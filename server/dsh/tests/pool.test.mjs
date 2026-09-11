import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DshPool, ROUTES, DEFAULT_ROUTE, buildChildEnv, availableRoutes, resolveDefaultRoute } from '../pool.js'

const ev = (sid, type, data) => ({ method: 'session.event', params: { sessionId: sid, event: { type, seq: 1, time: 0, data } } })
const idle = sid => ({ method: 'session.status', params: { sessionId: sid, status: 'idle' } })
// dsh 把用户消息拼进会话后先发的收据；pool 的 run 循环靠它区分"这一轮"与上一轮的残留通知。
const receipt = (sid, messageId) => ev(sid, 'agent/inbox/spliced', { inserted: [{ id: messageId, role: 'user' }] })
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms))

function fakeClient(script = () => []) {
  // script(sessionId) → 通知数组，在收据之后按序回放；push() 可在运行中追加。
  //
  // close() 契约核对自真实 SDK（node_modules/@deepseek-ai/dsh-sdk-client/lib/index.js）：
  // subscription.close() 内部调用 fail(new TransportClosedError(...))，fail() 会
  // reject 所有挂起的 next() 等待者——也就是说，关闭订阅会让正在等待的调用立刻拒绝，
  // 而不是像最初这个 fake 那样返回一个永不 settle 的 Promise。这里的 waiters 就是
  // 模拟"挂起等待者"：next() 排不到数据时把 resolve/reject 记下来，close() 时逐个拒绝。
  const queue = []
  const waiters = []
  let closed = false
  let seq = 0
  const closedError = () => Object.assign(new Error('订阅已关闭'), { name: 'TransportClosedError' })
  const pump = () => { while (queue.length && waiters.length) waiters.shift().resolve(queue.shift()) }
  const failAll = () => { while (waiters.length) waiters.shift().reject(closedError()) }
  return {
    calls: { init: 0, initializations: [], prompts: [] },
    push(n) { queue.push(n); pump() },
    async start() {},
    async initialize(params) { this.calls.init++; this.calls.initializations.push(params); return { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.0.1' } } },
    async prompt(sessionId, blocks) {
      this.calls.prompts.push({ sessionId, blocks })
      const id = `msg-${++seq}`
      queue.push(receipt(sessionId, id), ...script(sessionId, id))
      pump()
      return id
    },
    subscribeSessionTree() {
      return {
        next() {
          if (closed) return Promise.reject(closedError())
          if (queue.length) return Promise.resolve(queue.shift())
          return new Promise((resolve, reject) => { waiters.push({ resolve, reject }) })
        },
        close() { closed = true; failAll() },
      }
    },
    async close() { closed = true; failAll() },
  }
}

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

test('预热默认路由只初始化客户端，不会占用任何用户会话', async () => {
  const client = fakeClient(() => [])
  const pool = new DshPool({ createClient: () => client })
  await pool.warm('deepseek-flash')
  assert.equal(client.calls.init, 1)
  assert.equal(pool.busy.size, 0)
  await pool.close()
})

test('没有 DeepSeek 凭据时默认模型回退到可用的 MiniMax，而不是指向不可用的 Flash', () => {
  const env = { AGENT_DEFAULT_ROUTE: 'deepseek-flash', DEEPSEEK_API_KEY: '', MINIMAX_API_KEY: 'configured' }
  assert.deepEqual(availableRoutes(env).map(([key]) => key), ['minimax'])
  assert.equal(resolveDefaultRoute(env), 'minimax')
})

test('DeepSeek 凭据存在时仍优先使用快速默认模型', () => {
  const env = { AGENT_DEFAULT_ROUTE: 'deepseek-flash', DEEPSEEK_API_KEY: 'configured', MINIMAX_API_KEY: 'configured' }
  assert.equal(resolveDefaultRoute(env), 'deepseek-flash')
})

test('快速路由和深度路由按各自的生成上限初始化', async () => {
  // 该测试会在“所有模型都给同一 8192 token 上限”时失败；那会让默认快答
  // 无端生成过长，放大首轮等待。
  const flash = fakeClient(sid => [idle(sid)])
  const minimax = fakeClient(sid => [idle(sid)])
  const pool = new DshPool({ createClient: key => key === 'minimax' ? minimax : flash })

  await pool.run({ routeKey: 'deepseek-flash', sessionId: 'flash-route', text: '简要回答', onEvent: () => {} })
  await pool.run({ routeKey: 'minimax', sessionId: 'minimax-route', text: '深度回答', onEvent: () => {} })

  assert.equal(flash.calls.initializations[0].maxTokens, 3072)
  assert.equal(minimax.calls.initializations[0].maxTokens, 3072)
  await pool.close()
})

test('运行结果提供从握手到工具、首段正文与总耗时的分阶段指标', async () => {
  // 若删除 timing 采集，这些字段会消失；路由层就无法记录 Agent 的实际慢点。
  const client = fakeClient(sid => [
    ev(sid, 'assistant/chunk', { chunk: { type: 'reasoning-delta', index: 0, text: '核对中' } }),
    ev(sid, 'tool/call', { callId: 'call-1', name: 'bazi', arguments: '{}' }),
    ev(sid, 'tool/result', { message: { content: [{ type: 'text', text: '盘面' }], source: { callId: 'call-1' } } }),
    ev(sid, 'assistant/chunk', { chunk: { type: 'text-delta', index: 0, text: '正文' } }),
    idle(sid),
  ])
  const pool = new DshPool({ createClient: () => client })
  const result = await pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 'timing-route', text: '测速', onEvent: () => {} })

  assert.equal(typeof result.timing?.initializeMs, 'number')
  assert.equal(typeof result.timing?.promptAcceptedMs, 'number')
  assert.equal(typeof result.timing?.firstEventMs, 'number')
  assert.equal(typeof result.timing?.firstReasoningMs, 'number')
  assert.equal(typeof result.timing?.firstToolCallMs, 'number')
  assert.equal(typeof result.timing?.firstToolResultMs, 'number')
  assert.equal(typeof result.timing?.firstTextMs, 'number')
  assert.equal(typeof result.timing?.totalMs, 'number')
  assert.ok(result.timing.initializeMs <= result.timing.promptAcceptedMs)
  assert.ok(result.timing.promptAcceptedMs <= result.timing.totalMs)
  assert.ok(result.timing.firstEventMs <= result.timing.totalMs)
  assert.ok(result.timing.firstReasoningMs <= result.timing.totalMs)
  assert.ok(result.timing.firstToolCallMs <= result.timing.totalMs)
  assert.ok(result.timing.firstToolResultMs <= result.timing.totalMs)
  assert.ok(result.timing.firstTextMs <= result.timing.totalMs)
  await pool.close()
})

