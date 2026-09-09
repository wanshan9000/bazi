// 择吉 / 择日专报引擎：月令建除定用事，冲忌优先，个人命局仅作候选排序。

import { buildDaily, evaluateSelectionDay, SELECTION_PURPOSES } from './huangli.js'
import { makeReport, failReport } from './reportSchema.js'

const WEEK_CN = { 0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' }
const SCAN_DAYS = 45

const PURPOSES = {
  marry: { name: '嫁娶', warn: '嫁娶宜选吉日，更利婚姻美满、家宅安定。' },
  move: { name: '入宅', warn: '入宅搬家讲究和气生财，吉日入宅更利新居气象。' },
  business: { name: '开业', warn: '开业择吉是生意人的老讲究，图个开门红、财源广进。' },
}

const PURPOSE_MAP = [
  { key: 'marry', re: /结婚|嫁娶|嫁人|娶妻|婚礼|婚期|订婚|领证|领结婚证/ },
  { key: 'move', re: /搬家|入宅|乔迁|迁居|移居|搬新家|进新居/ },
  { key: 'business', re: /开业|开张|开市|开公司|开店|开工|动工|签约/ },
]

export function detectPurpose(q) {
  for (const it of PURPOSE_MAP) if (it.re.test(q)) return it.key
  return 'marry'
}

export function buildZejiReport(purposeKey, chart) {
  const key = PURPOSES[purposeKey] ? purposeKey : 'marry'
  const purpose = PURPOSES[key]
  if (!purpose) return failReport('未知的择吉用途。')

  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const matched = []
  for (let i = 1; i <= SCAN_DAYS; i++) {
    const date = new Date(from)
    date.setDate(from.getDate() + i)
    const day = buildDaily(date, chart)
    const evaluation = evaluateSelectionDay(date, chart, key)
    if (evaluation.decision !== 'recommend') continue
    matched.push({
      date: day.date,
      week: `周${WEEK_CN[date.getDay()]}`,
      ganzhi: `${day.yearGanzhi} ${day.dayGanzhi}`,
      day,
      evaluation,
    })
  }

  matched.sort((a, b) => b.evaluation.score - a.evaluation.score || a.date.localeCompare(b.date))
  const top = matched.slice(0, 5)

  if (!top.length) {
    return makeReport('zejiri', {
      sub: purpose.name,
      hero: { chars: ['择'], main: `${purpose.name}择日 · 近期暂未命中候选日` },
      sections: [{
        key: 'note', title: '说明', kind: 'note',
        data: { text: `近 ${SCAN_DAYS} 天内未找到同时通过冲忌、用事与建除筛选的${purpose.name}候选日。可放宽日期范围；涉及双方家人、具体时辰或地域时，宜另作完整择日。` },
      }],
      advice: { love: purpose.warn },
    })
  }

  const best = top[0]
  const overview = `近 ${SCAN_DAYS} 天中，有 ${top.length} 天通过了冲忌与用事筛选。首推 ${best.date}（${best.ganzhi}）：${best.evaluation.reasons.join('；')}。${chart ? '命局五行只用于同类候选日排序，不会覆盖冲忌。' : '未提供八字时，结果按通用节气月令与建除法生成。'}`
  const selectionRule = SELECTION_PURPOSES[key] || SELECTION_PURPOSES.marry

  return makeReport('zejiri', {
    sub: `${purpose.name} · ${chart ? '结合你的八字用神' : '通用黄历'}`,
    hero: { chars: ['择'], main: `${purpose.name} · 近 ${top.length} 个吉日推荐` },
    sections: [
      {
        key: 'top', title: `★ 吉日推荐（${purpose.name}）`, kind: 'table',
        data: {
          headers: ['日期', '星期', '干支', '月令建除', '结论', '依据'],
          rows: top.map(row => [
            row.date,
            row.week,
            row.ganzhi,
            `${row.evaluation.monthPillar.zhi}月${row.evaluation.jianchu}日`,
            '推荐',
            row.evaluation.reasons.slice(1).join('；'),
          ]),
        },
      },
      {
        key: 'method', title: '择日方法', kind: 'kv',
        data: {
          items: [
            { k: '一、先避冲忌', v: '日支冲命主年支或日支、用途回避的建除日，直接排除。' },
            { k: '二、再看用事', v: `${purpose.name}优先取${selectionRule.favorableValues.join('、')}日。建除以节气月令起算。` },
            { k: '三、后参个人', v: chart ? '比较候选日的日干、日支五行与命局喜忌，只作排序加权。' : '未输入八字，暂以通用黄历规则排序；补充八字后可作个人化排序。' },
          ],
        },
      },
      {
        key: 'note', title: '择日说明', kind: 'note',
        data: { text: `${overview} 本模块参考《协纪辨方书》所重的月令、用事与趋避次序，不以堆叠神煞替代判断。择日仅供参考，重要安排请结合现实情况统筹。` },
      },
      {
        key: 'tips', title: '当日提示', kind: 'cards',
        data: {
          items: top.slice(0, 3).map(row => ({
            title: `${row.date}（${row.day.dayGanzhi}）`,
            desc: `月令建除：${row.evaluation.monthPillar.zhi}月${row.evaluation.jianchu}日\n推荐依据：${row.evaluation.reasons.slice(1).join('；')}\n日常宜事：${(row.day.yi || []).slice(0, 3).join('、') || '平'}`,
            tag: '推荐',
          })),
        },
      },
    ],
    advice: {
      love: purpose.warn,
      wealth: '择吉日办大事，图个顺遂心安；更重要的是提前筹备、用心经营。',
    },
  })
}

export default buildZejiReport
