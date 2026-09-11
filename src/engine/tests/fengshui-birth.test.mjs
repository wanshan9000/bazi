// 风水页宣称「已结合八字」，实际却把假出生信息喂给引擎。
//
// FengshuiPage 原来这样取值：`baziChart.pillars?.[0]?.ganzhi?.year || 1990`。
// pillars[0] 的形状是 { label, gan, zhi, year, shiShen }，压根没有 ganzhi 这一层，
// 所以恒为 undefined → 一律按 1990-01-01 12:00 男 算喜忌，跟用户自己的命盘无关。
// 这里锁住两件事：命盘形状确实没有 ganzhi；不同命盘必须得到不同的喜忌结论。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildChart } from '../bazi.js'
import { analyzeFengshui } from '../fengshui.js'

const LAYOUT = { door: '东南', bedDir: '东南' }

// 页面用的取值方式（修好之后应当是这样）
const birthInfoOf = c => ({ year: c.year, month: c.month, day: c.day, hour: c.hour, gender: c.gender })

test('命盘的年柱对象没有 ganzhi 字段（旧取值必然拿到 undefined）', () => {
  const c = buildChart(1990, 5, 6, 8, '男')
  assert.equal(c.pillars[0].ganzhi, undefined)
  assert.equal(typeof c.pillars[0].year, 'number')
  // 出生要素在命盘顶层，这才是该用的来源
  assert.equal(c.year, 1990)
  assert.equal(c.month, 5)
  assert.equal(c.day, 6)
})

test('不同命盘应得到不同的风水喜忌（旧写法会全都一样）', () => {
  const a = analyzeFengshui({ layout: LAYOUT, birthInfo: birthInfoOf(buildChart(1990, 5, 6, 8, '男')) })
  const b = analyzeFengshui({ layout: LAYOUT, birthInfo: birthInfoOf(buildChart(1985, 11, 20, 14, '女')) })
  assert.notDeepEqual(
    [a.favorable, a.avoid],
    [b.favorable, b.avoid],
    '两张差异很大的命盘喜忌不该完全相同',
  )
})

test('旧写法确实退化成固定命盘：1990-01-01 男', () => {
  const fake = analyzeFengshui({ layout: LAYOUT, birthInfo: { year: 1990, month: 1, day: 1, hour: 12, gender: '男' } })
  const real = analyzeFengshui({ layout: LAYOUT, birthInfo: birthInfoOf(buildChart(1985, 11, 20, 14, '女')) })
  assert.notDeepEqual([real.favorable, real.avoid], [fake.favorable, fake.avoid],
    '真实命盘的结论不应与那套写死的 1990-01-01 男相同')
})

test('书桌座位：背靠实墙、前方开阔且取喜用方向，应优于门冲横梁位', () => {
  const birthInfo = birthInfoOf(buildChart(1990, 5, 6, 8, '男'))
  const favorableDir = { 木: '东', 火: '南', 土: '东北', 金: '西', 水: '北' }[buildChart(1990, 5, 6, 8, '男').favorable[0]]
  const favorable = analyzeFengshui({
    layout: {
      ...LAYOUT,
      deskDir: favorableDir,
      seatBack: 'wall',
      seatFront: 'open',
      seatLeft: 'solid',
      seatRight: 'open',
      seatHazard: 'none',
    },
    birthInfo,
  })
  const hostile = analyzeFengshui({
    layout: {
      ...LAYOUT,
      deskDir: '西',
      seatBack: 'window',
      seatFront: 'door',
      seatLeft: 'window',
      seatRight: 'tall',
      seatHazard: 'beam',
    },
    birthInfo,
  })

  assert.ok(favorable.desk.score > hostile.desk.score, '坐位的形势与朝向应真实改变评分')
  assert.equal(favorable.desk.verdict, '宜用')
  assert.equal(hostile.desk.verdict, '宜调整')
  assert.match(hostile.desk.tips.join(''), /横梁|门冲|背后/)
})
