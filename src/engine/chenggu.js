// 袁天罡称骨算命法（民俗参考）
// 统一入口供页面与 Agent 调用。称骨部分采用标准 51 档整数「钱」查表；
// 八字部分只作交叉后的生活建议，不把民俗歌诀当成决定论。
import { Lunar } from 'lunar-typescript'
import { normalizeGender } from './gender.js'
import { buildChart } from './bazi.js'
import { CHENGGU_STANDARD } from '../data/chengguStandard.js'

const HOUR_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

const TAG_COPY = {
  early_hardship: '先把基础能力与生活秩序稳住，耐心积累会比急着证明自己更有用。',
  midlate_better: '更适合用长期主义安排眼下，把可持续的能力与关系一点点做厚。',
  mobility: '环境变化、跨城或跨领域时，先把信息和资源准备充分，再做关键选择。',
  scholar_official: '把学习、专业表达与责任感沉淀成可见成果，机会更容易接住。',
  wealth: '做财务安排时，以稳健、分散和看得懂为先，不以短期情绪做决定。',
  family: '关系与家庭议题里，把期待说具体，长期的互相尊重比单方面承担更重要。',
  family_support_weak: '把生活支点放回自己能经营的能力、关系与日常秩序，减少对单一外部支持的依赖。',
  religious_path: '可把阅读、静心或服务他人当作整理内在秩序的方式，不必把它理解为人生唯一方向。',
  self_made: '更适合以可复利的专业能力建立安全感，关键决定先做足准备，再主动争取。',
}

// 对传统歌诀的专业化转译：保留歌诀主题，不把其中的贫富、寿限、婚配等绝对断语带入报告。
const TAG_INTERPRETATION = {
  early_hardship: {
    title: '起步与积累',
    text: '歌诀常以“早年辛劳”概括起步不易。更适合把它理解为资源、经验或支持网络尚在搭建期：先稳定基本盘，再扩大选择面。',
  },
  midlate_better: {
    title: '节奏与后程',
    text: '歌诀中的“后程渐稳”强调的是复利，而非某个年龄突然转运。把专业、储蓄和可信赖的关系持续做厚，往往比追逐短期结果更有效。',
  },
  mobility: {
    title: '变化与迁移',
    text: '歌诀多以离乡、变动取象。放在现实中，可理解为环境转换、跨领域或角色调整时更需要提前准备信息、技能和支持系统。',
  },
  scholar_official: {
    title: '学习与专业',
    text: '传统文本常以功名取象。现代语境里，更适合落实为持续学习、专业认证、作品沉淀与清晰表达，让能力被看见、被信任。',
  },
  wealth: {
    title: '资源与经营',
    text: '歌诀涉及财禄时，重点不宜理解成金额预言。更有价值的是建立预算、风险边界和长期现金流，用看得懂的方式经营资源。',
  },
  family: {
    title: '关系与支持',
    text: '传统说法会把家庭支持写得很重。现实里更值得关注的是沟通质量、责任边界和互相支持的方式，而不是把关系好坏归因给命数。',
  },
  family_support_weak: {
    title: '自立与支点',
    text: '歌诀里的“六亲少靠”不应理解为孤立无援。它提示的是把安全感分散到技能、收入、朋友与日常秩序上，减少对单一支点的依赖。',
  },
  religious_path: {
    title: '内在秩序',
    text: '传统文本有时借修习取象。可以把它转成阅读、静心、规律生活或服务他人的实践，用来整理内在秩序，而非回避现实责任。',
  },
  self_made: {
    title: '主动经营',
    text: '歌诀的自立意象更适合转成主动性：用可复利的技能、清晰的计划和稳健的决策，为自己建立更大的选择空间。',
  },
}

const FALLBACK_INTERPRETATION = {
  title: '稳步经营',
  text: '这类歌诀的重点在于守住日常秩序、持续投入和审慎决策。把注意力放在可控行动上，比用单一标签定义自己更有价值。',
}

function normalizeBirthDate(input) {
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input
  if (typeof input === 'string') {
    const match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}))?$/)
    if (match) return new Date(+match[1], +match[2] - 1, +match[3], +(match[4] || 12))
  }
  if (input && typeof input === 'object') {
    const { year, month, day, hour } = input
    if (year && month && day) return new Date(year, month - 1, day, hour ?? 12)
  }
  return new Date()
}

function getShiChen(date) {
  return HOUR_BRANCHES[Math.floor((date.getHours() + 1) / 2) % 12]
}

function formatBoneWeight(qian) {
  const liang = Math.floor(qian / 10)
  const rest = qian % 10
  const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  return rest === 0 ? `${cn[liang]}两` : `${cn[liang]}两${cn[rest]}钱`
}

