// 紫微斗数排盘引擎（基于 iztro）
// 浏览器端可直接运行。按倪海厦《天纪》的思路整理命盘：先看总格 → 命宫定性 →
// 三方四正看格局 → 生年四化断吉凶 → 大限流年看起伏，输出结构化文本供 LLM 解读。
import { astro } from 'iztro'

// 小时(0-23) → iztro 时辰索引(0-12, 12为晚子时)
export function hourToTimeIndex(hour) {
  if (hour === null || hour === undefined) return 0
  if (hour === 23) return 12
  return Math.floor((hour + 1) / 2)
}

// 四化之义（倪师《天纪》：禄权科忌的吉凶含义）
const SIHUA_MEANING = {
  禄: '得——财禄机遇，主该宫之事有进益、得贵人助',
  权: '掌——实权担当，主该宫之事可掌控、能有所为',
  科: '名——名声贵气，主该宫之事得认可、逢凶化吉',
  忌: '耗——执着耗损，主该宫之事多波折费心，宜以平常心化解'
}

// 六吉六煞（副星吉凶之分，吉星扶助、煞星侵扰）
const JI_STARS = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']
const SHA_STARS = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']

function starNames(stars, withDetail = false) {
  if (!stars || !stars.length) return ''
  return stars.map(s => {
    if (!withDetail) return s.name
    let str = s.name
    if (s.brightness) str += `(${s.brightness})`
    if (s.mutagen) str += `【${s.mutagen}】`
    return str
  }).join('、')
}

// 一宫文本（含亮度与四化）
function palaceLine(p) {
  const parts = [p.name + (p.isBodyPalace ? '（身宫）' : '')]
  const gz = `${p.heavenlyStem}${p.earthlyBranch}`
  const major = starNames(p.majorStars, true)
  const minor = starNames(p.minorStars)
  const adj = starNames(p.adjectiveStars)
  parts.push(gz)
  if (major) parts.push(`主星：${major}`)
  else parts.push('主星：无')
  if (minor) parts.push(`辅星：${minor}`)
  if (adj) parts.push(`杂曜：${adj}`)
  return parts.join('，')
}

// —— 格局判断（倪师《天纪》：先看总格，再论细事）——
// majorNames：命宫主星；spNames：命宫三方四正（命/财/官/迁移）内的主星
function gege(majorNames, spNames) {
  const inMing = n => majorNames.includes(n)
  const has = (...ns) => ns.every(n => spNames.includes(n))

  if (inMing('紫微') && inMing('天府')) return ['紫府同宫格', '紫微天府同守命宫，贵气与福气兼备，主掌权柄而不失从容，宜守成兴业、稳步向上。']
  if (inMing('七杀') && inMing('破军') && inMing('贪狼')) return ['杀破狼格', '七杀、破军、贪狼三会命宫，为杀破狼格，性喜变动开创、不喜守成，人生多起落，适逢运而兴、遇势而变。']
  if (has('天机', '太阴', '天同', '天梁') && !inMing('杀破狼')) return ['机月同梁格', '天机、太阴、天同、天梁会照命局，为机月同梁格，宜文职、技术、策划等安稳智谋之事，处世平和、善解人意。']
  if (inMing('太阳') && inMing('太阴')) return ['日月并明格', '太阳太阴同守命宫，为日月并明格，性情光明磊落、外放内敛兼备，贵气与亲和兼具。']
  if (inMing('武曲') && inMing('贪狼')) return ['武贪格', '武曲贪狼同守命宫，为武贪格，财星带桃花、刚中带柔，主中年后发，宜守不宜急。']
  if (inMing('太阳') && inMing('巨门')) return ['巨日同宫格', '太阳巨门同守命宫，为巨日同宫格，口才出众、善言善辩，利传播、教职、外交之事。']
  if (inMing('七杀')) return ['七杀朝斗格', '七杀坐命，为七杀朝斗格，性刚果敢、独当一面，主开创打拼，人生需经历磨砺而后成。']
  if (inMing('贪狼')) return ['贪狼入命格', '贪狼坐命，为贪狼入命格，才艺与欲望并存，善交际、有魅力，需自我约束方成大器。']
  if (inMing('天机')) return ['天机入命格', '天机坐命，为天机入命格，聪慧机敏、善谋略策划，心思细腻而多变，宜以智取胜。']
  if (inMing('紫微')) return ['帝座守命格', '紫微独坐命宫，为帝座守命格，自尊心强、有领导气质，宜居高位而慎独。']
  if (inMing('廉贞')) return ['廉贞入命格', '廉贞坐命，外冷内热、重情重义，才华锋芒外露，须防锋芒太盛招妒。']
  if (inMing('天梁')) return ['天梁入命格', '天梁坐命，为荫星坐命，主逢凶化吉、庇荫他人，宜公职、医疗、教职之途。']
  if (inMing('天相')) return ['天相入命格', '天相坐命，为印星坐命，温文尔雅、乐于辅佐，利文书、协调、管理之事。']
  if (inMing('太阴')) return ['太阴入命格', '太阴坐命，性柔善感、心思缜密，主内敛之财，宜静中求进。']
  if (inMing('太阳')) return ['日丽中天格', '太阳坐命，为日丽中天格，光明磊落、热心助人，利公职与行善积德之途。']
  if (inMing('巨门')) return ['巨门入命格', '巨门坐命，口舌之星，善辩多思，需以诚信与谨言化解口舌是非。']
  return ['主星平平（无明显大格局）', '命宫主星组合平实，不主大起大落，重在行运与四化之机，稳中求进即可。']
}

