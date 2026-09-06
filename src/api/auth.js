// 账号接口客户端：登录态 = 服务端签发的 JWT。
//
// token 存 localStorage。这里有个必须说清楚的取舍：localStorage 里的 token
// 会被 XSS 偷走，HttpOnly Cookie 不会。但 Cookie 方案要额外处理 CSRF，
// 而本站前后端同源部署、接口全走 Authorization 头，先取实现简单的一侧；
// 真正要紧的是**别再让客户端自称身份**，这一点两种方案都做到了。
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || ''

const TOKEN_KEY = 'genki-token'
// 当前用户的本地镜像。仅用于首屏同步渲染（顶栏头像、昵称），
// **不是权威数据** —— 改它只会让自己看到假的档位，任何要花积分的动作
// 都由服务端按 token 重新判定。
const USER_KEY = 'genki-user'

let memToken = null
let memUser = null

export function getToken() {
  if (memToken !== null) return memToken
  try { memToken = localStorage.getItem(TOKEN_KEY) } catch { memToken = null }
  return memToken
}

export function getCachedUser() {
  if (memUser !== null) return memUser
  try {
    const raw = localStorage.getItem(USER_KEY)
    memUser = raw ? JSON.parse(raw) : null
  } catch { memUser = null }
  return memUser
}

export function setAuth(token, user) {
  memToken = token || null
  memUser = user || null
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY)
  } catch { /* 隐私模式：内存里有就够这一会话用 */ }
}

export function clearAuth() {
  setAuth(null, null)
}

export function authHeader() {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** 登录态失效时的回调（由 App 注册，用于把界面切回未登录） */
let onUnauthorized = null
export function setUnauthorizedHandler(fn) { onUnauthorized = fn }

export async function api(path, { method = 'GET', body, headers } = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader(), ...(headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // 网络不通与「服务端说不行」是两回事，别混成同一句提示。
    return { ok: false, msg: '网络连接失败，请检查网络后重试', offline: true }
  }
  const data = await res.json().catch(() => ({ ok: false, msg: `响应解析失败(${res.status})` }))
  if (res.status === 401) {
    // token 过期或账号已注销：就地清掉，避免带着一张废 token 反复失败
    clearAuth()
    if (onUnauthorized) { try { onUnauthorized() } catch { /* ignore */ } }
  }
  return { status: res.status, ...data }
}
