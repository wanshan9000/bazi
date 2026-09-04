import { buildChart, calculateShensha } from './src/engine/bazi.js'
import { buildBaziFromSolar } from 'cantian-tymext'

const c = buildChart(1990, 5, 20, 12, '男')

console.log('════ 1. 四柱 + 藏干 + 十神 ════')
for (const p of c.pillars) {
  console.log(`${p.label}: ${p.gan}${p.zhi} | 干十神:${p.shiShen} | 藏干:${(p.zhiCanGan || []).join(',')}`)
}

console.log('\n════ 2. 空亡 ════')
console.log('buildChart 输出含空亡字段吗?', JSON.stringify(c.pillars.map(p => ({ [p.label]: p.kongWang }))))

console.log('\n════ 3. 大运 ════')
console.log('起运:', c.qiYunDate, c.qiYunAge, c.qiYunText)
for (const d of (c.daYunList || []).slice(0, 6)) {
  console.log(`${d.key} (${d.startAge}-${d.endAge}岁, ${d.start}-${d.end}) 干:${d.ganShiShen} 支:${(d.zhiShiShen || []).join('、')} 藏干:${(d.zhiCanGan || []).join('、')}`)
}

console.log('\n════ 4. 神煞 (calculateShensha) ════')
const [yp, mp, dp, hp] = c.pillars
const ss = calculateShensha({ yearGan: yp.gan, yearZhi: yp.zhi, monthGan: mp.gan, monthZhi: mp.zhi, dayGan: dp.gan, dayZhi: dp.zhi, timeGan: hp.gan, timeZhi: hp.zhi })
console.log(ss.length ? ss.map(s => `- ${s}`).join('\n') : '(无)')

console.log('\n════ 5. cantian-tymext 原始字段（参照） ════')
const ct = buildBaziFromSolar({ solarTime: '1990-05-20 12:00', gender: 1, sect: 2 })
console.log('四柱:', [ct.年柱.天干.天干 + ct.年柱.地支.地支, ct.月柱.天干.天干 + ct.月柱.地支.地支, ct.日柱.天干.天干 + ct.日柱.地支.地支, ct.时柱.天干.天干 + ct.时柱.地支.地支].join(' '))
console.log('年柱空亡:', ct.年柱.空亡, '| 月柱空亡:', ct.月柱.空亡, '| 日柱空亡:', ct.日柱.空亡, '| 时柱空亡:', ct.时柱.空亡)
console.log('大运起运:', ct.大运?.起运年龄, ct.大运?.起运日期)
console.log('首运:', ct.大运?.大运?.[0]?.干支, JSON.stringify(ct.大运?.大运?.[0]))
