// /api/auth/*：服务端账号与鉴权（R2 M1）。
//
// 在此之前身份只有一个 `X-Genki-Uid` 请求头，随手改一改就能读写别人的会话；
// 会员档位和积分余额存在 localStorage，改一行就能白嫖。这里把身份换成服务端
// 签发的 JWT，把额度换成服务端扣减。
import { Router } from 'express'
import { config, resolveJwtSecret, wechatConfigured } from '../config.js'
import { sharedAccounts } from '../accounts.js'
import { signJwt, verifyJwt } from '../jwt.js'
import { exchangeCode } from '../wechat.js'

const ACCOUNT_RE = /^[a-zA-Z0-9._-]{3,24}$/
const MAX_PWD = 128 // scrypt 对超长输入照算不误，但没必要给人塞 1MB 口令的机会

/* ---- 登录/注册限流 ----
 * 只对**失败**计数：登录成功就清零，免得正常使用的人被自己的成功请求锁在门外。
 * 按「账号 + IP」分桶，两个维度都要看：只按 IP 会误伤同一出口的整个办公室，
 * 只按账号则换个账号名就能继续对同一 IP 猛刷。
 */
function createLimiter({ windowMs, max }) {
  const hits = new Map()
  return {
    check(keys) {
      const now = Date.now()
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k)
      return keys.some(k => {
        const h = hits.get(k)
        return h && h.resetAt >= now && h.count >= max
      })
    },
    fail(keys) {
      const now = Date.now()
      for (const k of keys) {
        const h = hits.get(k)
        if (!h || h.resetAt < now) hits.set(k, { count: 1, resetAt: now + windowMs })
        else h.count++
      }
    },
    clear(keys) { for (const k of keys) hits.delete(k) },
  }
}

/**
 * 从请求里解出身份。
 *
 * 三种结果：
 *   · 有效 Bearer token   → { uid: <账号 id>, authed: true }
 *   · anon:* 的游客标识    → { uid: 'anon:xxx', authed: false }
 *   · 其他                → null
 *
 * 关键点：**不再接受自报的账号 uid**。以前 `X-Genki-Uid: u123` 就能冒充 u123，
 * 现在冒充一个账号必须拿得出该账号的签名 token。游客标识仍然是自报的，
 * 但游客名下本来就没有值钱的东西，且 claim 接口只接受 anon:* 作为来源。
 */
export function identify(req) {
  const auth = String(req.get('authorization') || '')
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (m) {
    const payload = verifyJwt(m[1].trim(), resolveJwtSecret())
    if (payload && payload.sub) return { uid: String(payload.sub), authed: true, token: payload }
    return null // token 给了但不合法 → 明确失败，不要悄悄降级成游客
  }
  const guest = String(req.get('x-genki-uid') || '').trim()
  if (guest.startsWith('anon:') && guest.length <= 80) return { uid: guest, authed: false }
  return null
}

/** Express 中间件：必须是已登录账号 */
export function requireAuth(accounts) {
  return (req, res, next) => {
    const id = identify(req)
    if (!id || !id.authed) return res.status(401).json({ ok: false, msg: '请先登录' })
    const user = accounts.get(id.uid)
    if (!user) return res.status(401).json({ ok: false, msg: '登录已失效，请重新登录' })
    req.uid = user.id
    req.account = user
    next()
  }
}

