/* ============ 灵枢 · 账号数据层 ============
 *
 * 已从「浏览器 localStorage 演示实现」迁到服务端（R2 M1）：
 *   · 身份 = 服务端签发的 JWT，不再是客户端自报的 uid；
 *   · 会员档位与积分余额由服务端持有并扣减，改本地存储不再能提权/白嫖；
 *   · 口令用服务端 scrypt 加盐散列，浏览器不再接触任何散列逻辑。
 *
 * 本模块只剩两件事：调接口，以及维护一份**仅供同步渲染**的本地镜像
 * （顶栏头像、昵称这类首屏就要用的字段）。镜像不是权威数据 —— 任何要花积分
 * 的动作都在服务端按 token 重新判定，改镜像只会让自己看到假的数字。
 */

import { api, setAuth, clearAuth, getCachedUser, getToken } from '../api/auth.js'
import { tryMigrateLegacy } from './legacyMigrate.js'

/* 会员档位（定义见 src/engine/membership.js，此处 re-export 保持向后兼容） */
export { PLANS } from '../engine/membership.js'

export const AVATARS = ['🐻', '🌸', '🌟', '🦋', '🍑', '🌙', '🪷', '☁️', '🍀', '🦊']

/* ---- 会话 ---- */

/**
 * 当前登录用户（同步）。返回的是本地镜像，可能略旧于服务端。
 * 需要权威状态时用 refreshSession()。
 */
export function getSession() {
  return getToken() ? getCachedUser() : null
}

export function logout() {
  clearAuth()
}

/** 向服务端确认登录态并刷新镜像。返回最新 user，未登录/已失效返回 null。 */
export async function refreshSession() {
  if (!getToken()) return null
  const res = await api('/api/auth/me')
  if (!res.ok) {
    // 网络不通时保留镜像：断网不该把人从界面上登出。
    // 真正失效（401）由 api() 内部清掉 token，这里 getSession() 自然返回 null。
    return res.offline ? getCachedUser() : null
  }
  setAuth(getToken(), res.user)
  return res.user
}

/* ---- 注册 / 登录 ---- */
export async function register({ nickname, account, password }) {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { nickname: (nickname || '').trim(), account: (account || '').trim(), password: password || '' },
  })
  if (!res.ok) return { ok: false, msg: res.msg || '注册失败' }
  setAuth(res.token, res.user)
  return { ok: true, user: res.user }
}

export async function login(account, password) {
  if (!account || !password) return { ok: false, msg: '请输入账号和密码' }
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { account: String(account).trim(), password },
  })
  if (res.ok) {
    setAuth(res.token, res.user)
    return { ok: true, user: res.user }
  }
  // 网络问题不是「密码错」，也没有迁移的必要，原样回报。
  if (res.offline) return { ok: false, msg: res.msg }

  // 服务端查无此人 —— 可能是账号迁到服务端之前就存在的本地老账号。
  // 用刚输入的明文口令校验本地那份旧散列，通过就替他在服务端建号并搬走本地数据。
  const migrated = await tryMigrateLegacy(account, password, register)
  if (migrated.ok) return { ok: true, user: migrated.user, migrated: true }
  if (migrated.msg) return { ok: false, msg: migrated.msg }

  return { ok: false, msg: res.msg || '登录失败' }
}

/* ---- 微信登录 ----
 * 配了微信凭证时传 code 由服务端换 openid；本地降级模式下才允许直接传 openid。
 */
export async function registerByWechat(openid, nickname = '微信用户', code = null) {
  const res = await api('/api/auth/wechat', {
    method: 'POST',
    body: code ? { code, nickname } : { openid: (openid || '').trim(), nickname },
  })
  if (!res.ok) return { ok: false, msg: res.msg || '微信登录失败' }
  setAuth(res.token, res.user)
  return { ok: true, user: res.user, fresh: Boolean(res.fresh) }
}

/* ---- 资料与安全 ---- */
export async function updateProfile(id, patch) {
  const res = await api('/api/auth/me', {
    method: 'PUT',
    // 只发这两个字段。plan / creditsUsed 就算发过去服务端也不认，
    // 但没必要让请求体看起来像是能改它们。
    body: { nickname: patch.nickname, avatar: patch.avatar },
  })
  if (!res.ok) return { ok: false, msg: res.msg || '保存失败' }
  setAuth(getToken(), res.user)
  return { ok: true, user: res.user }
}

export async function changePassword(id, oldPwd, newPwd) {
  const res = await api('/api/auth/password', {
    method: 'PATCH',
    body: { oldPassword: oldPwd, newPassword: newPwd },
  })
  return res.ok ? { ok: true, msg: res.msg || '密码已更新' } : { ok: false, msg: res.msg || '修改失败' }
}

/* ---- 切换会员档位（升级 / 降级 / 续费） ----
 * ⚠ 服务端目前也没有接支付，这个接口等于「点一下就升级」。
 * 搬到服务端的意义在于：档位由服务端持有，扣积分时以它为准，客户端不能再自称档位。
 * 真实收费必须在服务端插入「下单 → 支付回调 → 改档位」，不能只改这里。
 */
export async function changePlan(id, newKey) {
  const res = await api('/api/auth/plan', { method: 'POST', body: { plan: newKey } })
  if (!res.ok) return { ok: false, msg: res.msg || '切换失败' }
  setAuth(getToken(), res.user)
  return { ok: true, user: res.user, plan: res.plan, renewed: res.renewed }
}

/* ---- 扣减积分 ----
 * 由服务端扣。返回结构与旧的同步版本保持一致（ok / reason / user / cost / remaining），
 * 调用方只需把它当 Promise await。
 */
export async function consumeCredit(id, featureKey) {
  const res = await api('/api/auth/credits/consume', { method: 'POST', body: { feature: featureKey } })
  if (res.ok) {
    if (res.user) setAuth(getToken(), res.user)
    return { ok: true, user: res.user, cost: res.cost, remaining: res.remaining }
  }
  if (res.offline) return { ok: false, reason: 'offline', msg: res.msg }
  return { ok: false, reason: res.reason || 'failed', msg: res.msg, cost: res.cost, available: res.available }
}

/* ---- 注销账号（连坐清除服务端数据） ---- */
export async function deleteAccount() {
  const res = await api('/api/auth/me', { method: 'DELETE' })
  if (res.ok) clearAuth()
  return res
}

/* ---- 兼容旧调用点 ----
 * 月度重置与到期降级现在都由服务端在每次读取账号时推进，前端只要重新拉一次即可。
 */
export async function syncMonthlyReset() {
  return refreshSession()
}
