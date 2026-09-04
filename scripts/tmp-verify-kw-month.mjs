import { buildMangpaiReport } from '../src/engine/reports.js'
import { buildChart } from '../src/engine/bazi.js'
function probe(label, y, m, d, h) {
  const chart = buildChart(y, m, d, h, '男')
  const mp = buildMangpaiReport(chart)
  const sec = mp.sections.find(s => s.key === 'kongwang')
  const months = sec.data.items.filter(it => it.mark === '重点')
  console.log(`\n>>> ${label}`)
  console.log('note:', sec?.note)
  console.log(`重点月份卡数: ${months.length}`)
  months.forEach(it => console.log(`  - ${it.name}: ${it.desc.slice(0, 50)}`))
}
probe('截图 case (体平+2空亡命中+6害)', 1975, 10, 13, 6)
probe('八字2', 1990, 5, 20, 12)
probe('八字3', 1988, 8, 8, 8)
probe('八字4 (无空亡)', 2000, 1, 1, 10)
