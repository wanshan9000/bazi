// 免费配额本地存储：游客免费使用额度（注册会员自动绕过）
//   - tarot / qimen：游客每抽 1 次计 1 次；上限 10 次（含 10）
//   - agent     ：游客 token 累计；累计 ≥ 100 积分触发订阅引导（换算见 TOKENS_PER_CREDIT）

const LS_KEY = 'qw_free_quota'

const DEFAULTS = { tarot: 0, qimen: 0, agentTokens: 0 }

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

// 奇门：排盘次数 +1
export function incQimen() {
  const q = safeRead()
  q.qimen = (q.qimen || 0) + 1
  safeWrite(q)
  return q.qimen
}

// 元气 AI：按 token 估算值累加；返回最新 tokens
//   token 估算策略：英文约 4 字符/token、中文约 1.5 字符/token 混合 → 取字符数 ÷ 3 作为粗估
export function addAgentTokens(textLen) {
  if (!textLen || textLen <= 0) return 0
  const est = Math.ceil(textLen / 3)
  const q = safeRead()
  q.agentTokens = (q.agentTokens || 0) + est
  safeWrite(q)
  return q.agentTokens
}

/**
 * token → 积分的换算率。
 *
 * ⚠ 这里原本写死 1 积分 = 100000 token，游客上限因此高达 1000 万 token —— 一次
 * 对话回复撑死一两千 token，要聊上万轮才会触发额度提示，那条「游客 100 积分体验」
 * 的产品规则形同虚设。对齐 FEATURE_COSTS 的量级（八字完整命书 8 积分、一份报告
 * 万把 token）后，1 积分定为 2000 token：游客 100 积分 ≈ 100 次实打实的问答。
 */
export const TOKENS_PER_CREDIT = 2000

// 游客体验额度（积分）。与 membership.js 里「游客 100 积分」的表述保持一致。
export const AGENT_FREE_CREDITS = 100

export function tokensToCredits(tokens) {
  return (tokens || 0) / TOKENS_PER_CREDIT
}

export const AGENT_QUOTA_TOKENS = AGENT_FREE_CREDITS * TOKENS_PER_CREDIT // 200_000

export function isAgentOverQuota(tokens) {
  return (tokens || 0) >= AGENT_QUOTA_TOKENS
}

// 塔罗 / 奇门游客上限
export const FREE_LIMIT = 10

export function isTarotOverLimit(used) { return (used || 0) >= FREE_LIMIT }
export function isQimenOverLimit(used) { return (used || 0) >= FREE_LIMIT }