test('回复超时：保留常驻客户端（超时不等于子进程坏了）', async () => {
  let closeCalled = false
  const client = fakeClient(() => []) // 收据之后再无通知，模拟卡住的一轮
  const realClose = client.close.bind(client)
  client.close = async () => { closeCalled = true; return realClose() }
  const pool = new DshPool({ createClient: () => client, turnTimeoutMs: 20 })
  await assert.rejects(
    () => pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's4', text: 'a', onEvent: () => {} }),
    err => err.code === 'TIMEOUT'
  )
  // dropClient 里对子进程的 close() 是 fire-and-forget；给它一个宏任务窗口后确认没被调用。
  await tick(10)
  assert.equal(closeCalled, false)
  assert.equal(pool.clients.has(DEFAULT_ROUTE), true)
  await pool.close()
})

test('传输断开：丢弃路由客户端并关闭其子进程', async () => {
  let closeCalled = false
  const client = {
    calls: { init: 0, prompts: [] },
    async start() {},
    async initialize() { this.calls.init++; return { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.0.1' } } },
    async prompt(sessionId, blocks) { this.calls.prompts.push({ sessionId, blocks }); return 'msg-1' },
    subscribeSessionTree() {
      // 子进程死亡：挂起的 next() 以 TransportClosedError 拒绝
      return { next: () => Promise.reject(Object.assign(new Error('transport closed'), { name: 'TransportClosedError' })), close() {} }
    },
    async close() { closeCalled = true },
  }
  const pool = new DshPool({ createClient: () => client })
  await assert.rejects(
    () => pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's4b', text: 'a', onEvent: () => {} }),
    err => err.name === 'TransportClosedError'
  )
  await tick(10)
  assert.equal(closeCalled, true)
  assert.equal(pool.clients.has(DEFAULT_ROUTE), false)
  assert.equal(pool.isBusy('s4b'), false)
  await pool.close()
})

test('prompt 卡住时按整轮超时拒绝，且不产生 unhandledRejection', async () => {
  const client = {
    async start() {}, async initialize() { return { serverInfo: { name: 'x', version: '0' } } },
    prompt() { return new Promise(() => {}) }, // 永不 resolve：定时器会在 await 期间到点
    subscribeSessionTree() { return { next: () => new Promise(() => {}), close() {} } },
    async close() {},
  }
  const pool = new DshPool({ createClient: () => client, turnTimeoutMs: 20 })
  const unhandled = []
  const sentinel = reason => unhandled.push(reason)
  process.once('unhandledRejection', sentinel)
  try {
    await assert.rejects(
      () => pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's4c', text: 'a', onEvent: () => {} }),
      err => err.code === 'TIMEOUT'
    )
    // unhandledRejection 是在微任务队列排空后才派发的，多给几个宏任务窗口
    await tick(20)
    assert.deepEqual(unhandled, [])
  } finally {
    process.removeListener('unhandledRejection', sentinel)
  }
  await pool.close()
})

test('收据到达前的陈旧 idle 不会提前结束这一轮', async () => {
  const client = fakeClient(sid => [
    ev(sid, 'assistant/message', { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '真答案' }] } }),
    idle(sid),
  ])
  // 上一轮残留在订阅里的 idle：排在本轮收据之前
  client.push(idle('s7'))
  const pool = new DshPool({ createClient: () => client })
  const r = await pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's7', text: 'a', onEvent: () => {} })
  assert.equal(r.finalText, '真答案')
  await pool.close()
})