function formatLunarDay(day) {
  const digits = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (day <= 10) return `初${digits[day - 1]}`
  if (day < 20) return `十${digits[day - 11] || ''}`
  if (day === 20) return '二十'
  if (day < 30) return `廿${digits[day - 21] || ''}`
  return '三十'
}

function applyLookupBoundary(date) {
  const lookupDate = new Date(date)
  const nightZi = date.getHours() === 23
  // 通行规则：23:00~23:59 的夜子时，按下一农历日查日骨。
  if (nightZi) lookupDate.setDate(lookupDate.getDate() + 1)
  return { lookupDate, nightZi }
}

function resolveLunarComponents(date) {
  const { lookupDate, nightZi } = applyLookupBoundary(date)
  const lunar = Lunar.fromDate(lookupDate)
  const rawMonth = lunar.getMonth()
  const isLeapMonth = rawMonth < 0
  const lunarDay = lunar.getDay()
  let lookupMonth = Math.abs(rawMonth)
  // 通行 51 档规则：闰月前半按本月、后半按下月。
  if (isLeapMonth && lunarDay > 15) lookupMonth = lookupMonth === 12 ? 1 : lookupMonth + 1

  return {
    lunarYear: lunar.getYear(),
    lunarMonth: Math.abs(rawMonth),
    lunarDay,
    yearGanzhi: lunar.getYearInGanZhi(),
    isLeapMonth,
    lookupMonth,
    nightZi,
  }
}

function getStandardWeight({ yearGanzhi, lookupMonth, lunarDay, shiChen }) {
  const { yearWeightQianByGanzhi, monthWeightQian, dayWeightQian, hourWeightQian } = CHENGGU_STANDARD
  const values = {
    yearQian: yearWeightQianByGanzhi[yearGanzhi],
    monthQian: monthWeightQian[lookupMonth],
    dayQian: dayWeightQian[lunarDay],
    hourQian: hourWeightQian[shiChen],
  }
  if (Object.values(values).some(value => !Number.isInteger(value))) {
    throw new Error('称骨查表失败：出生信息未能匹配标准 51 档。')
  }
  const totalQian = values.yearQian + values.monthQian + values.dayQian + values.hourQian
  const verse = CHENGGU_STANDARD.versesByQian[totalQian]
  if (!verse) throw new Error(`称骨查表失败：${totalQian} 钱不在标准 51 档范围内。`)
  return { ...values, totalQian, verse }
}

function buildHourUncertainty({ lunar, yearQian, monthQian, dayQian, currentQian, hourKnown }) {
  if (hourKnown !== false) return { isEstimate: false }

  const baseQian = yearQian + monthQian + dayQian
  const possibleTotals = [...new Set(
    HOUR_BRANCHES.map(shiChen => baseQian + CHENGGU_STANDARD.hourWeightQian[shiChen])
  )].sort((a, b) => a - b)

  return {
    isEstimate: true,
    assumedShiChen: '午',
    assumedTotalQian: currentQian,
    minQian: possibleTotals[0],
    maxQian: possibleTotals.at(-1),
    possibleTotalCount: possibleTotals.length,
    note: `未提供出生时辰，当前以午时作示例。按同一农历年、月、日的十二时辰查表，总骨重可能落在${formatBoneWeight(possibleTotals[0])}至${formatBoneWeight(possibleTotals.at(-1))}之间；补充时辰后才能定档。`,
    lookupContext: {
      yearGanzhi: lunar.yearGanzhi,
      month: lunar.lookupMonth,
      day: lunar.lunarDay,
    },
  }
}

function buildWeightProfile(verse) {
  const tags = verse.tags || []
  const tagLabel = tags.length ? tags.map(tag => ({
    early_hardship: '前期积累', midlate_better: '后程渐稳', mobility: '变动适应',
    scholar_official: '学业专业', wealth: '资源经营', family: '关系经营',
    family_support_weak: '自立经营', religious_path: '静心修习', self_made: '自主积累',
  }[tag] || tag)).join('、') : '稳步经营'
  const note = tags.map(tag => TAG_COPY[tag]).find(Boolean) || '把注意力放回眼前可控的安排，持续行动比给自己贴标签更重要。'
  return { label: tagLabel, note, tags }
}

function buildTraditionalInterpretation(profile) {
  const themes = profile.tags
    .map(tag => TAG_INTERPRETATION[tag])
    .filter(Boolean)
    .slice(0, 3)

  return {
    intro: '以下释义把歌诀中的传统意象转成现实可观察的议题，用于帮助理解，不是对人生结果的预测。',
    themes: themes.length ? themes : [FALLBACK_INTERPRETATION],
  }
}

