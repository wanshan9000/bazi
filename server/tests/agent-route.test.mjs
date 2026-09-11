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

function fakePool(events, { timing = null } = {}) {
  return {
    isBusy: () => false,
    async run({ onEvent }) { for (const e of events) onEvent(e); return { finalText: events.filter(e => e.type === 'text').map(e => e.delta).join(''), usage: null, title: null, timing } },
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
const sseFrames = body => body.split('\n\n').filter(frame => frame.startsWith('data: ')).map(frame => JSON.parse(frame.replace(/^data: /, '')))

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

test('完成帧与会话只记录 Agent 耗时指标', async () => {
  // 若路由层忘了转存 pool timing，性能排查会退化成只能靠主观感受“好像慢”。
  const timing = { firstEventMs: 83, firstTextMs: 126, totalMs: 912 }
  const { app, store, accounts } = mkApp(fakePool([{ type: 'text', delta: '已整理。' }], { timing }))
  const me = await mkUser(accounts, 'timing-user')
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ text: '看看事业' }),
    })
    const frames = sseFrames(await res.text())
    const sid = frames.find(frame => frame.type === 'session').sessionId
    assert.deepEqual(frames.at(-1).timing, timing)
    assert.deepEqual(store.getSession(me.id, sid).lastTiming, timing)
  } finally { srv.close() }
})

test('报告咨询会话在历史中使用清晰的报告来源标题', async () => {
  const { app, store, accounts } = mkApp(fakePool([{ type: 'text', delta: '可以继续问。' }]))
  const me = await mkUser(accounts, 'report-title')
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '报告咨询：奇门遁甲\n我正在阅读奇门遁甲报告。请解释当前报告。' }),
    })
    const frames = sseFrames(await res.text())
    const sessionId = frames.find(frame => frame.type === 'session').sessionId
    assert.equal(store.getSession(me.id, sessionId).title, '奇门遁甲报告咨询')
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

test('客者可免费体验一个咨询主题，最多获得十次具体问题解读', async () => {
  const { app, store } = mkApp(fakePool([{ type: 'text', delta: '已解答你的具体问题，建议稳住节奏。' }]))
  const { srv, base } = await listen(app)
  try {
    let sessionId = null
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${base}/api/agent/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...guest('trial-user') }, body: JSON.stringify({ sessionId, text: `第${i + 1}次：今年财运如何？` }),
      })
      assert.equal(res.status, 200)
      const frames = sseFrames(await res.text())
      sessionId = frames.find(frame => frame.type === 'session').sessionId
      const consultation = frames.find(frame => frame.type === 'consultation')?.consultation
      assert.equal(consultation.remainingRounds, 9 - i)
    }
    const exhausted = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...guest('trial-user') }, body: JSON.stringify({ sessionId, text: '第十一次：今年财运如何？' }),
    })
    // 单 uid 的安全限流仍保持每分钟 10 次，因此第 11 次会先命中安全层；
    // 不放宽防刷规则，只验证客者主题已正确用满 10 轮。
    assert.ok([402, 429].includes(exhausted.status))
    if (exhausted.status === 402) assert.equal((await exhausted.json()).reason, 'guest_limit')
    assert.equal(store.getSession('anon:trial-user', sessionId).consultation.remainingRounds, 0)
  } finally { srv.close() }
})

test('寒暄、补充资料与仅澄清信息不消耗具体问题解读次数', async () => {
  // 防止退回“只要模型吐字就扣一次”的旧规则：用户真正得到的咨询判断才应消耗主题额度。
  const pool = {
    isBusy: () => false,
    async run({ text, onEvent }) {
      const answer = text.includes('今年财运如何')
        ? '## 财运判断\n今年宜稳中求进，先守住现金流。'
        : text.includes('1995年')
          ? '请补充出生时辰与想重点咨询的问题，我再为你排盘。'
          : '你好，我一直都在。你可以先说说想从哪个方向开始聊，我会结合你提供的信息逐步解答。'
      onEvent({ type: 'text', delta: answer })
      return { finalText: answer, usage: null, title: null }
    },
  }
  const { app } = mkApp(pool)
  const { srv, base } = await listen(app)
  try {
    const first = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...guest('effective-rounds') }, body: JSON.stringify({ text: 'Hi，你回来了' }),
    })
    const firstFrames = sseFrames(await first.text())
    const sessionId = firstFrames.find(frame => frame.type === 'session').sessionId
    assert.equal(firstFrames.find(frame => frame.type === 'consultation').consultation.remainingRounds, 10)

    const details = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...guest('effective-rounds') }, body: JSON.stringify({ sessionId, text: '1995年6月15日，女' }),
    })
    assert.equal(sseFrames(await details.text()).find(frame => frame.type === 'consultation').consultation.remainingRounds, 10)

    const consultation = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...guest('effective-rounds') }, body: JSON.stringify({ sessionId, text: '今年财运如何' }),
    })
    assert.equal(sseFrames(await consultation.text()).find(frame => frame.type === 'consultation').consultation.remainingRounds, 9)
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
    // 有错误结束的半截输出不算成功回答，不开启主题也不扣点。
    assert.equal(accounts.get(me.id).permanentCredits, 20)
  } finally { srv.close() }
})

