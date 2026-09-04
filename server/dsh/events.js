// dsh 通知 → 前端 SSE 事件（纯函数，无副作用；不依赖任何外部模块）
//
// 输入形状核对自：
//   node_modules/@deepseek-ai/dsh-session/lib/types/types.d.ts  (SessionEventMap, TurnEndReasonMap)
//   node_modules/@deepseek-ai/dsh-llm/lib/types/types.d.ts      (StreamChunk, TokenUsage, LlmFailure, ToolResultBlock)
//   node_modules/@deepseek-ai/dsh-llm/lib/types/message.d.ts    (ToolResultMessage, ToolMessageSource)
//   node_modules/@deepseek-ai/dsh-session-title/lib/types/types.d.ts (SessionTitleEventData)

const TOOL_NAME_CN = {
  bazi: '八字排盘', ziwei: '紫微排盘', liuyao: '六爻起卦', qimen: '奇门排盘', huangli: '黄历查询',
  modern_huangli: '幽默黄历', tarot: '塔罗抽牌', name: '姓名分析', fengshui: '风水分析', wuyunliuqi: '五运六气',
  report: '测算报告', skill: '加载技能',
}

// tool/result 在真实类型中不携带工具名：ToolResultBlock 只有
// { type:'tool-result', toolCallId, content, isError? }，ToolMessageSource 只有
// { kind:'tool', callId }。因此在收到配对的 tool/call 时暂存 name，
// tool/result 消费后立即删除，避免无界增长（若从未收到匹配的 result，
// 条目会残留，但每个会话的 callId 空间有限，实际影响可忽略）。
// key 用 `${sessionId}:${callId}` 而非裸 callId：pool.js 会用同一个模块
// 驱动多个并发 dsh 会话，callId 只在各自会话内保证唯一，裸 key 会在两个
// 会话恰好复用同一个 callId 时互相串号。
const pendingToolNames = new Map()

function textOf(blocks) {
  return (blocks || []).filter(b => b && b.type === 'text').map(b => b.text).join('')
}

function safeJson(s) {
  try { return JSON.parse(s) } catch { return { raw: String(s) } }
}

function normalize(n) {
  if (!n || n.method !== 'session.event') return null
  const e = n.params && n.params.event
  if (!e) return null
  const d = e.data || {}
  switch (e.type) {
    case 'assistant/chunk': {
      const c = d.chunk || {}
      if (c.type === 'text-delta') return { type: 'text', delta: c.text }
      if (c.type === 'reasoning-delta') return { type: 'reasoning', delta: c.text }
      return null
    }
    case 'tool/call':
      pendingToolNames.set(`${n.params.sessionId}:${d.callId}`, d.name)
      return { type: 'tool_call', name: d.name, args: safeJson(d.arguments) }
    case 'tool/result': {
      const block = d.message && d.message.content && d.message.content[0]
      const callId = (block && block.toolCallId) || (d.message && d.message.source && d.message.source.callId)
      const key = `${n.params.sessionId}:${callId}`
      const name = pendingToolNames.get(key) || 'tool'
      pendingToolNames.delete(key)
      const ok = !(d.error || (block && block.isError))
      const text = block ? textOf(block.content) : ''
      return { type: 'tool_result', name, ok, text, kind: name === 'report' ? 'report' : 'data' }
    }
    case 'assistant/message': {
      const out = { type: 'message', text: textOf(d.message && d.message.content) }
      if (d.usage) out.usage = d.usage
      return out
    }
    case 'session/title':
      return { type: 'title', title: d.title }
    case 'turn/end': {
      const r = d.reason || {}
      if (r.kind === 'error') return { type: 'error', code: r.error?.code || 'ERROR', message: r.error?.message || '模型请求失败' }
      return { type: 'done', reason: r.kind || 'completed' }
    }
    default:
      return null
  }
}

function isIdle(n, sessionId) {
  return !!n && n.method === 'session.status' && !!n.params && n.params.sessionId === sessionId && n.params.status === 'idle'
}

// prompt() 返回的 messageId 被拼进会话时，dsh 会先发一条 agent/inbox/spliced 收据。
// 收到它之前的一切通知都属于上一轮（尤其是残留的 session.status: idle），必须忽略，
// 否则新一轮会在刚发出 prompt 时就被"上一轮的 idle"立刻结束。
// 判定逻辑核对自 SDK 自己的 run 循环：
//   node_modules/@deepseek-ai/dsh-sdk-client/lib/index.js 的 isInboxReceipt()（约 825 行）
function isInboxReceipt(n, sessionId, messageId) {
  if (!n || n.method !== 'session.event' || !n.params || n.params.sessionId !== sessionId) return false
  const e = n.params.event
  if (!e || e.type !== 'agent/inbox/spliced' || !e.data) return false
  const inserted = e.data.inserted
  return Array.isArray(inserted) && inserted.some(m => m && m.id === messageId)
}

export { normalize, isIdle, isInboxReceipt, TOOL_NAME_CN }
