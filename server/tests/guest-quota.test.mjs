// 游客免费额度的服务端记账。
//
// 背景：额度原本只在浏览器 localStorage 里，而游客标识是客户端自报的 ——
// 清一次站点数据就同时重置了额度和按 uid 的限流桶。实测拿一个全新的 anon 标识
// 能直接调用付费模型。这组测试钉住「换标识绕不过」。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import { createGuestQuota, PREPAID_TOKENS } from '../guestQuota.js'
import { createAgentRouter } from '../routes/agent.js'
import { createAgentStore } from '../dsh/agentStore.js'
import { createAccountStore } from '../accounts.js'
import { signJwt } from '../jwt.js'
import { resolveJwtSecret } from '../config.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gq-'))

test('额度按 IP 记账，超了就拒', () => {
  const q = createGuestQuota(path.join(tmp(), 'q.json'), { dailyLimit: 10000 })
  assert.equal(q.begin('1.1.1.1').ok, true)
  q.settle('1.1.1.1', 9000)
  assert.equal(q.remaining('1.1.1.1'), 1000)
  // 还有余额就放行（哪怕不足一轮）——不然最后那点额度永远用不掉
  assert.equal(q.begin('1.1.1.1').ok, true)
  q.settle('1.1.1.1', 5000)
  assert.equal(q.begin('1.1.1.1').ok, false, '超出后必须拒绝')
  // 另一个 IP 不受影响
  assert.equal(q.begin('2.2.2.2').ok, true)
})

test('预扣：并发请求不会同时通过（check-then-act 竞态）', () => {
  const q = createGuestQuota(path.join(tmp(), 'q.json'), { dailyLimit: PREPAID_TOKENS * 3 })
  // 三个请求同时开始、都还没结算
  assert.equal(q.begin('1.1.1.1').ok, true)
  assert.equal(q.begin('1.1.1.1').ok, true)
  assert.equal(q.begin('1.1.1.1').ok, true)
  assert.equal(q.begin('1.1.1.1').ok, false, '不预扣的话这一发也会通过')
})

test('结算用真实用量替换预扣；没产出则退回', () => {
  const q = createGuestQuota(path.join(tmp(), 'q.json'), { dailyLimit: 50000 })
  q.begin('1.1.1.1')
  q.settle('1.1.1.1', 7000)
  assert.equal(q.remaining('1.1.1.1'), 43000, '应按真实 7000 记，而不是预扣值')

  q.begin('1.1.1.1')
  q.settle('1.1.1.1', 0)
  assert.equal(q.remaining('1.1.1.1'), 43000, '一轮没跑起来应把预扣退回去')
})

test('24 小时后重置', () => {
  const q = createGuestQuota(path.join(tmp(), 'q.json'), { dailyLimit: 10000 })
  const t0 = Date.now()
  q.begin('1.1.1.1', t0)
  q.settle('1.1.1.1', 10000, t0)
  assert.equal(q.begin('1.1.1.1', t0).ok, false)
  assert.equal(q.begin('1.1.1.1', t0 + 86400001).ok, true, '过一天应恢复')
})

test('落盘：重启后额度不会白送', () => {
  const dir = tmp()
  const file = path.join(dir, 'q.json')
  const a = createGuestQuota(file, { dailyLimit: 10000 })
  a.begin('1.1.1.1')
  a.settle('1.1.1.1', 10000) // 正好用满

  const b = createGuestQuota(file, { dailyLimit: 10000 })
  assert.equal(b.begin('1.1.1.1').ok, false, '重启后应记得已经用过')
})

test('过期条目会被清掉，表不会随访客 IP 无界增长', () => {
  const q = createGuestQuota(path.join(tmp(), 'q.json'), { dailyLimit: 10000 })
  const t0 = Date.now()
  for (let i = 0; i < 50; i++) q.begin(`10.0.0.${i}`, t0)
  assert.equal(Object.keys(q._dump()).length, 50)
  q.begin('11.0.0.1', t0 + 86400001)
  assert.equal(Object.keys(q._dump()).length, 1, '过期条目应被清理')
})

/* ---- 路由层 ---- */