test('中途中止：busy 保留到该会话真正 idle 之后才释放', async () => {
  const client = fakeClient(() => [])
  const pool = new DshPool({ createClient: () => client })
  const ac = new AbortController()
  const p = pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's8', text: 'a', onEvent: () => {}, signal: ac.signal })
  await tick()
  ac.abort()
  // run 只在收到下一条通知后才察觉中止；推一条让它回到循环顶部
  client.push(ev('s8', 'assistant/chunk', { chunk: { type: 'text-delta', index: 0, text: '半' } }))
  await p
  // 子进程仍在为这个会话生成：此时放开 busy 会让下一条消息串进同一轮
  assert.equal(pool.isBusy('s8'), true)
  client.push(idle('s8'))
  await tick()
  assert.equal(pool.isBusy('s8'), false)
  await pool.close()
})

test('buildChildEnv 只透传白名单变量', () => {
  const out = buildChildEnv({
    PATH: '/usr/bin', HOME: '/home/x',
    DEEPSEEK_API_KEY: 'ds', MINIMAX_API_KEY: 'mm',
    AWS_SECRET_ACCESS_KEY: '不该外泄', ADMIN_PASSWORD: '不该外泄', npm_config_registry: 'x',
  })
  assert.deepEqual(Object.keys(out).sort(), [
    'DEEPSEEK_API_KEY', 'DSH_HOME', 'DSH_TELEMETRY_DISABLED', 'HOME',
    'LINGSHU_ENGINES', 'LINGSHU_PERSONA', 'LINGSHU_SKILLS_DIR', 'MINIMAX_API_KEY', 'PATH',
  ])
  assert.equal(out.PATH, '/usr/bin')
  assert.equal(out.DEEPSEEK_API_KEY, 'ds')
  assert.equal(out.DSH_TELEMETRY_DISABLED, '1')
  // 缺失的密钥退化为空串而不是 undefined（避免子进程继承父进程同名变量）
  assert.equal(buildChildEnv({}).MINIMAX_API_KEY, '')
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

// ── 超时相关回归 ────────────────────────────────────────────────────────────

test('超时时在途的 next() 不能被丢弃：idle 到了就要释放 busy', async () => {
  // 本轮迟迟不结束 → 触发 TIMEOUT；随后 idle 才到。
  // 旧实现里 Promise.race 输给 deadline 的那个 sub.next() 结果被直接丢掉，
  // 若丢掉的正是 idle，drainToIdle 会白等下一个永不到来的 idle，
  // 会话要多 busy 整整一个 turnTimeout。
  const client = fakeClient(() => [])
  const pool = new DshPool({ createClient: () => client, turnTimeoutMs: 30 })
  const sid = 's-timeout'

  await assert.rejects(
    pool.run({ routeKey: DEFAULT_ROUTE, sessionId: sid, text: '你好', onEvent: () => {} }),
    err => err.code === 'TIMEOUT',
  )
  assert.equal(pool.isBusy(sid), true, '超时后应仍标记 busy，等待后台排空')

  // idle 在超时之后才到达：必须被在途的那次 next() 接住
  client.push(idle(sid))
  for (let i = 0; i < 40 && pool.isBusy(sid); i++) await tick(5)
  assert.equal(pool.isBusy(sid), false, 'idle 到达后应尽快释放 busy，而不是等满一个超时周期')
  await pool.close()
})

test('静默超时会因持续输出而续期：长回复不会被中途判超时', async () => {
  const client = fakeClient(() => [])
  const pool = new DshPool({ createClient: () => client, turnTimeoutMs: 60 })
  const sid = 's-long'
  const seen = []

  const running = pool.run({
    routeKey: DEFAULT_ROUTE, sessionId: sid, text: '写一份长报告',
    onEvent: e => { if (e.type === 'text') seen.push(e.delta) },
  })

  // 每 30ms 吐一小段，总时长（~180ms）远超 60ms 的静默超时；
  // 只要计时随每条通知重置，这一轮就不该超时。
  for (let i = 0; i < 6; i++) {
    await tick(30)
    client.push(ev(sid, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: `第${i}段` } }))
  }
  client.push(idle(sid))

  const r = await running
  assert.ok(seen.length >= 3, `应收到多段增量，实际 ${seen.length} 段`)
  assert.equal(pool.isBusy(sid), false)
  await pool.close()
})

test('握手失败时关闭子进程，不留孤儿', async () => {
  let closed = 0
  const bad = {
    async start() {},
    async initialize() { throw new Error('boom') },
    subscribeSessionTree() { return { next: () => new Promise(() => {}), close() {} } },
    async close() { closed++ },
  }
  const pool = new DshPool({ createClient: () => bad, turnTimeoutMs: 50 })
  await assert.rejects(pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's-bad', text: 'hi', onEvent: () => {} }))
  for (let i = 0; i < 20 && closed === 0; i++) await tick(5)
  assert.equal(closed, 1, '初始化失败的客户端必须被 close()，否则子进程一直挂着')
  await pool.close()
})
