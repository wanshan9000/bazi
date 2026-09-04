import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../plugins/lingshu-tools/dist/engines.mjs')

test('buildChart 在 Node 下可用且四柱稳定', () => {
  const c = E.buildChart(1990, 5, 6, 8, '男')
  assert.equal(c.pillars.length, 4)
  // 引擎实际口径：1990-05-06 08:00 男，四柱为 庚午 辛巳 辛未 壬辰
  // （brief 预期的 癸卯 丙辰 与实际引擎输出不符，以实际输出为准，见 commit 说明）
  assert.equal(c.pillars.map(p => p.gan + p.zhi).join(' '), '庚午 辛巳 辛未 壬辰')
})

test('奇门与统一报告引擎可加载（曾因 .ts 源码在 Node 下失败）', () => {
  assert.equal(typeof E.buildQimenFull, 'function')
  const chart = E.buildChart(1990, 5, 6, 8, '男')
  const rep = E.buildReport('bazi', chart, {})
  assert.equal(rep.ok, true)
  assert.equal(rep.type, 'bazi')
  // buildReport 的 markdown 字段是固定占位字符串（"...详见下方分节"），不含四柱内容；
  // 真正的排盘结论体现在 hero.title 里（以日主开头），用它做稳定性校验
  assert.match(rep.hero.title, new RegExp(`^${chart.dayMaster}日主`))
})

test('塔罗抽牌不依赖浏览器 localStorage', () => {
  const r = E.drawCards('single', 42)
  assert.equal(r.cards.length, 1)
})
