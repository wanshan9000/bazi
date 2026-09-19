import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import { createAccountStore } from '../accounts.js'
import { createGrowthRouter } from '../routes/growth.js'
import { signJwt } from '../jwt.js'
import { resolveJwtSecret } from '../config.js'

function makeApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-'))
  const accounts = createAccountStore(path.join(dir, 'accounts.json'))
  const app = express()
  app.use(express.json())
  app.use('/api', createGrowthRouter({ accounts }))
  return { app, accounts }
}

const listen = app => new Promise(resolve => {
  const server = app.listen(0, () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }))
})

test('分享奖励接口要求登录，并将奖励写入永久积分钱包', async () => {
  const { app, accounts } = makeApp()
  const user = await accounts.create({ account: 'growth-user', password: 'secret123', nickname: '增长用户' })
  const token = signJwt({ sub: user.id }, resolveJwtSecret(), { expiresInSec: 3600 })
  const { server, base } = await listen(app)
  try {
    const denied = await fetch(`${base}/api/growth/share-reward`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: 'share_event_0001' }),
    })
    assert.equal(denied.status, 401)

    const granted = await fetch(`${base}/api/growth/share-reward`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId: 'share_event_0001', source: 'chart_summary' }),
    })
    const body = await granted.json()
    assert.equal(granted.status, 200)
    assert.equal(body.rewarded, true)
    assert.equal(body.credits, 24)
    assert.equal(body.user.permanentCredits, 44)
  } finally {
    server.close()
  }
})