export function createAuthRouter({ accounts = sharedAccounts(), onRemoveUser = null } = {}) {
  const r = Router()
  const limiter = createLimiter({
    windowMs: config.auth.loginWindowMin * 60000,
    max: config.auth.loginMaxAttempts,
  })
  const ttlSec = config.auth.tokenTtlDays * 86400

  function issue(user) {
    return signJwt({ sub: user.id }, resolveJwtSecret(), { expiresInSec: ttlSec })
  }

  function ok(res, user) {
    res.json({ ok: true, token: issue(user), user: accounts.publicUser(user), expiresIn: ttlSec })
  }

  r.post('/auth/register', async (req, res) => {
    const nickname = String(req.body?.nickname || '').trim()
    const account = String(req.body?.account || '').trim()
    const password = String(req.body?.password || '')
    if (nickname.length < 2) return res.status(400).json({ ok: false, msg: '昵称至少 2 个字符' })
    if (nickname.length > 16) return res.status(400).json({ ok: false, msg: '昵称最多 16 个字符' })
    if (!ACCOUNT_RE.test(account)) return res.status(400).json({ ok: false, msg: '账号需为 3-24 位字母、数字或 . _ -' })
    if (password.length < 6) return res.status(400).json({ ok: false, msg: '密码至少 6 位' })
    if (password.length > MAX_PWD) return res.status(400).json({ ok: false, msg: '密码过长' })

    const keys = [`ip:${req.ip}`]
    if (limiter.check(keys)) return res.status(429).json({ ok: false, msg: '操作过于频繁，请稍后再试' })

    if (accounts.byAccount(account)) {
      limiter.fail(keys) // 注册重名也计数：否则这个接口就是个免费的「账号是否存在」枚举器
      return res.status(409).json({ ok: false, msg: '该账号已被注册，换一个试试' })
    }
    const user = await accounts.create({ account, password, nickname })
    ok(res, user)
  })

  r.post('/auth/login', async (req, res) => {
    const account = String(req.body?.account || '').trim()
    const password = String(req.body?.password || '')
    if (!account || !password) return res.status(400).json({ ok: false, msg: '请输入账号和密码' })
    if (password.length > MAX_PWD) return res.status(400).json({ ok: false, msg: '账号或密码不正确' })

    const keys = [`ip:${req.ip}`, `acct:${account.toLowerCase()}`]
    if (limiter.check(keys)) {
      return res.status(429).json({ ok: false, msg: '尝试次数过多，请稍后再试' })
    }

    const user = accounts.byAccount(account)
    // 账号不存在时也跑一遍散列：否则「不存在」几毫秒返回、「密码错」要一百毫秒，
    // 用响应快慢就能把注册过的账号名枚举出来。
    const passed = user ? await accounts.checkPassword(user, password) : await accounts.dummyPasswordCheck(password)
    if (!user || !passed) {
      limiter.fail(keys)
      return res.status(401).json({ ok: false, msg: '账号或密码不正确' })
    }
    limiter.clear(keys)
    accounts.touchLogin(user)
    ok(res, user)
  })

  /* 微信登录。
   * 配了公众号/开放平台凭证时用 code 换 openid；未配凭证的本地降级模式下
   * 允许直接传 openid 建号 —— 但生产必须显式开 ALLOW_MOCK_CHANNELS，
   * 否则公网任何人传一个 openid 就能凭空建号甚至顶掉已有账号。
   */
  r.post('/auth/wechat', async (req, res) => {
    const keys = [`ip:${req.ip}`]
    if (limiter.check(keys)) return res.status(429).json({ ok: false, msg: '操作过于频繁，请稍后再试' })
    let openid = null
    const code = String(req.body?.code || '').trim()
    if (code && wechatConfigured()) {
      try {
        const info = await exchangeCode(code)
        openid = info && info.openid
      } catch (e) {
        console.error('[auth/wechat] code 换取失败', e)
        return res.status(502).json({ ok: false, msg: '微信授权失败，请重试' })
      }
    } else {
      if (!config.allowMockChannels) {
        return res.status(503).json({ ok: false, msg: '微信登录暂未开放' })
      }
      openid = String(req.body?.openid || '').trim()
    }
    if (!openid || openid.length > 64) {
      limiter.fail(keys)
      return res.status(400).json({ ok: false, msg: '未获取到微信标识' })
    }
    let user = accounts.byOpenid(openid)
    let fresh = false
    if (!user) {
      const nickname = String(req.body?.nickname || '微信用户').trim().slice(0, 16) || '微信用户'
      user = await accounts.create({ account: openid, nickname, wechatOpenid: openid })
      fresh = true
    } else {
      accounts.touchLogin(user)
    }
    res.json({ ok: true, token: issue(user), user: accounts.publicUser(user), expiresIn: ttlSec, fresh })
  })

  // 以下均需登录
  const auth = requireAuth(accounts)

  r.get('/auth/me', auth, (req, res) => {
    res.json({ ok: true, user: accounts.publicUser(req.account) })
  })

  r.put('/auth/me', auth, (req, res) => {
    // 注意：这里**不接受** plan / creditsUsed / planExpiresAt。
    // 会员档位只能走 /auth/plan（将来接支付），额度只能由服务端扣减，
    // 否则把它们放进可 PUT 的字段等于把「改本地存储就能越权」原样搬到服务端。
    const out = accounts.update(req.uid, {
      nickname: req.body?.nickname,
      avatar: req.body?.avatar,
    })
    res.status(out.ok ? 200 : 400).json(out)
  })

  r.patch('/auth/password', auth, async (req, res) => {
    const oldPwd = String(req.body?.oldPassword || '')
    const newPwd = String(req.body?.newPassword || '')
    if (newPwd.length > MAX_PWD) return res.status(400).json({ ok: false, msg: '密码过长' })
    const out = await accounts.setPassword(req.uid, oldPwd, newPwd)
    res.status(out.ok ? 200 : 400).json(out)
  })

  /* 切换会员档位。
   * ⚠ 目前**没有接支付**：这个接口等于「点一下就升级」，与改本地存储的差别只是
   * 记录在服务端。真实收费前必须在这里插入订单校验（下单 → 支付回调 → 再改档位）。
   * 之所以仍然搬到服务端：额度扣减要以服务端的 plan 为准，客户端不能再自称档位。
   */
  r.post('/auth/plan', auth, (req, res) => {
    const out = accounts.changePlan(req.uid, String(req.body?.plan || ''))
    res.status(out.ok ? 200 : 400).json(out)
  })

  /** 扣积分。前端在做需要消耗的操作前调用，扣不动就别做。 */
  r.post('/auth/credits/consume', auth, (req, res) => {
    const feature = String(req.body?.feature || '')
    const out = accounts.consumeCredit(req.uid, feature)
    if (!out.ok && out.reason === 'insufficient') return res.status(402).json(out)
    if (!out.ok) return res.status(400).json(out)
    res.json(out)
  })

  /** 注销账号。隐私合规要求连坐清除，关联数据由 onRemoveUser 负责（会话、消息等）。 */
  r.delete('/auth/me', auth, (req, res) => {
    const id = req.uid
    // 先清关联数据再删账号：反过来的话，中途失败会留下一份没有主人的孤儿数据，
    // 而且删不掉了（再没有任何 uid 能对上）。
    let purged = 0
    if (onRemoveUser) {
      try { purged = onRemoveUser(id) || 0 }
      catch (e) {
        console.error('[auth] 注销时清理关联数据失败', e)
        return res.status(500).json({ ok: false, msg: '注销失败，请稍后重试' })
      }
    }
    const removed = accounts.remove(id)
    res.json({ ok: removed, purged })
  })

  return r
}

export default createAuthRouter
