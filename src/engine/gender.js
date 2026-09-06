// 性别口径的唯一真源。
//
// 全站 canonical 形式是 '男' / '女'：排盘引擎（buildChart、calculateShensha）、
// 报告文案（乾造/坤造）、盲派与紫微都按这个判。历史上表单层混用过 'male'/'female'
// （起名页、风水页的内嵌排盘表单），而引擎只判 `=== '女'`，于是女命被静默当成男命
// 排盘；称骨页反过来传 '女' 给只认 'female' 的引擎，连显示的性别都是反的。
//
// 结论：任何跨模块传递的性别都先过这里，页面表单也直接产出 canonical 值。
// 未知值按 '男' 兜底，与既有行为一致，不会改动已生成的历史命盘。
export function normalizeGender(gender) {
  const s = String(gender ?? '').trim().toLowerCase()
  if (s === '女' || s === 'female' || s === 'f' || s === '坤' || s === '坤造') return '女'
  return '男'
}

/** 是否女命。等价于 normalizeGender(g) === '女'，只是读起来更直白。 */
export function isFemale(gender) {
  return normalizeGender(gender) === '女'
}
