// 报告缓存的隔离性回归测试。
//
// 背景：buildReport 的缓存键曾写成 chart.pillars.year —— 而 pillars 是数组，取到 undefined，
// 键退化成「类型|:::性别|参数」。前端每次刷新重建模块尚不易察觉，但服务端 dsh 的 report
// 工具常驻进程、缓存跨请求存活，A 用户的整份报告会被原样返回给下一个同性别的 B 用户。
// 这里直接跑打包后的引擎（server 侧真正加载的就是它）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
const E = await import('../plugins/lingshu-tools/dist/engines.mjs')

const A = () => E.buildChart(1990, 5, 6, 8, '男')
const B = () => E.buildChart(1985, 11, 20, 14, '男')

test('不同命盘、同性别：报告不得串号', () => {
  const a = A(); const b = B()
  assert.notEqual(a.pillars.map(p => p.gan + p.zhi).join(''), b.pillars.map(p => p.gan + p.zhi).join(''), '前置：两个命盘四柱应不同')

  const ra = E.buildReport('bazi', a, {})
  const rb = E.buildReport('bazi', b, {})

  assert.notEqual(ra, rb, '两份报告不能是同一个对象')
  const sb = JSON.stringify(rb)
  assert.ok(!sb.includes('庚午'), 'B 的报告里不应出现 A 的年柱庚午')
  assert.ok(sb.includes('乙丑'), 'B 的报告里应出现自己的年柱乙丑')
})

test('同一命盘重复请求：仍然命中缓存（缓存没有被改废）', () => {
  const a = A()
  const r1 = E.buildReport('bazi', a, {})
  const r2 = E.buildReport('bazi', E.buildChart(1990, 5, 6, 8, '男'), {})
  assert.equal(r1, r2, '同命盘应复用缓存，否则每次都重算')
})

test('同出生年月日、不同性别：报告不得互串', () => {
  const m = E.buildReport('bazi', E.buildChart(1992, 3, 3, 10, '男'), {})
  const f = E.buildReport('bazi', E.buildChart(1992, 3, 3, 10, '女'), {})
  assert.notEqual(m, f)
})

test('同命盘、不同报告类型：互不串号', () => {
  const a = A()
  const bazi = E.buildReport('bazi', a, {})
  const mangpai = E.buildReport('mangpai', a, {})
  assert.notEqual(bazi, mangpai)
})

// 起卦/抽牌自带随机性，缓存会让「再起一卦」永远得到同一卦。
test('六爻：同样入参每次重新起卦，不落缓存', () => {
  const seen = new Set()
  for (let i = 0; i < 12; i++) {
    const r = E.buildReport('liuyao', null, { question: '事业如何' })
    seen.add(JSON.stringify(r))
  }
  assert.ok(seen.size > 1, `12 次起卦应出现不同结果，实际只有 ${seen.size} 种`)
})

test('塔罗：同样入参每次重新抽牌，不落缓存', () => {
  const seen = new Set()
  for (let i = 0; i < 12; i++) {
    const r = E.buildReport('tarot', null, { question: '感情走向', spreadId: 'time' })
    seen.add(JSON.stringify(r))
  }
  assert.ok(seen.size > 1, `12 次抽牌应出现不同结果，实际只有 ${seen.size} 种`)
})
