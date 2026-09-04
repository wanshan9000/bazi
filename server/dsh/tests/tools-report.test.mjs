import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeReportTool } from '../plugins/lingshu-tools/tools/report.js'

const E = await import('../plugins/lingshu-tools/dist/engines.mjs')
const exec = { signal: new AbortController().signal }
const birth = { year: 1990, month: 5, day: 6, hour: 8, gender: '男' }

test('report bazi 返回以标题开头的 Markdown', async () => {
  const out = await makeReportTool(E).execute({ type: 'bazi', ...birth }, exec)
  assert.match(out, /^# /)
  assert.match(out, /庚午/)
})

test('report hehun 需要 partner', async () => {
  const t = makeReportTool(E)
  await assert.rejects(() => t.execute({ type: 'hehun', ...birth }, exec), /partner/)
  const out = await t.execute({ type: 'hehun', ...birth, partner: { year: 1992, month: 8, day: 1, hour: 10, gender: '女' } }, exec)
  assert.match(out, /合婚|婚配/)
})

test('report 未知类型报错', async () => {
  await assert.rejects(() => makeReportTool(E).execute({ type: 'xxx', ...birth }, exec))
})
