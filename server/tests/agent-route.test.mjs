import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAgentRouter } from '../routes/agent.js'
import { createAgentStore } from '../dsh/agentStore.js'
import { createAccountStore } from '../accounts.js'
import { signJwt } from '../jwt.js'
import { resolveJwtSecret } from '../config.js'

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-'))
  const store = createAgentStore(path.join(dir, 'db.json'))
  const accounts = createAccountStore(path.join(dir, 'accounts.json'))
  const app = express()
  app.use(express.json())
  app.use('/api', createAgentRouter({ pool, store, accounts }))
  return { app, store, accounts }
}

// 建一个真账号并签一张真 token —— 身份不再是「请求头里写什么就是什么」，
// 测试也必须走真实路径，否则测的就不是上线后的行为。
async function mkUser(accounts, account = 'u1') {
  const u = await accounts.create({ account, password: 'secret123', nickname: '缘主' })
  return { id: u.id, token: signJwt({ sub: u.id }, resolveJwtSecret(), { expiresInSec: 3600 }) }
}
const bearer = t => ({ authorization: `Bearer ${t}` })
const guest = id => ({ 'x-genki-uid': `anon:${id}` })

test('chat 流式返回并镜像消息', async () => {
  const { app, store, accounts } = mkApp(fakePool([{ type: 'text', delta: '你' }, { type: 'text', delta: '好' }, { type: 'done', reason: 'completed' }]))
  const me = await mkUser(accounts)
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ text: '嗨' }) })
    assert.equal(res.headers.get('content-type').split(';')[0], 'text/event-stream')
    // 没有它，nginx 之类的反代会缓冲整条 SSE，流式回复会攒成一坨才到前端
    assert.equal(res.headers.get('x-accel-buffering'), 'no')
    const body = await res.text()
    const frames = body.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    assert.equal(frames[0].type, 'session')
    assert.equal(frames.at(-1).type, 'done')
    const msgs = store.listMessages(me.id, frames[0].sessionId)
    assert.deepEqual(msgs.map(m => [m.role, m.text]), [['user', '嗨'], ['ai', '你好']])
  } finally { srv.close() }
})

test('缺身份 → 401；text 超长 → 400', async () => {
  const { app, accounts } = mkApp(fakePool([]))
  const me = await mkUser(accounts)
  const { srv, base } = await listen(app)
  try {
    const r1 = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x' }) })
    assert.equal(r1.status, 401)
    const r2 = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ text: 'x'.repeat(2001) }) })
    assert.equal(r2.status, 400)
  } finally { srv.close() }
})

// 整改的核心：以前 `X-Genki-Uid: <别人的账号 id>` 就能把别人的会话读走、删掉。
test('自报账号 uid 不再能冒充任何人', async () => {
  const { app, store, accounts } = mkApp(fakePool([]))
  const victim = await mkUser(accounts, 'victim')
  const s = store.createSession(victim.id, { route: 'deepseek-flash', title: '私密对话' })
  const { srv, base } = await listen(app)
  try {
    const forged = await fetch(`${base}/api/agent/sessions`, { headers: { 'x-genki-uid': victim.id } })
    assert.equal(forged.status, 401, '拿别人的 uid 当身份必须被拒')

    const del = await fetch(`${base}/api/agent/sessions/${s.id}`, { method: 'DELETE', headers: { 'x-genki-uid': victim.id } })
    assert.equal(del.status, 401)
    assert.equal(store.listSessions(victim.id).length, 1, '别人的会话必须原封不动')

    // 过期 token 同样不行
    const expired = signJwt({ sub: victim.id }, resolveJwtSecret(), { expiresInSec: -1 })
    assert.equal((await fetch(`${base}/api/agent/sessions`, { headers: bearer(expired) })).status, 401)
  } finally { srv.close() }
})

// token 还没过期、但账号已经注销：不能让一张废 token 继续在无主 uid 下写数据。
test('账号注销后，未过期的 token 也不再放行', async () => {
  const { app, accounts } = mkApp(fakePool([]))
  const me = await mkUser(accounts, 'gone')
  accounts.remove(me.id)
  const { srv, base } = await listen(app)
  try {
    assert.equal((await fetch(`${base}/api/agent/sessions`, { headers: bearer(me.token) })).status, 401)
  } finally { srv.close() }
})

