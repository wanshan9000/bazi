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

test('models 列表', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    const m = await (await fetch(`${base}/api/agent/models`)).json()
    assert.ok(m.routes.find(r => r.key === 'deepseek-flash'))
  } finally { srv.close() }
})
