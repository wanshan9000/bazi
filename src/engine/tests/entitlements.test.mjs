// 计费去重与作用域隔离的回归测试。
// 这些模块直接读写 localStorage，Node 下用一个最小内存实现顶上。
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

function installStorage() {
  const mem = new Map()
  const api = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)) },
    removeItem: k => { mem.delete(k) },
    clear: () => mem.clear(),
    _mem: mem,
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: api })
  return api
}
const store = installStorage()

const { hasPaid, markPaid, chartKeyOf, clearPaid } = await import('../entitlements.js')

const CHART_A = { year: 1990, month: 5, day: 6, hour: 8, gender: '男' }
const CHART_B = { year: 1985, month: 11, day: 20, hour: 14, gender: '女' }

beforeEach(() => store.clear())

test('chartKeyOf：出生要素唯一确定一张盘', () => {
  assert.equal(chartKeyOf(CHART_A), '1990-5-6-8-男')
  assert.notEqual(chartKeyOf(CHART_A), chartKeyOf(CHART_B))
  assert.equal(chartKeyOf(null), null)
  assert.equal(chartKeyOf({ year: 1990 }), null, '信息不全时不计费')
})

test('同一用户同一张盘只算一次已购', () => {
  assert.equal(hasPaid('u1', 'bazi.full', CHART_A), false)
  markPaid('u1', 'bazi.full', CHART_A)
  assert.equal(hasPaid('u1', 'bazi.full', CHART_A), true)
  // 这正是「返回首页再进来重复扣 8 分」的回归点：重进页面应命中已购
  assert.equal(hasPaid('u1', 'bazi.full', { ...CHART_A }), true)
})

test('换一张盘要重新计费', () => {
  markPaid('u1', 'bazi.full', CHART_A)
  assert.equal(hasPaid('u1', 'bazi.full', CHART_B), false)
})

test('不同功能、不同用户互不影响', () => {
  markPaid('u1', 'bazi.full', CHART_A)
  assert.equal(hasPaid('u1', 'ziwei.full', CHART_A), false, '八字的已购不能顶紫微')
  assert.equal(hasPaid('u2', 'bazi.full', CHART_A), false, '别人的已购不能顶自己')
})

test('clearPaid 只清掉指定用户', () => {
  markPaid('u1', 'bazi.full', CHART_A)
  markPaid('u2', 'bazi.full', CHART_A)
  clearPaid('u1')
  assert.equal(hasPaid('u1', 'bazi.full', CHART_A), false)
  assert.equal(hasPaid('u2', 'bazi.full', CHART_A), true)
})
