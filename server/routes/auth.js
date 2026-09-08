// /api/auth/*：服务端账号与鉴权（R2 M1）。
//
// 在此之前身份只有一个 `X-Genki-Uid` 请求头，随手改一改就能读写别人的会话；
// 会员档位和积分余额存在 localStorage，改一行就能白嫖。这里把身份换成服务端
// 签发的 JWT，把额度换成服务端扣减。
import { Router } from 'express'
import crypto from 'node:crypto'
import { config, resolveJwtSecret, smsConfigured, wechatConfigured } from '../config.js'
import { sharedAccounts } from '../accounts.js'
import { signJwt, verifyJwt } from '../jwt.js'
import { exchangeCode } from '../wechat.js'
import { createWindowLimiter } from '../rateLimit.js'
import { sendVerifySms } from '../sms.js'

async function verifyRegistrationCaptcha(req) {
  if (!config.security.captchaRequired) return { ok: true }
  const token = String(req.body?.captchaToken || '').trim()
  if (!token) return { ok: false, status: 400, msg: '请先完成人机验证' }
  if (!config.security.captchaSecret) {
    // 生产环境宁可暂时关闭注册，也不能因为忘配密钥而把防刷形同虚设。
    return { ok: false, status: 503, msg: '注册验证暂不可用，请稍后再试' }
  }
  try {
    const body = new URLSearchParams({
      secret: config.security.captchaSecret,
      response: token,
      remoteip: String(req.ip || ''),
    })
    const response = await fetch(config.security.captchaVerifyUrl, { method: 'POST', body, signal: AbortSignal.timeout(5000) })
    const result = await response.json().catch(() => null)
    return result?.success ? { ok: true } : { ok: false, status: 400, msg: '人机验证未通过，请重试' }
  } catch (error) {
    console.error('[auth/register] 人机验证服务不可用：', error.message)
    return { ok: false, status: 503, msg: '注册验证暂不可用，请稍后再试' }
  }
}

