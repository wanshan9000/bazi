import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateChenggu } from '../chenggu.js'

test('generateChenggu：页面与 Skill 共用的统一入口输出结构化结果', () => {
  const report = generateChenggu({ birth: { year: 1992, month: 3, day: 3, hour: 10, gender: '女' } })
  assert.equal(report.summary.gender, '女')
  assert.equal(report.breakdown.length, 4)
  assert.equal(report.lines.length, 5)
  assert.equal(report.summary.standard, 'standard-51qian')
  assert.equal(report.summary.totalQian, 45)
  assert.deepEqual(
    { year: report.summary.year, month: report.summary.month, day: report.summary.day, hour: report.summary.hour },
    { year: 1992, month: 3, day: 3, hour: 10 }
  )
  assert.match(report.classic.sourceVerse, /名利推求竟若何/)
  assert.equal(report.calculation.tableScope, '标准 51 档（2两1钱至7两1钱）')
  assert.ok(report.classic.interpretation.themes.length >= 1)
})

test('generateChenggu：出生时辰变化时，骨重和传统歌诀同步变化', () => {
  const morning = generateChenggu({ birth: { year: 1992, month: 3, day: 3, hour: 6, gender: '女' } })
  const night = generateChenggu({ birth: { year: 1992, month: 3, day: 3, hour: 22, gender: '女' } })
  assert.notEqual(morning.summary.total, night.summary.total)
  assert.notEqual(morning.classic.sourceVerse, night.classic.sourceVerse)
  assert.ok(morning.lines.every(line => !/称骨|骨重/.test(line.text)), '骨重基调应只在区块导语说明一次，不应逐项重复')
  assert.ok(morning.lines.every(line => !/日主/.test(line.text)), '四柱术语只在依据区块展示，不应在各建议中重复')
  assert.match(generateChenggu({ birth: { year: 1992, month: 3, day: 3, hour: 6, gender: '女' }, format: 'markdown' }), /【传统称骨解读】/)
  assert.match(generateChenggu({ birth: { year: 1992, month: 3, day: 3, hour: 6, gender: '女' }, format: 'markdown' }), /【歌诀专业释义】/)
})

test('generateChenggu：夜子时按次日的农历日查日骨', () => {
  const report = generateChenggu({ birth: { year: 1992, month: 3, day: 3, hour: 23, gender: '女' } })
  assert.equal(report.summary.lunarDay, '初一')
  assert.match(report.breakdown.find(item => item.name === '时骨').detail, /夜子时按次日查日骨/)
})

test('generateChenggu：时辰未知时如实标注午时估算', () => {
  const report = generateChenggu({
    birth: { year: 1992, month: 3, day: 3, hour: 12, hourKnown: false, gender: '女' },
    format: 'markdown'
  })
  assert.match(report, /时辰未知，按午时估算/)
  assert.match(report, /总骨重可能落在/)
})
