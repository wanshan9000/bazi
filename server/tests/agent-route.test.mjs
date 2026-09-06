import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAgentRouter } from '../routes/agent.js'
import { createAgentStore } from '../dsh/agentStore.js'

function fakePool(events) {
  return {
    isBusy: () => false,
    async run({ onEvent }) { for (const e of events) onEvent(e); return { finalText: events.filter(e => e.type === 'text').map(e => e.delta).join(''), usage: null, title: null } },
  }
}

async function listen(app) {
  return new Promise(res => { const srv = app.listen(0, () => res({ srv, base: `http://127.0.0.1:${srv.address().port}` })) })
}

function mkApp(pool) {
  const store = createAgentStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ar-')), 'db.json'))
  const app = express()
  app.use(express.json())
  app.use('/api', createAgentRouter({ pool, store }))
  return { app, store }
}

test('chat 流式返回并镜像消息', async () => {
  const { app, store } = mkApp(fakePool([{ type: 'text', delta: '你' }, { type: 'text', delta: '好' }, { type: 'done', reason: 'completed' }]))
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-genki-uid': 'u1' }, body: JSON.stringify({ text: '嗨' }) })
    assert.equal(res.headers.get('content-type').split(';')[0], 'text/event-stream')
    // 没有它，nginx 之类的反代会缓冲整条 SSE，流式回复会攒成一坨才到前端
    assert.equal(res.headers.get('x-accel-buffering'), 'no')
    const body = await res.text()
    const frames = body.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    assert.equal(frames[0].type, 'session')
    assert.equal(frames.at(-1).type, 'done')
    const msgs = store.listMessages('u1', frames[0].sessionId)
    assert.deepEqual(msgs.map(m => [m.role, m.text]), [['user', '嗨'], ['ai', '你好']])
  } finally { srv.close() }
})

test('缺 uid → 400；text 超长 → 400', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    const r1 = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x' }) })
    assert.equal(r1.status, 400)
    const r2 = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-genki-uid': 'u1' }, body: JSON.stringify({ text: 'x'.repeat(2001) }) })
    assert.equal(r2.status, 400)
  } finally { srv.close() }
})

test('sessions 列表/消息/删除按 uid 隔离', async () => {
  const { app, store } = mkApp(fakePool([]))
  const s = store.createSession('u1', { route: 'deepseek-flash', title: 'T' })
  const { srv, base } = await listen(app)
  try {
    const l = await (await fetch(`${base}/api/agent/sessions`, { headers: { 'x-genki-uid': 'u1' } })).json()
    assert.equal(l.sessions.length, 1)
    const other = await fetch(`${base}/api/agent/sessions/${s.id}/messages`, { headers: { 'x-genki-uid': 'u2' } })
    assert.equal(other.status, 404)
    const del = await (await fetch(`${base}/api/agent/sessions/${s.id}`, { method: 'DELETE', headers: { 'x-genki-uid': 'u1' } })).json()
    assert.equal(del.ok, true)
  } finally { srv.close() }
})

test('turn/end 错误：不再补发 done', async () => {
  const pool = {
    isBusy: () => false,
    async run({ onEvent }) {
      onEvent({ type: 'text', delta: '部分' })
      onEvent({ type: 'error', code: 'AUTH', message: 'bad key' })
      return { finalText: '', usage: null, title: null }
    },
  }
  const { app } = mkApp(pool)
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-genki-uid': 'u1' }, body: JSON.stringify({ text: '嗨' }) })
    const body = await res.text()
    const frames = body.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    assert.equal(frames.at(-1).type, 'error')
    assert.ok(!frames.some(f => f.type === 'done'))
  } finally { srv.close() }
})

test('请求体读完不应提前中止 pool.run 的 signal', async () => {
  let aborted
  const pool = {
    isBusy: () => false,
    async run({ onEvent, signal }) {
      await new Promise(r => setTimeout(r, 30))
      aborted = signal.aborted
      onEvent({ type: 'text', delta: 'ok' })
      return { finalText: 'ok', usage: null, title: null }
    },
  }
  const { app } = mkApp(pool)
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-genki-uid': 'u1' }, body: JSON.stringify({ text: '嗨' }) })
    const body = await res.text()
    const frames = body.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    assert.ok(frames.some(f => f.type === 'text' && f.delta === 'ok'))
    assert.equal(aborted, false)
  } finally { srv.close() }
})

test('models 列表', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    const m = await (await fetch(`${base}/api/agent/models`)).json()
    assert.ok(m.routes.find(r => r.key === 'deepseek-flash'))
  } finally { srv.close() }
})