function mkApp(pool, dailyLimit) {
  const dir = tmp()
  const store = createAgentStore(path.join(dir, 'db.json'))
  const accounts = createAccountStore(path.join(dir, 'accounts.json'))
  const guestQuota = createGuestQuota(path.join(dir, 'q.json'), { dailyLimit })
  const app = express()
  app.use(express.json())
  app.use('/api', createAgentRouter({ pool, store, accounts, guestQuota }))
  return { app, accounts, guestQuota }
}
const listen = app => new Promise(r => { const srv = app.listen(0, () => r({ srv, base: `http://127.0.0.1:${srv.address().port}` })) })

function fakePool(totalTokens = 7000) {
  let called = 0
  return {
    calls: () => called,
    isBusy: () => false,
    async run({ onEvent }) {
      called++
      onEvent({ type: 'text', delta: '好' })
      return { finalText: '好', usage: { totalTokens }, title: null }
    },
  }
}

const guest = id => ({ 'content-type': 'application/json', 'x-genki-uid': `anon:${id}` })

test('游客额度用尽后返回 402，且不再调用模型', async () => {
  const pool = fakePool(7000)
  // 上限 5000、一轮实耗 7000：第一轮放行（开始时余额还够），第二轮必被拒
  const { app } = mkApp(pool, 5000)
  const { srv, base } = await listen(app)
  try {
    const chat = (id) => fetch(`${base}/api/agent/chat`, { method: 'POST', headers: guest(id), body: JSON.stringify({ text: '嗨' }) })
    await chat('dev1')   // 用掉 7000，已超上限
    const before = pool.calls()
    const res = await chat('dev1')
    assert.equal(res.status, 402)
    const body = await res.json()
    assert.equal(body.reason, 'guest_quota')
    assert.equal(pool.calls(), before, '额度用尽就不该把请求打到付费模型上')
  } finally { srv.close() }
})

// 这是整改的核心：以前换一个 anon 标识就是全新的额度。
test('换游客标识绕不过额度（记账按 IP 不按自报标识）', async () => {
  const pool = fakePool(7000)
  const { app } = mkApp(pool, 5000)
  const { srv, base } = await listen(app)
  try {
    const chat = (id) => fetch(`${base}/api/agent/chat`, { method: 'POST', headers: guest(id), body: JSON.stringify({ text: '嗨' }) })
    await chat('dev1')
    const res = await chat('brand-new-device-9999')
    assert.equal(res.status, 402, '换个标识不该换来新额度')
  } finally { srv.close() }
})

test('登录用户不受游客额度限制', async () => {
  const pool = fakePool(7000)
  const { app, accounts } = mkApp(pool, 5000)
  const u = await accounts.create({ account: 'member', password: 'secret123', nickname: '会员' })
  const token = signJwt({ sub: u.id }, resolveJwtSecret(), { expiresInSec: 3600 })
  const { srv, base } = await listen(app)
  try {
    // 先把游客额度耗光
    await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: guest('dev1'), body: JSON.stringify({ text: '嗨' }) })
    await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: guest('dev1'), body: JSON.stringify({ text: '嗨' }) })
    // 登录用户照常
    const res = await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: '嗨' }),
    })
    assert.equal(res.status, 200)
    assert.equal(accounts.get(u.id).creditsUsed, 1, '登录用户按积分扣，不动游客额度')
  } finally { srv.close() }
})

test('模型报错、一个字没产出时不消耗游客额度', async () => {
  const pool = {
    isBusy: () => false,
    async run({ onEvent }) {
      onEvent({ type: 'error', code: 'CLOSED', message: '子进程已退出' })
      return { finalText: '', usage: null, title: null }
    },
  }
  const { app, guestQuota } = mkApp(pool, 10000)
  const { srv, base } = await listen(app)
  try {
    await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: guest('dev1'), body: JSON.stringify({ text: '嗨' }) })
    const used = Object.values(guestQuota._dump()).map(e => e.used)
    assert.deepEqual(used, [0], `没产出的一轮应把预扣退回去，实际记了 ${used}`)
  } finally { srv.close() }
})
