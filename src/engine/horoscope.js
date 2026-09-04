// 西方星座运势算法
// 核心：根据 (当前日期 - 入庙日) 计算行星行运相位，配合星座特质，给出当日运势

const ZODIAC = [
  { name: '摩羯座',  en: 'Capricorn',  icon: '♑', wx: '土', color: '稳重冷静', dateRange: '12.22 - 01.19', ruler: '土星', start: { m: 12, d: 22 }, end: { m: 1, d: 19 } },
  { name: '水瓶座',  en: 'Aquarius',   icon: '♒', wx: '风', color: '理性独立', dateRange: '01.20 - 02.18', ruler: '天王星', start: { m: 1, d: 20 }, end: { m: 2, d: 18 } },
  { name: '双鱼座',  en: 'Pisces',     icon: '♓', wx: '水', color: '浪漫直觉', dateRange: '02.19 - 03.20', ruler: '海王星', start: { m: 2, d: 19 }, end: { m: 3, d: 20 } },
  { name: '白羊座',  en: 'Aries',      icon: '♈', wx: '火', color: '果敢热情', dateRange: '03.21 - 04.19', ruler: '火星', start: { m: 3, d: 21 }, end: { m: 4, d: 19 } },
  { name: '金牛座',  en: 'Taurus',     icon: '♉', wx: '土', color: '稳健内敛', dateRange: '04.20 - 05.20', ruler: '金星', start: { m: 4, d: 20 }, end: { m: 5, d: 20 } },
  { name: '双子座',  en: 'Gemini',     icon: '♊', wx: '风', color: '机敏灵活', dateRange: '05.21 - 06.21', ruler: '水星', start: { m: 5, d: 21 }, end: { m: 6, d: 21 } },
  { name: '巨蟹座',  en: 'Cancer',     icon: '♋', wx: '水', color: '细腻温情', dateRange: '06.22 - 07.22', ruler: '月亮', start: { m: 6, d: 22 }, end: { m: 7, d: 22 } },
  { name: '狮子座',  en: 'Leo',        icon: '♌', wx: '火', color: '自信大方', dateRange: '07.23 - 08.22', ruler: '太阳', start: { m: 7, d: 23 }, end: { m: 8, d: 22 } },
  { name: '处女座',  en: 'Virgo',      icon: '♍', wx: '土', color: '条理谨严', dateRange: '08.23 - 09.22', ruler: '水星', start: { m: 8, d: 23 }, end: { m: 9, d: 22 } },
  { name: '天秤座',  en: 'Libra',      icon: '♎', wx: '风', color: '优雅从容', dateRange: '09.23 - 10.23', ruler: '金星', start: { m: 9, d: 23 }, end: { m: 10, d: 23 } },
  { name: '天蝎座',  en: 'Scorpio',    icon: '♏', wx: '水', color: '深邃执著', dateRange: '10.24 - 11.22', ruler: '冥王星', start: { m: 10, d: 24 }, end: { m: 11, d: 22 } },
  { name: '射手座',  en: 'Sagittarius', icon: '♐', wx: '火', color: '乐观豁达', dateRange: '11.23 - 12.21', ruler: '木星', start: { m: 11, d: 23 }, end: { m: 12, d: 21 } }
]

// 由公历日期推出星座
function findSign(date) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  for (const z of ZODIAC) {
    // 跨年区间：摩羯
    if (z.name === '摩羯座') {
      if ((m === 12 && d >= z.start.d) || (m === 1 && d <= z.end.d)) return z
    } else if ((m === z.start.m && d >= z.start.d) || (m === z.end.m && d <= z.end.d)) return z
  }
  return ZODIAC[0]
}

// 简易哈希：日期 → 运势种子
function daySeed(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()
  return (y * 10000 + m * 100 + d) | 0
}

// 基于种子生成稳定的 5 维评分 1-5
function pseudoRand(seed, idx) {
  const n = (seed * 9301 + idx * 49297 + 233280) % 233280
  return (n / 233280)
}

function score5(seed, idx, base = 3.0, range = 1.6) {
  const r = pseudoRand(seed, idx)
  return +(base + r * range - range / 2).toFixed(1)
}

// 行运类型（伪随机 选 ~10 种）
const TRANSIT_TONES = [
  { title: '金星合月', text: '情感磁场柔软，你的话语会显得格外温暖，宜主动向在意的人表达关怀。' },
  { title: '水星顺行', text: '沟通运上扬，正适合谈合作、写方案、组织会议。注意别在大群里说错话。' },
  { title: '火星入庙', text: '行动力攀升，今天的「做就比想强」。复杂的决定，反而要等。' },
  { title: '土星四分', text: '可能遇到阻力，但稳住节奏、做对的事，收获的是长期复利。' },
  { title: '木星六合', text: '鸿运当头机率高，宜尝试新领域。但仍要记账，别让好运变成冲动。' },
  { title: '月亮空亡', text: '情绪起伏，像是戴了一副自带滤镜的眼镜。稳住睡 8 小时，比做任何决策都重要。' },
  { title: '日冥相位', text: '意志沉稳但易钻牛角尖。不妨听一段不同立场的播客，打破思维惯性。' },
  { title: '金海三分', text: '艺术感与同理心都放大，是拍照、写信、装饰房间的好日子。' },
  { title: '火海四分', text: '小心情绪失控，对陌生人多一点耐心，对亲近的人多一分克制。' },
  { title: '金土六合', text: '责任与美感平衡，今天也适合收拾衣柜、整理桌角，让生活更顺。' }
]