test('限流覆盖整个 /agent/*（不只是 /chat）', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    let last = 200
    for (let i = 0; i < 21; i++) {
      last = (await fetch(`${base}/api/agent/sessions`, { headers: { 'x-genki-uid': 'flood' } })).status
    }
    assert.equal(last, 429)
    // /models 不带 uid，不参与限流
    assert.equal((await fetch(`${base}/api/agent/models`)).status, 200)
  } finally { srv.close() }
})

// uid 是客户端自报的，只按 uid 分桶等于没有闸门：每次换一个新 uid 计数就清零。
// 必须还有一层只按来源 IP 的桶把总量摁住。
test('限流：轮换 uid 也绕不过按 IP 的闸门', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    let last = 200
    let sent = 0
    // 每个 uid 只发 1 次，uid 桶永远只有 1 —— 唯一能拦住的只有 IP 桶。
    for (let i = 0; i < 80 && last !== 429; i++) {
      last = (await fetch(`${base}/api/agent/sessions`, { headers: { 'x-genki-uid': `flood-${i}` } })).status
      sent++
    }
    assert.equal(last, 429, `轮换 ${sent} 个 uid 后仍未被限流`)
    assert.ok(sent > 20, '不应把单 uid 的额度算到 IP 桶上，IP 闸门要比 uid 闸门宽')
  } finally { srv.close() }
})

// chart 里的字段会被直接拼进 prompt。不校验的话，MAX_TEXT（2000 字）那道闸门
// 可以被绕开：把几十 KB 文本塞进 chart.gender 即可。
test('chart 字段非法/超长时不得进入 prompt', async () => {
  const captured = []
  const pool = {
    isBusy: () => false,
    async run({ text, onEvent }) {
      captured.push(text)
      onEvent({ type: 'done', reason: 'completed' })
      return { finalText: '好', usage: null, title: null }
    },
  }
  const { app } = mkApp(pool)
  const { srv, base } = await listen(app)
  try {
    const huge = 'A'.repeat(50000)
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-genki-uid': 'u-chart' },
      body: JSON.stringify({ text: '你好', chart: { year: 1990, month: 5, day: 6, hour: 8, gender: huge } }),
    })
    assert.equal(captured.length, 1)
    assert.ok(!captured[0].includes('AAAA'), '非法 gender 不该出现在 prompt 里')
    assert.ok(captured[0].length < 500, `prompt 被撑大到 ${captured[0].length} 字`)
    assert.ok(!captured[0].includes('当前缘主命盘'), '命盘非法时不应拼命盘行')
  } finally { srv.close() }
})

test('合法 chart 会拼出命盘行；时辰未知不伪装成 12 时', async () => {
  const captured = []
  const pool = {
    isBusy: () => false,
    async run({ text, onEvent }) {
      captured.push(text)
      onEvent({ type: 'done', reason: 'completed' })
      return { finalText: '好', usage: null, title: null }
    },
  }
  const { app } = mkApp(pool)
  const { srv, base } = await listen(app)
  try {
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-genki-uid': 'u-c1' },
      body: JSON.stringify({ text: '排盘', chart: { year: 1990, month: 5, day: 6, hour: 8, gender: '男' } }),
    })
    assert.match(captured[0], /当前缘主命盘.*1990年5月6日 8时 男/)

    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-genki-uid': 'u-c2' },
      body: JSON.stringify({ text: '排盘', chart: { year: 1990, month: 5, day: 6, gender: '女' } }),
    })
    assert.match(captured[1], /时辰未知/, '缺 hour 应标注未知，而不是补成 12 时')
  } finally { srv.close() }
})

// 游客聊过之后登录，uid 从 anon:xxx 变成账号 id；不做过户的话之前的会话直接消失。
test('登录后可认领游客会话，且只能认领匿名 uid 的', async () => {
  const { app, store } = mkApp(fakePool([]))
  const guest = 'anon:dev123'
  store.createSession(guest, { route: 'deepseek-flash', title: '游客聊的' })
  store.createSession('u-other', { route: 'deepseek-flash', title: '别人的' })
  const { srv, base } = await listen(app)
  try {
    const r = await (await fetch(`${base}/api/agent/sessions/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-genki-uid': 'u-me' },
      body: JSON.stringify({ from: guest }),
    })).json()
    assert.equal(r.ok, true)
    assert.equal(r.moved, 1)
    assert.equal(store.listSessions('u-me').length, 1)
    assert.equal(store.listSessions(guest).length, 0)

    // 非匿名来源必须拒绝，否则这就成了「把别人会话搬走」的接口
    const bad = await fetch(`${base}/api/agent/sessions/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-genki-uid': 'u-me' },
      body: JSON.stringify({ from: 'u-other' }),
    })
    assert.equal(bad.status, 400)
    assert.equal(store.listSessions('u-other').length, 1, '别人的会话必须原封不动')
  } finally { srv.close() }
})
