// 袁天罡称骨算命法
import { normalizeGender } from './gender.js'
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
    if (p.type === 'year') {
      y = v.replace(/[^0-9]/g, '').slice(0, 4)
      if (v.includes('闰')) leap = true
    }
    if (p.type === 'month') m = v.replace(/[^0-9]/g, '')
    if (p.type === 'day') d = v.replace(/[^0-9]/g, '')
  }
  return { year: +y, month: +m, day: +d, leap }
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

  // 性格、事业、感情、财运、健康 五维解读（文言结论 + 大白话）
  const lines = [
    { key: '性格', label: '性格', text: rating.tone === '奇特' || rating.tone === '隆昌'
      ? '主见极强，有领袖之质，独行而能聚人。须戒过刚。'
      : rating.tone === '显达'
      ? '外圆内方，沉稳有度，能纳百川亦不失底线。'
      : rating.tone === '顺达'
      ? '温柔敦厚，待人以诚，关键时刻能下决断。'
      : rating.tone === '中和'
      ? '均衡中庸，宜向一技之长深耕，借专业以立足。'
      : '质朴勤勉，不善变通，需修「心宽」二字以化戾气。',
      plain: '你有主见、能拿主意，是个敢想敢干的人；要注意别太犟、别太冲，多听听别人的意见。' },
    { key: '事业', label: '事业', text: total >= 3.0
      ? '中年得志机率高，宜入主流行业深耕技术与资源，35 岁后启动第二曲线。'
      : total >= 2.0
      ? '事业有起有伏，宜守攻兼备、择主而事，30 岁后渐入佳境。'
      : '早年多磨，宜以一技傍身，择稳为上，戒急躁与多变。',
      plain: total >= 3.0 ? '你的事业属于"后半程发力"，年轻别急着到处跳，35 岁以后机会和积累会集中兑现。' : total >= 2.0 ? '工作有高有低，30 岁前多打磨本事，之后会越来越好；选对平台跟对人很重要。' : '早年辛苦些，先练就一门看家本领、求个稳当，别这山望着那山高，急反而容易吃亏。' },
    { key: '财运', label: '财运', text: total >= 2.5
      ? '正财稳、偏财有，遇贵人引路可得意外之喜。忌贪，宜稳健理财。'
      : '财来财去，留心散财风险，宜记账、设止损、慎入陌生领域。',
      plain: total >= 2.5 ? '你有稳定收入，也常有额外进账，遇到合适的人指点还有惊喜；关键别贪，钱要管住、稳着花。' : '钱来得快去得也快，容易大手大脚；养成记账的习惯、设好花钱上限，别碰不懂的行当，才能攒得住。' },
    { key: '感情', label: '感情', text: g === '女'
      ? total >= 2.5 ? '贤淑有福，多得良人相伴，宜惜缘修心。' : '情路多波，须自立自强，良缘多现于中年后。'
      : total >= 2.5 ? '稳重可靠，宜择贤内助持家，婚姻可为事业助力。' : '婚姻晚来亦佳，宜自修品性，宁缺毋滥。',
      plain: g === '女'
        ? total >= 2.5 ? '你是有福之人，身边不缺合适的人，遇到了就好好珍惜，别太挑剔。' : '感情路上有点波折，先把日子过好、把自己立起来，对的人通常在中晚年才出现。'
        : total >= 2.5 ? '你踏实靠得住，找个贤内助能把家撑起来，另一半也会是你的好帮手。' : '晚点结婚反而更好，先把人品修好，宁缺毋滥，别将就。' },
    { key: '健康', label: '健康', text: '筋骨、肠胃、颈椎为三处当守之处。30 岁后每年体检，早睡胜药补。', plain: '重点留意腰腿、肠胃和颈椎这三样；过了 30 岁每年做次体检，早睡早起比吃啥补品都管用。' }
  ]

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
    lines
  }
}
