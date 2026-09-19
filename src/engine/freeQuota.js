// 未注册游客的本机体验配额。纯本地计算不产生模型成本，因此这里的作用是
// 引导合理注册，不充当安全边界；涉及 Agent 的 Token 额度仍由服务端按 IP 控制。
import { GUEST_FREE_FEATURE_DAILY_LIMIT } from './membership.js'

const LS_KEY = 'qw_free_quota'

const DEFAULTS = { tarot: 0 }
const GUEST_FEATURE_PREFIX = 'feature:'

function localDay(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function featureKey(feature, day = localDay()) {
  return `${GUEST_FEATURE_PREFIX}${feature}:${day}`
}

function safeRead() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULTS }
    const obj = JSON.parse(raw)
    return { ...DEFAULTS, ...obj }
  } catch {
    return { ...DEFAULTS }
  }
}

function safeWrite(q) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(q)) } catch { /* ignore */ }
}

export function loadQuota() {
  return safeRead()
}

export function saveQuota(q) {
  safeWrite(q)
}

// 塔罗：占卜次数 +1（返回更新后累计次数）
export function incTarot() {
  const q = safeRead()
  q.tarot = (q.tarot || 0) + 1
  safeWrite(q)
  return q.tarot
}

// 游客塔罗体验上限
export const FREE_LIMIT = 3

export function isTarotOverLimit(used) { return (used || 0) >= FREE_LIMIT }

export function guestTarotStatus() {
  const used = Math.max(0, Number(safeRead().tarot) || 0)
  return { used, remaining: Math.max(0, FREE_LIMIT - used) }
}

/** 成功占用一次游客塔罗体验；到限后不再写入。 */
export function consumeGuestTarot() {
  const quota = safeRead()
  const used = Math.max(0, Number(quota.tarot) || 0)
  if (used >= FREE_LIMIT) return { ok: false, used, remaining: 0 }
  quota.tarot = used + 1
  safeWrite(quota)
  return { ok: true, used: quota.tarot, remaining: FREE_LIMIT - quota.tarot }
}

/** 某个无 Token 功能的游客日限额状态。每项单独计数，次日自动换新桶。 */
export function guestFeatureStatus(feature, now = new Date()) {
  const q = safeRead()
  const used = Math.max(0, Number(q[featureKey(feature, localDay(now))]) || 0)
  return { used, limit: GUEST_FREE_FEATURE_DAILY_LIMIT, remaining: Math.max(0, GUEST_FREE_FEATURE_DAILY_LIMIT - used) }
}

/** 成功使用一次无 Token 功能；达当日上限时不再写入。 */
export function consumeGuestFeature(feature, now = new Date()) {
  const q = safeRead()
  const key = featureKey(feature, localDay(now))
  const used = Math.max(0, Number(q[key]) || 0)
  if (used >= GUEST_FREE_FEATURE_DAILY_LIMIT) {
    return { ok: false, used, limit: GUEST_FREE_FEATURE_DAILY_LIMIT, remaining: 0 }
  }
  q[key] = used + 1
  // 保留当日与昨天的功能桶，避免 localStorage 随日期长期增长。
  const today = localDay(now)
  const yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  for (const keyName of Object.keys(q)) {
    if (keyName.startsWith(GUEST_FEATURE_PREFIX) && !keyName.endsWith(`:${today}`) && !keyName.endsWith(`:${yesterday}`)) delete q[keyName]
  }
  safeWrite(q)
  return { ok: true, used: q[key], limit: GUEST_FREE_FEATURE_DAILY_LIMIT, remaining: GUEST_FREE_FEATURE_DAILY_LIMIT - q[key] }
}
