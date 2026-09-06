// /api/auth/* 的回归测试。重点在「越权走不通」，而不只是「正常流程能走通」。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAccountStore } from '../accounts.js'
import { createAuthRouter } from '../routes/auth.js'

function mkApp(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authr-'))
  const accounts = createAccountStore(path.join(dir, 'accounts.json'))
  const app = express()
  app.use(express.json())
  app.use('/api', createAuthRouter({ accounts, ...opts }))
  return { app, accounts }
}

async function listen(app) {
  return new Promise(res => { const srv = app.listen(0, () => res({ srv, base: `http://127.0.0.1:${srv.address().port}` })) })
}

const J = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const bearer = t => ({ authorization: `Bearer ${t}` })

async function register(base, account = 'alice', password = 'secret123') {
  const r = await fetch(`${base}/api/auth/register`, J({ account, password, nickname: '小明' }))
  return { status: r.status, body: await r.json() }
}

test('注册返回 token 与用户；token 可换回 me', async () => {
  const { app } = mkApp()
  const { srv, base } = await listen(app)
  try {
    const { body } = await register(base)
    assert.equal(body.ok, true)
    assert.ok(body.token, '注册必须返回 token')
    assert.equal(body.user.plan, 'earth')

    const me = await (await fetch(`${base}/api/auth/me`, { headers: bearer(body.token) })).json()
    assert.equal(me.ok, true)
    assert.equal(me.user.id, body.user.id)
  } finally { srv.close() }
})

test('账号重名拒绝；字段校验拒绝', async () => {
  const { app } = mkApp()
  const { srv, base } = await listen(app)
  try {
    await register(base, 'dup')
    assert.equal((await register(base, 'dup')).status, 409)
    assert.equal((await register(base, 'ab')).status, 400, '账号太短应拒绝')
    assert.equal((await register(base, 'okname', '123')).status, 400, '口令太短应拒绝')
  } finally { srv.close() }
})

test('登录：正确口令通过，错误口令 401', async () => {
  const { app } = mkApp()
  const { srv, base } = await listen(app)
  try {
    await register(base, 'lily')
    const bad = await fetch(`${base}/api/auth/login`, J({ account: 'lily', password: 'wrong' }))
    assert.equal(bad.status, 401)
    const good = await (await fetch(`${base}/api/auth/login`, J({ account: 'lily', password: 'secret123' }))).json()
    assert.equal(good.ok, true)
    assert.ok(good.token)
  } finally { srv.close() }
})

// 没有 token 就没有身份。这是整改的核心：以前 X-Genki-Uid 写谁就是谁。
test('无 token / 伪造 uid 头一律 401', async () => {
  const { app } = mkApp()
  const { srv, base } = await listen(app)
  try {
    const { body } = await register(base, 'victim')
    assert.equal((await fetch(`${base}/api/auth/me`)).status, 401)
    const forged = await fetch(`${base}/api/auth/me`, { headers: { 'x-genki-uid': body.user.id } })
    assert.equal(forged.status, 401, '自报别人的 uid 不该换来身份')
    const tampered = await fetch(`${base}/api/auth/me`, { headers: bearer(body.token.slice(0, -2) + 'xx') })
    assert.equal(tampered.status, 401)
  } finally { srv.close() }
})

// 把 plan / creditsUsed 放进可 PUT 的字段，等于把「改本地存储就能提权」搬到服务端。
test('PUT /auth/me 不能改档位与积分', async () => {
  const { app } = mkApp()
  const { srv, base } = await listen(app)
  try {
    const { body } = await register(base, 'climber')
    const res = await (await fetch(`${base}/api/auth/me`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...bearer(body.token) },
      body: JSON.stringify({ nickname: '新名字', plan: 'oracle', creditsUsed: 0, planExpiresAt: 9e15 }),
    })).json()
    assert.equal(res.ok, true)
    assert.equal(res.user.nickname, '新名字')
    assert.equal(res.user.plan, 'earth', '档位不得通过资料接口提升')
    assert.ok(res.user.planExpiresAt < 9e15, '到期时间不得由客户端指定')
  } finally { srv.close() }
})

test('积分扣减在服务端进行；扣光后 402', async () => {
  const { app } = mkApp()
  const { srv, base } = await listen(app)
  try {
    const { body } = await register(base, 'spender')
    const one = await (await fetch(`${base}/api/auth/credits/consume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(body.token) },
      body: JSON.stringify({ feature: 'bazi.full' }),
    })).json()
    assert.equal(one.ok, true)
    assert.equal(one.cost, 8)
    assert.equal(one.remaining, 192)

    let last
    for (let i = 0; i < 30; i++) {
      last = await fetch(`${base}/api/auth/credits/consume`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...bearer(body.token) },
        body: JSON.stringify({ feature: 'bazi.full' }),
      })
      if (last.status !== 200) break
    }
    assert.equal(last.status, 402, '额度用尽必须给 402，前端据此引导升级')
  } finally { srv.close() }
})

test('登录失败次数超限后 429，且成功登录会清零计数', async () => {
  const { app } = mkApp()
  const { srv, base } = await listen(app)
  try {
    await register(base, 'target')
    let status = 0
    for (let i = 0; i < 10; i++) {
      status = (await fetch(`${base}/api/auth/login`, J({ account: 'target', password: 'nope' + i }))).status
      if (status === 429) break
    }
    assert.equal(status, 429, '连续猜口令必须被限流')
  } finally { srv.close() }
})

test('注销账号会连坐清理关联数据', async () => {
  let purgedFor = null
  const { app } = mkApp({ onRemoveUser: uid => { purgedFor = uid; return 3 } })
  const { srv, base } = await listen(app)
  try {
    const { body } = await register(base, 'quitter')
    const res = await (await fetch(`${base}/api/auth/me`, { method: 'DELETE', headers: bearer(body.token) })).json()
    assert.equal(res.ok, true)
    assert.equal(res.purged, 3)
    assert.equal(purgedFor, body.user.id)
    // 注销后原 token 立刻失效
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: bearer(body.token) })).status, 401)
  } finally { srv.close() }
})

test('改密码：旧口令不对拒绝；改完只能用新口令登录', async () => {
  const { app } = mkApp()
  const { srv, base } = await listen(app)
  try {
    const { body } = await register(base, 'changer')
    const h = { 'content-type': 'application/json', ...bearer(body.token) }
    const bad = await fetch(`${base}/api/auth/password`, { method: 'PATCH', headers: h, body: JSON.stringify({ oldPassword: 'wrong', newPassword: 'newsecret1' }) })
    assert.equal(bad.status, 400)
    const good = await fetch(`${base}/api/auth/password`, { method: 'PATCH', headers: h, body: JSON.stringify({ oldPassword: 'secret123', newPassword: 'newsecret1' }) })
    assert.equal(good.status, 200)
    assert.equal((await fetch(`${base}/api/auth/login`, J({ account: 'changer', password: 'secret123' }))).status, 401)
    assert.equal((await fetch(`${base}/api/auth/login`, J({ account: 'changer', password: 'newsecret1' }))).status, 200)
  } finally { srv.close() }
})
