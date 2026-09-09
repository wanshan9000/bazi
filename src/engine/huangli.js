// 个性化黄历引擎
// 输入：日期 + 八字命盘(chart)，输出：融合老黄历与当代生活场景的每日提示

import {
  DAY_RULES, ZHI_CHONG, GAN_THEME, WX_LIFE,
  lunarInfo, weekday, dayElement, solarTerm, zodiacOfYear,
  dayPillar, yearPillar, monthPillar
} from '../data/huangli.js'
import { DI_ZHI, SHENGXIAO, TIAN_GAN } from '../data/ganzhi.js'

// 五行相生相克关系
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }

// 建除十二神以节气月令的月支为起点：月支当日为「建」，地支顺行十二日一周。
// 《协纪辨方书》的择日思想重在先辨月令、再审用事、后参人事；这里把它实现为
// 可解释的三层规则，避免将零散神煞或个人喜忌当作一票否决的万能分数。
export const JIANCHU_VALUES = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭']

export const SELECTION_PURPOSES = {
  marry: {
    name: '嫁娶',
    favorableValues: ['定', '成', '开'],
    avoidValues: ['破', '闭'],
    aliases: ['嫁娶', '婚嫁', '结婚', '纳采', '订盟'],
  },
  move: {
    name: '入宅',
    favorableValues: ['定', '成', '开'],
    avoidValues: ['破', '闭'],
    aliases: ['入宅', '搬家', '移徙', '安床', '置产'],
  },
  business: {
    name: '开业',
    favorableValues: ['满', '成', '开'],
    avoidValues: ['破', '闭'],
    aliases: ['开市', '开业', '开张', '交易', '纳财', '签约'],
  },
}

