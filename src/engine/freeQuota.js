// 未注册游客的本机体验配额：可任选牌阵，共 3 次。
// 塔罗解读由本地引擎生成，不涉及模型或付费权益；注册后改由服务端账号权益控制。

const LS_KEY = 'qw_free_quota'

const DEFAULTS = { tarot: 0 }

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
