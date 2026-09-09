// 袁天罡称骨算命法
import { normalizeGender } from './gender.js'
import { buildChart } from './bazi.js'
// 核心算法：根据出生年、月、日、时的干支查询骨重数（两），累加后评定命格。
// 说明：传统称骨表以「两」为单位，1 两 = 10 钱。此处采用广泛流传的版本，权作参考。

// 月骨表（农历月份）。键为农历月，值为 [初一, 初二, ...三十]
// 每格骨重两数：2.2 / 1.6 ...
const MONTH_BONE = {
  1: [0.2,1.6,0.9,0.5,1.2,0.4,0.6,1.5,0.2,1.0,0.6,0.7,1.5,0.7,0.5,1.0,1.3,1.0,1.3,1.6,0.6,0.4,0.7,1.2,1.4,0.8,0.7,0.9,1.4,0.7,0.9,1.0],
  2: [0.5,0.7,1.4,1.0,1.2,1.4,1.0,0.7,0.8,1.0,0.5,0.6,1.2,0.5,0.8,1.4,1.5,1.4,1.2,1.4,1.0,1.0,0.5,0.6,1.2,0.7,1.4,1.2,1.5,0.7,1.4,1.5],
  3: [0.9,1.3,0.5,0.8,1.4,0.7,0.5,1.0,0.9,1.0,0.6,1.3,0.6,0.5,0.8,1.5,0.7,1.4,1.0,0.5,1.2,0.7,0.6,0.5,1.5,0.5,1.4,0.7,1.4,0.7,1.2,1.0],
  4: [1.2,1.0,1.4,0.5,1.4,1.2,1.5,1.4,0.9,1.2,1.5,0.6,1.2,0.7,0.5,1.5,0.7,1.5,0.5,0.9,1.0,1.5,1.5,1.4,1.2,0.5,0.7,0.7,0.6,1.4,1.5,0.9],
  5: [0.6,1.0,0.5,0.5,1.4,1.0,0.9,0.9,0.8,1.5,0.9,0.8,1.4,1.4,0.8,0.5,1.5,0.7,1.0,1.5,0.5,1.0,0.5,0.5,1.0,0.6,1.0,0.5,0.6,1.0,1.4,1.0,1.0],
  6: [1.4,1.0,1.0,0.5,0.6,0.6,1.5,0.8,1.0,1.0,1.5,0.6,1.0,0.6,0.6,1.0,1.0,0.5,1.5,0.8,1.0,1.0,0.6,0.6,1.0,0.5,1.0,0.5,0.5,1.0,1.4,0.8,1.5,0.8],
  7: [0.6,1.2,0.5,0.5,1.0,1.4,0.6,1.5,1.0,0.6,0.6,1.2,1.4,0.6,0.6,1.0,1.4,1.0,0.6,0.5,0.5,1.0,1.4,0.6,1.0,1.2,0.5,1.0,0.5,0.8,1.0,1.0],
  8: [1.4,0.5,0.5,1.0,1.0,0.6,1.0,0.5,1.0,0.6,1.0,0.5,1.0,0.5,0.8,1.0,1.0,0.5,0.5,1.0,0.5,0.5,1.0,0.6,1.0,0.5,1.0,0.6,1.0,1.5,0.5],
  9: [1.0,1.0,1.4,0.6,0.5,1.0,1.5,0.6,0.5,1.0,1.0,0.6,1.0,0.5,1.0,1.0,0.5,1.0,1.0,0.5,1.0,0.5,0.8,1.0,0.5,0.5,0.6,0.5,1.0,0.6],
  10: [0.8,1.0,1.0,1.0,0.5,0.6,1.0,0.5,0.5,1.0,0.5,1.0,0.6,0.5,1.0,0.5,1.0,1.0,0.6,0.5,0.5,0.6,1.0,0.5,1.0,0.5,1.0,1.0,0.6,0.5],
  11: [1.0,0.5,1.0,0.5,0.6,1.0,0.5,0.6,1.0,0.6,0.5,1.0,1.0,0.5,0.5,0.5,0.6,0.6,0.5,0.5,0.6,0.5,1.0,0.5,1.0,0.5,0.6,0.5,0.6,0.5],
  12: [1.0,0.5,0.6,1.0,0.5,0.5,0.6,0.5,1.0,0.5,0.6,1.0,0.5,0.5,0.5,0.6,0.5,0.5,0.6,1.0,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.6,0.5]
}

// 时骨表（按地支）
const HOUR_BONE = {
  子: 1.6, 丑: 0.6, 寅: 0.7, 卯: 1.0,
  辰: 1.4, 巳: 0.6, 午: 1.6, 未: 0.6,
  申: 0.5, 酉: 1.0, 戌: 0.5, 亥: 1.4
}