test('sessions 列表/消息/删除按账号隔离', async () => {
  const { app, store, accounts } = mkApp(fakePool([]))
  const a = await mkUser(accounts, 'ua')
  const b = await mkUser(accounts, 'ub')
  const s = store.createSession(a.id, { route: 'deepseek-flash', title: 'T' })
  const { srv, base } = await listen(app)
  try {
    const l = await (await fetch(`${base}/api/agent/sessions`, { headers: bearer(a.token) })).json()
    assert.equal(l.sessions.length, 1)
    const other = await fetch(`${base}/api/agent/sessions/${s.id}/messages`, { headers: bearer(b.token) })
    assert.equal(other.status, 404)
    const del = await (await fetch(`${base}/api/agent/sessions/${s.id}`, { method: 'DELETE', headers: bearer(a.token) })).json()
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
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts)
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ text: '嗨' }) })
    const body = await res.text()
    const frames = body.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    assert.equal(frames.at(-1).type, 'error')
    assert.ok(!frames.some(f => f.type === 'done'))
    // 这一轮吐了「部分」正文才报错，属于有产出，照常收费
    assert.equal(accounts.get(me.id).creditsUsed, 1)
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
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts)
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ text: '嗨' }) })
    const body = await res.text()
    const frames = body.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    assert.ok(frames.some(f => f.type === 'text' && f.delta === 'ok'))
    assert.equal(aborted, false)
    assert.equal(accounts.get(me.id).creditsUsed, 1, '有产出的一轮按 agent.chat 扣 1 分')
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
  const { app, accounts } = mkApp(fakePool([]))
  const me = await mkUser(accounts, 'flooder')
  const { srv, base } = await listen(app)
  try {
    let last = 200
    for (let i = 0; i < 21; i++) {
      last = (await fetch(`${base}/api/agent/sessions`, { headers: bearer(me.token) })).status
    }
    assert.equal(last, 429)
    // /models 不带 uid，不参与限流
    assert.equal((await fetch(`${base}/api/agent/models`)).status, 200)
  } finally { srv.close() }
})

// 游客标识是客户端自报的，只按它分桶等于没有闸门：每次换一个新的计数就清零。
// 必须还有一层只按来源 IP 的桶把总量摁住。
test('限流：轮换游客标识也绕不过按 IP 的闸门', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    let last = 200
    let sent = 0
    // 每个 uid 只发 1 次，uid 桶永远只有 1 —— 唯一能拦住的只有 IP 桶。
    for (let i = 0; i < 80 && last !== 429; i++) {
      last = (await fetch(`${base}/api/agent/sessions`, { headers: guest(`flood-${i}`) })).status
      sent++
    }
    assert.equal(last, 429, `轮换 ${sent} 个 uid 后仍未被限流`)
    assert.ok(sent > 10, '不应把单个游客的额度算到 IP 桶上，IP 闸门要比游客闸门宽')
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
      headers: { 'content-type': 'application/json', ...guest('chart') },
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
      headers: { 'content-type': 'application/json', ...guest('c1') },
      body: JSON.stringify({ text: '排盘', chart: { year: 1990, month: 5, day: 6, hour: 8, gender: '男' } }),
    })
    assert.match(captured[0], /当前缘主命盘.*1990年5月6日 8时 男/)

    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...guest('c2') },
      body: JSON.stringify({ text: '排盘', chart: { year: 1990, month: 5, day: 6, gender: '女' } }),
    })
    assert.match(captured[1], /时辰未知/, '缺 hour 应标注未知，而不是补成 12 时')
  } finally { srv.close() }
})