// 排盘：chart 需含 year/month/day/hour/gender
export function buildZiwei(chart, targetDate) {
  if (!chart) return '（尚未排盘，可提示用户先去八字门排盘）'
  const { year, month, day, hour = 12, gender = '男' } = chart
  const timeIndex = hourToTimeIndex(hour)
  const astrolabe = astro.bySolar(`${year}-${month}-${day}`, timeIndex, gender === '女' ? '女' : '男')

  const segs = [
    `【紫微斗数命盘】`,
    `公历：${astrolabe.solarDate}｜农历：${astrolabe.lunarDate}｜生肖：${astrolabe.zodiac}｜星座：${astrolabe.sign}`,
    `五行局：${astrolabe.fiveElementsClass}｜命主：${astrolabe.soul}｜身主：${astrolabe.body}`
  ]

  const palaces = astrolabe.palaces
  const ming = palaces.find(p => p.name === '命宫')
  const shen = palaces.find(p => p.isBodyPalace)

  // 命宫与身宫定位（倪师：先找命宫定性格，身宫主后天努力方向）
  if (ming) {
    segs.push(`命宫位于${ming.heavenlyStem}${ming.earthlyBranch}${ming.majorStars.length ? `，主星：${starNames(ming.majorStars, true)}` : '，主星：无（借星安宫看对宫）'}`)
    segs.push(`身宫位于${shen ? `${shen.name}（${shen.heavenlyStem}${shen.earthlyBranch}，主星：${starNames(shen.majorStars) || '无'}）` : '—'}，身宫主后天努力与成就方向`)
  }

  // 格局总断（倪师：先看总格）
  if (ming) {
    const sur = astrolabe.surroundedPalaces('命宫')
    const spMajors = [sur.target, sur.opposite, sur.wealth, sur.career].flatMap(p => p.majorStars.map(s => s.name))
    const [gName, gDesc] = gege(ming.majorStars.map(s => s.name), spMajors)
    segs.push(`【格局】${gName}：${gDesc}`)
  }

  // 命宫三方四正（命 + 财帛 + 官禄 + 迁移，倪师论格局高低必看）
  if (ming) {
    const sur = astrolabe.surroundedPalaces('命宫')
    const sp = [sur.target, sur.opposite, sur.wealth, sur.career]
    segs.push('')
    segs.push(`【命宫三方四正】`)
    for (const p of sp) {
      const stars = starNames(p.majorStars, true)
      segs.push(`${p.name}：${stars || '无主星'}`)
    }
  }

  // 生年四化（倪师：禄权科忌断人生重点与吉凶）
  const sihua = []
  for (const p of palaces) {
    const m = p.majorStars.find(s => s.mutagen)
    if (m) sihua.push(`${m.name}化${m.mutagen}于${p.name}`)
  }
  if (sihua.length) {
    segs.push('')
    segs.push(`【生年四化】${sihua.join('；')}`)
    segs.push(`四化之义：${Object.entries(SIHUA_MEANING).map(([k, v]) => `化${k}为${v}`).join('；')}`)
  }

  // 吉凶星概览（六吉六煞）
  const ji = []
  const sha = []
  for (const p of palaces) {
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if (JI_STARS.includes(s.name)) ji.push(`${s.name}（${p.name}）`)
      if (SHA_STARS.includes(s.name)) sha.push(`${s.name}（${p.name}）`)
    }
  }
  segs.push('')
  if (ji.length) segs.push(`【六吉星】${ji.join('、')}——吉星扶助，可增益贵气与人缘`)
  else segs.push(`【六吉星】无吉星入局，贵气多靠自身修持`)
  if (sha.length) segs.push(`【六煞星】${sha.join('、')}——煞星侵扰，相关宫位之事需多加用心`)
  else segs.push(`【六煞星】无煞星入局，一生少无妄之灾`)

  // 12 宫
  segs.push('')
  segs.push('【十二宫】')
  for (const p of palaces) {
    segs.push(palaceLine(p))
  }

  // 大限与流年
  const today = targetDate || new Date()
  const dateStr = targetDate || `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
  try {
    const h = astrolabe.horoscope(dateStr)
    const decName = h.decadal.palaceNames[0]
    const decPalace = palaces.find(p => p.name === decName)
    const yearName = h.yearly.palaceNames[0]
    const yearPalace = palaces.find(p => p.name === yearName)

    segs.push('')
    // 紫微大限：按五行局起限（非八字节气起运），每限十年。ageRange 为当前大限起止虚岁
    const decAge = h.decadal && h.decadal.ageRange ? `（${h.decadal.ageRange[0]}–${h.decadal.ageRange[1]}虚岁）` : ''
    segs.push(`【大限 ${h.decadal.heavenlyStem}${h.decadal.earthlyBranch}${decAge}（当前十年，紫微按五行局起限）】`)
    segs.push(`当前大限落${decName}宫${decPalace ? `（主星：${starNames(decPalace.majorStars, true) || '无'}）` : ''}，四化：${h.decadal.mutagen.join('、') || '无'}——此限所主之宫位与四化，为当下十年运势的关键（紫微大限按五行局起限、每限十年；与八字大运按节气交运不同）`)
    segs.push(`【流年 ${h.yearly.heavenlyStem}${h.yearly.earthlyBranch} ${dateStr}】`)
    segs.push(`流年落${yearName}宫${yearPalace ? `（主星：${starNames(yearPalace.majorStars, true) || '无'}）` : ''}，四化：${h.yearly.mutagen.join('、') || '无'}——本年吉凶以此宫为纲`)
  } catch (e) {
    segs.push('')
    segs.push('（流年信息暂不可用）')
  }

  return segs.join('\n')
}

// 简洁版：只取命宫/财帛/官禄/夫妻/迁移/福德六宫，供快速概览
export function buildZiweiBrief(chart, targetDate) {
  const full = buildZiwei(chart, targetDate)
  if (!full || full.startsWith('（')) return full
  const lines = full.split('\n')
  const keep = ['命宫', '财帛宫', '官禄宫', '夫妻宫', '迁移宫', '福德宫']
  return lines
    .filter(l => !l.trim() || keep.some(k => l.startsWith(k)) || l.startsWith('【') || l.includes('五行局'))
    .join('\n')
}