test('请求体读完不应提前中止 pool.run 的 signal', async () => {
  let aborted
  const pool = {
    isBusy: () => false,
    async run({ onEvent, signal }) {
      await new Promise(r => setTimeout(r, 30))
      aborted = signal.aborted
      onEvent({ type: 'text', delta: '你的事业趋势适合稳中求进，建议先做好长期积累。' })
      return { finalText: '你的事业趋势适合稳中求进，建议先做好长期积累。', usage: null, title: null }
    },
  }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts)
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ text: '请解读我的事业趋势' }) })
    const body = await res.text()
    const frames = body.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    assert.ok(frames.some(f => f.type === 'text' && f.delta.includes('事业趋势')))
    assert.equal(aborted, false)
    assert.equal(accounts.get(me.id).permanentCredits, 15, '首次成功回答开启主题，扣 5 点永久积分')
  } finally { srv.close() }
})

test('付费咨询主题在首次成功回答时扣五点，同一主题八次具体问题解读内不重复扣款', async () => {
  const { app, store, accounts } = mkApp(fakePool([{ type: 'text', delta: '已解答你的具体问题，建议稳住节奏。' }]))
  const me = await mkUser(accounts, 'topic-member')
  const { srv, base } = await listen(app)
  try {
    let sessionId = null
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${base}/api/agent/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ sessionId, text: `第${i + 1}次：今年事业如何？` }),
      })
      assert.equal(res.status, 200)
      const frames = sseFrames(await res.text())
      sessionId = frames.find(frame => frame.type === 'session').sessionId
      const consultation = frames.find(frame => frame.type === 'consultation')?.consultation
      assert.equal(consultation.remainingRounds, 7 - i)
    }
    assert.equal(accounts.get(me.id).permanentCredits, 15, '八轮主题只扣一次 5 点')
    assert.equal(store.getSession(me.id, sessionId).consultation.remainingRounds, 0)
    const exhausted = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ sessionId, text: '第九问' }),
    })
    assert.equal(exhausted.status, 402)
    assert.equal((await exhausted.json()).reason, 'topic_exhausted')
    assert.equal(accounts.get(me.id).permanentCredits, 15)
  } finally { srv.close() }
})

test('主题用尽后续问沿用同一会话并保留上下文', async () => {
  // 若续问被迫新建 session，DSH 拿到的是空白上下文，用户会感觉“昨天聊过的全忘了”。
  const { app, store, accounts } = mkApp(fakePool([{ type: 'text', delta: '已解答你的具体问题，建议稳住节奏。' }]))
  const me = await mkUser(accounts, 'topic-continuation')
  const { srv, base } = await listen(app)
  try {
    let sessionId = null
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${base}/api/agent/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ sessionId, text: `第${i + 1}次：今年事业如何？` }),
      })
      sessionId = sseFrames(await res.text()).find(frame => frame.type === 'session').sessionId
    }
    const continued = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ sessionId, text: '继续追问昨天的选择', renew: true }),
    })
    assert.equal(continued.status, 200)
    const frames = sseFrames(await continued.text())
    assert.equal(frames.find(frame => frame.type === 'session').sessionId, sessionId)
    assert.equal(frames.find(frame => frame.type === 'consultation').consultation.remainingRounds, 7)
    assert.equal(store.listSessions(me.id).length, 1, '续问不能另建一条失忆会话')
    assert.equal(accounts.get(me.id).permanentCredits, 10, '每个八轮主题仍按原规则扣五点')
  } finally { srv.close() }
})

