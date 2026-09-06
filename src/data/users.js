/* ============ 元氣滿滿 · 用户数据层（本地存储） ============
 * 纯前端演示实现：用户数据存于 localStorage，会话存于 sessionStorage。
 * 密码仅存哈希值（djb2 简易散列），不做真实服务端安全保证。
 */

import { planByKey, FEATURE_COSTS, nextResetAt } from '../engine/membership.js'

const USERS_KEY = 'sanmen-users'
const SESSION_KEY = 'sanmen-session'
const MONTH_MS = 30 * 86400000

/* 会员档位（定义见 src/engine/membership.js，此处 re-export 保持向后兼容） */
export { PLANS } from '../engine/membership.js'

export const AVATARS = ['🐻', '🌸', '🌟', '🦋', '🍑', '🌙', '🪷', '☁️', '🍀', '🦊']

/* ---- 口令散列 ----
 *
 * ⚠ 旧实现是 djb2：32 位、无盐、纯整数运算。整个口令空间可以在浏览器里几秒钟枚举完，
 * 而用户在别处大概率复用同一个口令 —— 泄漏的不只是这个演示站的账号。
 * 现改为 Web Crypto 的 PBKDF2-SHA256 + 每用户随机盐 + 20 万轮。
 *
 * 兼容：库里已有的 djb2 散列（'u' 开头、无 '$' 分隔）仍可验证通过，并在下一次
 * 成功登录/改密时自动升级为新格式，老用户不会被锁在门外。
 *
 * 注意：这仍是浏览器本地存储的演示实现 —— 能读到 localStorage 的人可以直接改
 * plan 字段，散列强度保护的是「用户的口令本身」，不是这个站的权限体系。
 * 权限的正解是服务端账号 + JWT（见 docs/Agent记忆与账号服务端隔离R2改造方案.md）。
 */
const PBKDF2_ITERATIONS = 200000
const LEGACY_PREFIX = 'u'

function legacyHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return LEGACY_PREFIX + (h >>> 0).toString(36)
}

