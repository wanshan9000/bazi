import test from 'node:test'
import assert from 'node:assert/strict'

import { DI_ZHI, TIAN_GAN } from '../../data/ganzhi.js'
import { ZHI_CHONG, dayPillar, monthPillar, yearPillar } from '../../data/huangli.js'
import { buildDaily, evaluateSelectionDay, jianchuValue } from '../huangli.js'

function findDate(predicate) {
  const start = new Date(2026, 0, 1)
  for (let offset = 0; offset < 730; offset++) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    if (predicate(date)) return date
  }
  throw new Error('没有找到符合条件的测试日期')
}

test('建除值日以节气月支为建，按地支顺行', () => {
  const date = findDate(d => {
    const yp = yearPillar(d)
    const mp = monthPillar(d, TIAN_GAN.indexOf(yp.gan))
    return dayPillar(d).zhi === mp.zhi
  })
  const value = jianchuValue(date)
  const daily = buildDaily(date, null)
  assert.equal(value.name, '建')
  assert.equal(value.index, 0)
  assert.equal(daily.jianchu, '建')
  assert.match(daily.monthGanzhi, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]月$/)
})

test('用途回避日不会被个人喜用五行加分翻为推荐', () => {
  const date = findDate(d => jianchuValue(d).name === '破')
  const result = evaluateSelectionDay(date, {
    favorable: ['木', '火', '土', '金', '水'],
    avoid: [],
  }, 'marry')
  assert.ok(result.personalScore > 0)
  assert.equal(result.decision, 'avoid')
  assert.ok(result.hardReasons.some(reason => reason.includes('破日不作嫁娶用事')))
})

test('冲命主年支的日期直接排除', () => {
  const date = findDate(d => ['定', '成', '开'].includes(jianchuValue(d).name))
  const dayZhi = dayPillar(date).zhi
  const result = evaluateSelectionDay(date, {
    yearZhi: ZHI_CHONG[dayZhi],
    favorable: ['木', '火', '土', '金', '水'],
    avoid: [],
  }, 'marry')
  assert.equal(result.decision, 'avoid')
  assert.ok(result.hardReasons.some(reason => reason.includes('冲命主年支')))
})

test('未提供命盘时仍可输出通用建除择日判断', () => {
  const date = findDate(d => ['满', '成', '开'].includes(jianchuValue(d).name))
  const result = evaluateSelectionDay(date, null, 'business')
  assert.ok(DI_ZHI.includes(result.monthPillar.zhi))
  assert.ok(['recommend', 'avoid'].includes(result.decision))
  assert.equal(result.reasons[0], `${result.monthPillar.zhi}月${result.jianchu}日`)
})
