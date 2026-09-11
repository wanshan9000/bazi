import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createArchiveDraft, legacyArchiveDrafts } from '../reportArchive.js'

beforeEach(() => localStorage.clear())

test('档案草稿裁剪命盘字段、摘要和未识别字段，保留完整结果作为恢复正文', () => {
  const draft = createArchiveDraft({
    type: 'bazi',
    title: '八字命盘 · 甲木日主',
    summary: '甲木日主，宜稳步建立节奏。'.repeat(20),
    chart: { year: 1995, month: 3, day: 8, hour: 9, gender: '女', token: 'must-not-leak' },
    result: { sections: [{ title: '五行' }], privateRuntimeState: { ref: 'omit' } },
    facts: ['日主：甲木', '喜用：水、木', 'x'.repeat(300)],
    createdAt: 1_700_000_000_000,
  })
  assert.equal(draft.type, 'bazi')
  assert.equal(draft.summary.length, 180)
  assert.deepEqual(draft.chart, { year: 1995, month: 3, day: 8, hour: 9, gender: '女' })
  assert.equal(draft.facts.length, 2)
  assert.deepEqual(draft.report, { sections: [{ title: '五行' }], privateRuntimeState: { ref: 'omit' } })
  assert.ok(draft.clientKey.startsWith('bazi:'))
})

test('旧本地基础记录不再迁移为不可恢复的报告', () => {
  localStorage.setItem('sanmen-history', JSON.stringify([
    { id: 11, name: '小雨', year: 1995, month: 3, day: 8, hour: 9, gender: '女', dayMaster: '甲', pillars: ['乙亥', '己卯'], leaked: 'do-not-upload' },
  ]))
  localStorage.setItem('sanmen-tarot-history', JSON.stringify([
    { id: 12, spreadId: 'single', spreadName: '单卡直答', question: '今天适合告白吗？', cards: [{ id: 'm1', name: '魔术师', reversed: false }], summary: '适合真诚表达。', leaked: 'do-not-upload' },
  ]))
  const first = legacyArchiveDrafts()
  const second = legacyArchiveDrafts()
  assert.deepEqual(first, [])
  assert.deepEqual(second, [])
})