function isLegacyHash(stored) {
  return typeof stored === 'string' && !stored.includes('$')
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

function subtle() {
  const c = globalThis.crypto
  return c && c.subtle ? c.subtle : null
}

/** 生成 `pbkdf2$<迭代轮数>$<盐hex>$<摘要hex>`；无 Web Crypto 时退回旧算法。 */
async function hashPassword(password, saltHex) {
  const sub = subtle()
  if (!sub) return legacyHash(password)
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)))
    : globalThis.crypto.getRandomValues(new Uint8Array(16))
  const key = await sub.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await sub.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(bits)}`
}

/** 校验口令。返回 { ok, upgrade } —— upgrade 为新格式散列时，调用方应写回。 */
async function verifyPassword(password, stored) {
  if (!stored) return { ok: false, upgrade: null }
  if (isLegacyHash(stored)) {
    if (legacyHash(password) !== stored) return { ok: false, upgrade: null }
    // 旧散列验证通过 → 顺手升级成 PBKDF2
    return { ok: true, upgrade: await hashPassword(password) }
  }
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return { ok: false, upgrade: null }
  const again = await hashPassword(password, parts[2])
  return { ok: again === stored, upgrade: null }
}

/**
 * 用户 id：必须唯一且不可枚举。
 *
 * ⚠ 原实现是 `'u' + Date.now().toString(36)` —— 同一毫秒内注册的账号会拿到
 * 完全相同的 id。实测连续注册 5 个账号得到的是同一个 id，它们于是共用同一份
 * userScope 命名空间（会话/记忆/收藏全部串在一起），也共用服务端的 X-Genki-Uid。
 * 而且时间戳本身单调可猜，配合 /api/agent/* 的头部鉴别就是可枚举的用户身份。
 * 改为「时间戳 + 高熵随机后缀」：既保证单调有序便于排查，也不可预测、不会碰撞。
 */
function randomSuffix(len = 12) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const g = globalThis.crypto
  if (g && typeof g.getRandomValues === 'function') {
    const buf = new Uint8Array(len)
    g.getRandomValues(buf)
    return Array.from(buf, b => alphabet[b % alphabet.length]).join('')
  }
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function newUserId(prefix = 'u') {
  return prefix + Date.now().toString(36) + randomSuffix()
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch { /* ignore */ }
}

/**
 * 对外暴露的用户对象：剔除 password，其余业务字段必须原样带出。
 *
 * ⚠ 这里此前漏掉了 creditsUsed / planCreditsResetAt / planExpiresAt 三个字段，
 * 而它们正是积分体系的全部状态。后果是连锁的：
 *   · getMonthlyCredits(user) 里 `user.creditsUsed || 0` 恒为 0 → 顶栏与个人中心
 *     的积分余额永远显示满额，扣了分也看不出来；
 *   · BaziPage / ZiweiPage 的「已扣过就别再扣」守卫写作 `(user.creditsUsed || 0) > 0`，
 *     恒为假 → 每次进页面重复扣 8 分；
 *   · 个人中心的「到期时间」永远显示「—」。
 * 只要这里补齐，上述几处不用各自打补丁就一起好了。
 */
function publicUser(u) {
  return {
    id: u.id,
    nickname: u.nickname,
    account: u.account,
    avatar: u.avatar,
    plan: u.plan || 'earth',
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    creditsUsed: u.creditsUsed || 0,
    planCreditsResetAt: u.planCreditsResetAt || 0,
    planExpiresAt: u.planExpiresAt || 0,
  }
}

/* ---- 会话 ---- */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const sid = JSON.parse(raw)
    const user = read(USERS_KEY, []).find(u => u.id === sid)
    return user ? publicUser(user) : null
  } catch {
    return null
  }
}

function setSession(user) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user.id))
  } catch { /* ignore */ }
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}

/* ---- 注册 ---- */
export async function register({ nickname, account, password }) {
  nickname = (nickname || '').trim()
  account = (account || '').trim()
  if (nickname.length < 2) return { ok: false, msg: '昵称至少 2 个字符' }
  if (nickname.length > 16) return { ok: false, msg: '昵称最多 16 个字符' }
  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(account)) {
    return { ok: false, msg: '账号需为 3-24 位字母、数字或 . _ -' }
  }
  if (password.length < 6) return { ok: false, msg: '密码至少 6 位' }

  const users = read(USERS_KEY, [])
  if (users.some(u => u.account === account)) {
    return { ok: false, msg: '该账号已被注册，换一个试试' }
  }

  const now = Date.now()
  const user = {
    id: newUserId('u'),
    nickname,
    account,
    password: await hashPassword(password),
    avatar: AVATARS[now % AVATARS.length],
    plan: 'earth',
    creditsUsed: 0,
    planCreditsResetAt: nextResetAt(now),
    planExpiresAt: nextResetAt(now),
    createdAt: now,
    lastLoginAt: now
  }
  users.push(user)
  write(USERS_KEY, users)
  setSession(user)
  return { ok: true, user: publicUser(user) }
}

/* ---- 微信扫码注册（降级/授权后本地建号） ---- */
export function registerByWechat(openid, nickname = '微信用户') {
  openid = (openid || '').trim()
  if (!openid) return { ok: false, msg: '未获取到微信标识' }
  const users = read(USERS_KEY, [])
  const existing = users.find(u => u.wechatOpenid === openid || u.account === openid)
  if (existing) {
    existing.lastLoginAt = Date.now()
    ensureMonthlyReset(existing)
    write(USERS_KEY, users)
    setSession(existing)
    return { ok: true, user: publicUser(existing), fresh: false }
  }
  const now = Date.now()
  const user = {
    id: newUserId('w'),
    nickname,
    account: openid,
    wechatOpenid: openid,
    avatar: AVATARS[now % AVATARS.length],
    plan: 'earth',
    creditsUsed: 0,
    planCreditsResetAt: nextResetAt(now),
    planExpiresAt: nextResetAt(now),
    createdAt: now,
    lastLoginAt: now
  }
  users.push(user)
  write(USERS_KEY, users)
  setSession(user)
  return { ok: true, user: publicUser(user), fresh: true }
}

/* ---- 月度重置（30 天积分额度清零 · 平滑续期） ----
 * 若 planCreditsResetAt 已过期：creditsUsed 归零，并把窗口顺延 30 天
 * 不会改变 plan 档位；会员过期由 planExpiresAt 字段承担（演示项目当前不做强制降级）
 */
function ensureMonthlyReset(user) {
  const now = Date.now()
  if ((user.planCreditsResetAt || 0) <= now) {
    user.creditsUsed = 0
    user.planCreditsResetAt = now + MONTH_MS
  }
}

/* ---- 登录 ---- */
export async function login(account, password) {
  account = (account || '').trim()
  if (!account || !password) return { ok: false, msg: '请输入账号和密码' }
  const users = read(USERS_KEY, [])
  const user = users.find(u => u.account === account)
  // 账号不存在时也走一遍散列，避免用响应快慢区分「账号是否存在」
  const { ok, upgrade } = await verifyPassword(password, user ? user.password : 'pbkdf2$1$00$00')
  if (!user || !ok) {
    return { ok: false, msg: '账号或密码不正确' }
  }
  if (upgrade) user.password = upgrade
  user.lastLoginAt = Date.now()
  ensureMonthlyReset(user)
  write(USERS_KEY, users)
  setSession(user)
  return { ok: true, user: publicUser(user) }
}

/* ---- 应用层月度重置（页面挂载时调用，保证顶栏/Profile 实时） ---- */
export function syncMonthlyReset(id) {
  const users = read(USERS_KEY, [])
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return null
  const user = users[idx]
  ensureMonthlyReset(user)
  write(USERS_KEY, users)
  setSession(user)
  return publicUser(user)
}

/* ---- 资料与安全 ---- */
export function updateProfile(id, patch) {
  const users = read(USERS_KEY, [])
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return { ok: false, msg: '用户不存在' }
  const user = users[idx]
  if (patch.nickname !== undefined) {
    const nickname = (patch.nickname || '').trim()
    if (nickname.length < 2) return { ok: false, msg: '昵称至少 2 个字符' }
    if (nickname.length > 16) return { ok: false, msg: '昵称最多 16 个字符' }
    user.nickname = nickname
  }
  if (patch.avatar !== undefined) user.avatar = patch.avatar
  if (patch.plan !== undefined) user.plan = patch.plan
  write(USERS_KEY, users)
  setSession(user)
  return { ok: true, user: publicUser(user) }
}

/* ---- 切换会员档位（升级 / 降级 / 续费） ----
 * 切档时清零积分用量、刷新月度窗口；到期时间统一延长 30 天
 */
export function changePlan(id, newKey) {
  const users = read(USERS_KEY, [])
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return { ok: false, msg: '用户不存在' }
  const plan = planByKey(newKey)
  if (!plan) return { ok: false, msg: '档位不存在' }
  const user = users[idx]
  const now = Date.now()
  const samePlan = user.plan === plan.key
  user.plan = plan.key
  user.creditsUsed = 0
  user.planCreditsResetAt = nextResetAt(now)
  // 续费（档位不变）应当在原到期时间之上顺延，否则提前续费等于把剩余天数白送掉。
  // 换档则从当下重新起算 30 天。
  const base = samePlan ? Math.max(now, user.planExpiresAt || 0) : now
  user.planExpiresAt = nextResetAt(base)
  write(USERS_KEY, users)
  setSession(user)
  return { ok: true, user: publicUser(user), plan, renewed: samePlan }
}

/* ---- 扣减积分（用于八字命书 / 紫微 / 塔罗 / 奇门 / 元气 AI 等消耗项） ----
 * 自动先做月度重置；余额不足返回 { ok:false, reason:'insufficient' }
 */
export function consumeCredit(id, featureKey) {
  const cost = FEATURE_COSTS[featureKey]
  if (cost == null) return { ok: true, cost: 0 } // 未列入积分 = 免费
  const users = read(USERS_KEY, [])
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return { ok: false, reason: 'no_user' }
  const user = users[idx]
  ensureMonthlyReset(user)
  const plan = planByKey(user.plan)
  const used = user.creditsUsed || 0
  const available = plan.credits - used
  if (available < cost) {
    return { ok: false, reason: 'insufficient', cost, available }
  }
  user.creditsUsed = used + cost
  write(USERS_KEY, users)
  setSession(user)
  return { ok: true, user: publicUser(user), cost, remaining: plan.credits - user.creditsUsed }
}

export async function changePassword(id, oldPwd, newPwd) {
  const users = read(USERS_KEY, [])
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return { ok: false, msg: '用户不存在' }
  const user = users[idx]
  const { ok } = await verifyPassword(oldPwd, user.password)
  if (!ok) return { ok: false, msg: '当前密码不正确' }
  if (!newPwd || newPwd.length < 6) return { ok: false, msg: '新密码至少 6 位' }
  user.password = await hashPassword(newPwd)
  write(USERS_KEY, users)
  return { ok: true, msg: '密码已更新' }
}

/* ---- 统计（供管理面板参考） ---- */
export function countUsers() {
  return read(USERS_KEY, []).length
}