const ACCOUNT_RE = /^[a-zA-Z0-9._-]{3,24}$/
const PHONE_RE = /^1\d{10}$/
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
    if (!accounts.isActive(user)) return res.status(403).json({ ok: false, msg: '该账号已被限制，请联系管理员' })
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
  const registerLimiter = createWindowLimiter({
    windowMs: config.auth.registerWindowMin * 60000,
    max: config.auth.registerMaxAttempts,
  })
  const sensitiveLimiter = createWindowLimiter({ windowMs: 15 * 60000, max: 8 })
  const smsSendLimiter = createWindowLimiter({ windowMs: 60 * 60000, max: config.security.smsIpPerHour })
  const smsVerifyLimiter = createWindowLimiter({ windowMs: 60 * 60000, max: config.security.smsVerifyIpPerHour })
  const smsCodes = new Map()
  const ttlSec = config.auth.tokenTtlDays * 86400

  function smsKey(phone, purpose) { return `${phone}:${purpose}` }
  function clearExpiredSmsCodes() {
    const expiresAt = Date.now() - config.sms.codeTtlMin * 60 * 1000
    for (const [key, value] of smsCodes) if (value.createdAt < expiresAt || value.used) smsCodes.delete(key)
  }
  function verifySmsCode(phone, purpose, code) {
    clearExpiredSmsCodes()
    const entry = smsCodes.get(smsKey(phone, purpose))
    if (!entry) return { ok: false, msg: '请先获取验证码或验证码已过期' }
    if (entry.attempts >= 5) {
      smsCodes.delete(smsKey(phone, purpose))
      return { ok: false, msg: '验证码错误次数过多，请重新获取' }
    }
    if (entry.code !== code) {
      entry.attempts += 1
      return { ok: false, msg: '验证码不正确' }
    }
    entry.used = true
    smsCodes.delete(smsKey(phone, purpose))
    return { ok: true }
  }

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
    // 注册成功也计入窗口，避免脚本用大量不同账号绕开“仅失败计数”的登录限流。
    const registration = registerLimiter.take(`ip:${req.ip}`)
    if (!registration.ok) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((registration.resetAt - Date.now()) / 1000)))
      return res.status(429).json({ ok: false, msg: '注册过于频繁，请稍后再试' })
    }
    if (nickname.length < 2) return res.status(400).json({ ok: false, msg: '昵称至少 2 个字符' })
    if (nickname.length > 16) return res.status(400).json({ ok: false, msg: '昵称最多 16 个字符' })
    if (!ACCOUNT_RE.test(account)) return res.status(400).json({ ok: false, msg: '账号需为 3-24 位字母、数字或 . _ -' })
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ ok: false, msg: '密码至少 8 位，且须同时含字母和数字' })
    }
    if (password.length > MAX_PWD) return res.status(400).json({ ok: false, msg: '密码过长' })

    const captcha = await verifyRegistrationCaptcha(req)
    if (!captcha.ok) return res.status(captcha.status).json({ ok: false, msg: captcha.msg })

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
    if (!accounts.isActive(user)) return res.status(403).json({ ok: false, msg: '该账号已被限制，请联系管理员' })
    limiter.clear(keys)
    accounts.touchLogin(user)
    ok(res, user)
  })

  // 短信凭证只服务登录与注册，和黄历订阅验证码隔离，不能相互替代。
  r.post('/auth/sms/send-code', async (req, res) => {
    const purpose = String(req.body?.purpose || '')
    const phone = String(req.body?.phone || '').trim()
    if (!['login', 'register'].includes(purpose)) return res.status(400).json({ ok: false, msg: '验证码用途无效' })
    if (!PHONE_RE.test(phone)) return res.status(400).json({ ok: false, msg: '请输入正确的 11 位手机号' })
    if (!smsConfigured() && !config.allowMockChannels) return res.status(503).json({ ok: false, msg: '短信登录暂未开放' })
    const attempt = smsSendLimiter.take(`sms:${req.ip}`)
    if (!attempt.ok) return res.status(429).json({ ok: false, msg: '该网络请求验证码过于频繁，请稍后再试' })
    clearExpiredSmsCodes()
    const key = smsKey(phone, purpose)
    const previous = smsCodes.get(key)
    if (previous && Date.now() - previous.createdAt < config.sms.sendCooldownSec * 1000) {
      const wait = Math.ceil((config.sms.sendCooldownSec * 1000 - (Date.now() - previous.createdAt)) / 1000)
      return res.status(429).json({ ok: false, msg: `发送过于频繁，请 ${wait} 秒后再试`, wait })
    }
    const code = String(crypto.randomInt(100000, 1000000))
    smsCodes.set(key, { code, createdAt: Date.now(), attempts: 0, used: false })
    try {
      await sendVerifySms(phone, code)
    } catch (error) {
      smsCodes.delete(key)
      console.error('[auth/sms/send-code] 发送失败', error.message)
      return res.status(502).json({ ok: false, msg: '验证码发送失败，请稍后再试' })
    }
    res.json({ ok: true, msg: '验证码已发送', devCode: smsConfigured() || !config.allowMockChannels ? undefined : code })
  })

  r.post('/auth/sms/register', async (req, res) => {
    const phone = String(req.body?.phone || '').trim()
    const code = String(req.body?.code || '').trim()
    if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, msg: '请输入手机号和 6 位验证码' })
    const registration = registerLimiter.take(`sms-register:${req.ip}`)
    if (!registration.ok) return res.status(429).json({ ok: false, msg: '注册过于频繁，请稍后再试' })
    const verified = verifySmsCode(phone, 'register', code)
    if (!verified.ok) return res.status(400).json({ ok: false, msg: verified.msg })
    if (accounts.byAccount(phone)) return res.status(409).json({ ok: false, msg: '该手机号已注册，请直接登录' })
    const nickname = String(req.body?.nickname || '手机用户').trim().slice(0, 16) || '手机用户'
    const user = await accounts.create({ account: phone, nickname })
    ok(res, user)
  })

  r.post('/auth/sms/login', async (req, res) => {
    const phone = String(req.body?.phone || '').trim()
    const code = String(req.body?.code || '').trim()
    if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, msg: '请输入手机号和 6 位验证码' })
    const attempt = smsVerifyLimiter.take(`sms-login:${req.ip}`)
    if (!attempt.ok) return res.status(429).json({ ok: false, msg: '验证码校验过于频繁，请稍后再试' })
    const verified = verifySmsCode(phone, 'login', code)
    if (!verified.ok) return res.status(400).json({ ok: false, msg: verified.msg })
    const user = accounts.byAccount(phone)
    if (!user) return res.status(404).json({ ok: false, msg: '该手机号尚未注册' })
    if (!accounts.isActive(user)) return res.status(403).json({ ok: false, msg: '该账号已被限制，请联系管理员' })
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
    const attempt = sensitiveLimiter.take(`password:${req.uid}|${req.ip}`)
    if (!attempt.ok) return res.status(429).json({ ok: false, msg: '密码修改过于频繁，请稍后再试' })
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
    if (!config.security.allowUnpaidPlanChanges) {
      return res.status(409).json({ ok: false, msg: '在线支付尚未开放，暂不能自助开通或续费会员' })
    }
    const attempt = sensitiveLimiter.take(`plan:${req.uid}|${req.ip}`)
    if (!attempt.ok) return res.status(429).json({ ok: false, msg: '订阅操作过于频繁，请稍后再试' })
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
