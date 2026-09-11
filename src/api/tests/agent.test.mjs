import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAgentApi, parseSseChunks } from '../agent.js'

test('按 \n\n 分帧，跨块拼接', () => {
  const p = parseSseChunks()
  assert.deepEqual(p.feed('data: {"type":"text","delta":"你"}\n\ndata: {"ty'), [{ type: 'text', delta: '你' }])
  assert.deepEqual(p.feed('pe":"done"}\n\n'), [{ type: 'done' }])
})

test('忽略非 JSON 行', () => {
  const p = parseSseChunks()
  assert.deepEqual(p.feed(': ping\n\n'), [])
})

test('续问当前主题时把 renew 标记传给服务端', async () => {
  // 没有这个字段时，服务端只能把已结束主题拒掉，前端只能另开会话，导致上下文断裂。
  const originalFetch = globalThis.fetch
  let requestBody = null
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body)
    return new Response('data: {"type":"done"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  }
  try {
    await createAgentApi().streamChat({
      sessionId: 'same-session', text: '继续问', renew: true, onEvent() {},
    })
    assert.equal(requestBody.renew, true)
    assert.equal(requestBody.sessionId, 'same-session')
  } finally {
    globalThis.fetch = originalFetch
  }
})
