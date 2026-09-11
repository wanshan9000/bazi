// 免费配额本地存储：客者只可累计体验 8 次塔罗单牌。
// 其余深度内容与元气 Agent 均须登录后，按服务端双钱包计费。

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

// 塔罗客者上限
export const FREE_LIMIT = 8

export function isTarotOverLimit(used) { return (used || 0) >= FREE_LIMIT }