// 年骨表（按天干或六十甲子）
// 以六十甲子为索引，相对 1924 为甲子年（序号 0）
// 简化处理：按出生年的支查基础年骨，闰年减 0.2
const YEAR_BASE = {
  子: 1.2, 丑: 0.9, 寅: 1.0, 卯: 1.0,
  辰: 1.2, 巳: 1.0, 午: 1.6, 未: 1.0,
  申: 0.8, 酉: 0.9, 戌: 0.5, 亥: 1.4
}

// 公历转农历（简版，使用 Intl）
function solarToLunar(date) {
  const fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    year: 'numeric', month: 'numeric', day: 'numeric'
  })
  const parts = fmt.formatToParts(date)
  let y = '', m = '', d = '', leap = false
  for (const p of parts) {
    const v = p.value
    if (p.type === 'relatedYear' || p.type === 'year') {
      y = v.replace(/[^0-9]/g, '').slice(0, 4)
      if (v.includes('闰')) leap = true
    }
    if (p.type === 'month') m = v.replace(/[^0-9]/g, '')
    if (p.type === 'day') d = v.replace(/[^0-9]/g, '')
  }
  return { year: +(y || date.getFullYear()), month: +m, day: +d, leap }
}

// 中文数字转阿拉伯
function cnToNum(s) {
  const map = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 廿: 20, 卅: 30 }
  let v = 0
  // 处理 二十 / 廿三 / 十五
  if (s.includes('廿')) {
    const rest = s.replace('廿', '')
    if (rest === '十') return 20
    return 20 + (map[rest] || 0)
  }
  if (s.startsWith('十')) {
    return 10 + (map[s[1]] || 0)
  }
  if (s.includes('十')) {
    const [a, b] = s.split('十')
    return (map[a] || 1) * 10 + (map[b] || 0)
  }
  return map[s] || parseInt(s) || 1
}

// 精确从 Intl 拿农历月份（汉字）
function getLunarMonthName(date) {
  const fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long' })
  return fmt.format(date) // e.g. "七月"
}

// 由公历 date 取时辰地支
function getShiChen(date) {
  const h = date.getHours()
  const map = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
  // 子时：23:00 - 01:00 → 0
  let idx = Math.floor((h + 1) / 2) % 12
  return map[idx]
}

// 由公历 date 取年支
function getYearZhi(date) {
  // 用立春分隔
  let y = date.getFullYear()
  if (date.getMonth() < 1 || (date.getMonth() === 1 && date.getDate() < 4)) y -= 1
  const map = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
  return map[((y - 4) % 12 + 12) % 12]
}

// 命格判定（按总骨重两数）
const RATING = [
  { min: 0, max: 1.5, grade: '命薄', tone: '辛苦', desc: '命格偏薄，事务多艰辛，宜守正待机，命局占「勤」字。', plain: '这局命不算顺，靠自己一步步熬，勤快、踏实、别好高骛远，稳扎稳打能把日子过起来。' },
  { min: 1.5, max: 2.0, grade: '中下', tone: '平常', desc: '命格平常，祸福参半，宜安守本分，立善心方能招福。', plain: '这局命比较普通，有苦有甜、起起落落，本本分分过日子、多做善事，福气会慢慢聚过来。' },
  { min: 2.0, max: 2.5, grade: '中', tone: '中和', desc: '中正之命，早年劳碌，中年后渐入佳境，可守可攻。', plain: '这局命不算差，年轻时辛苦点，中年前后日子会越过越好，既守得住也能冲一把。' },
  { min: 2.5, max: 3.0, grade: '中上', tone: '顺达', desc: '命势上扬，贤达者居多，能逢贵人，事业稳中有升。', plain: '这局命往上走，常能遇到贵人拉一把，工作事业稳稳当当往上提。' },
  { min: 3.0, max: 3.5, grade: '上等', tone: '显达', desc: '大器晚成，少时多磨砺，中年青云直上，名利双收。', plain: '这局命属于厚积薄发，年轻时吃些苦头，中年以后机会一来，名利都能到手。' },
  { min: 3.5, max: 4.0, grade: '上上', tone: '隆昌', desc: '命格富贵，多得祖德荫庇与贵人相助，宜心存善念回报。', plain: '这局命底子好，家里有靠、贵人也多，是福厚之命；别忘本，多行善积德，福气才长久。' },
  { min: 4.0, max: 99,  grade: '极品', tone: '奇特', desc: '非常之命，多主奇才异能，然忌傲，须修德以养福。', plain: '这局命很特别，往往有过人的本事或际遇，但最忌讳骄傲，把德行修好，福分才守得住。' }
]

function rate(total) {
  for (const r of RATING) {
    if (total >= r.min && total < r.max) return r
  }
  return RATING[RATING.length - 1]
}

