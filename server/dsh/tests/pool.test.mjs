import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DshPool, ROUTES, DEFAULT_ROUTE } from '../pool.js'

function fakeClient(script) {
  // script(sessionId) → 通知数组，按序回放。
  //
  // close() 契约核对自真实 SDK（node_modules/@deepseek-ai/dsh-sdk-client/lib/index.js）：
  // subscription.close() 内部调用 fail(new TransportClosedError(...))，fail() 会
  // reject 所有挂起的 next() 等待者——也就是说，关闭订阅会让正在等待的调用立刻拒绝，
  // 而不是像最初这个 fake 那样返回一个永不 settle 的 Promise。这里的 pendingReject
  // 就是模拟“挂起等待者”：next() 排不到数据时把 reject 函数记下来，close() 时调用它。
  const queue = []
  let closed = false
  let pendingReject = null
  const closedError = () => Object.assign(new Error('订阅已关闭'), { name: 'TransportClosedError' })
  const rejectPending = () => { if (pendingReject) { const r = pendingReject; pendingReject = null; r(closedError()) } }
  return {
    calls: { init: 0, prompts: [] },
    async start() {},
    async initialize(p) { this.calls.init++; return { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.0.1' } } },
    async prompt(sessionId, blocks) { this.calls.prompts.push({ sessionId, blocks }); queue.push(...script(sessionId)); return 'msg-1' },
    subscribeSessionTree() {
      return {
        next() {
          if (closed) return Promise.reject(closedError())
          const n = queue.shift()
          if (n) return Promise.resolve(n)
          return new Promise((resolve, reject) => { pendingReject = reject })
        },
        close() { closed = true; rejectPending() },
      }
    },
    async close() { closed = true; rejectPending() },
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
  // close() 应该让仍在等待通知的 p 立刻以 CLOSED 拒绝，而不是挂到 120s 超时，
  // 也不应该让它“成功返回一个空结果”——池关闭中途没有真正跑完的这一轮就是失败的。
  await pool.close()
  await assert.rejects(p, err => err.code === 'CLOSED')
})

test('未知路由报错', async () => {
  const pool = new DshPool({ createClient: () => fakeClient(() => []) })
  await assert.rejects(() => pool.run({ routeKey: 'nope', sessionId: 's3', text: 'a', onEvent: () => {} }), /UNKNOWN_ROUTE/)
  await pool.close()
})

test('ROUTES 含默认路由', () => {
  assert.ok(ROUTES[DEFAULT_ROUTE])
})

test('回复超时：丢弃路由客户端并关闭其子进程', async () => {
  let closeCalled = false
  const client = {
    calls: { init: 0, prompts: [] },
    async start() {},
    async initialize() { this.calls.init++; return { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.0.1' } } },
    async prompt(sessionId, blocks) { this.calls.prompts.push({ sessionId, blocks }); return 'msg-1' },
    subscribeSessionTree() {
      return { next: () => new Promise(() => {}), close() {} } // 永不产生通知，模拟卡住的一轮
    },
    async close() { closeCalled = true },
  }
  const pool = new DshPool({ createClient: () => client, turnTimeoutMs: 20 })
  await assert.rejects(
    () => pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's4', text: 'a', onEvent: () => {} }),
    err => err.code === 'TIMEOUT'
  )
  // dropClient 里对子进程的 close() 是 fire-and-forget，给它一个宏任务窗口。
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(closeCalled, true)
  await pool.close()
})

test('调用前已中止：不发送 prompt，直接返回空结果', async () => {
  const client = fakeClient(() => [])
  const pool = new DshPool({ createClient: () => client })
  const controller = new AbortController()
  controller.abort()
  const r = await pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's5', text: 'a', onEvent: () => {}, signal: controller.signal })
  assert.deepEqual(r, { finalText: '', usage: null, title: null })
  assert.equal(client.calls.prompts.length, 0)
  await pool.close()
})
