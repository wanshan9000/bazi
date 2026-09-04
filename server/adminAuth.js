// 管理后台 · 共享管理员鉴权（令牌签发 + 中间件）
// 由 skills.js / subscribe.js 等路由共用，保证所有管理接口鉴权一致。
import crypto from 'crypto'
import { config } from './config.js'

// 管理员令牌（内存态，服务重启即失效）
const sessions = new Map() // token -> expiresAt

export function adminConfigured() {
  return Boolean(config.admin.password)
}

export function issueToken() {
  const token = crypto.randomBytes(24).toString('hex')
  sessions.set(token, Date.now() + config.admin.tokenTtlHours * 60 * 60 * 1000)
  return token
}

// 中间件：校验管理员令牌
export function requireAdmin(req, res, next) {
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