test('过期的咨询主题未经确认不能继续', async () => {
  const { app, store, accounts } = mkApp(fakePool([{ type: 'text', delta: '已解答你的具体问题，建议稳住节奏。' }]))
  const me = await mkUser(accounts, 'topic-expired')
  const { srv, base } = await listen(app)
  try {
    const first = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ text: '请解读我的事业趋势' }),
    })
    const sessionId = sseFrames(await first.text()).find(frame => frame.type === 'session').sessionId
    const session = store.getSession(me.id, sessionId)
    store.updateSession(me.id, sessionId, { consultation: { ...session.consultation, expiresAt: Date.now() - 1 } })
    const expired = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify({ sessionId, text: '续问' }),
    })
    assert.equal(expired.status, 402)
    assert.equal((await expired.json()).reason, 'topic_expired')
  } finally { srv.close() }
})

test('models 列表', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    const m = await (await fetch(`${base}/api/agent/models`)).json()
    assert.ok(m.routes.find(r => r.key === 'minimax'))
    assert.equal(m.routes.some(r => r.key === 'deepseek-flash'), false, '没有 DeepSeek 凭据时不能展示不可用的快速模型')
    assert.equal(m.default, 'minimax')
  } finally { srv.close() }
})

test('黄历 AI 解读：先计算事实、调用一次后缓存且只扣一次积分', async () => {
  const prompts = []
  const pool = {
    isBusy: () => false,
    async run({ text }) {
      prompts.push(text)
      return { finalText: '## 今日判断\n稳住节奏。\n\n## 安排重点\n先完成沟通。\n\n## 提醒\n别仓促拍板。', usage: null, title: null }
    },
  }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'huangli-insight')
  const { srv, base } = await listen(app)
  const body = { date: '2026-09-10', scenario: 'worker', chart: { year: 1995, month: 6, day: 15, hour: 12, gender: '女' } }
  try {
    const first = await (await fetch(`${base}/api/agent/huangli-insight`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify(body),
    })).json()
    assert.equal(first.ok, true)
    assert.equal(first.cached, false)
    assert.match(first.text, /今日判断/)
    assert.equal(prompts.length, 1)
    assert.match(prompts[0], /严格遵守“huangli” Skill/)
    assert.match(prompts[0], /传统/)
    assert.equal(accounts.get(me.id).permanentCredits, 19)

    const second = await (await fetch(`${base}/api/agent/huangli-insight`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) }, body: JSON.stringify(body),
    })).json()
    assert.equal(second.ok, true)
    assert.equal(second.cached, true)
    assert.equal(prompts.length, 1, '缓存命中不应再次调用模型')
    assert.equal(accounts.get(me.id).permanentCredits, 19, '缓存命中不应再次扣分')
  } finally { srv.close() }
})

test('黄历 AI 解读：模型无内容时退还积分', async () => {
  const pool = { isBusy: () => false, async run() { return { finalText: '', usage: null, title: null } } }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'huangli-refund')
  const { srv, base } = await listen(app)
  try {
    const response = await fetch(`${base}/api/agent/huangli-insight`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ date: '2026-09-10', scenario: 'worker' }),
    })
    assert.equal(response.status, 502)
    assert.equal(accounts.get(me.id).permanentCredits, 20)
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
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'chart-invalid')
  const { srv, base } = await listen(app)
  try {
    const huge = 'A'.repeat(50000)
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
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
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'chart-valid')
  const { srv, base } = await listen(app)
  try {
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '排盘', chart: { year: 1990, month: 5, day: 6, hour: 8, gender: '男' } }),
    })
    assert.match(captured[0], /当前缘主命盘.*1990年5月6日 8时 男/)

    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '排盘', chart: { year: 1990, month: 5, day: 6, gender: '女' } }),
    })
    assert.match(captured[1], /时辰未知/, '缺 hour 应标注未知，而不是补成 12 时')
  } finally { srv.close() }
})

test('完整出生信息首次进入会话时，提示模型先校盘再在同一轮回答问题', async () => {
  const captured = []
  const pool = {
    isBusy: () => false,
    async run({ text, onEvent }) {
      captured.push(text)
      onEvent({ type: 'text', delta: '答复' })
      return { finalText: '答复', usage: null, title: null }
    },
  }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'bazi-calibration')
  const { srv, base } = await listen(app)
  try {
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '我是1990年5月6日早上8点出生的男生，今年适合换工作吗？' }),
    })

    assert.match(captured[0], /【排盘校验任务】/)
    assert.match(captured[0], /^\/mangpai\b/, '完整生辰只注入实际要执行的默认盲派 Skill')
    assert.doesNotMatch(captured[0], /^\/bazi-router\b/, '流派选择已由服务端完成，首轮不应重复注入只负责路由的 Skill')
    assert.match(captured[0], /必须先调用 `bazi` 工具/)
    assert.match(captured[0], /同一轮继续回答用户这次的具体问题/)
    assert.match(captured[0], /标题必须独占一行/)
    assert.match(captured[0], /不得使用 Markdown 表格/)
    assert.match(captured[0], /不得输出.*think/)
    assert.match(captured[0], /今年适合换工作吗？/)
  } finally { srv.close() }
})

