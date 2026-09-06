// 服务端账号库（R2 M1）。
//
// 在此之前，账号、会员档位、积分余额全都存在浏览器 localStorage 里：
// 打开控制台改一行 `plan: 'oracle'` 就能白嫖天机境，改 `creditsUsed: 0` 就能
// 无限用 AI。前端的散列强度只保护「用户的口令」，保护不了这个站的权限体系。
// 权限的正解是：身份由服务端签发的 token 决定，额度由服务端扣减。
//
// 存储沿用 store.js 的 JSON 文件模式（原子写 + 损坏另存），便于将来平滑换 SQLite。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { config } from './config.js'
import { planByKey, FEATURE_COSTS, nextResetAt, FREE_PLAN, isPlanExpired } from '../src/engine/membership.js'

const scrypt = promisify(crypto.scrypt)

const MONTH_MS = 30 * 86400000

/* ---- 口令散列：scrypt ----
 * 参数取 Node 默认档（N=16384, r=8, p=1），单次约 50~100ms，足以让离线爆破不划算，
 * 又不至于让登录接口变成自我 DoS。格式里带上参数，将来调参不影响老口令验证。
 */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }

async function hashPassword(password, saltHex, params = SCRYPT) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16)
  const buf = await scrypt(String(password), salt, params.keylen, {
    N: params.N, r: params.r, p: params.p,
    // scrypt 的默认 maxmem 是 32MB，N=16384/r=8 刚好贴着上限，换算下来 128*N*r ≈ 16MB，
    // 留一倍余量免得在别的参数下报 ERR_CRYPTO_INVALID_SCRYPT_PARAMS。
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('hex')}$${buf.toString('hex')}`
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, saltHex, hashHex] = parts
  let again
  try {
    again = await hashPassword(password, saltHex, {
      N: Number(N), r: Number(r), p: Number(p), keylen: hashHex.length / 2,
    })
  } catch { return false }
  const a = Buffer.from(again.split('$')[5], 'hex')
  const b = Buffer.from(hashHex, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** 账号 id：时间戳保证有序便于排查，随机后缀保证不可预测、不碰撞。 */
function newId(prefix = 'u') {
  return prefix + Date.now().toString(36) + crypto.randomBytes(8).toString('hex')
}

const EMPTY_DB = () => ({ users: [] })

export function createAccountStore(file) {
  let cache = null

  function ensureDir() {
    fs.mkdirSync(path.dirname(file), { recursive: true })
  }

  function load() {
    if (cache) return cache
    ensureDir()
    let raw = null
    try {
      if (!fs.existsSync(file)) { cache = EMPTY_DB(); return cache }
      raw = fs.readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw)
      cache = { ...EMPTY_DB(), ...parsed }
      if (!Array.isArray(cache.users)) cache.users = []
    } catch (e) {
      // 账号库解析失败绝不能当空库继续跑：那样下一次 save 就把所有人的账号抹了。
      // 先另存损坏文件留证，再以空库启动（此时新注册仍可用，老账号可人工恢复）。
      if (raw != null) {
        const bak = `${file}.corrupt-${Date.now()}`
        try { fs.writeFileSync(bak, raw); console.error(`[accounts] 账号库解析失败，已备份到 ${bak}：${e.message}`) }
        catch (e2) { console.error(`[accounts] 账号库解析失败且备份也失败：${e.message} / ${e2.message}`) }
      }
      cache = EMPTY_DB()
    }
    return cache
  }

  function save() {
    ensureDir()
    const tmp = `${file}.tmp-${process.pid}`
    try {
      // 账号库含口令散列，别给同机其他用户读。
      fs.writeFileSync(tmp, JSON.stringify(load(), null, 2), { mode: 0o600 })
      fs.renameSync(tmp, file)
    } catch (e) {
      try { fs.rmSync(tmp, { force: true }) } catch { /* ignore */ }
      throw e
    }
  }

  /* ---- 状态推进：月度重置 + 到期降级 ----
   * 每次读取账号都先跑一遍，保证任何入口拿到的都是「当下」的状态，
   * 不依赖某个定时任务恰好跑过。
   */
  function refresh(u, now = Date.now()) {
    let changed = false
    // 到期降级：付费档过期后落到 free 档。之前 planExpiresAt 写了但没人读，
    // 于是会员「永不过期」——买一次天机境用到天荒地老。
    if (isPlanExpired(u, now)) {
      u.plan = FREE_PLAN.key
      u.planExpiresAt = 0
      u.creditsUsed = 0
      u.planCreditsResetAt = now + MONTH_MS
      changed = true
    }
    if ((u.planCreditsResetAt || 0) <= now) {
      u.creditsUsed = 0
      u.planCreditsResetAt = now + MONTH_MS
      changed = true
    }
    return changed
  }

  function publicUser(u) {
    if (!u) return null
    return {
      id: u.id,
      nickname: u.nickname,
      account: u.account,
      avatar: u.avatar,
      plan: u.plan || FREE_PLAN.key,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      creditsUsed: u.creditsUsed || 0,
      planCreditsResetAt: u.planCreditsResetAt || 0,
      planExpiresAt: u.planExpiresAt || 0,
      wechatBound: Boolean(u.wechatOpenid),
    }
  }

  function findRaw(id) {
    return load().users.find(u => u.id === id) || null
  }

  /** 按 id 取用户（顺带推进状态并落盘） */
  function get(id) {
    const u = findRaw(id)
    if (!u) return null
    if (refresh(u)) save()
    return u
  }

  function byAccount(account) {
    const key = String(account || '').trim().toLowerCase()
    if (!key) return null
    // 账号大小写不敏感：否则 Alice 和 alice 会是两个账号，而用户以为是同一个。
    return load().users.find(u => String(u.account || '').toLowerCase() === key) || null
  }

  function byOpenid(openid) {
    const key = String(openid || '').trim()
    if (!key) return null
    return load().users.find(u => u.wechatOpenid === key) || null
  }

  const AVATARS = ['🐻', '🌸', '🌟', '🦋', '🍑', '🌙', '🪷', '☁️', '🍀', '🦊']

  async function create({ account, password, nickname, avatar, wechatOpenid, plan = 'earth' }) {
    const db = load()
    const now = Date.now()
    const u = {
      id: newId(wechatOpenid ? 'w' : 'u'),
      account: String(account).trim(),
      nickname: String(nickname).trim(),
      avatar: avatar || AVATARS[now % AVATARS.length],
      passHash: password ? await hashPassword(password) : null,
      wechatOpenid: wechatOpenid || null,
      plan,
      creditsUsed: 0,
      planCreditsResetAt: nextResetAt(now),
      // free 档不设到期；付费档给 30 天（沿用原注册即送 earth 的口径）
      planExpiresAt: plan === FREE_PLAN.key ? 0 : nextResetAt(now),
      createdAt: now,
      lastLoginAt: now,
    }
    db.users.push(u)
    save()
    return u
  }

  async function checkPassword(u, password) {
    if (!u || !u.passHash) return false
    return verifyPassword(password, u.passHash)
  }

  /** 供「账号不存在」时也走一遍散列，避免用响应快慢探测账号是否存在 */
  async function dummyPasswordCheck(password) {
    await hashPassword(String(password || ''))
    return false
  }

  function touchLogin(u) {
    u.lastLoginAt = Date.now()
    refresh(u)
    save()
  }

  function update(id, patch) {
    const u = get(id)
    if (!u) return { ok: false, msg: '用户不存在' }
    if (patch.nickname !== undefined) {
      const nickname = String(patch.nickname || '').trim()
      if (nickname.length < 2) return { ok: false, msg: '昵称至少 2 个字符' }
      if (nickname.length > 16) return { ok: false, msg: '昵称最多 16 个字符' }
      u.nickname = nickname
    }
    if (patch.avatar !== undefined) {
      // 头像只能从白名单里选。这里此前是任意字符串直存 —— 前端会把它原样渲染，
      // 长度也没有上限，等于给了一个「往别人看得到的地方塞任意内容」的口子。
      if (!AVATARS.includes(patch.avatar)) return { ok: false, msg: '头像不在可选范围内' }
      u.avatar = patch.avatar
    }
    save()
    return { ok: true, user: publicUser(u) }
  }

  async function setPassword(id, oldPwd, newPwd) {
    const u = get(id)
    if (!u) return { ok: false, msg: '用户不存在' }
    // 微信注册的账号没有口令，首次设置时不要求旧口令
    if (u.passHash && !(await checkPassword(u, oldPwd))) return { ok: false, msg: '当前密码不正确' }
    if (!newPwd || String(newPwd).length < 6) return { ok: false, msg: '新密码至少 6 位' }
    u.passHash = await hashPassword(newPwd)
    save()
    return { ok: true, msg: '密码已更新' }
  }

  function changePlan(id, newKey) {
    const u = get(id)
    if (!u) return { ok: false, msg: '用户不存在' }
    // free 是过期落点，不是商品，不能通过购买接口切进去
    if (newKey === FREE_PLAN.key) return { ok: false, msg: '档位不存在' }
    const plan = planByKey(newKey)
    if (!plan || plan.key !== newKey) return { ok: false, msg: '档位不存在' }
    const now = Date.now()
    const samePlan = u.plan === plan.key
    u.plan = plan.key
    u.creditsUsed = 0
    u.planCreditsResetAt = nextResetAt(now)
    // 续费在原到期时间上顺延，否则提前续费等于白送掉剩余天数；换档从当下重新起算。
    u.planExpiresAt = nextResetAt(samePlan ? Math.max(now, u.planExpiresAt || 0) : now)
    save()
    return { ok: true, user: publicUser(u), plan, renewed: samePlan }
  }

  /** 扣积分。额度与扣减都在服务端，客户端改不动。 */
  function consumeCredit(id, featureKey) {
    const cost = FEATURE_COSTS[featureKey]
    if (cost == null) return { ok: true, cost: 0 } // 未列入积分表 = 免费
    const u = get(id)
    if (!u) return { ok: false, reason: 'no_user' }
    const plan = planByKey(u.plan)
    const used = u.creditsUsed || 0
    const available = plan.credits - used
    if (available < cost) return { ok: false, reason: 'insufficient', cost, available }
    u.creditsUsed = used + cost
    save()
    return { ok: true, user: publicUser(u), cost, remaining: plan.credits - u.creditsUsed }
  }

  /** 退还积分。用于「扣了钱但这一轮什么都没产出」（模型立刻报错等）。 */
  function refundCredit(id, featureKey) {
    const cost = FEATURE_COSTS[featureKey]
    if (cost == null) return { ok: true, cost: 0 }
    const u = get(id)
    if (!u) return { ok: false, reason: 'no_user' }
    // 不能退成负数：月度重置可能刚好发生在扣减与退还之间，那时 creditsUsed 已归零，
    // 再减一次就等于凭空发钱。
    u.creditsUsed = Math.max(0, (u.creditsUsed || 0) - cost)
    save()
    return { ok: true, user: publicUser(u), cost }
  }

  /** 注销账号。隐私合规要求连坐清除，调用方负责清各自集合里的数据。 */
  function remove(id) {
    const db = load()
    const i = db.users.findIndex(u => u.id === id)
    if (i < 0) return false
    db.users.splice(i, 1)
    save()
    return true
  }

  return {
    get, byAccount, byOpenid, create, checkPassword, dummyPasswordCheck,
    touchLogin, update, setPassword, changePlan, consumeCredit, refundCredit, remove,
    publicUser, refresh,
    count: () => load().users.length,
    list: () => load().users.map(publicUser),
    AVATARS,
    // 测试用：丢掉内存缓存，强制重读文件
    _reset: () => { cache = null },
  }
}

let shared = null
/** 进程级单例。测试可传 file 用临时目录，生产走 config.auth.accountsFile。 */
export function sharedAccounts(file) {
  if (!shared) shared = createAccountStore(file || config.auth.accountsFile)
  return shared
}

export { hashPassword, verifyPassword, newId }
