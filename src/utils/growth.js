import { api, getToken, setAuth } from '../api/auth.js'

function shareEventId() {
  if (globalThis.crypto?.randomUUID) return `share_${globalThis.crypto.randomUUID()}`
  return `share_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

/** 分享完成后，为已登录用户领取服务端验证的永久积分奖励。 */
export async function claimShareReward(source) {
  if (!getToken()) return { ok: false, reason: 'login_required' }
  const result = await api('/api/growth/share-reward', {
    method: 'POST',
    body: { eventId: shareEventId(), source },
  })
  if (result.ok && result.user) {
    setAuth(getToken(), result.user)
    window.dispatchEvent(new CustomEvent('genki:account-updated', { detail: result.user }))
  }
  return result
}
