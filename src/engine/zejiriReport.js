// 择吉 / 择日专报引擎：为嫁娶、搬家、开业等大事，在近期挑选吉日
// 结合老黄历宜忌 + 命主八字喜用神五行关系，给出可解释的排序建议
// 输出统一 report 对象（sections + advice），前端 ReportView 渲染

import { buildDaily } from './huangli.js'
import { makeReport, failReport } from './reportSchema.js'

const WEEK_CN = { 0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' }
const SCAN_DAYS = 45 // 扫描未来天数

// 用途定义：名称 + 需匹配的"宜事"关键词（黄历 yi 列表）
const PURPOSES = {
  marry: { name: '嫁娶', key: '嫁娶', yi: ['嫁娶', '婚嫁', '结婚', '纳采', '订盟'], warn: '嫁娶宜选吉日，更利婚姻美满、家宅安定。' },
  move: { name: '入宅', key: '搬家', yi: ['入宅', '搬家', '移徙', '安床', '置产'], warn: '入宅搬家讲究和气生财，吉日入宅更利新居气象。' },
  business: { name: '开业', key: '开业', yi: ['开市', '开业', '开张', '交易', '纳财', '签约'], warn: '开业择吉是生意人的老讲究，图个开门红、财源广进。' },
}

// 用途关键词 → purpose key
const PURPOSE_MAP = [
  { key: 'marry', re: /结婚|嫁娶|嫁人|娶妻|婚礼|婚期|订婚|领证|领结婚证/ },
  { key: 'move', re: /搬家|入宅|乔迁|迁居|移居|搬新家|进新居/ },
  { key: 'business', re: /开业|开张|开市|开公司|开店|开工|动工|签约/ },
]

export function detectPurpose(q) {
  for (const it of PURPOSE_MAP) if (it.re.test(q)) return it.key
  return 'marry' // 默认嫁娶（最常见）
}

// 判断某日"宜"该用途：命中用途对应 yi 关键词
function dayYiFor(day, purpose) {
  const yiSet = new Set((day.yi || []).map(s => s.replace(/[（(].*?[)）]/g, '')))
  return purpose.yi.some(k => yiSet.has(k))
}

// 该日是否忌该用途
function dayJiFor(day, purpose) {
  const jiSet = new Set((day.ji || []).map(s => s.replace(/[（(].*?[)）]/g, '')))
  return purpose.yi.some(k => jiSet.has(k))
}

// 综合评分：宜事命中 + 与命主五行关系
function scoreDay(day, purpose, chart) {
  let s = 0
  if (dayYiFor(day, purpose)) s += 3
  if (dayJiFor(day, purpose)) s -= 3
  const rel = day.relation
  if (rel === '顺') s += 2
  else if (rel === '平') s += 1
  else if (rel === '慎') s -= 1
  // 当日五行避忌神
  if (chart && chart.avoid && chart.avoid.includes(day.dayWx)) s -= 1
  return s
}

export function buildZejiReport(purposeKey, chart) {
  const purpose = PURPOSES[purposeKey] || PURPOSES.marry
  if (!purpose) return failReport('未知的择吉用途。')

  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const rows = []
  const matched = []
  for (let i = 1; i <= SCAN_DAYS; i++) {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    const day = buildDaily(d, chart)
    const yiHit = dayYiFor(day, purpose)
    const jiHit = dayJiFor(day, purpose)
    const sc = scoreDay(day, purpose, chart)
    rows.push({
      date: day.date,
      week: `周${WEEK_CN[day.week ? new Date(day.date).getDay() : new Date(day.date).getDay()]}`,
      ganzhi: `${day.yearGanzhi} ${day.dayGanzhi}`,
      relation: day.relation,
      yiHit, jiHit, score: sc, day
    })
    if (yiHit && !jiHit) matched.push(rows[rows.length - 1])
  }

  // 按评分排序，取前 5 个吉日
  matched.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
  const top = matched.slice(0, 5)

  if (!top.length) {
    return makeReport('zejiri', {
      sub: purpose.name,
      hero: { chars: ['择'], main: `${purpose.name}择日 · 近期暂未命中上吉日` },
      sections: [{
        key: 'note', title: '说明', kind: 'note',
        data: { text: `近 ${SCAN_DAYS} 天内未找到完全避开冲忌的${purpose.name}吉日，建议放宽到 60 天范围，或咨询专业择日师综合看。` }
      }],
      advice: { love: purpose.warn }
    })
  }

  // 最优日
  const best = top[0]
  const overview = best
    ? `综合黄历宜忌与你的八字五行，近一月较适合${purpose.name}的吉日集中在 ${top.length} 天。首推 ${best.date}（${best.ganzhi}），当日五行与你${chart ? '用神相顺（正好是你需要的五行，帮你补力）' : '大势相合'}，顺遂指数最高。`
    : ''

  return makeReport('zejiri', {
    sub: purpose.name + ' · ' + (chart ? '结合你的八字用神' : '通用黄历'),
    hero: { chars: ['择'], main: `${purpose.name} · 近 ${top.length} 个吉日推荐` },
    sections: [
      {
        key: 'top', title: `★ 吉日推荐（${purpose.name}）`, kind: 'table',
        data: {
          headers: ['日期', '星期', '干支', '五行相合', '说明'],
          rows: top.map(r => [
            r.date, r.week, r.ganzhi,
            r.relation === '顺' ? '顺' : r.relation === '平' ? '平' : '慎',
            `${r.yiHit ? '宜' : ''}${r.day.dayWx}`
          ])
        }
      },
      {
        key: 'note', title: '择日说明', kind: 'note',
        data: { text: overview + ' 以上排序综合了「黄历宜忌」与「当日五行与你命局喜忌」两项。择日仅供参考，重要安排请结合现实情况统筹。' }
      },
      {
        key: 'tips', title: '当日开运', kind: 'cards',
        data: { items: top.slice(0, 3).map(r => ({ title: `${r.date}（${r.day.dayGanzhi}）`, desc: `黄历宜事：${(r.day.yi || []).slice(0, 3).join('、') || '平'}\n与你日主关系：${r.relation}${r.relation === '顺' ? '（当日五行帮你补力，事顺）' : r.relation === '平' ? '（平平无奇，中规中矩）' : '（略有冲克，能避则避）'}`, tag: r.relation === '顺' ? '吉' : '平' })) }
      }
    ],
    advice: {
      love: purpose.warn,
      wealth: '择吉日办大事，图个顺遂心安；更重要的是提前筹备、用心经营。'
    }
  })
}

export default buildZejiReport
