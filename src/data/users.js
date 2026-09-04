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

/* ---- 工具 ---- */
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return 'u' + (h >>> 0).toString(36)
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

function publicUser(u) {
  return {
    id: u.id,
    nickname: u.nickname,
    account: u.account,
    avatar: u.avatar,
    plan: u.plan || 'earth',
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt
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
export function register({ nickname, account, password }) {
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
    id: 'u' + now.toString(36),
    nickname,
    account,
    password: hash(password),
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
    id: 'w' + now.toString(36) + Math.random().toString(36).slice(2, 6),
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
export function login(account, password) {
  account = (account || '').trim()
  if (!account || !password) return { ok: false, msg: '请输入账号和密码' }
  const users = read(USERS_KEY, [])
  const user = users.find(u => u.account === account)
  if (!user || user.password !== hash(password)) {
    return { ok: false, msg: '账号或密码不正确' }
  }
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
  user.plan = plan.key
  user.creditsUsed = 0
  user.planCreditsResetAt = nextResetAt(now)
  user.planExpiresAt = nextResetAt(now)
  write(USERS_KEY, users)
  setSession(user)
  return { ok: true, user: publicUser(user), plan }
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

export function changePassword(id, oldPwd, newPwd) {
  const users = read(USERS_KEY, [])
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return { ok: false, msg: '用户不存在' }
  const user = users[idx]
  if (hash(oldPwd) !== user.password) return { ok: false, msg: '当前密码不正确' }
  if (!newPwd || newPwd.length < 6) return { ok: false, msg: '新密码至少 6 位' }
  user.password = hash(newPwd)
  write(USERS_KEY, users)
  return { ok: true, msg: '密码已更新' }
}

/* ---- 统计（供管理面板参考） ---- */
export function countUsers() {
  return read(USERS_KEY, []).length
}