test('聊天内排出命盘后，会话历史以命盘摘要命名', async () => {
  const pool = {
    isBusy: () => false,
    async run({ onEvent }) {
      onEvent({ type: 'tool_call', name: 'bazi', args: { year: 1975, month: 10, day: 13, hour: 6, gender: '男' } })
      onEvent({ type: 'tool_result', name: 'bazi', ok: true, kind: 'data', text: '排盘成功' })
      onEvent({ type: 'text', delta: '已排盘' })
      return { finalText: '已排盘', usage: null, title: null }
    },
  }
  const { app, store } = mkApp(pool)
  const { srv, base } = await listen(app)
  try {
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...guest('bazi-title') },
      body: JSON.stringify({ text: '1975年10月13日早上6点，男，帮我排盘' }),
    })
    const [session] = store.listSessions('anon:bazi-title')
    assert.equal(session.chartKey, '1975-10-13-6-男')
    assert.equal(session.title, '乾造 · 1975年10月13日 · 卯时')
  } finally { srv.close() }
})

// 游客聊过之后登录，uid 从 anon:xxx 变成账号 id；不做过户的话之前的会话直接消失。
test('登录后可认领游客会话，且只能认领匿名标识的', async () => {
  const { app, store, accounts } = mkApp(fakePool([]))
  const me = await mkUser(accounts, 'claimer')
  const other = await mkUser(accounts, 'other')
  const guestUid = 'anon:dev123'
  store.createSession(guestUid, { route: 'deepseek-flash', title: '游客聊的' })
  store.createSession(other.id, { route: 'deepseek-flash', title: '别人的' })
  const { srv, base } = await listen(app)
  try {
    const r = await (await fetch(`${base}/api/agent/sessions/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ from: guestUid }),
    })).json()
    assert.equal(r.ok, true)
    assert.equal(r.moved, 1)
    assert.equal(store.listSessions(me.id).length, 1)
    assert.equal(store.listSessions(guestUid).length, 0)

    // 非匿名来源必须拒绝，否则这就成了「把别人会话搬走」的接口
    const bad = await fetch(`${base}/api/agent/sessions/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ from: other.id }),
    })
    assert.equal(bad.status, 400)
    assert.equal(store.listSessions(other.id).length, 1, '别人的会话必须原封不动')
  } finally { srv.close() }
})

// 扣了钱却一个字都没产出（密钥错、路由挂了）——不能让用户为一条报错买单。
test('一轮完全没有产出时退还积分', async () => {
  const pool = {
    isBusy: () => false,
    async run({ onEvent }) {
      onEvent({ type: 'error', code: 'CLOSED', message: '子进程已退出' })
      return { finalText: '', usage: null, title: null }
    },
  }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'refundee')
  const { srv, base } = await listen(app)
  try {
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '嗨' }),
    })
    assert.equal(accounts.get(me.id).creditsUsed, 0, '无产出的一轮必须退还积分')
  } finally { srv.close() }
})

// 积分不足时不该把请求打到付费模型上，也不该留下一条空会话。
test('积分不足时 /agent/chat 返回 402，且没有真的调用模型', async () => {
  let called = 0
  const pool = { isBusy: () => false, async run({ onEvent }) { called++; onEvent({ type: 'done', reason: 'completed' }); return { finalText: 'x', usage: null, title: null } } }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'broke')
  // 把额度花光
  while (accounts.consumeCredit(me.id, 'agent.chat').ok) { /* 一直扣到不足为止 */ }
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '嗨' }),
    })
    assert.equal(res.status, 402)
    assert.equal((await res.json()).reason, 'insufficient')
    assert.equal(called, 0, '扣不动积分就不该调用模型')
  } finally { srv.close() }
})

// 游客的桶必须比登录用户紧：游客标识换一个就是新桶，松了等于没有闸门。
test('游客的单桶额度比登录用户紧', async () => {
  const { app, accounts } = mkApp(fakePool([]))
  const me = await mkUser(accounts, 'paid')
  const { srv, base } = await listen(app)
  try {
    let guestHits = 0
    while (guestHits < 40) {
      const st = (await fetch(`${base}/api/agent/sessions`, { headers: guest('samedev') })).status
      if (st === 429) break
      guestHits++
    }
    let userHits = 0
    while (userHits < 40) {
      const st = (await fetch(`${base}/api/agent/sessions`, { headers: bearer(me.token) })).status
      if (st === 429) break
      userHits++
    }
    assert.ok(guestHits < userHits, `游客额度(${guestHits}) 应小于登录用户(${userHits})`)
  } finally { srv.close() }
})
