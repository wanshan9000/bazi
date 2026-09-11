import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { clearAuth, setAuth } from '../auth.js'
import { createReportApi } from '../reports.js'

beforeEach(() => {
  clearAuth()
  localStorage.clear()
})

test('报告 API 使用 Bearer 身份头并正确组织 CRUD 与迁移请求', async () => {
  setAuth('jwt-report', { id: 'u-1' })
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : null })
    return { status: 200, json: async () => ({ ok: true, reports: [], counts: {} }) }
  }
  try {
    const reports = createReportApi()
    await reports.list('tarot')
    await reports.save({ type: 'tarot' })
    await reports.migrate([{ type: 'chart' }])
    await reports.linkSession('report-1', 'session-1')
    await reports.remove('report-1')
    assert.deepEqual(calls.map(call => [call.method, call.url]), [
      ['GET', '/api/reports?type=tarot'],
      ['POST', '/api/reports'],
      ['POST', '/api/reports/migrate'],
      ['POST', '/api/reports/report-1/sessions'],
      ['DELETE', '/api/reports/report-1'],
    ])
    assert.equal(calls.every(call => call.headers.Authorization === 'Bearer jwt-report'), true)
    assert.deepEqual(calls[2].body, { reports: [{ type: 'chart' }] })
    assert.deepEqual(calls[3].body, { sessionId: 'session-1' })
  } finally {
    globalThis.fetch = original
  }
})