test('完整生辰且明确指定子平时，服务端注入子平 Skill 而不走默认盲派', async () => {
  const captured = []
  const pool = {
    isBusy: () => false,
    async run({ text, onEvent }) {
      captured.push(text)
      onEvent({ type: 'text', delta: '答复' })
      return { finalText: '答复', usage: null, title: null }
    },
  }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'bazi-ziping-calibration')
  const { srv, base } = await listen(app)
  try {
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '1990年5月6日早上8点，男，请按子平派看今年工作。' }),
    })

    assert.match(captured[0], /^\/yixue-taishan\b/)
    assert.doesNotMatch(captured[0], /^\/bazi-router\b/)
    assert.doesNotMatch(captured[0], /^\/mangpai\b/)
  } finally { srv.close() }
})

test('Agent 原始推理不会向用户暴露 Skill 跳过或重走流程等内部过程', async () => {
  const pool = {
    isBusy: () => false,
    async run({ onEvent }) {
      onEvent({ type: 'reasoning', delta: '我刚才跳过了 Skill，是否需要重走流程？' })
      onEvent({ type: 'text', delta: '我先为你核对盘面。' })
      return { finalText: '我先为你核对盘面。', usage: null, title: null }
    },
  }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'private-reasoning')
  const { srv, base } = await listen(app)
  try {
    const response = await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '帮我看看' }),
    })
    const frames = sseFrames(await response.text())
    const reasoning = frames.filter(frame => frame.type === 'reasoning').map(frame => frame.delta).join('')
    assert.equal(reasoning, '正在整理命盘与问题要点…')
    assert.doesNotMatch(JSON.stringify(frames), /跳过.*Skill|重走流程/)
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
  const { app, store, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'bazi-title')
  const { srv, base } = await listen(app)
  try {
    await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '1975年10月13日早上6点，男，帮我排盘' }),
    })
    const [session] = store.listSessions(me.id)
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
    assert.equal(accounts.get(me.id).permanentCredits, 20, '无产出不能开启主题或扣点')
  } finally { srv.close() }
})

// 积分不足时不该把请求打到付费模型上，也不该留下一条空会话。
test('积分不足时 /agent/chat 返回 402，且没有真的调用模型', async () => {
  let called = 0
  const pool = { isBusy: () => false, async run({ onEvent }) { called++; onEvent({ type: 'done', reason: 'completed' }); return { finalText: 'x', usage: null, title: null } } }
  const { app, accounts } = mkApp(pool)
  const me = await mkUser(accounts, 'broke')
  // 把额度花光
  while (accounts.consumeCredit(me.id, 'agent.topic').ok) { /* 一直扣到不足为止 */ }
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

test('正文夹带的内部 think 不会流给用户或写入会话历史', async () => {
  const events = [
    { type: 'text', delta: '<think>我需要先加载 mangpai Skill，再调用 ' },
    { type: 'text', delta: 'bazi 工具校盘。</think>\n\n## 盘面核对\n- 四柱：戊午 · 甲寅 · 辛亥 · 丁酉' },
  ]
  const { app, store, accounts } = mkApp(fakePool(events))
  const me = await mkUser(accounts, 'safe-think')
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(me.token) },
      body: JSON.stringify({ text: '请看这个命盘' }),
    })
    const frames = sseFrames(await res.text())
    const publicText = frames.filter(frame => frame.type === 'text').map(frame => frame.delta).join('')
    const sessionId = frames.find(frame => frame.type === 'session').sessionId
    const storedText = store.listMessages(me.id, sessionId).find(message => message.role === 'ai').text

    assert.equal(publicText.includes('加载 mangpai Skill'), false, 'SSE 不应发送内部流程')
    assert.equal(storedText.includes('加载 mangpai Skill'), false, '会话历史不应保存内部流程')
    assert.ok(publicText.includes('已完成命盘与要点核对'), '用户应看到统一的思考状态')
    assert.ok(storedText.includes('盘面核对'), '可读结论应完整保存')
  } finally { srv.close() }
})
