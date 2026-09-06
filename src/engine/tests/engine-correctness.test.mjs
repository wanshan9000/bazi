// 排盘算法正确性回归测试（直接测源码）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentYearGanzhi } from '../bazi.js'
import { lunarToSolar, tryLunarToSolar } from '../../utils/lunar.js'
import { analyzeName } from '../nameAnalysis.js'

test('流年以立春为界，不是元旦', () => {
  // 2026 立春在 2 月 4 日前后。之前仍是乙巳年，之后才是丙午年。
  assert.equal(gz(new Date(2026, 0, 15)), '乙巳', '1 月 15 日应仍算上一年')
  assert.equal(gz(new Date(2026, 1, 3)), '乙巳', '立春前一天应仍算上一年')
  assert.equal(gz(new Date(2026, 1, 10)), '丙午', '立春后才换年')
  function gz(d) { const r = currentYearGanzhi(d); return r.gan + r.zhi }
})

test('流年：同一年立春前后必须不同', () => {
  const before = currentYearGanzhi(new Date(2026, 0, 20))
  const after = currentYearGanzhi(new Date(2026, 5, 20))
  assert.notEqual(before.gan + before.zhi, after.gan + after.zhi,
    '元旦到立春之间若与年中相同，说明还在按公历年号取干支')
})

test('无效农历必须显式失败，不能当公历排盘', () => {
  for (const args of [[2024, 13, 1, false], [2024, 2, 31, false], [2024, 5, 1, true]]) {
    assert.throws(() => lunarToSolar(...args), /INVALID_LUNAR_DATE|无效的农历日期/,
      `${args.join('/')} 应当抛错而不是原样返回`)
    assert.equal(tryLunarToSolar(...args), null)
  }
})

test('合法农历正常换算', () => {
  const sol = lunarToSolar(2024, 1, 1, false)
  assert.equal(sol.year, 2024)
  assert.ok(sol.month >= 1 && sol.month <= 12)
  assert.ok(sol.day >= 1 && sol.day <= 31)
})

test('姓名五格：单字名的人格要含名字笔画', () => {
  const g = grid('王明')
  // 王 4 + 明 8：天 5 / 人 12 / 地 9 / 外 1 / 总 12
  assert.equal(g.tian, 5)
  assert.equal(g.ren, 12, '人格漏加名字笔画时会退化成姓氏的 4')
  assert.equal(g.di, 9)
  assert.equal(g.zong, 12)
  assert.equal(g.wai, 1, '单姓单名的外格固定为 1')
})

test('姓名五格：双字名', () => {
  const g = grid('王小明')
  assert.equal(g.tian, 5)
  assert.equal(g.ren, 7)
  assert.equal(g.di, 11)
  assert.equal(g.zong, 15)
  assert.equal(g.wai, 9)
})

test('姓名五格：外格 = 总格 - 人格 + 1 恒成立，且各格为正', () => {
  for (const name of ['王明', '王小明', '欧阳修', '司马相如', '李白', '诸葛亮']) {
    const g = grid(name)
    assert.equal(g.wai, g.zong - g.ren + 1, `${name} 的外格不满足定义`)
    for (const [k, v] of Object.entries(g)) {
      assert.ok(v > 0, `${name} 的${k}格为 ${v}，五格不可能为零或负`)
    }
    assert.ok(g.zong >= g.ren, `${name} 总格(${g.zong})不该小于人格(${g.ren})——复姓混用简繁笔画时才会这样`)
  }
})

function grid(fullName) {
  const raw = analyzeName({ fullName }).grid
  const v = Object.values(raw).map(x => (x && x.value !== undefined ? x.value : x))
  return { tian: v[0], ren: v[1], di: v[2], wai: v[3], zong: v[4] }
}
