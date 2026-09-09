import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, isIdle, TOOL_NAME_CN } from '../events.js'

const ev = (type, data) => ({ method: 'session.event', params: { sessionId: 's1', event: { type, seq: 1, time: 0, data } } })

test('text-delta → text', () => {
  assert.deepEqual(
    normalize(ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '你好' } })),
    { type: 'text', delta: '你好' }
  )
})

test('reasoning-delta → reasoning', () => {
  assert.deepEqual(
    normalize(ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: '想' } })),
    { type: 'reasoning', delta: '想' }
  )
})

test('其他 chunk 忽略', () => {
  assert.equal(
    normalize(ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'block-start', index: 0, blockType: 'text' } })),
    null
  )
})

test('tool/call 解析参数', () => {
  assert.deepEqual(
    normalize(ev('tool/call', { turn: 1, step: 1, callId: 'c1', name: 'bazi', arguments: '{"year":1990}' })),
    { type: 'tool_call', name: 'bazi', args: { year: 1990 } }
  )
})

// NOTE on tool/result shape adjustment vs the brief:
// Real types (dsh-llm lib/types/message.d.ts ToolResultMessage, types.d.ts
// ToolResultBlock, message.d.ts ToolMessageSource) carry NO tool name anywhere
// on tool/result: ToolResultBlock = { type:'tool-result', toolCallId, content,
// isError? } and ToolMessageSource = { kind:'tool', callId }. The brief's
// fixture invented `callId`/`name` fields on the block and `name` on source
// that do not exist on the real type. Per the controller instructions, the
// tool name is instead recovered from the paired tool/call by callId via a
// small module-level Map (see events.js). So this test first replays the
// tool/call, then feeds the correctly-shaped tool/result.
test('tool/result 报告类（从配对的 tool/call 恢复工具名）', () => {
  normalize(ev('tool/call', { turn: 1, step: 1, callId: 'c1', name: 'report', arguments: '{}' }))
  const n = normalize(ev('tool/result', {
    turn: 1,
    step: 1,
    message: {
      id: 'm1',
      role: 'user',
      content: [{ type: 'tool-result', toolCallId: 'c1', isError: false, content: [{ type: 'text', text: '# 报告' }] }],
      source: { kind: 'tool', callId: 'c1' },
    },
  }))
  assert.equal(n.type, 'tool_result')
  assert.equal(n.name, 'report')
  assert.equal(n.kind, 'report')
  assert.equal(n.ok, true)
  assert.equal(n.text, '# 报告')
})

test('tool/result 失败（isError / 顶层 error 均视为失败）', () => {
  normalize(ev('tool/call', { turn: 2, step: 1, callId: 'c2', name: 'bazi', arguments: '{}' }))
  const n = normalize(ev('tool/result', {
    turn: 2,
    step: 1,
    message: {
      id: 'm2',
      role: 'user',
      content: [{ type: 'tool-result', toolCallId: 'c2', isError: true, content: [{ type: 'text', text: '出错了' }] }],
      source: { kind: 'tool', callId: 'c2' },
    },
    error: { name: 'ToolError', code: 'BAD_INPUT' },
  }))
  assert.equal(n.type, 'tool_result')
  assert.equal(n.name, 'bazi')
  assert.equal(n.kind, 'data')
  assert.equal(n.ok, false)
  assert.equal(n.text, '出错了')
})

test('tool/result 找不到配对的 tool/call 时使用兜底名称', () => {
  const n = normalize(ev('tool/result', {
    turn: 3,
    step: 1,
    message: {
      id: 'm3',
      role: 'user',
      content: [{ type: 'tool-result', toolCallId: 'unknown', isError: false, content: [{ type: 'text', text: 'x' }] }],
      source: { kind: 'tool', callId: 'unknown' },
    },
  }))
  assert.equal(n.type, 'tool_result')
  assert.equal(n.name, 'tool')
  assert.equal(n.kind, 'data')
})

test('tool/result 按 sessionId 隔离，不同会话复用同一 callId 不串号', () => {
  const evFor = (sid, type, data) => ({ method: 'session.event', params: { sessionId: sid, event: { type, seq: 1, time: 0, data } } })
  normalize(evFor('sA', 'tool/call', { turn: 1, step: 1, callId: 'dup', name: 'bazi', arguments: '{}' }))
  normalize(evFor('sB', 'tool/call', { turn: 1, step: 1, callId: 'dup', name: 'ziwei', arguments: '{}' }))
  const resultFor = (sid) => normalize(evFor(sid, 'tool/result', {
    turn: 1,
    step: 1,
    message: {
      id: 'm', role: 'user',
      content: [{ type: 'tool-result', toolCallId: 'dup', isError: false, content: [{ type: 'text', text: 'x' }] }],
      source: { kind: 'tool', callId: 'dup' },
    },
  }))
  assert.equal(resultFor('sA').name, 'bazi')
  assert.equal(resultFor('sB').name, 'ziwei')
})

test('turn/end 成功、失败与其他终止原因', () => {
  assert.deepEqual(normalize(ev('turn/end', { turn: 1, reason: { kind: 'completed' } })), { type: 'done', reason: 'completed' })
  assert.deepEqual(
    normalize(ev('turn/end', { turn: 1, reason: { kind: 'error', error: { code: 'AUTH', message: 'bad key' } } })),
    { type: 'error', code: 'AUTH', message: 'bad key' }
  )
  // Non-error, non-completed kinds (aborted/blocked/max-tokens/interrupted, per
  // dsh-session TurnEndReasonMap) all normalize to a generic 'done'.
  assert.deepEqual(
    normalize(ev('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } })),
    { type: 'done', reason: 'aborted' }
  )
})

test('session/title', () => {
  assert.deepEqual(
    normalize(ev('session/title', { title: '排八字', messageSeqs: [1], source: { kind: 'fallback' } })),
    { type: 'title', title: '排八字' }
  )
})

test('assistant/message 带 usage', () => {
  const n = normalize(ev('assistant/message', {
    turn: 1,
    step: 1,
    message: { id: 'm4', role: 'assistant', content: [{ type: 'text', text: '断语' }], source: { kind: 'model', provider: 'deepseek', model: 'deepseek-chat' } },
    usage: { inputTokens: 10, outputTokens: 5 },
  }))
  assert.deepEqual(n, { type: 'message', text: '断语', usage: { inputTokens: 10, outputTokens: 5 } })
})

test('非 session.event 通知返回 null', () => {
  assert.equal(normalize({ method: 'session.status', params: { sessionId: 's1', status: 'idle' } }), null)
  assert.equal(normalize(null), null)
  assert.equal(normalize({}), null)
})

test('未知事件类型返回 null', () => {
  assert.equal(normalize(ev('turn/start', { turn: 1 })), null)
})

test('isIdle 只认本会话', () => {
  assert.equal(isIdle({ method: 'session.status', params: { sessionId: 's1', status: 'idle' } }, 's1'), true)
  assert.equal(isIdle({ method: 'session.status', params: { sessionId: 's2', status: 'idle' } }, 's1'), false)
  assert.equal(isIdle({ method: 'session.status', params: { sessionId: 's1', status: 'running' } }, 's1'), false)
  assert.equal(isIdle({ method: 'session.event', params: { sessionId: 's1' } }, 's1'), false)
})

test('TOOL_NAME_CN 覆盖所有已知工具', () => {
  for (const key of ['bazi', 'ziwei', 'liuyao', 'qimen', 'huangli', 'tarot', 'name', 'fengshui', 'wuyunliuqi', 'report', 'skill']) {
    assert.equal(typeof TOOL_NAME_CN[key], 'string')
  }
})
