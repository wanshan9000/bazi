import { buildChart, calculateShensha } from './src/engine/bazi.js'

// 用与 skill 测试相同的命例：1990-05-20 12:00 男
const c = buildChart(1990, 5, 20, 12, '男')
console.log('=== 四柱 ===')
for (const p of c.pillars) {
  console.log(`${p.label}: ${p.gan}${p.zhi}  十神(干): ${p.shiShen}`)
}
console.log('\n=== 五行 ===', JSON.stringify(c.wuxing))
console.log('=== 日主 ===', c.dayMaster, c.dayMasterWx)
console.log('=== 强弱 ===', JSON.stringify(c.strength))
console.log('=== 大运 ===')
console.log('起运:', c.qiYunDate, c.qiYunAge, c.qiYunText)
if (c.daYunList) {
  for (const d of c.daYunList.slice(0, 8)) {
    console.log(`${d.key}  ${d.start}-${d.end} (${d.startAge}-${d.endAge}岁)  干十神:${d.ganShiShen} 支十神:${JSON.stringify(d.zhiShiShen)} 藏干:${(d.zhiCanGan||[]).join('')}`)
  }
}
console.log('\n=== 神煞 ===')
const [yp, mp, dp, hp] = c.pillars
const ss = calculateShensha({
  yearGan: yp.gan, yearZhi: yp.zhi,
  monthGan: mp.gan, monthZhi: mp.zhi,
  dayGan: dp.gan, dayZhi: dp.zhi,
  timeGan: hp.gan, timeZhi: hp.zhi,
})
console.log(ss.length ? ss.join('\n') : '(无)')
