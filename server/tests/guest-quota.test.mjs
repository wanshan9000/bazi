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
      onEvent({ type: 'text', delta: '已解答你的具体问题，建议稳住节奏。' })
      return { finalText: '已解答你的具体问题，建议稳住节奏。', usage: { totalTokens }, title: null }
    },
  }
}

const guest = id => ({ 'content-type': 'application/json', 'x-genki-uid': `anon:${id}` })

test('游客咨询元气 Agent 使用赠送 Token，且不消耗账号积分', async () => {
  const pool = fakePool(7000)
  const { app } = mkApp(pool, 5000)
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, {
      method: 'POST', headers: guest('dev1'), body: JSON.stringify({ text: '嗨' }),
    })
    assert.equal(res.status, 200)
    const body = await res.text()
    assert.match(body, /"usage"/)
    assert.equal(pool.calls(), 1)
  } finally { srv.close() }
})

test('登录新用户按模型实际 Token 用量折算扣除注册积分', async () => {
  const pool = fakePool(7000)
  const { app, accounts } = mkApp(pool, 5000)
  const u = await accounts.create({ account: 'member', password: 'secret123', nickname: '会员' })
  const token = signJwt({ sub: u.id }, resolveJwtSecret(), { expiresInSec: 3600 })
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: '请解读我今年的财运' }),
    })
    assert.equal(res.status, 200)
    assert.equal(accounts.get(u.id).permanentCredits, 19, '应按模型返回的 7,000 Token 折算扣除 1 积分')
  } finally { srv.close() }
})
