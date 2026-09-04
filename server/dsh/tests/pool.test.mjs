import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DshPool, ROUTES, DEFAULT_ROUTE } from '../pool.js'

function fakeClient(script) {
  // script(sessionId) → 通知数组，按序回放
  const queue = []
  let closed = false
  return {
    calls: { init: 0, prompts: [] },
    async start() {},
    async initialize(p) { this.calls.init++; return { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.0.1' } } },
    async prompt(sessionId, blocks) { this.calls.prompts.push({ sessionId, blocks }); queue.push(...script(sessionId)); return 'msg-1' },
    subscribeSessionTree() {
      return {
        next: async () => { if (closed) throw new Error('closed'); const n = queue.shift(); if (!n) return new Promise(() => {}); return n },
        close() { closed = true },
      }
    },
    async close() { closed = true },
  }
}

const ev = (sid, type, data) => ({ method: 'session.event', params: { sessionId: sid, event: { type, seq: 1, time: 0, data } } })
const idle = sid => ({ method: 'session.status', params: { sessionId: sid, status: 'idle' } })

test('run 收集文本并在 idle 结束', async () => {
  const client = fakeClient(sid => [
    ev(sid, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '你' } }),
    ev(sid, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '好' } }),
    ev(sid, 'assistant/message', { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '你好' }] }, usage: { inputTokens: 1, outputTokens: 2 } }),
    ev(sid, 'turn/end', { turn: 1, reason: { kind: 'completed' } }),
    idle(sid),
  ])
  const pool = new DshPool({ createClient: () => client })
  const got = []
  const r = await pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's1', text: '嗨', onEvent: e => got.push(e) })
  assert.equal(r.finalText, '你好')
  assert.deepEqual(r.usage, { inputTokens: 1, outputTokens: 2 })
  assert.equal(got.filter(e => e.type === 'text').length, 2)
  assert.equal(client.calls.init, 1)
  assert.equal(client.calls.prompts[0].blocks[0].text, '嗨')
  await pool.close()
})

test('同一 session 并发 run 被拒绝', async () => {
  const client = fakeClient(sid => [])
  const pool = new DshPool({ createClient: () => client })
  const p = pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's2', text: 'a', onEvent: () => {} })
  assert.equal(pool.isBusy('s2'), true)
  await assert.rejects(() => pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's2', text: 'b', onEvent: () => {} }), /BUSY/)
  await pool.close()
  await p.catch(() => {})
})

test('未知路由报错', async () => {
  const pool = new DshPool({ createClient: () => fakeClient(() => []) })
  await assert.rejects(() => pool.run({ routeKey: 'nope', sessionId: 's3', text: 'a', onEvent: () => {} }), /UNKNOWN_ROUTE/)
  await pool.close()
})

test('ROUTES 含默认路由', () => {
  assert.ok(ROUTES[DEFAULT_ROUTE])
})
