// 奇门遁甲排盘引擎
// - 日家/月家/年家：使用 bigfishmarquis-qimen 完整引擎（自包含，浏览器可跑）
// - 时家：保留原有近似转盘算法（bigfishmarquis-qimen 未暴露完整时家引擎）
import { nianJiaGenerate, yueJiaGenerate, riJiaGenerate } from 'bigfishmarquis-qimen'
import { Solar } from 'lunar-typescript'

// ─── 原有时家简化算法（保留） ──────────────────

const JIEQI = [
  { m: 12, d: 21, name: '冬至', y: '阳遁' }, { m: 1, d: 5, name: '小寒', y: '阳遁' }, { m: 1, d: 20, name: '大寒', y: '阳遁' },
  { m: 2, d: 4, name: '立春', y: '阳遁' }, { m: 2, d: 19, name: '雨水', y: '阳遁' }, { m: 3, d: 5, name: '惊蛰', y: '阳遁' },
  { m: 3, d: 20, name: '春分', y: '阳遁' }, { m: 4, d: 4, name: '清明', y: '阳遁' }, { m: 4, d: 20, name: '谷雨', y: '阳遁' },
  { m: 5, d: 5, name: '立夏', y: '阳遁' }, { m: 5, d: 21, name: '小满', y: '阳遁' }, { m: 6, d: 5, name: '芒种', y: '阳遁' },
  { m: 6, d: 21, name: '夏至', y: '阴遁' }, { m: 7, d: 7, name: '小暑', y: '阴遁' }, { m: 7, d: 22, name: '大暑', y: '阴遁' },
  { m: 8, d: 7, name: '立秋', y: '阴遁' }, { m: 8, d: 23, name: '处暑', y: '阴遁' }, { m: 9, d: 7, name: '白露', y: '阴遁' },
  { m: 9, d: 23, name: '秋分', y: '阴遁' }, { m: 10, d: 8, name: '寒露', y: '阴遁' }, { m: 10, d: 23, name: '霜降', y: '阴遁' },
  { m: 11, d: 7, name: '立冬', y: '阴遁' }, { m: 11, d: 22, name: '小雪', y: '阴遁' }, { m: 12, d: 7, name: '大雪', y: '阴遁' }
]

const JIU_GONG = [
  { pos: '巽', num: 4, wx: '木' },
  { pos: '离', num: 9, wx: '火' },
  { pos: '坤', num: 2, wx: '土' },
  { pos: '震', num: 3, wx: '木' },
  { pos: '中', num: 5, wx: '土' },
  { pos: '兑', num: 7, wx: '金' },
  { pos: '艮', num: 8, wx: '土' },
  { pos: '坎', num: 1, wx: '水' },
  { pos: '乾', num: 6, wx: '金' }
]

const DI_PAN_ORDER = [
  ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'],
  ['戊', '乙', '丙', '丁', '癸', '壬', '辛', '庚', '己']
]

const GONG_GAN_ARR = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']

const NINE_STARS = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英']
const STAR_NATURE = {
  天蓬: '凶', 天芮: '凶', 天冲: '平', 天辅: '吉', 天禽: '平', 天心: '吉', 天柱: '凶', 天任: '吉', 天英: '平'
}
const STAR_CONTENT = {
  天蓬: '水贼星，主盗寇暗昧之事',
  天芮: '病符星，主病疾哭泣之事',
  天冲: '翰噪星，主武斗争讼之事',
  天辅: '文昌星，主学业文教之事',
  天禽: '福灵星，主调和阴柔之事',
  天心: '善德星，主医药寿考之事',
  天柱: '刑戮星，惊怪异乱之事',
  天任: '丰吉星，主田财喜庆之事',
  天英: '火害星，主火光惊恐之事'
}

const EIGHT_MEN = ['休', '生', '伤', '杜', '景', '死', '惊', '开']
const MEN_NATURE = {
  休: '吉', 生: '吉', 伤: '凶', 杜: '平', 景: '平', 死: '凶', 惊: '凶', 开: '大吉'
}
const MEN_CONTENT = {
  休: '休养安神，宜静守、疗养、上官',
  生: '生发万物，宜谋事、开业、出行',
  伤: '伤悲啼哭，宜柔克刚、避锋芒',
  杜: '闭塞不通，宜隐匿密谋、保密',
  景: '文书印信，宜文书、考试、立约',
  死: '死灭终结，宜收尾、不宜新做',
  惊: '惊恐口舌，宜戒口、慎行',
  开: '开放荣昌，宜出征、开业、婚嫁'
}