function formatBoneWeight(total) {
  const liang = Math.floor(total)
  const qian = Math.round((total - liang) * 10)
  const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  return qian === 0 ? `${cn[liang]}两` : `${cn[liang]}两${cn[qian]}钱`
}

function buildClassicReading(total, gender, rating) {
  const genderText = gender === '女' ? '女命' : '男命'
  const genderNote = gender === '女'
    ? '女命常规断法会兼看自身立身、情缘与家庭经营，以自立和关系中的互相尊重为要。'
    : '男命常规断法会兼看立业、责任与家运，以稳住根基、踏实经营为要。'
  return {
    title: `${formatBoneWeight(total)} · ${genderText}称骨`,
    rule: '常规称骨以农历出生年、月、日、时分别查骨重，四项相加得到总骨重，并分别按男女命作解读。',
    text: `此命总骨重为 ${formatBoneWeight(total)}。按常见称骨口径，属「${rating.tone}」之象：${rating.desc}${genderNote}`,
    plain: `${rating.plain}${genderNote}`,
  }
}

function buildDynamicLines({ total, rating, gender, chart }) {
  const pillars = chart.pillars.map(p => `${p.gan}${p.zhi}`).join(' ')
  const dominant = chart.wuxingRank[0]
  const weakest = chart.wuxingRank[chart.wuxingRank.length - 1]
  const favorable = chart.favorable.join('、')
  const avoid = chart.avoid.join('、')
  const strength = chart.strength.strong ? '偏旺' : chart.strength.weak ? '偏弱' : '较为平衡'
  const boneTone = `${total} 两「${rating.tone}」`
  const genderText = gender === '女' ? '坤造' : '乾造'

  return [
    {
      key: '性格',
      label: '性格',
      text: `称骨主断为${boneTone}；八字为 ${pillars}，${chart.dayMaster}${chart.dayMasterWx}日主${strength}，${dominant}气较显。`,
      plain: chart.strength.strong
        ? `你的底色是有主见、行动感强。把劲用在长期目标上，留意给别人和自己都留一点余地。`
        : chart.strength.weak
          ? `你对环境与关系的感受更细腻。先稳住自己的节奏和边界，再把能力慢慢放大。`
          : `你能在坚持和配合之间找到分寸。选定方向后持续投入，比频繁改变更容易积累成果。`,
    },
    {
      key: '事业',
      label: '事业',
      text: `称骨的${rating.tone}命格给出整体行事基调；八字调和倾向为${favorable}，宜把优势落在可持续的学习、作品与协作上。`,
      plain: chart.strength.strong
        ? `工作上适合主动承担、输出和统筹，但不要只靠冲劲。用清晰流程和可复用的技能承接机会，走得更稳。`
        : chart.strength.weak
          ? `事业上先选能提供支持、反馈和成长空间的平台。把基础能力练扎实，再逐步承担更大的目标。`
          : `你适合在稳定节奏中扩展边界。先做好一项核心能力，再用项目和人脉放大它。`,
    },
    {
      key: '财运',
      label: '财运',
      text: `骨重呈现的是人生基调；财务取向需以八字调和为准，当前宜向${favorable}靠拢，并留意${avoid}过度时带来的消耗。`,
      plain: chart.strength.strong
        ? `收入增长更适合来自能力变现和长期项目。预算先行、分散风险，别让一时兴起决定大额支出。`
        : chart.strength.weak
          ? `先建立稳定现金流和储蓄缓冲，再谈扩张。熟悉的领域、可靠的合作与持续积累，比追逐快钱更合适。`
          : `收支保持清楚，优先投入能提升专业能力和长期回报的事情。稳步积累，比短期冒进更有利。`,
    },
    {
      key: '感情',
      label: '感情',
      text: `${genderText}以${chart.dayMaster}${chart.dayMasterWx}为日主，称骨的${rating.tone}只作缘分节奏参考；关系是否长久仍要看彼此的沟通、边界与现实选择。`,
      plain: chart.strength.strong
        ? `感情里你更容易主导节奏。把“我觉得”多留一点空间给对方表达，关系会更轻松。`
        : chart.strength.weak
          ? `你需要的是稳定回应和被尊重的感受。先确认自己的需求，不必为了维系关系而委屈自己。`
          : `你重视相处的平衡感。保持坦诚沟通、把期待说清楚，比猜测更能建立安全感。`,
    },
    {
      key: '身心',
      label: '身心',
      text: `五行呈现${dominant}偏显、${weakest}相对不足；这是八字平衡提示，不构成健康诊断。`,
      plain: `日常可用${favorable}的节奏来调和：规律作息、适量运动、稳定饮食，并在压力累积时主动休息。若有持续不适，请及时咨询医生。`,
    },
  ]
}