function buildClassicReading({ totalQian, gender, verse, profile }) {
  const genderText = gender === '女' ? '女命' : '男命'
  return {
    title: `${formatBoneWeight(totalQian)} · ${genderText}称骨`,
    rule: '按农历年干支、月、日、时辰分别查骨重，四项相加后匹配本站固定的标准 51 档。性别不会改变四项骨重，只用于保留出生信息与后续交叉解读。',
    sourceVerse: verse.verse,
    // 保留兼容字段：Agent/旧消费者可继续拿到完整的一次传统歌诀。
    text: `传统歌诀：${verse.verse}`,
    sourceNotice: '歌诀是历史民俗文本，常带有寿限、贫富、婚配或性别角色等时代化、绝对化表述。本页不以这些内容判断现实结果，也不展示扩写式的寿限、子嗣断语。',
    weightNote: `可提取的主题：${profile.label}。`,
    plain: `换成今天的话：${profile.note}`,
    interpretation: buildTraditionalInterpretation(profile),
  }
}

function buildDynamicLines({ gender, chart, profile }) {
  const profileLead = profile.tags.includes('mobility')
    ? '遇到转折先做好信息和资源准备。'
    : profile.tags.includes('midlate_better')
      ? '用长期节奏替代一时快慢。'
      : '先把基础和边界安稳。'

  return [
    {
      key: '节奏', label: '个人节奏',
      text: chart.strength.strong
        ? `${profileLead}行动和主见是优势，但先定目标与边界，再推进更省力。`
        : chart.strength.weak
          ? `${profileLead}你对环境变化更敏感，先稳住日常节奏，再逐步放大能力。`
          : `${profileLead}在坚持与配合之间找准分寸，选定方向后持续投入即可。`,
    },
    {
      key: '事业', label: '工作与学业',
      text: chart.strength.strong
        ? '主动承担与输出可以成为优势；用流程和可复用的技能承接机会，别只依赖冲劲。'
        : chart.strength.weak
          ? '优先选择能提供支持、反馈与成长空间的平台，先练稳基础，再承担更大的目标。'
          : '在稳定节奏中扩展边界，先做好一项核心能力，再用项目和人脉把它放大。',
    },
    {
      key: '财务', label: '钱与资源',
      text: chart.strength.strong
        ? '收入增长宜来自能力变现和长期项目；预算先行、分散风险，避免冲动做大额决定。'
        : chart.strength.weak
          ? '先建立稳定现金流和储蓄缓冲，再考虑扩张；可靠合作比追逐快钱更适合你。'
          : '收支保持清楚，优先投入能提升专业能力和长期回报的事情，稳步积累更有利。',
    },
    {
      key: '感情', label: '关系经营',
      text: chart.strength.strong
        ? (gender === '女'
          ? '别把照料一切变成单向承担；把真实需求说出来，关系会更轻松。'
          : '别让“我来安排”变成单向决定；多留一点表达空间，关系会更轻松。')
        : chart.strength.weak
          ? (gender === '女'
            ? '确认自己的需求，不必为了维系关系而委屈；稳定回应与互相尊重更重要。'
            : '把感受和期待说具体，别只靠忍耐或猜测；稳定回应更有安全感。')
          : (gender === '女'
            ? '把期待说清楚，少用照顾和猜测代替沟通，安全感会在实际行动里慢慢建立。'
            : '把期待说清楚，少用猜测替代沟通，安全感会在实际行动里慢慢建立。'),
    },
    {
      key: '身心', label: '身心节律',
      text: `日常可按${chart.favorable.join('、')}的调和方向安排：规律作息、适量运动、稳定饮食；若有持续不适，请及时咨询医生。`,
    },
  ]
}

function chengguMarkdown(result) {
  const { summary, breakdown, classic, bazi, lines, uncertainty, calculation } = result
  return [
    '【称骨论命】',
    `${summary.gender === '女' ? '女命' : '男命'} · ${formatBoneWeight(summary.totalQian)} · 标准 51 档`,
    `农历：${summary.lunarYear}年${summary.lunarMonth}${summary.lunarDay} · ${summary.shiChen}时${summary.hourKnown === false ? '（时辰未知，按午时估算）' : ''}`,
    '',
    '【骨重明细】',
    ...breakdown.map(item => `${item.name}：${item.value}两（${item.detail}）`),
    uncertainty.isEstimate ? `时辰提示：${uncertainty.note}` : '',
    '',
    '【计算口径】',
    `基础：${calculation.basis}`,
    `版本：${calculation.tableScope}`,
    `边界：${calculation.rules.join('；')}`,
    calculation.sourcePolicy,
    '',
    '【传统称骨解读】',
    `传统歌诀（历史原文节录）：${classic.sourceVerse}`,
    classic.sourceNotice,
    classic.weightNote,
    classic.plain,
    '',
    '【歌诀专业释义】',
    classic.interpretation.intro,
    ...classic.interpretation.themes.map(theme => `${theme.title}：${theme.text}`),
    '',
    '【结合八字的动态解读】',
    `四柱：${bazi.pillars.join(' · ')}｜日主：${bazi.dayMaster} · ${bazi.strength}｜调和倾向：${bazi.favorable.join('、')}`,
    ...lines.map(line => `${line.label}：${line.text}${line.plain ? ` ${line.plain}` : ''}`),
    '',
    '【说明】称骨歌诀为民俗参考；结合八字的部分会随出生日期、时辰与性别重新计算，不替代现实中的主动选择与专业建议。',
  ].join('\n')
}