const SHEN_ARR = ['值符', '腾蛇', '太阴', '六合', '勾陈', '朱雀', '九地', '九天']
const SHEN_ARR_INV = ['值符', '九天', '九地', '朱雀', '勾陈', '六合', '太阴', '腾蛇']
const SHEN_CONTENT = {
  值符: '掌控中枢、主神守护',
  腾蛇: '惊吓缭绕、虚惊不断',
  太阴: '阴柔暗扶、贵人暗中相助',
  六合: '合同交易、和合成就',
  勾陈: '牵绊拘滞、迟滞不前',
  朱雀: '口舌是非、文书临门',
  九地: '坤柔厚载、密谋藏形',
  九天: '阳刚高远、利于出行'
}

const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const QI_XING = new Set(['乙', '丙', '丁'])

function getJieqi(date) {
  const m = date.getMonth() + 1, d = date.getDate()
  let result = JIEQI[0]
  for (const jq of JIEQI) {
    if (m > jq.m || (m === jq.m && d >= jq.d)) result = jq
  }
  return result
}

function getJu(date) {
  const jq = getJieqi(date)
  const dayIdx = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000)
  const hourIdx = SHICHEN.indexOf(getShiChen(date))
  const raw = (dayIdx + hourIdx) % 9
  let ju
  if (jq.y === '阳遁') {
    ju = (raw % 9) + 1
    if (ju > 9) ju -= 9
  } else {
    ju = 9 - (raw % 9)
    if (ju < 1) ju += 9
  }
  return { jq, ju }
}

function getShiChen(date) {
  const h = date.getHours()
  const idx = Math.floor((h + 1) / 2) % 12
  return SHICHEN[idx]
}

function buildPan(date) {
  const { jq, ju } = getJu(date)
  const dayIdx = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000)
  const hourIdx = SHICHEN.indexOf(getShiChen(date))

  const yang = jq.y === '阳遁'
  const star_order = NINE_STARS.slice()
  const men_order = EIGHT_MEN.slice()
  const shen_arr = yang ? SHEN_ARR : SHEN_ARR_INV

  const tianPan = yang ? DI_PAN_ORDER[0].slice() : DI_PAN_ORDER[1].slice()
  const shiGanIndex = (Math.floor((date.getHours() / 2)) + 1) % 10
  const shiGan = GONG_GAN_ARR[(yang ? shiGanIndex : -shiGanIndex + 10) % 10]
  const tianGanPos = tianPan.indexOf(shiGan)

  const baseGongIdx = (() => {
    const seq = [5, 1, 8, 3, 4, 9, 2, 7, 6]
    return seq[(tianGanPos + ju) % 9]
  })()

  const starPos = (yang ? 1 : -1) * 1
  const seq9 = ['中', '坎', '艮', '震', '巽', '离', '坤', '兑', '乾']

  const pan = seq9.map((pos, idx) => {
    const ganAtPos = tianPan[(idx + ju - 1 + 9) % 9]
    const starIdx = (idx + starPos + 9) % 9
    const star = star_order[starIdx]
    const menIdx = (idx + 1) % 8
    const men = men_order[(menIdx + 8) % 8]
    const shenIdx = (idx + (yang ? 1 : -1) * (ju - 1) + 9 * 2) % 8
    const shen = shen_arr[(shenIdx + 8) % 8]
    return {
      pos,
      idx,
      gan: ganAtPos,
      star,
      starNature: STAR_NATURE[star],
      starContent: STAR_CONTENT[star],
      men,
      menNature: MEN_NATURE[men],
      menContent: MEN_CONTENT[men],
      shen,
      shenContent: SHEN_CONTENT[shen],
      qiXing: QI_XING.has(ganAtPos)
    }
  })

  const goodPalace = pan.filter(p => p.starNature === '吉' && (p.menNature === '吉' || p.menNature === '大吉'))
  const goodPos = goodPalace.map(p => p.pos).join('、') || '暂无可大动之宫'

  const pillarsLabel = `${jq.name}·${jq.y}${ju}局·${getShiChen(date)}时`

  return {
    date,
    jq,
    ju,
    juLabel: `${jq.y}${ju}局`,
    shiChen: getShiChen(date),
    shiGan,
    pillarsLabel,
    layout: pan,
    goodPos,
    suggestions: [
      goodPos !== '暂无可大动之宫' ? `今日宜取 ${goodPos} 方，谋事多吉。` : '今日奇门格局平缓，宜守不宜攻。',
      `局数 ${ju}：${ju <= 3 ? '上元局，利开创、起步。' : ju <= 6 ? '中元局，利推进、协调。' : '下元局，利收束、巩固。'}`,
      `${getShiChen(date)}时值符：观此方位，先静观再动。`
    ]
  }
}

// ─── 公开 API（兼容原页面） ─────────────────────

export function castQimen(date = new Date()) {
  return buildPan(date)
}

// ─── 完整排盘文本（供元气AI技能） ──────────────

function toGz(str) {
  return str || ''
}

// 宫名映射：奇门 1-9 宫号 → 卦名（与九宫方位一致）
const PALACE_NAME = ['坎', '坤', '震', '巽', '中', '乾', '兑', '艮', '离']