function pickTone(seed) {
  return TRANSIT_TONES[Math.abs(seed) % TRANSIT_TONES.length]
}

// 五维：整体、爱情、事业、财运、健康
function buildScores(sign, date) {
  const seed = daySeed(date)
  // 不同星座 × 五维 设定偏置
  const bias = (zodiacBias[sign.name] || [0, 0, 0, 0, 0])
  const dims = [
    { key: 'overall',  label: '整体', en: 'Overall' },
    { key: 'love',     label: '爱情', en: 'Love' },
    { key: 'career',   label: '事业', en: 'Career' },
    { key: 'wealth',   label: '财运', en: 'Wealth' },
    { key: 'health',   label: '健康', en: 'Health' }
  ]
  return dims.map((d, i) => {
    const s = +(score5(seed, i + 1) + bias[i]).toFixed(1)
    return {
      ...d,
      score: Math.max(1, Math.min(5, s))
    }
  })
}

const zodiacBias = {
  摩羯座: [0.1, -0.1, 0.2, 0.0, 0.0],
  水瓶座: [0.0, 0.1, 0.1, -0.1, 0.0],
  双鱼座: [0.0, 0.2, -0.1, 0.0, -0.1],
  白羊座: [0.2, -0.1, 0.2, 0.1, 0.1],
  金牛座: [0.0, 0.1, 0.0, 0.2, -0.1],
  双子座: [0.1, 0.1, 0.0, 0.0, 0.0],
  巨蟹座: [0.0, 0.2, -0.1, 0.0, 0.1],
  狮子座: [0.2, 0.0, 0.2, 0.0, 0.0],
  处女座: [0.1, 0.0, 0.1, 0.1, -0.1],
  天秤座: [0.1, 0.2, 0.0, 0.0, 0.0],
  天蝎座: [0.0, 0.0, 0.1, 0.2, -0.2],
  射手座: [0.2, 0.0, 0.0, 0.1, 0.1]
}

const COLOR_LIST = ['珊瑚金', '雾蓝', '雾紫', '米白', '青绿', '烟粉', '薄荷绿', '柠檬黄', '雾灰蓝', '暖赭红', '柔杏色', '松石蓝']
const LUCKY_NUM = (seed) => (((Math.abs(seed) % 31) || 1))
const LUCKY_DIR = ['东', '东南', '南', '西南', '西', '西北', '北', '东北']

export function horoscope(signInput, date = new Date()) {
  let sign = typeof signInput === 'string'
    ? ZODIAC.find(z => z.name === signInput || z.en.toLowerCase() === signInput.toLowerCase())
    : (signInput && signInput.zodiac) || findSign(date)

  if (!sign) sign = findSign(date)

  // 今日运势
  const todaySeed = daySeed(date)
  const tone = pickTone(todaySeed)
  const scores = buildScores(sign, date)
  const overall = +((scores.reduce((a, b) => a + b.score, 0)) / 5).toFixed(1)
  const overallStar = Math.round(overall * 2) / 2

  // 明日预览
  const tom = new Date(date); tom.setDate(tom.getDate() + 1)
  const tomSeed = daySeed(tom)
  const tomScores = buildScores(sign, tom)
  const tomOverall = +((tomScores.reduce((a, b) => a + b.score, 0)) / 5).toFixed(1)

  // 一周预览（未来 7 天）
  const week = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(date); d.setDate(d.getDate() + i)
    const s = daySeed(d)
    const avg = +((buildScores(sign, d).reduce((a, b) => a + b.score, 0)) / 5).toFixed(1)
    week.push({
      date: d,
      weekday: ['日','一','二','三','四','五','六'][d.getDay()],
      score: avg,
      tone: pickTone(s).title
    })
  }

  // 幸运色 / 数字 / 方位
  const luckyColor = COLOR_LIST[Math.abs(todaySeed) % COLOR_LIST.length]
  const luckyNum = LUCKY_NUM(todaySeed * 7 + 11)
  const luckyDir = LUCKY_DIR[Math.abs(todaySeed + 3) % LUCKY_DIR.length]

  // 生肖宜忌（与星座互补）
  const tips = {
    yi: ['拍照记录', '与挚友通话', '亲近自然'],
    ji: ['冲动购物', '深夜决断', '与陌生人争论']
  }

  return {
    sign,
    date,
    today: {
      overall: overallStar,
      scores,
      tone: tone.title,
      toneDesc: tone.text,
      luckyColor,
      luckyNum,
      luckyDir,
      yi: tips.yi,
      ji: tips.ji
    },
    tomorrow: {
      overall: tomOverall,
      tone: pickTome(tomSeed).title,
      text: pickTome(tomSeed).text
    },
    week
  }
}

function pickTome(seed) {
  return TRANSIT_TONES[Math.abs(seed) % TRANSIT_TONES.length]
}

export const ALL_SIGNS = ZODIAC
export { ZODIAC, findSign }
