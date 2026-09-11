// 性别口径回归测试（直接测源码，不经打包产物）。
//
// 背景：全站 canonical 是 '男'/'女'。起名页与风水页的内嵌排盘表单历史上产出
// 'male'/'female'，而 buildChart 只判 `=== '女'` → 女命被静默当成男命排盘；
// 称骨引擎反过来只认 'female'，页面传 '女' → 女性拿到男命断语，页面显示的性别也是反的。
// 现在统一在 src/engine/gender.js 归一，引擎入口一律先过它。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGender, isFemale } from '../gender.js'
import { buildChart } from '../bazi.js'
import { weighBones } from '../chenggu.js'

const BIRTH = { year: 1992, month: 3, day: 3, hour: 10 }

test('normalizeGender：各种写法都归到 男/女', () => {
  for (const v of ['女', 'female', 'FEMALE', 'F', '坤', '坤造', ' 女 ']) {
    assert.equal(normalizeGender(v), '女', `${v} 应归一为 女`)
  }
  for (const v of ['男', 'male', 'M', '乾', '', null, undefined, '不详']) {
    assert.equal(normalizeGender(v), '男', `${JSON.stringify(v)} 应兜底为 男`)
  }
  assert.equal(isFemale('female'), true)
  assert.equal(isFemale('male'), false)
})

test('buildChart：传 female 与传 女 得到同一张盘', () => {
  const a = buildChart(BIRTH.year, BIRTH.month, BIRTH.day, BIRTH.hour, '女')
  const b = buildChart(BIRTH.year, BIRTH.month, BIRTH.day, BIRTH.hour, 'female')
  // chart.gender 必须存归一后的值，否则下游「坤造/乾造」的判断也跟着错
  assert.equal(b.gender, '女')
  assert.deepEqual(b.pillars.map(p => p.gan + p.zhi), a.pillars.map(p => p.gan + p.zhi))
  assert.deepEqual(b.daYunList.map(d => d.key), a.daYunList.map(d => d.key))
})

test('buildChart：男女大运方向确实不同（证明性别真的参与了排盘）', () => {
  const m = buildChart(BIRTH.year, BIRTH.month, BIRTH.day, BIRTH.hour, '男')
  const f = buildChart(BIRTH.year, BIRTH.month, BIRTH.day, BIRTH.hour, '女')
  assert.notDeepEqual(m.daYunList.map(d => d.key), f.daYunList.map(d => d.key),
    '同八字的男女大运应逆顺相反；若相同说明性别没被采纳')
})

test('称骨：女命拿到女命断语，summary.gender 存归一值', () => {
  const f = weighBones(BIRTH, '女')
  const m = weighBones(BIRTH, '男')
  assert.equal(f.summary.gender, '女')
  assert.equal(m.summary.gender, '男')
  const love = r => r.lines.find(l => l.key === '感情')
  assert.notEqual(love(f).text, love(m).text, '男女感情断语必须不同')
  // 总评白话仅描述骨重命格，不再重复男女命通用规则；性别差异由经典断语与感情项承载。
  assert.equal(f.classic.plain, m.classic.plain)
})

test('称骨：传统歌诀与现代提示不重复男女命通用规则', () => {
  const m = weighBones(BIRTH, '男').classic
  const f = weighBones(BIRTH, '女').classic
  assert.match(m.text, /传统歌诀/)
  assert.match(f.text, /传统歌诀/)
  assert.doesNotMatch(m.plain, /男命常规断法|女命常规断法/)
  assert.doesNotMatch(f.plain, /男命常规断法|女命常规断法/)
})

test('称骨：传 female / male 与传 女 / 男 结果一致', () => {
  const a = weighBones(BIRTH, '女')
  const b = weighBones(BIRTH, 'female')
  assert.equal(b.summary.gender, '女')
  assert.deepEqual(b.lines.map(l => l.text), a.lines.map(l => l.text))
})