function chartToText(chart, label) {
  const lines = []
  lines.push(`【奇门遁甲 · ${label}】`)
  const dun = chart.dun === 'yang' ? '阳遁' : chart.dun === 'yin' ? '阴遁' : chart.dun
  lines.push(`${dun}${chart.juNumber}局｜值符：${chart.zhiFuStar}（${chart.zhiFuPalace}宫）｜值使：${chart.zhiShiDoor}（${chart.zhiShiPalace}宫）`)
  if (chart.fourPillars) {
    const fp = chart.fourPillars
    lines.push(`四柱：${fp.year.gan}${fp.year.zhi}年 ${fp.month.gan}${fp.month.zhi}月 ${fp.day.gan}${fp.day.zhi}日 ${fp.hour ? fp.hour.gan + fp.hour.zhi + '时' : ''}`)
  }
  if (chart.kongWang && chart.kongWang.length) lines.push(`旬空：${chart.kongWang.join('、')}`)
  if (chart.solarTerm) lines.push(`节气：${chart.solarTerm}`)
  lines.push('')
  lines.push('【九宫盘面】')
  for (const p of chart.palaces) {
    const marks = p.marks && p.marks.length ? `（${p.marks.join('、')}）` : ''
    lines.push(`${p.palaceName}宫[${p.palaceElement}]：天盘${p.skyStem} 地盘${p.earthStem}｜${p.star}${p.starElement}｜${p.door}门${p.doorElement}｜${p.godShort || p.god}${marks}`)
  }
  lines.push('')
  lines.push(`用神参考：值符${chart.zhiFuStar}落${chart.zhiFuPalace}宫，值使${chart.zhiShiDoor}落${chart.zhiShiPalace}宫。取方位宜参考开门（吉门）所在宫。`)
  return lines.join('\n')
}

// 日家奇门（公历 date）
export function buildQimenDaily(date = new Date()) {
  try {
    const chart = riJiaGenerate(date.getFullYear(), date.getMonth() + 1, date.getDate())
    return chartToText(chart, '日家奇门')
  } catch (e) {
    return `（日家奇门排盘失败：${e.message}）`
  }
}

// 结构化日家奇门（返回原始 chart 供报告做分析，而非文本）
export function buildQimenDailyChart(date = new Date()) {
  try {
    return riJiaGenerate(date.getFullYear(), date.getMonth() + 1, date.getDate())
  } catch (e) {
    return null
  }
}

// 月家奇门（公历 date，month 为节气月 1-12）
export function buildQimenMonthly(date = new Date()) {
  try {
    const chart = yueJiaGenerate(date.getFullYear(), date.getMonth() + 1)
    return chartToText(chart, '月家奇门')
  } catch (e) {
    return `（月家奇门排盘失败：${e.message}）`
  }
}

// 结构化月家奇门
export function buildQimenMonthlyChart(date = new Date()) {
  try {
    return yueJiaGenerate(date.getFullYear(), date.getMonth() + 1)
  } catch (e) {
    return null
  }
}

// 年家奇门（公历 year）
export function buildQimenYearly(year = new Date().getFullYear()) {
  try {
    const chart = nianJiaGenerate(year)
    return chartToText(chart, '年家奇门')
  } catch (e) {
    return `（年家奇门排盘失败：${e.message}）`
  }
}

// 结构化年家奇门
export function buildQimenYearlyChart(year = new Date().getFullYear()) {
  try {
    return nianJiaGenerate(year)
  } catch (e) {
    return null
  }
}

// 时家奇门（保留原有近似算法，输出结构化文本）
export function buildQimenHourly(date = new Date()) {
  const pan = buildPan(date)
  const lines = []
  lines.push('【奇门遁甲 · 时家奇门】')
  lines.push(`${pan.pillarsLabel}｜值符：${pan.shiGan}`)
  lines.push('')
  lines.push('【九宫盘面】')
  for (const p of pan.layout) {
    lines.push(`${p.pos}宫：天盘干${p.gan}${p.qiXing ? '（三奇）' : ''}｜${p.star}（${p.starNature}，${p.starContent}）｜${p.men}门（${p.menNature}，${p.menContent}）｜${p.shen}（${p.shenContent}）`)
  }
  lines.push('')
  for (const s of pan.suggestions) lines.push(s)
  return lines.join('\n')
}

// 综合排盘：时家 + 日家 + 月家 + 年家
export function buildQimenFull(date = new Date()) {
  return [
    buildQimenHourly(date),
    '',
    buildQimenDaily(date),
    '',
    buildQimenMonthly(date),
    '',
    buildQimenYearly(date.getFullYear()),
  ].join('\n')
}

export const QIMEN_META = { JIU_GONG, JIEQI, SHICHEN }