function dateLabel(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function selectionPurpose(purposeKey) {
  return SELECTION_PURPOSES[purposeKey] || SELECTION_PURPOSES.marry
}

function chartBranches(chart) {
  if (!chart) return []
  const pillars = Array.isArray(chart.pillars) ? chart.pillars : []
  const year = pillars.find(p => p.label === '年柱')?.zhi || chart.yearZhi
  const day = pillars.find(p => p.label === '日柱')?.zhi || chart.dayZhi
  return [
    year && { zhi: year, label: '年支' },
    day && { zhi: day, label: '日支' },
  ].filter(Boolean)
}

// 返回当天在节气月令下的建除值日。纯日期也可使用，因而常规黄历与个人黄历共用。
export function jianchuValue(date) {
  const yp = yearPillar(date)
  const mp = monthPillar(date, TIAN_GAN.indexOf(yp.gan))
  const dp = dayPillar(date)
  const index = (DI_ZHI.indexOf(dp.zhi) - DI_ZHI.indexOf(mp.zhi) + 12) % 12
  return { name: JIANCHU_VALUES[index], index, monthPillar: mp, dayPillar: dp }
}

// 择日规则的优先级：冲忌/用途禁日为硬过滤；建除用事决定是否入选；
// 个人五行只在已经通过前两层的候选中调整排序，不能把避开日重新抬为吉日。
export function evaluateSelectionDay(date, chart, purposeKey = 'marry') {
  const purpose = selectionPurpose(purposeKey)
  const jianchu = jianchuValue(date)
  const element = dayElement(date)
  const hardReasons = []
  const reasons = [`${jianchu.monthPillar.zhi}月${jianchu.name}日`]

  for (const branch of chartBranches(chart)) {
    if (ZHI_CHONG[jianchu.dayPillar.zhi] === branch.zhi) {
      hardReasons.push(`日支${jianchu.dayPillar.zhi}冲命主${branch.label}${branch.zhi}`)
    }
  }
  if (purpose.avoidValues.includes(jianchu.name)) {
    hardReasons.push(`${jianchu.name}日不作${purpose.name}用事`)
  }
  const purposeFit = purpose.favorableValues.includes(jianchu.name)
  if (purposeFit) reasons.push(`${jianchu.name}日与${purpose.name}用事相合`)
  else reasons.push(`${jianchu.name}日不列为${purpose.name}首选`)

  let personalScore = 0
  const favorable = chart?.favorable || []
  const avoid = chart?.avoid || []
  const dayElements = [element.ganWx, element.zhiWx]
  const favorableHits = dayElements.filter(wx => favorable.includes(wx))
  const avoidHits = dayElements.filter(wx => avoid.includes(wx))
  if (favorableHits.length) {
    personalScore += favorableHits.length
    reasons.push(`当日${favorableHits.join('、')}与命局喜用相合`)
  }
  if (avoidHits.length) {
    personalScore -= avoidHits.length
    reasons.push(`当日${avoidHits.join('、')}为命局需节制的五行`)
  }

  const hardBlocked = hardReasons.length > 0
  const decision = hardBlocked ? 'avoid' : purposeFit ? 'recommend' : 'neutral'
  // 建除适配为主要排序项；个人项最多贡献 2 分，且硬过滤不因分数改变。
  const score = (purposeFit ? 10 : 0) + personalScore

  return {
    date: dateLabel(date),
    purpose: purpose.name,
    purposeKey,
    monthPillar: jianchu.monthPillar,
    dayPillar: jianchu.dayPillar,
    jianchu: jianchu.name,
    dayWx: `${element.ganWx}${element.zhiWx}`,
    hardBlocked,
    decision,
    score,
    reasons,
    hardReasons,
    purposeFit,
    personalScore,
  }
}

// 当日干支与该日主"生克关系"评分为顺/平/慎
function dayRelation(chart, dayWx, dayZhiWx) {
  const self = chart.dayMasterWx
  // 生我、我生、比和 → 顺；我克、克我 → 慎/平
  let score = 0
  for (const wx of [dayWx, dayZhiWx]) {
    if (wx === self) score += 2
    else if (SHENG[wx] === self) score += 1   // 生我（印）
    else if (SHENG[self] === wx) score += 1   // 我生（食伤）
    else if (KE[wx] === self) score -= 1      // 克我（官杀）
    else if (KE[self] === wx) score -= 1      // 我克（财）
  }
  if (score >= 3) return '顺'
  if (score <= 0) return '慎'
  return '平'
}

// 今日是否宜"主动出击 / 收敛蓄力"
function actionAdvice(relation, avoidWx, dayWx) {
  const avoid = avoidWx.includes(dayWx)
  if (avoid) return { mode: '静守', head: '宜守不宜攻', body: '今日五行与你忌神同气，冲动易耗神，适合收敛锋芒、按部就班，把大决定放到明天。' }
  if (relation === '顺') return { mode: '进取', head: '宜进不宜退', body: '今日五行生扶于你，思路清晰、助力常在，适合把一直拖着的事往前推一把。' }
  if (relation === '慎') return { mode: '稳中求进', head: '宜稳不宜急', body: '今日与你略有冲克，节奏宜放缓，做决定前多问一个「为什么」。' }
  return { mode: '顺势而为', head: '宜谋不宜躁', body: '今日平平，稳扎稳打即可，小步快跑胜过大步冒进。' }
}

// 结合八字喜用神给出开运建议（颜色/方位/贵人）
function luckTips(chart) {
  const fav = chart.favorable[0] || '火'
  const t = WX_LIFE[fav]
  const color = { 木: '青绿', 火: '红紫', 土: '黄棕', 金: '白金', 水: '黑蓝' }[fav]
  const dir = { 木: '东方', 火: '南方', 土: '中原', 金: '西方', 水: '北方' }[fav]
  const noble = { 木: '虎兔猪', 火: '蛇马羊', 土: '龙狗牛', 金: '猴鸡鼠', 水: '猪鼠鸡' }[fav]
  const num = { 木: '3·8', 火: '2·7', 土: '5·10', 金: '4·9', 水: '1·6' }[fav]
  return { fav, color, dir, noble, num, scene: t.good }
}

// 生成单日个性化黄历
export function buildDaily(date, chart) {
  const dp = dayPillar(date)
  const yp = yearPillar(date)
  const jianchu = jianchuValue(date)
  const el = dayElement(date)
  const term = solarTerm(date)
  const lunar = lunarInfo(date)
  const zhiChong = ZHI_CHONG[dp.zhi]
  const chongZodiac = SHENGXIAO[DI_ZHI.indexOf(zhiChong)]
  const zodiac = zodiacOfYear(date)

  const rules = DAY_RULES[dp.zhi] || { yi: [], ji: [] }
  const theme = GAN_THEME[dp.gan] || GAN_THEME['甲']
  const rel = chart ? dayRelation(chart, el.ganWx, el.zhiWx) : '平'
  const act = chart ? actionAdvice(rel, chart.avoid, el.ganWx) : { mode: '顺势而为', head: '宜随缘而动', body: '以平常心面对今天，把注意力放在当下该做的事上。' }
  const tips = chart ? luckTips(chart) : null
  const life = WX_LIFE[el.ganWx]

  // 结合喜忌挑 2 条生活化建议
  const goodScenes = chart
    ? (tips.scene.length >= 2 ? tips.scene.slice(0, 2) : tips.scene)
    : GAN_THEME[dp.gan].scene.slice(0, 2)

  // 传统宜忌挑选（各取 3）
  const yiPick = (rules.yi || []).slice(0, 3)
  const jiPick = (rules.ji || []).slice(0, 3)

  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    week: `周${weekday(date)}`,
    yearGanzhi: `${yp.gan}${yp.zhi}年`,
    monthGanzhi: `${jianchu.monthPillar.gan}${jianchu.monthPillar.zhi}月`,
    dayGanzhi: `${dp.gan}${dp.zhi}日`,
    dayWx: `${el.ganWx}${el.zhiWx}`,
    lunar: lunar.label,
    term: term.name,
    monthZhi: jianchu.monthPillar.zhi,
    jianchu: jianchu.name,
    zhi: dp.zhi,
    chong: `${chongZodiac}（冲${chongZodiac}，避西北动土）`,
    rules,
    yi: yiPick,
    ji: jiPick,
    theme: theme.title,
    tone: theme.tone,
    scenes: goodScenes,
    relation: rel,
    action: act,
    tips,
    // 供黄历报告的所有个人化区块使用；传统黄历原始字段不受此对象改写。
    bazi: chart ? {
      dayMaster: chart.dayMaster,
      dayMasterWx: chart.dayMasterWx,
      favorable: chart.favorable || [],
      avoid: chart.avoid || [],
    } : null,
    life,
    isToday: isSameDay(date, new Date())
  }
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// 生成一周黄历
export function buildWeek(fromDate, chart) {
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(fromDate)
    d.setDate(fromDate.getDate() + i)
    days.push(buildDaily(d, chart))
  }
  return days
}

// 把八字命盘中的核心信息抽取成订阅可复用的概要（用于展示"你的专属维度"）
export function chartProfile(chart) {
  if (!chart) return null
  return {
    dayMaster: chart.dayMaster,
    dayMasterWx: chart.dayMasterWx,
    shengxiao: chart.shengxiao,
    gender: chart.gender,
    favorable: chart.favorable,
    avoid: chart.avoid,
    strength: chart.strength
  }
}