// 称骨算命核心：输入公历生日 + 性别，返回完整结果
// 支持传入 Date 或 { year, month, day, hour } 对象（内部统一转 Date，避免无效时间崩溃）
export function weighBones(dateObj, gender = '男') {
  // 全站性别口径是 '男'/'女'。这里原先只判 gender === 'female'，而称骨页传的是
  // '女' —— 于是女性拿到的是男命感情断语；summary.gender 也原样回传，再被页面
  // 按 === 'male' 判断，把男显示成女。归一之后两处都对。
  const g = normalizeGender(gender)
  let lunarDate
  if (dateObj instanceof Date && !isNaN(dateObj)) {
    lunarDate = dateObj
  } else if (dateObj && typeof dateObj === 'object') {
    const { year, month, day, hour } = dateObj
    lunarDate = new Date(year, (month || 1) - 1, day || 1)
    if (hour !== undefined && hour !== null) lunarDate.setHours(hour)
  } else {
    lunarDate = new Date()
  }
  const { year, month, day, leap } = solarToLunar(lunarDate)

  // 农历月份（汉字 → 阿拉伯）
  const monthName = getLunarMonthName(lunarDate)
  // e.g. "七月" → 7
  const CN = { 正: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 冬: 11, 腊: 12 }
  const m = monthName.length === 2 ? CN[monthName[0]] : (monthName.includes('十') ? cnToNum(monthName) : CN[monthName[0]])

  // 农历日（汉字 → 阿拉伯）
  const dayFmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { day: 'numeric' })
  const dayStr = dayFmt.format(lunarDate) // "十七"
  const d = cnToNum(dayStr)

  // 农历月、日 显示
  const displayMonth = monthName + (leap ? '（闰）' : '')
  const displayDay = dayStr

  // 年骨
  const yearZhi = getYearZhi(lunarDate)
  let yearBone = YEAR_BASE[yearZhi]
  // 闰年微调
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  if (isLeap(lunarDate.getFullYear()) && leap) yearBone += 0.2

  // 月骨
  const safeM = Math.max(1, Math.min(12, m))
  const safeD = Math.max(1, Math.min(30, d))
  const monthBone = (MONTH_BONE[safeM] || MONTH_BONE[1])[safeD - 1] || 0

  // 日骨（按日数流派）— 这里从月骨表取日：再保留一份日骨代理
  // 简化：日骨按日数映射（1-30: 0.5-1.5 浮动）
  const dayBoneMap = [1.2,1.0,1.4,1.5,1.0,0.6,1.4,1.4,0.7,1.0,1.4,1.4,1.4,1.2,1.5,1.4,1.0,1.4,0.7,1.5,0.5,1.4,1.5,1.5,1.0,1.0,1.4,1.0,1.4,1.4]
  const dayBone = dayBoneMap[(safeD - 1) % 30] + (leap ? 0.2 : 0)

  // 时骨
  const shiChen = getShiChen(lunarDate)
  const hourBone = HOUR_BONE[shiChen]

  const total = +(yearBone + monthBone + dayBone + hourBone).toFixed(1)
  const rating = rate(total)
  const classic = buildClassicReading(total, g, rating)
  const chart = buildChart(
    lunarDate.getFullYear(),
    lunarDate.getMonth() + 1,
    lunarDate.getDate(),
    lunarDate.getHours(),
    g,
  )
  const lines = buildDynamicLines({ total, rating, gender: g, chart })

  return {
    summary: {
      year: lunarDate.getFullYear(),
      lunarYear: year,
      lunarMonth: displayMonth,
      lunarDay: displayDay,
      shiChen,
      gender: g,
      total,
      grade: rating.grade,
      tone: rating.tone
    },
    breakdown: [
      { name: '年骨', value: yearBone, detail: `${yearZhi}年生人，基骨 ${yearBone} 两` },
      { name: '月骨', value: monthBone, detail: `${displayMonth}，月骨 ${monthBone} 两` },
      { name: '日骨', value: dayBone, detail: `${displayDay}，日骨 ${dayBone}${leap ? '（闰月加成）' : ''} 两` },
      { name: '时骨', value: hourBone, detail: `${shiChen}时，时骨 ${hourBone} 两` }
    ],
    verdict: rating,
    classic,
    bazi: {
      pillars: chart.pillars.map(p => `${p.gan}${p.zhi}`),
      dayMaster: `${chart.dayMaster}${chart.dayMasterWx}`,
      strength: chart.strength.strong ? '偏旺' : chart.strength.weak ? '偏弱' : '较为平衡',
      favorable: chart.favorable,
      dominant: chart.wuxingRank[0],
      weakest: chart.wuxingRank[chart.wuxingRank.length - 1],
    },
    lines
  }
}
