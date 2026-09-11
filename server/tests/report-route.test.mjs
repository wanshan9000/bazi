import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAccountStore } from '../accounts.js'
import { createAgentStore } from '../dsh/agentStore.js'
import { createReportArchiveStore } from '../reportArchive.js'
import { createReportsRouter } from '../routes/reports.js'
import { createAuthRouter } from '../routes/auth.js'
import { signJwt } from '../jwt.js'
import { resolveJwtSecret } from '../config.js'

function mkApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-route-'))
  const accounts = createAccountStore(path.join(dir, 'accounts.json'))
  const sessions = createAgentStore(path.join(dir, 'sessions.json'))
  const archives = createReportArchiveStore(path.join(dir, 'reports.json'), { sessions })
  const app = express()
  app.use(express.json({ limit: '400kb' }))
  app.use('/api', createAuthRouter({
    accounts,
    onRemoveUser: uid => archives.deleteAllReports(uid) + sessions.deleteAllSessions(uid),
  }))
  app.use('/api', createReportsRouter({ accounts, archives, sessions }))
  return { app, accounts, sessions, archives }
}

async function listen(app) {
  return new Promise(resolve => { const srv = app.listen(0, () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}` })) })
}

async function user(accounts, account) {
  const created = await accounts.create({ account, password: 'secret123', nickname: '缘主' })
  return { id: created.id, token: signJwt({ sub: created.id }, resolveJwtSecret(), { expiresInSec: 3600 }) }
}

const bearer = token => ({ authorization: `Bearer ${token}` })
const json = (token, body) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...bearer(token) }, body: JSON.stringify(body) })

function draft(overrides = {}) {
  return {
    clientKey: 'bazi:1995-3-8-9:female',
    type: 'bazi',
    title: '八字命盘 · 甲木日主',
    summary: '甲木日主，宜稳步建立节奏。',
    report: { sections: [{ title: '命局总览', blocks: [] }] },
    chart: { year: 1995, month: 3, day: 8, hour: 9, gender: '女' },
    facts: ['日主：甲木'],
    ...overrides,
  }
}

test('报告接口要求登录、列表不返回正文且按账号隔离', async () => {
  const { app, accounts } = mkApp()
  const a = await user(accounts, 'reporta')
  const b = await user(accounts, 'reportb')
  const { srv, base } = await listen(app)
  try {
    assert.equal((await fetch(`${base}/api/reports`)).status, 401)
    const created = await fetch(`${base}/api/reports`, json(a.token, draft()))
    assert.equal(created.status, 201)
    const body = await created.json()
    assert.equal(body.ok, true)
    const reportId = body.report.id

    const listed = await (await fetch(`${base}/api/reports`, { headers: bearer(a.token) })).json()
    assert.equal(listed.reports.length, 1)
    assert.equal('report' in listed.reports[0], false)
    assert.equal(listed.counts.bazi, 1)
    assert.equal((await fetch(`${base}/api/reports/${reportId}`, { headers: bearer(b.token) })).status, 404)
    assert.equal((await fetch(`${base}/api/reports/${reportId}`, { headers: bearer(a.token) })).status, 200)
  } finally { srv.close() }
})

test('报告只能关联自己的 AI 会话；删除报告后会话仍可读取', async () => {
  const { app, accounts, sessions } = mkApp()
  const a = await user(accounts, 'linka')
  const b = await user(accounts, 'linkb')
  const aSession = sessions.createSession(a.id, { route: 'deepseek-flash', title: '报告咨询' })
  const bSession = sessions.createSession(b.id, { route: 'deepseek-flash', title: '私密会话' })
  const { srv, base } = await listen(app)
  try {
    const reportId = (await (await fetch(`${base}/api/reports`, json(a.token, draft()))).json()).report.id
    assert.equal((await fetch(`${base}/api/reports/${reportId}/sessions`, json(a.token, { sessionId: bSession.id }))).status, 404)
    const linked = await (await fetch(`${base}/api/reports/${reportId}/sessions`, json(a.token, { sessionId: aSession.id }))).json()
    assert.equal(linked.ok, true)
    assert.equal(linked.report.sessionCount, 1)
    assert.equal((await fetch(`${base}/api/reports/${reportId}`, { method: 'DELETE', headers: bearer(a.token) })).status, 200)
    assert.ok(sessions.getSession(a.id, aSession.id), '删除报告不得删除已关联会话')
  } finally { srv.close() }
})

test('旧记录迁移只导入一次，注销账号时同时清理报告与会话', async () => {
  const { app, accounts, sessions, archives } = mkApp()
  const a = await user(accounts, 'migratea')
  const session = sessions.createSession(a.id, { route: 'deepseek-flash', title: '待清理' })
  const { srv, base } = await listen(app)
  try {
    const first = await (await fetch(`${base}/api/reports/migrate`, json(a.token, { reports: [draft({ clientKey: 'legacy-1', report: null })] }))).json()
    assert.equal(first.migrated, 1)
    const second = await (await fetch(`${base}/api/reports/migrate`, json(a.token, { reports: [draft({ clientKey: 'legacy-2', report: null })] }))).json()
    assert.equal(second.migrated, 0)
    const remove = await (await fetch(`${base}/api/auth/me`, { method: 'DELETE', headers: bearer(a.token) })).json()
    assert.equal(remove.ok, true)
    assert.equal(archives.listReports(a.id).reports.length, 0)
    assert.equal(sessions.getSession(a.id, session.id), null)
  } finally { srv.close() }
})
