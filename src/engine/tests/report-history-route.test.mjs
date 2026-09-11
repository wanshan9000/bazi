import { test } from 'node:test'
import assert from 'node:assert/strict'
import { historyRouteForReport, isHistoryReportView } from '../reportHistoryRoute.js'

test('完整报告按门类进入原生历史路由，而不是报告协调页', () => {
  assert.equal(historyRouteForReport({ id: 'b1', type: 'bazi' }), 'bazi')
  assert.equal(historyRouteForReport({ id: 'z1', type: 'ziwei' }), 'ziwei')
  assert.equal(historyRouteForReport({ id: 'q1', type: 'qimen' }), 'qimen')
  assert.equal(historyRouteForReport({ id: 'h1', type: 'huangli' }), 'huangli')
  assert.equal(historyRouteForReport({ id: 't1', type: 'tarot' }), 'tarot-reading')
  assert.equal(historyRouteForReport({ id: 'f1', type: 'fengshui' }), 'fengshui')
  assert.equal(historyRouteForReport({ id: 'legacy', type: 'chart' }), null)
  assert.equal(isHistoryReportView('tarot-reading'), true)
  assert.equal(isHistoryReportView('report-detail'), false)
})
