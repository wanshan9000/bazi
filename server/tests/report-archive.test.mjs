import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createReportArchiveStore } from '../reportArchive.js'

const USER_A = 'user-a'
const USER_B = 'user-b'

function tempStore(options) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-archive-'))
  return createReportArchiveStore(path.join(dir, 'reports.json'), options)
}

function baziDraft(overrides = {}) {
  return {
    clientKey: 'bazi:1995-3-8-9:female',
    type: 'bazi',
    title: '八字命盘 · 甲木日主',
    summary: '甲木日主，宜稳步建立节奏。',
    report: { sections: [{ title: '命局总览', blocks: [] }], score: 86 },
    chart: { year: 1995, month: 3, day: 8, hour: 9, gender: '女', extra: 'must-not-persist' },
    facts: ['日主：甲木', '喜用：水、木'],
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

test('保存、列表、读取与删除只作用于所属账号，列表不泄露完整报告', () => {
  const store = tempStore()
  const saved = store.saveReport(USER_A, baziDraft())
  assert.equal(saved.ok, true)
  assert.equal(saved.created, true)
  assert.ok(saved.report.id)

  const listed = store.listReports(USER_A)
  assert.equal(listed.reports.length, 1)
  assert.equal(listed.counts.bazi, 1)
  assert.equal('report' in listed.reports[0], false, '列表不能带回完整报告正文')
  assert.equal(listed.reports[0].isComplete, true, '完整的原生报告应标记为可恢复')
  assert.deepEqual(listed.reports[0].chart, { year: 1995, month: 3, day: 8, hour: 9, gender: '女' })

  assert.equal(store.getReport(USER_B, saved.report.id), null, '其他账号不能读取')
  assert.equal(store.deleteReport(USER_B, saved.report.id), false, '其他账号不能删除')
  assert.equal(store.getReport(USER_A, saved.report.id).report.score, 86)
  assert.equal(store.deleteReport(USER_A, saved.report.id), true)
  assert.equal(store.listReports(USER_A).reports.length, 0)
})

test('列表只返回可恢复的完整报告，旧基础档案仍保留但不展示', () => {
  const store = tempStore()
  const legacy = store.saveReport(USER_A, baziDraft({ clientKey: 'legacy-basic', type: 'chart', report: null }))
  const complete = store.saveReport(USER_A, baziDraft({
    clientKey: 'native-bazi',
    report: { sections: [{ title: '命局总览', blocks: [] }] },
  }))
  assert.equal(legacy.ok, true)
  assert.equal(complete.ok, true)
  const listed = store.listReports(USER_A)
  assert.equal(listed.reports.length, 1)
  assert.equal(listed.reports[0].id, complete.report.id)
  assert.equal(store.getReport(USER_A, legacy.report.id)?.id, legacy.report.id, '隐藏不等于擅自删除旧档案')
})

test('同一 clientKey 保存两次复用一份档案，限制类型、文案、大小与总数', () => {
  const store = tempStore()
  const first = store.saveReport(USER_A, baziDraft())
  const duplicate = store.saveReport(USER_A, baziDraft({ summary: '第二次保存不应创建新档案。' }))
  assert.equal(duplicate.ok, true)
  assert.equal(duplicate.created, false)
  assert.equal(duplicate.report.id, first.report.id)

  assert.equal(store.saveReport(USER_A, baziDraft({ clientKey: 'bad', type: 'unknown' })).reason, 'invalid_type')
  assert.equal(store.saveReport(USER_A, baziDraft({ clientKey: 'long', summary: 'x'.repeat(181) })).reason, 'invalid_summary')
  assert.equal(store.saveReport(USER_A, baziDraft({ clientKey: 'huge', report: { markdown: 'x'.repeat(250 * 1024) } })).reason, 'too_large')

  const full = tempStore()
  for (let index = 0; index < 120; index++) {
    const result = full.saveReport(USER_A, baziDraft({ clientKey: `bazi-${index}`, title: `八字报告 ${index}` }))
    assert.equal(result.ok, true)
  }
  assert.equal(full.saveReport(USER_A, baziDraft({ clientKey: 'overflow' })).reason, 'limit_reached')
})

test('关联会话时必须属于同一账号，删除报告不会删除会话', () => {
  const sessions = {
    getSession(uid, id) { return uid === USER_A && id === 'session-a' ? { id, uid } : null },
  }
  const store = tempStore({ sessions })
  const saved = store.saveReport(USER_A, baziDraft())

  assert.equal(store.appendSession(USER_A, saved.report.id, 'session-b').reason, 'session_not_found')
  assert.equal(store.appendSession(USER_B, saved.report.id, 'session-a').reason, 'report_not_found')
  assert.equal(store.appendSession(USER_A, saved.report.id, 'session-a').ok, true)
  assert.equal(store.appendSession(USER_A, saved.report.id, 'session-a').created, false, '同一会话只关联一次')
  assert.deepEqual(store.getReport(USER_A, saved.report.id).agentSessionIds, ['session-a'])
  assert.equal(store.deleteReport(USER_A, saved.report.id), true)
  assert.deepEqual(sessions.getSession(USER_A, 'session-a'), { id: 'session-a', uid: USER_A }, '删报告不能删除 AI 会话')
})

test('旧本地不完整记录迁移后不进入我的报告，仍只认领一次', () => {
  const store = tempStore()
  const legacy = [
    baziDraft({ source: 'legacy-local', clientKey: 'legacy-chart-1', report: null, facts: ['日主：甲木'] }),
    baziDraft({ source: 'legacy-local', clientKey: 'legacy-chart-1', report: null, facts: ['日主：甲木'] }),
    { ...baziDraft({ clientKey: 'legacy-tarot-1', type: 'tarot', title: '塔罗 · 单卡直答', report: { cards: [{ id: 'm1' }] } }), untrusted: '<script>' },
  ]
  const first = store.migrateLegacy(USER_A, legacy)
  assert.equal(first.ok, true)
  assert.equal(first.migrated, 2)
  assert.equal(store.listReports(USER_A).reports.length, 0)
  const second = store.migrateLegacy(USER_A, legacy)
  assert.equal(second.ok, true)
  assert.equal(second.migrated, 0)
  assert.equal(second.claimed, true)
})

test('账号注销清理该账号报告与迁移标记，不影响其他账号', () => {
  const store = tempStore()
  store.saveReport(USER_A, baziDraft())
  store.saveReport(USER_B, baziDraft({ clientKey: 'bazi-b' }))
  store.migrateLegacy(USER_A, [])
  assert.equal(store.deleteAllReports(USER_A), 1)
  assert.equal(store.listReports(USER_A).reports.length, 0)
  assert.equal(store.listReports(USER_B).reports.length, 1)
  assert.equal(store.migrateLegacy(USER_A, []).claimed, false, '清理后不应残留迁移标记')
})
