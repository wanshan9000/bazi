// 管理后台 · 共享管理员鉴权（令牌签发 + 中间件）
// 由 skills.js / subscribe.js 等路由共用，保证所有管理接口鉴权一致。
import crypto from 'crypto'
import { config, resolveJwtSecret } from './config.js'
import { sharedAccounts } from './accounts.js'
import { verifyJwt } from './jwt.js'
import { isSuperAdmin } from '../src/engine/membership.js'

// 管理员令牌（内存态，服务重启即失效）
const sessions = new Map() // token -> expiresAt

export function adminConfigured() {
  return Boolean(config.admin.password)
}

// 登录失败计数（按来源 IP）。管理口令是单一静态口令，没有失败限制就等于
// 允许公网无限次在线爆破 —— 尤其 deploy/env.example 里的示例值还是 change-me。
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_FAILS = 8
const fails = new Map() // ip -> { count, until }

export function loginBlocked(ip) {
  const rec = fails.get(ip)
  if (!rec) return false
  if (Date.now() > rec.until) { fails.delete(ip); return false }
  return rec.count >= LOGIN_MAX_FAILS
}

export function noteLoginFail(ip) {
  const now = Date.now()
  for (const [k, v] of fails) if (now > v.until) fails.delete(k)
  const rec = fails.get(ip)
  if (!rec || now > rec.until) fails.set(ip, { count: 1, until: now + LOGIN_WINDOW_MS })
  else rec.count++
}

export function noteLoginOk(ip) {
  fails.delete(ip)
}

export function issueToken() {
  const token = crypto.randomBytes(24).toString('hex')
  // 顺手清掉过期令牌：sessions 原先只增不减，长跑进程里会一直堆积。
  const now = Date.now()
  for (const [t, exp] of sessions) if (now > exp) sessions.delete(t)
  sessions.set(token, now + config.admin.tokenTtlHours * 60 * 60 * 1000)
  return token
}

/** 令牌是否有效（不改动响应，供需要「有则更详细」的读接口使用） */
export function isValidAdminToken(token) {
  if (!token) return false
  const exp = sessions.get(token)
  if (!exp) return false
  if (Date.now() > exp) { sessions.delete(token); return false }
  return true
}

/**
 * 超级管理员仍以账号 JWT 为入口，但每次请求都会回查服务端账号角色。
 * 因此撤销角色后，已签发的普通登录态会立刻失去后台权限。
 */
export function isSuperAdminRequest(req) {
  const auth = String(req.get('authorization') || '')
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  const payload = verifyJwt(match[1].trim(), resolveJwtSecret())
  if (!payload?.sub) return false
  return isSuperAdmin(sharedAccounts().get(String(payload.sub)))
}

// 中间件：校验管理员令牌
export function requireAdmin(req, res, next) {
  if (isSuperAdminRequest(req)) {
    req.isSuperAdmin = true
    return next()
  }
  if (!adminConfigured()) {
    return res.status(403).json({ ok: false, msg: '管理后台未启用（请设置 ADMIN_PASSWORD 环境变量）' })
  }
  const token = req.headers['x-admin-token'] || ''
  const exp = sessions.get(token)
  if (!exp) return res.status(401).json({ ok: false, msg: '未授权，请先登录管理后台' })
  if (Date.now() > exp) {
    sessions.delete(token)
    return res.status(401).json({ ok: false, msg: '会话已过期，请重新登录' })
  }
  next()
}