/** 页面与 Agent 共用的称骨报告入口。 */
export function generateChenggu({ birth, date, gender, format = 'object' } = {}) {
  const source = birth ?? date
  const normalizedBirth = normalizeBirthDate(source)
  if (birth?.hourKnown === false) normalizedBirth.hourKnown = false
  const result = weighBones(normalizedBirth, gender || birth?.gender)
  if (birth?.hourKnown === false) result.summary.hourKnown = false
  return format === 'markdown' ? chengguMarkdown(result) : result
}

export function weighBones(dateObj, gender = '男') {
  const date = normalizeBirthDate(dateObj)
  const g = normalizeGender(gender)
  const shiChen = getShiChen(date)
  const lunar = resolveLunarComponents(date)
  const weight = getStandardWeight({ ...lunar, shiChen })
  const uncertainty = buildHourUncertainty({
    lunar,
    yearQian: weight.yearQian,
    monthQian: weight.monthQian,
    dayQian: weight.dayQian,
    currentQian: weight.totalQian,
    hourKnown: dateObj?.hourKnown,
  })
  const profile = buildWeightProfile(weight.verse)
  const chart = buildChart(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), g)
  const classic = buildClassicReading({ totalQian: weight.totalQian, gender: g, verse: weight.verse, profile })
  const lines = buildDynamicLines({ gender: g, chart, profile })
  const lunarMonthLabel = `${lunar.isLeapMonth ? '闰' : ''}${lunar.lunarMonth}月`
  const boundaryNotes = [
    lunar.nightZi ? '夜子时按次日查日骨' : '',
    lunar.isLeapMonth ? `闰月${lunar.lunarDay <= 15 ? '按本月' : '后半月按下月'}查月骨` : '',
  ].filter(Boolean).join('；')

  return {
    summary: {
      year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(),
      lunarYear: lunar.lunarYear, lunarMonth: lunarMonthLabel,
      lunarDay: formatLunarDay(lunar.lunarDay), yearGanzhi: lunar.yearGanzhi, shiChen, gender: g,
      total: weight.totalQian / 10, totalQian: weight.totalQian,
      grade: weight.verse.grade, tone: profile.label, standard: CHENGGU_STANDARD.version,
    },
    breakdown: [
      { name: '年骨', value: weight.yearQian / 10, detail: `${lunar.yearGanzhi}年，${weight.yearQian}钱` },
      { name: '月骨', value: weight.monthQian / 10, detail: `${lunarMonthLabel}${lunar.lookupMonth !== lunar.lunarMonth ? `（按${lunar.lookupMonth}月）` : ''}，${weight.monthQian}钱` },
      { name: '日骨', value: weight.dayQian / 10, detail: `${formatLunarDay(lunar.lunarDay)}，${weight.dayQian}钱` },
      { name: '时骨', value: weight.hourQian / 10, detail: `${shiChen}时，${weight.hourQian}钱${boundaryNotes ? `；${boundaryNotes}` : ''}` },
    ],
    verdict: {
      grade: weight.verse.grade,
      tone: profile.label,
      desc: uncertainty.isEstimate
        ? `午时示例命中${formatBoneWeight(weight.totalQian)}；补充时辰后才能确认准确档位。`
        : `已按本站固定的标准 51 档完成查表，命中${formatBoneWeight(weight.totalQian)}。`,
      plain: '骨重是传统分类索引，不是对人生高低或现实结果的评价。',
    },
    uncertainty,
    calculation: {
      tableScope: '标准 51 档（2两1钱至7两1钱）',
      basis: '农历年干支、农历月、农历日、十二时辰',
      rules: ['夜子时（23:00–23:59）按次日查日骨', '闰月初一至十五按本月，十六至月底按下月', '性别不改变四项骨重'],
      sourcePolicy: '不同民间版本在歌诀、男女断语与最高档位上会有差别；本站固定使用 standard-51qian，不混合扩展版本。',
    },
    weightProfile: profile,
    classic,
    bazi: {
      pillars: chart.pillars.map(p => `${p.gan}${p.zhi}`),
      dayMaster: `${chart.dayMaster}${chart.dayMasterWx}`,
      strength: chart.strength.strong ? '偏旺' : chart.strength.weak ? '偏弱' : '较为平衡',
      favorable: chart.favorable, dominant: chart.wuxingRank[0], weakest: chart.wuxingRank.at(-1),
    },
    lines,
  }
}
