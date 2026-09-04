// 统一报告引擎：8 大门类 → 统一报告 Schema（见 reportSchema.js）
// 每个门类返回 { ok, type, icon, title, sub, meta, sections, advice, markdown }
import { makeReport, failReport } from './reportSchema.js'
import { buildBaziReport } from './baziReport.js'
import { buildZiwei, hourToTimeIndex } from './ziwei.js'
import { ZHONGZHOU_PALACE_BREAK, normalizePalace } from './ziweiZhongzhou.js'
import { astro } from 'iztro'
import { solar2lunar } from 'lunar-lite'
import { castHexagram } from './liuyao.js'
import {
  castQimen,
  buildQimenDaily,
  buildQimenDailyChart,
  buildQimenMonthlyChart,
  buildQimenYearlyChart,
} from './qimen.js'
import { buildDaily } from './huangli.js'
import { getSceneData } from './cantian.js'
import { drawCards, interpret } from '../data/tarot.js'
import { analyzeName, recommendName } from './nameAnalysis.js'
import { analyzeFengshui } from './fengshui.js'
import { buildChart } from './bazi.js'
import { buildBaziFromSolar } from 'cantian-tymext'
import { analyzeMangpai, mangpaiAdvice } from './mangpai.js'
import { buildHehunReport } from './hehunReport.js'
import { buildZejiReport } from './zejiriReport.js'
import { buildConsultReport } from './consultReport.js'

// ============ 紫微斗数报告 ============

// 四化 → 文字
function mutagenText(m) {
  if (!m) return '无四化'
  if (Array.isArray(m)) return m.join('、')
  if (m === '禄') return '禄'
  if (m === '权') return '权'
  if (m === '科') return '科'
  if (m === '忌') return '忌'
  return m
}

// 命主 14 主星
const ZW_MINGZHU = {
  贪狼: '贪狼为命主，主欲望与才艺，一生多机遇', 巨门: '巨门为命主，口才思辨，以智取胜',
  禄存: '禄存为命主，福禄自足，稳中有进', 文曲: '文曲为命主，才艺斐然，灵动过人',
  廉贞: '廉贞为命主，机敏果断，情志坚定', 武曲: '武曲为命主，刚毅果决，务实求成',
  破军: '破军为命主，破旧立新，勇闯敢为', 太阳: '太阳为命主，光明磊落，贵气临身',
  紫微: '紫微为命主，帝王气象，统领全局', 天机: '天机为命主，智慧灵巧，善谋善断',
  天相: '天相为命主，稳重端方，辅佐之才', 天梁: '天梁为命主，正直仁厚，逢凶化吉',
  七杀: '七杀为命主，杀伐果断，格局威猛', 天府: '天府为命主，库藏深厚，稳重包容',
}

// 身主 12 星
const ZW_SHENZHU = {
  火星: '火星为身主，行动果决，性情刚烈', 天相: '天相为身主，重仪表，处事圆融',
  天梁: '天梁为身主，贵气隐现，晚年享福', 天同: '天同为身主，随遇而安，福缘深厚',
  文昌: '文昌为身主，才学出众，文名可期', 天机: '天机为身主，思虑周密，谋定后动',
  火星_铃星: '火铃为身主，性烈心热，敢作敢当', 天相_天梁: '天相天梁为身主，贵气与稳重兼具',
  贪狼: '贪狼为身主，桃花与才艺并重', 太阴: '太阴为身主，性情温润，内敛持重',
  天机_月: '太阴为身主，柔和内敛', 紫微: '紫微为身主，气度不凡',
}

// 主星特质速写
const ZW_STAR_TRAITS = {
  紫微: '帝星，尊贵威严，具领袖气质与大局观', 天机: '智星，机敏善谋，思虑周详而善变',
  太阳: '贵星，光明磊落，热心助人，光芒外放', 武曲: '财星，刚毅果决，务实笃行，理财有力',
  天同: '福星，温和随性，人缘极佳，知足常乐', 廉贞: '次桃花星，聪慧执着，外冷内热',
  天府: '库星，沉稳厚重，守成有方，善于积累', 太阴: '母星，内敛细腻，温婉持重，善于照顾',
  贪狼: '桃花星，多才多艺，欲望强而行动果敢', 巨门: '暗星，口才了得，是非分明，洞察力强',
  天相: '印星，稳重端方，辅佐有力，重仪表', 天梁: '荫星，正直仁厚，逢凶化吉，有担当',
  七杀: '将星，威猛果决，行动力强，勇于开创', 破军: '耗星，破旧立新，变动大而敢闯敢拼',
  左辅: '辅星，贵人扶持，处事圆满', 右弼: '辅星，暗中助力，人缘通达',
  文昌: '文星，才学出众，文书考试利', 文曲: '才星，艺术才情，口才表达佳',
  禄存: '财星，稳重聚财，福禄绵长', 擎羊: '刑星，锋芒毕露，成败两极化',
  陀罗: '暗星，拖延纠缠，磨砺心志', 火星: '煞星，爆发性强，行动急躁',
  铃星: '煞星，闷烧持久，劳心费神', 天马: '驿马，奔波远行，动中得财',
  地空: '空星，想法超脱，淡泊名利', 地劫: '劫星，财来财去，需防破耗',
  天魁: '贵人，逢凶化吉，得长辈提携', 天钺: '贵人，阴贵相助，得异性助力',
  红鸾: '桃花，婚恋喜庆', 天喜: '喜庆，人缘佳运',
  天姚: '桃花，风流多情', 咸池: '桃花，异性缘旺',
  龙池: '才艺，雅致', 凤阁: '才艺，气度',
  天哭: '孤星，情绪易感伤', 天虚: '虚星，防空欢喜',
}

// 主星生活画像（把星曜理论翻译成具体的人：性格、事业、财运、感情、健康）
const ZW_STAR_LIFE = {
  紫微: '贵气十足、自尊心强，天生有带班带队的气场，但容易放不下身段、听不进劝。事业宜走管理、统筹或开创型路径，凭威望服众；财运不错但偏向大进大出，需学会攒钱；感情上渴望被尊重，伴侣若能顺毛捧场则关系和睦。',
  天机: '脑子转得快、点子多，善分析也易想太多，常因过度思虑而错过时机。事业适合技术、策划、咨询、教育等动脑的活；财运属细水长流型，靠本事赚钱，不宜投机；感情心思细腻但容易猜疑，宜多些直来直去的沟通。',
  太阳: '性情光明、热心肠，到哪里都容易成为人群里发光的那一个，但也常因揽事太多而操劳。事业宜公职、公益、销售、传媒等抛头露面的行业；财运随人缘而旺，广结善缘则财来；感情大方主动，重情义，健康上要注意用眼和心火。',
  武曲: '刚毅务实、说到做到，是典型的实干派，做事讲效率不喜虚招。事业极适合金融、技术、军警、经营等需要果决的领域；财运是十四主星里最硬气的求财星，靠自己拼出来，但易守财过度；感情偏理性木讷，不懂浪漫，宜主动表达。',
  天同: '性情温和、随遇而安，人缘好、朋友多，懂得享受生活，是典型的福气星。事业宜稳定平和的岗位，不宜高压竞争；财运平稳、不愁吃穿，属于细水长流型；感情细腻黏人，重陪伴，是很好的伴侣；健康上要注意脾胃，勿贪口腹之欲。',
  廉贞: '聪慧执着、外冷内热，才华锋芒外露，认准的事九头牛拉不回。事业宜创意、设计、公关、管理等多面手型工作；财运起伏大，来得快去得也快，需防冲动消费；感情热烈又别扭，容易爱得深也伤得深，宜学会放低姿态。',
  天府: '稳重厚道、守成有方，是天生会过日子的人，朋友信得过、长辈看得上。事业宜金融、地产、行政等重积累的领域，越老越吃香；财运是库星，善存钱、家底厚，但要防太过保守而错失机会；感情专一顾家，是靠谱的港湾。',
  太阴: '性格内敛、心思细腻，敏感又体贴，很会照顾人，但情绪容易受影响。事业宜艺术、文案、护理、财务等细致内省的领域；财运属暗中聚财型，擅长储蓄和精打细算；感情温柔重情，愿意付出，宜多表达自己而非憋在心里。',
  贪狼: '多才多艺、反应快，社交能力强，桃花旺、人脉广，是天生的交际花。事业宜创意、销售、公关、跨界等能发挥才艺的平台；财运机会多但来得快去得也快，贵在见好就收；感情浪漫多情，易得异性缘，需自律方能安定。',
  巨门: '口才了得、是非分明，洞察力强，适合靠嘴和笔吃饭，但言多易惹是非。事业宜传播、法律、教学、公关等口才型工作；财运靠口才与专业积累，动嘴不动手；感情爱讲道理、容易较真，宜学会少说多听、以柔化刚。',
  天相: '稳重端方、做事周全，是辅佐型人才，到哪里都让人放心，宜做副手或协调者。事业适合文书、行政、管理、协调等工作；财运平稳、细水长流，善打理；感情上温柔体贴、有分寸，是理想的终身伴侣，健康需防思虑伤脾。',
  天梁: '正直仁厚、有担当，天生爱助人、逢凶化吉，是长辈缘很好的荫星。事业宜公职、医疗、法律、教育等济世助人的行业；财运不靠横财，靠积累与德行，晚年尤佳；感情上成熟稳重、包容大度，愿为家庭扛事，健康要注意脾胃保养。',
  七杀: '果敢刚烈、行动力强，天生将才，敢打敢拼、独当一面，忌听人摆布。事业极适合军警、创业、销售、开拓型行业；财运先苦后甜，靠拼劲和魄力打江山，起伏大；感情热烈直接、宁折不弯，宜学收放之道，避免冲动伤情。',
  破军: '敢破敢立、不甘平淡，人生变动多、经历丰富，是典型的开创型耗星。事业宜不断求新求变的行业，忌一成不变；财运大起大落，破旧方能立新，贵在风险控制；感情爱恨分明、轰轰烈烈，宜给伴侣稳定感，健康注意劳逸结合。',
}
// 十二宫含义速写
const ZW_PALACE_MEANING = {
  命宫: '一生命运总纲，性格气质所在\n┄ 即：你是哪种性格、一辈子的大方向，主要看它',
  兄弟宫: '手足缘分、平辈助力\n┄ 即：兄弟姐妹、发小同辈能不能帮上你',
  夫妻宫: '婚姻感情、配偶特质\n┄ 即：婚姻顺不顺、另一半是什么样的人',
  子女宫: '子女缘分、才华传承\n┄ 即：子女缘、晚辈缘分，还有你的才艺天赋',
  财帛宫: '财运格局、求财方式\n┄ 即：这辈子钱多钱少、靠什么方式挣钱',
  疾厄宫: '健康体质、病痛隐患\n┄ 即：身体底子如何、要留心哪方面的毛病',
  迁移宫: '外出运、社会际遇\n┄ 即：出远门、在外面闯荡的运气和遇人',
  交友宫: '朋友贵贱、人际网络\n┄ 即：身边朋友是贵人还是损友、人缘怎么样',
  官禄宫: '事业格局、职场成就\n┄ 即：事业运、工作上的成就和地位',
  田宅宫: '家宅房产、积蓄厚薄\n┄ 即：家运、房子、存款等"家底"厚不厚',
  福德宫: '精神世界、福气享受\n┄ 即：内心快乐不快乐、晚年的福气',
  父母宫: '父母缘分、长辈助力\n┄ 即：和父母长辈的缘分、他们能给你多大助力',
}

// 四化之义（倪师《天纪》：禄权科忌的吉凶含义）
const ZW_SIHUA = {
  禄: '得——财禄机遇，主该宫之事有进益、得贵人助',
  权: '掌——实权担当，主该宫之事可掌控、能有所为',
  科: '名——名声贵气，主该宫之事得认可、逢凶化吉',
  忌: '耗——执着耗损，主该宫之事多波折费心，宜以平常心化解',
}

// 天干 → 四化星序 [禄, 权, 科, 忌]，用于推导大限/流年宫干所飞四化
const ZW_GAN_SIHUA = {
  甲: ['廉贞', '破军', '武曲', '太阳'],
  乙: ['天机', '天梁', '紫微', '太阴'],
  丙: ['天同', '天机', '文昌', '廉贞'],
  丁: ['太阴', '天同', '天机', '巨门'],
  戊: ['贪狼', '太阴', '右弼', '天机'],
  己: ['武曲', '贪狼', '天梁', '文曲'],
  庚: ['太阳', '武曲', '太阴', '天同'],
  辛: ['巨门', '太阳', '文曲', '文昌'],
  壬: ['天梁', '紫微', '左辅', '武曲'],
  癸: ['破军', '巨门', '太阴', '贪狼'],
}
const ZW_SIHUA_SEQ = ['禄', '权', '科', '忌']

// 格局判断（倪师《天纪》：先看总格，再论细事）
function ziweiGege(majorNames, spNames) {
  const inMing = n => majorNames.includes(n)
  const has = (...ns) => ns.every(n => spNames.includes(n))
  if (inMing('紫微') && inMing('天府')) return ['紫府同宫格', '紫微天府同守命宫，贵气与福气兼备，主掌权柄而不失从容，宜守成兴业、稳步向上。']
  if (inMing('七杀') && inMing('破军') && inMing('贪狼')) return ['杀破狼格', '七杀、破军、贪狼三会命宫，性喜变动开创、不喜守成，人生多起落，适逢运而兴、遇势而变。']
  if (has('天机', '太阴', '天同', '天梁') && !inMing('七杀') && !inMing('破军') && !inMing('贪狼')) return ['机月同梁格', '天机、太阴、天同、天梁会照命局，宜文职、技术、策划等安稳智谋之事，处世平和、善解人意。']
  if (inMing('太阳') && inMing('太阴')) return ['日月并明格', '太阳太阴同守命宫，性情光明磊落、外放内敛兼备，贵气与亲和兼具。']
  if (inMing('武曲') && inMing('贪狼')) return ['武贪格', '武曲贪狼同守命宫，财星带桃花、刚中带柔，主中年后发，宜守不宜急。']
  if (inMing('太阳') && inMing('巨门')) return ['巨日同宫格', '太阳巨门同守命宫，口才出众、善言善辩，利传播、教职、外交之事。']
  if (inMing('七杀')) return ['七杀朝斗格', '七杀坐命，性刚果敢、独当一面，主开创打拼，人生需经历磨砺而后成。']
  if (inMing('贪狼')) return ['贪狼入命格', '贪狼坐命，才艺与欲望并存，善交际、有魅力，需自我约束方成大器。']
  if (inMing('天机')) return ['天机入命格', '天机坐命，聪慧机敏、善谋略策划，心思细腻而多变，宜以智取胜。']
  if (inMing('紫微')) return ['帝座守命格', '紫微独坐命宫，自尊心强、有领导气质，宜居高位而慎独。']
  if (inMing('廉贞')) return ['廉贞入命格', '廉贞坐命，外冷内热、重情重义，才华锋芒外露，须防锋芒太盛招妒。']
  if (inMing('天梁')) return ['天梁入命格', '天梁坐命，为荫星坐命，主逢凶化吉、庇荫他人，宜公职、医疗、教职之途。']
  if (inMing('天相')) return ['天相入命格', '天相坐命，为印星坐命，温文尔雅、乐于辅佐，利文书、协调、管理之事。']
  if (inMing('太阴')) return ['太阴入命格', '太阴坐命，性柔善感、心思缜密，主内敛之财，宜静中求进。']
  if (inMing('太阳')) return ['日丽中天格', '太阳坐命，光明磊落、热心助人，利公职与行善积德之途。']
  if (inMing('巨门')) return ['巨门入命格', '巨门坐命，口舌之星，善辩多思，需以诚信与谨言化解口舌是非。']
  if (!majorNames.length) return ['', '命宫格局随行运与四化而定，重在把握大限流年之机。']
  return ['主星平平（无明显大格局）', '命宫主星组合平实，不主大起大落，重在行运与四化之机，稳中求进即可。']
}

// 六吉六煞
const ZW_JI = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']
const ZW_SHA = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']

function ziweiPalaceCard(p, opts = {}) {
  const majors = p.majorStars.map(s => `${s.name}${s.brightness ? `（${s.brightness}）` : ''}${s.mutagen ? `·化${mutagenText(s.mutagen)}` : ''}`)
  const trait = p.majorStars.length ? ZW_STAR_TRAITS[p.majorStars[0].name] : ''
  const meaning = ZW_PALACE_MEANING[p.name] || ''
  const isMing = p.name === '命宫'
  const isShen = !!p.isBodyPalace
  const hasJi = p.majorStars.some(s => s.mutagen === '忌')
  const hasLu = p.majorStars.some(s => s.mutagen === '禄')
  let tone = ''
  if (hasJi) tone = 'bad'
  else if (hasLu || p.majorStars.some(s => ['庙', '旺'].includes(s.brightness))) tone = 'good'

  // 亮度 / 四化徽章
  const badges = []
  const muStar = p.majorStars.find(s => s.mutagen)
  if (muStar) badges.push({ text: `化${mutagenText(muStar.mutagen)}`, tone: muStar.mutagen === '忌' ? 'bad' : 'good' })
  const lead = p.majorStars[0]
  if (lead && lead.brightness) {
    const b = lead.brightness
    if (['庙', '旺'].includes(b)) badges.push({ text: b, tone: 'good' })
    else if (b === '陷') badges.push({ text: b, tone: 'bad' })
    else badges.push({ text: b, tone: 'flat' })
  }

  // 命 / 身 / 三方标记
  const marks = []
  if (isMing) marks.push('命')
  if (isShen) marks.push('身')
  if (opts.sanfang && opts.sanfang.includes(p.name)) marks.push('三方')

  // 落到生活：主星有一整段"这个人具体怎么表现"的画像
  const leadName = p.majorStars[0]?.name
  const lifeTxt = leadName ? ZW_STAR_LIFE[leadName] : ''
  // 中州派宫垣论：此星落此宫的差异化断辞（比通用星曜特质更贴近"这个宫位"）
  const zh = leadName ? ZHONGZHOU_PALACE_BREAK[normalizePalace(p.name)]?.[leadName] : ''
  const desc = [
    meaning,
    trait ? `主星${trait}。` : '',
    hasJi ? '本宫化忌（这个领域容易费心费力、多波折），主此宫事项多耗心力，宜以平常心经营。' : hasLu ? '本宫化禄（这个领域容易来财、有福），此宫事项多得助力、顺势而上。' : '',
    isMing ? '为命宫之根本，格局由此展开。' : '',
    zh ? `\n中州断：${zh}` : '',
    lifeTxt ? `\n落到生活：${lifeTxt}` : '',
  ].filter(Boolean).join('')
  return {
    name: p.name,
    tag: p.name === '命宫' ? '命宫' : `${p.heavenlyStem}${p.earthlyBranch}`,
    mark: marks.join('·') || undefined,
    tone,
    badges,
    sub: majors.length ? majors.join('、') : '',
    desc,
  }
}

// 五行 → 星曜概览（原页面 meta-grid 四格）
// 十二宫速览（紫微视角：主星 + 亮度 + 四化 + 宫位本义）
function ziweiQuickPalaces(a, sanfang) {
  return a.palaces.map(p => {
    const meaning = ZW_PALACE_MEANING[p.name] || ''
    const lead = p.majorStars[0]
    const bright = lead && lead.brightness ? `（${lead.brightness}）` : ''
    const mu = p.majorStars.find(s => s.mutagen)
    const muTxt = mu ? `化${mutagenText(mu.mutagen)}` : ''
    const trait = lead ? ZW_STAR_TRAITS[lead.name] : ''
    const zh = lead ? ZHONGZHOU_PALACE_BREAK[normalizePalace(p.name)]?.[lead.name] : ''
    let summary
    if (lead) {
      summary = `${meaning}。主星${lead.name}${bright}入宫，${trait ? trait + '。' : ''}${zh ? `中州断：${zh}` : ''}${mu ? `本宫${muTxt}，主其${ZW_SIHUA[mu.mutagen]}。` : ''}`
    } else {
      summary = `${meaning}。${mu ? `宫干${muTxt}，主其${ZW_SIHUA[mu.mutagen]}。` : ''}`
    }
    return {
      name: p.name,
      tag: sanfang && sanfang.includes(p.name) ? '三方' : (p.name === '命宫' ? '命' : `${p.heavenlyStem}${p.earthlyBranch}`),
      sub: lead ? `${lead.name}${bright}${mu ? ' · ' + muTxt : ''}` : '',
      desc: summary,
    }
  })
}

// 星曜概览（真实盘面数据：命宫主星、身宫、格局、四化、吉凶星）
function ziweiStarOverview(a, ming, shen, gegeName, sihuaCount, jiCount, shaCount) {
  const items = []
  if (ming && ming.majorStars.length) items.push({ k: '命宫主星', v: ming.majorStars.map(s => s.name).join('、') })
  if (shen) items.push({ k: '身宫所在', v: `${shen.name}（${shen.heavenlyStem}${shen.earthlyBranch}）` })
  if (gegeName) items.push({ k: '命局格局', v: gegeName })
  if (sihuaCount) items.push({ k: '生年四化', v: `${sihuaCount} 处入局` })
  if (jiCount) items.push({ k: '吉星扶助', v: `${jiCount} 星入局` })
  if (shaCount) items.push({ k: '煞星侵扰', v: `${shaCount} 星入局` })
  return items
}

// 五行局详解
function ziweiFiveElementsText(a) {
  const ju = a.fiveElementsClass || ''
  const map = {
    水二局: '水二局：命宫之宫干属水，其数为二。水主流动智慧，命主一生机遇流转、以智取胜，宜从事流通、资讯、创意类行业。',
    木三局: '木三局：命宫之宫干属木，其数为三。木主生发进取，命主志向高远、贵人缘佳，宜向教育、文化、医疗方向求发展。',
    金四局: '金四局：命宫之宫干属金，其数为四。金主刚毅决断，命主果敢务实、财路清晰，宜从事金融、法律、技术类工作。',
    土五局: '土五局：命宫之宫干属土，其数为五。土主厚重承载，命主稳健包容、后福绵长，宜经营实业、地产、管理类事业。',
    火六局: '火六局：命宫之宫干属火，其数为六。火主热烈光明，命主行动力强、声名易显，宜从事传播、能源、演艺类行业。',
  }
  const base = map[ju] || `${ju}：五行局定命主根基，决定命宫起法与事业方位。`
  const soulTxt = a.soul ? `命主为「${a.soul}」` : ''
  const bodyTxt = a.body ? `身主为「${a.body}」` : ''
  const sbTxt = soulTxt && bodyTxt ? `${soulTxt}、${bodyTxt}` : soulTxt || bodyTxt
  return `${base}${sbTxt ? `\n${sbTxt}，主一生权威归属与晚景依托。` : ''}`
}

// ============ 全盘关联总纲 ============
// 把「八字 → 五行局/命主身主 → 命宫/格局 → 三方四正 → 生年四化 → 大限流年」串成一条因果链，
// 让排盘的每个算法环节彼此呼应，而非孤立罗列。
function buildLinkage({ a, ming, shen, gegeName, sanfangNames, mutagenFull, dec, yr }) {
  const lines = []

  // ① 八字 → 五行局 → 命主/身主
  const ju = a.fiveElementsClass || '五行局'
  const soulN = a.soul || ''
  const bodyN = a.body || ''
  const soulTxt = soulN ? `命主为「${soulN}」` : ''
  const bodyTxt = bodyN ? `身主为「${bodyN}」` : ''
  const sbTxt = soulTxt && bodyTxt ? `${soulTxt}、${bodyTxt}` : soulTxt || bodyTxt
  lines.push(`【生辰·五行局·命主身主】以「${a.solarDate}」生辰起盘，属${ju}命。五行局定命宫起法与一生根基${sbTxt ? `；${sbTxt}，为先天权威归属与后天晚景依托之枢` : ''}。`)

  // ② 命宫主星 → 格局 → 三方四正
  const mingStars = ming && ming.majorStars.length ? ming.majorStars.map(s => s.name).join('、') : ''
  const mingTxt = mingStars ? `命宫坐「${mingStars}」` : ''
  const shenPos = shen ? `${shen.name}（${shen.heavenlyStem}${shen.earthlyBranch}）` : ''
  const shenTxt = shenPos ? `身宫落「${shenPos}」` : ''
  const sanfangTxt = (sanfangNames && sanfangNames.length) ? sanfangNames.join('、') : '命、财帛、官禄、迁移'
  lines.push(`【命宫·格局·三方四正】${[mingTxt, shenTxt].filter(Boolean).join('，')}${mingTxt || shenTxt ? '，' : ''}命局${gegeName ? `成「${gegeName}」` : '格局平实'}。命盘大势以命宫三方四正（${sanfangTxt}）为纲领——命宫定气质、财帛看求财、官禄看事业、迁移看际遇，四宫互参方见全貌。`)

  // ③ 生年四化：把四化定位到具体宫位，并指出与三方四正的呼应
  const sfSet = new Set(sanfangNames || [])
  if (mutagenFull && mutagenFull.length) {
    const parts = mutagenFull.map(x => {
      const inSf = sfSet.has(x.palace) ? '（正属命宫三方四正）' : ''
      return `「${x.palace}·${x.star}化${x.m}」${inSf}，主${x.meaning}`
    })
    const hits = mutagenFull.filter(x => sfSet.has(x.palace))
    let link = ''
    if (hits.length) {
      link = `其中${hits.map(x => `「${x.palace}·${x.star}化${x.m}」`).join('、')}直落命宫三方四正，此生得失之重心，正与命、财、官、迁四宫相呼应，须与格局同参。`
    } else {
      link = '生年四化皆落在三方四正之外，一生重心更偏于行运触发，须结合大限流年四化转用。'
    }
    lines.push(`【生年四化】${parts.join('；')}。${link}`)
  }

  // ④ 大限流年：指出当前大限宫位、四化，及其与命宫三方/生年四化的呼应
  if (dec && dec.palaceNames && dec.palaceNames.length) {
    const decName = dec.palaceNames[0]
    const decPalace = a.palaces.find(p => p.name === decName)
    const decStars = decPalace && decPalace.majorStars.length ? decPalace.majorStars.map(s => s.name).join('、') : ''
    const decStarTxt = decStars ? `（主星${decStars}）` : ''
    const inSf = sfSet.has(decName)
    const decMu = (dec.mutagen && dec.mutagen.length) ? `，此限四化${dec.mutagen.join('、')}` : ''
    const hit = dec.mutagen ? dec.mutagen.map(n => mutagenFull.find(x => x.star === n)).filter(Boolean) : []
    const hitTxt = hit.length ? `，其中${hit.map(x => `「${x.star}化${x.m}」`).join('、')}为生年四化之转用，主其宫所主之事在当限显化` : ''
    lines.push(`【当前大限】行至「${decName}」宫${decStarTxt}${decMu}${hitTxt}${inSf ? '，此限恰在命宫三方四正之内，为一生关键十年' : '，此限不在三方四正，为较外围之十年，重在借四化而动'}。`)
  }
  if (yr && yr.palaceNames && yr.palaceNames.length) {
    const yrName = yr.palaceNames[0]
    const yrPalace = a.palaces.find(p => p.name === yrName)
    const yrStars = yrPalace && yrPalace.majorStars.length ? yrPalace.majorStars.map(s => s.name).join('、') : ''
    const yrStarTxt = yrStars ? `（主星${yrStars}）` : ''
    const yrMu = (yr.mutagen && yr.mutagen.length) ? `，流年四化${yr.mutagen.join('、')}` : ''
    const yrHit = yr.mutagen ? yr.mutagen.map(n => mutagenFull.find(x => x.star === n)).filter(Boolean) : []
    const yrHitTxt = yrHit.length ? `，其中「${yrHit.map(x => `${x.star}化${x.m}`).join('、')}」呼应生年四化，本年吉凶以此为纲` : ''
    lines.push(`【本年流年】落「${yrName}」宫${yrStarTxt}${yrMu}${yrHitTxt}；流年与大限同参，方知当下十年如何借运而进。`)
  }

  // ⑤ 收束：回到五行局与命主身主的落地
  lines.push(`【综论】命主「${soulN}」定其权威归属，身主「${bodyN}」定其晚景依托，五行局「${ju}」主其行业方向；格局定一生大势，四化定得失机枢，大限流年定当下进退——八字、宫位、星曜、四化、行运环环相扣，非一宫一星可独断。`)
  return lines.join('\n\n')
}

export function buildZiweiReport(chart, targetDate) {
  if (!chart) return failReport('尚未排盘，请先生成命盘')
  try {
    const { year, month, day, hour = 12, gender = '男' } = chart
    const a = astro.bySolar(`${year}-${month}-${day}`, hourToTimeIndex(hour), gender === '女' ? '女' : '男')
    const today = targetDate || new Date()
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    let dec = null, yr = null
    try {
      const h = a.horoscope(dateStr)
      dec = h.decadal
      yr = h.yearly
    } catch (e) { /* ignore */ }

    // iztro 的 h.decadal.palaceNames[0] / h.yearly.palaceNames[0] 与 palaces 数组存在索引错位
    // （getPalaceNames 的 fromIndex 与 palaces 数组索引含义不一致），导致当前大限/流年宫名取错。
    // 改用 decadalList + 虚岁自行匹配当前大限，保证 palaceName / 干支 / 四化均正确。
    const decadalList = a.decadalList()
    const targetAge = (() => {
      try {
        const b = solar2lunar(a.solarDate)
        const t = solar2lunar(dateStr)
        return t.lunarYear - b.lunarYear + 1
      } catch (e) { return 0 }
    })()
    const curDecByAge = decadalList.find(d => d.ageRange && targetAge >= d.ageRange[0] && targetAge <= d.ageRange[1])
    if (dec && curDecByAge) {
      // 用 decadalList 的"正确"当前大限重建 dec 对象
      dec = {
        ...dec,
        index: curDecByAge.index,
        heavenlyStem: curDecByAge.heavenlyStem,
        earthlyBranch: curDecByAge.earthlyBranch,
        mutagen: curDecByAge.mutagen,
        ageRange: curDecByAge.ageRange,
        yearRange: curDecByAge.yearRange,
        palaceNames: [curDecByAge.palaceName, ...(dec.palaceNames || []).slice(1)],
      }
    }
    // 流年同义修整：用流年地支 → palaces 数组中对应地支的宫
    if (yr && yr.earthlyBranch) {
      const yrPalaceByBranch = a.palaces.find(p => p.earthlyBranch === yr.earthlyBranch)
      if (yrPalaceByBranch) {
        yr = {
          ...yr,
          palaceNames: [yrPalaceByBranch.name, ...(yr.palaceNames || []).slice(1)],
        }
      }
    }

    const palaceRows = a.palaces.map(p => [
      p.name,
      `${p.heavenlyStem}${p.earthlyBranch}`,
      p.majorStars.length ? p.majorStars.map(s => `${s.name}${s.brightness ? `（${s.brightness}）` : ''}${s.mutagen ? `·${mutagenText(s.mutagen)}` : ''}`).join('、') : '',
      p.minorStars.length ? p.minorStars.map(s => s.name).join('、') : '',
    ])
    const ming = a.palaces.find(p => p.name === '命宫')
    const shen = a.palaces.find(p => p.isBodyPalace)

    // 格局与三方四正（倪师《天纪》：先看总格，再看三方四正）
    let gegeName = '', gegeDesc = '', sanfangNames = []
    try {
      if (ming) {
        const sur = a.surroundedPalaces('命宫')
        sanfangNames = [sur.target.name, sur.opposite.name, sur.wealth.name, sur.career.name]
        const spMajors = [sur.target, sur.opposite, sur.wealth, sur.career].flatMap(p => p.majorStars.map(s => s.name))
        ;[gegeName, gegeDesc] = ziweiGege(ming.majorStars.map(s => s.name), spMajors)
      }
    } catch (e) { /* ignore */ }

    // 十二宫逐宫详批（palaceGrid，带命/身/三方标记与亮度四化徽章）
    const palaceDetailItems = a.palaces.map(p => ziweiPalaceCard(p, { sanfang: sanfangNames }))

    // 三方四正卡片（命、财、官、迁）
    let sanfangItems = []
    try {
      if (ming) {
        const sur = a.surroundedPalaces('命宫')
        sanfangItems = [sur.target, sur.opposite, sur.wealth, sur.career].map(p => ziweiPalaceCard(p, { sanfang: sanfangNames }))
      }
    } catch (e) { /* ignore */ }

    // 生年四化总览（含四化之义）
    const mutagenItems = []
    const mutagenFull = []
    for (const p of a.palaces) {
      for (const s of p.majorStars) {
        if (s.mutagen) {
          const m = mutagenText(s.mutagen)
          mutagenItems.push({ k: `${p.name}·${s.name}`, v: `化${m}`, tone: m === '忌' ? 'bad' : 'good' })
          mutagenFull.push({ palace: p.name, star: s.name, m, meaning: ZW_SIHUA[m] })
        }
      }
    }

    // 吉凶星统计（六吉六煞）
    let jiCount = 0, shaCount = 0
    for (const p of a.palaces) {
      for (const s of [...p.majorStars, ...p.minorStars]) {
        if (ZW_JI.includes(s.name)) jiCount++
        if (ZW_SHA.includes(s.name)) shaCount++
      }
    }

    // 大限列表
    let decadalRows = []
    try {
      const decList = a.decadalList()
      decadalRows = decList.map((d, i) => [
        d.palaceName || '-',
        `${d.heavenlyStem}${d.earthlyBranch}`,
        (d.ageRange || []).join('-'),
        (d.yearRange || []).join('-'),
        d.mutagen && d.mutagen.length ? d.mutagen.join('、') : '',
      ])
    } catch (e) { /* ignore */ }

    // 紫微起运：按五行局定第一大限起始岁数（非八字节气起运）。
    // iztro 的 decadalList 已按大限起始虚岁升序排列，首项即第一大限（命宫）。
    const qiyun = (() => {
      try {
        if (!decadalList || !decadalList.length) return null
        const first = decadalList[0]
        const ju = a.fiveElementsClass || ''
        return {
          age: first.ageRange[0],
          text: `${ju} · ${first.ageRange[0]}岁起运`,
          date: `第一大限：${first.palaceName} ${first.heavenlyStem}${first.earthlyBranch}（每限十年）`,
        }
      } catch (e) { return null }
    })()

    // 命盘信息（精致版）—— 结构化数据，供 identity 渲染
    const identityData = {
      pillars: (chart.pillars || []).map(p => ({ label: p.label, gan: p.gan, zhi: p.zhi })),
      dayMaster: { name: chart.dayMaster || '', wuxing: chart.dayMasterWx || '' },
      favorable: chart.favorable || [],
      avoid: chart.avoid || [],
      qiyun,
      solar: a.solarDate || '',
      lunar: a.lunarDate || '',
      zodiac: a.zodiac || '',
      sign: a.sign || '',
      ju: a.fiveElementsClass || '',
      soul: { name: a.soul || '', desc: ZW_MINGZHU[a.soul] || '' },
      body: { name: a.body || '', desc: ZW_SHENZHU[a.body] || '' },
    }

    const sections = [
      {
        key: 'info', title: '命盘信息', kind: 'identity',
        data: identityData,
        note: '上为八字命局，下为紫微盘面 · 同参方得全貌',
      },
      {
        key: 'gege', title: '命局格局', kind: 'note',
        data: {
          text: `${gegeName ? `【${gegeName}】` : ''}${gegeDesc}\n\n${ming && ming.majorStars.length ? `命宫主星：${ming.majorStars.map(s => s.name).join('、')}｜` : ''}${shen ? `身宫：${shen.name}｜` : ''}格局以命宫三方四正（命、财帛、官禄、迁移）为纲，主一生大势。`,
        },
      },
      {
        key: 'linkage', title: '全盘关联总纲', kind: 'note',
        data: { text: buildLinkage({ a, ming, shen, gegeName, sanfangNames, mutagenFull, dec, yr }) },
        note: (() => {
          const mingStars = ming && ming.majorStars.length ? ming.majorStars.map(s => s.name).join('、') : '无主星'
          return {
            term: `命局总纲：${gegeName ? `「${gegeName}」格局` : '平实之格'}｜命宫 ${mingStars}｜身宫 ${shen?.name || '-'}｜生年四化 ${mutagenFull.length} 处${jiCount ? `、化忌 ${jiCount} 处` : ''}${shaCount ? `、六煞 ${shaCount} 颗` : ''}。一生大势，以此纲为宗。`,
            plain: `先给你一句总评：${gegeName ? `你这盘成「${gegeName}」之格，有明确的格局依托` : '你这盘属平实之格，不靠虚名，靠实打实的积累'}；命宫坐 ${mingStars}（性格底色），身宫在 ${shen?.name || '-'}（后天用力处）；${mutagenFull.length ? `生年四化 ${mutagenFull.length} 处，是老天给你点亮的几条"主线"` : '生年无四化，一生平顺、少大起大落'}${jiCount ? `，其中化忌 ${jiCount} 处，对应的领域要多用心经营` : ''}。下面逐层展开。`,
          }
        })(),
      },
      {
        key: 'starOverview', title: '星曜概览', kind: 'kv',
        data: { items: ziweiStarOverview(a, ming, shen, gegeName, mutagenFull.length, jiCount, shaCount) },
      },
      ...(mutagenFull.length ? [{
        key: 'mutagen', title: '生年四化详解', kind: 'kv',
        data: { items: mutagenFull.map(x => ({ k: `${x.palace} · ${x.star}化${x.m}`, v: x.meaning, tone: x.m === '忌' ? 'bad' : 'good' })), vertical: true },
        note: (() => {
          const jiP = mutagenFull.filter(x => x.m === '忌').map(x => `${x.palace}·${x.star}`)
          return {
            term: `生年四化 ${mutagenFull.length} 处：${mutagenFull.map(x => `${x.palace}·${x.star}化${x.m}`).join('、')}——禄权科主机遇所向，化忌之处主执念与波折。`,
            plain: `你这一生被"点亮"的方向在：${mutagenFull.map(x => `${x.palace}（${x.star}化${x.m}）`).join('、')}${jiP.length ? `；尤其化忌落 ${jiP.join('、')}，这是你最放不下、最容易反复拉扯的领域，别的都好说，这块要提前做心理建设` : '；没有化忌，一生少执念牵绊'}。往四化的宫位使劲，事半功倍。`,
          }
        })(),
      }] : []),
      {
        key: 'quickPalaces', title: '十二宫速览', kind: 'palaceGrid',
        data: { items: ziweiQuickPalaces(a, sanfangNames), cols: 2 },
        note: (() => {
          const key = sanfangNames.length ? sanfangNames.join('、') : '命宫、财帛、官禄、迁移'
          return {
            term: `速览平铺十二宫；「三方」即命宫三方四正（${key}），此四宫联动定命局高低。`,
            plain: `快速扫一眼全盘：标「三方」的四个宫（${key}）是你人生的"主战场"——命宫看性格、财帛看求财、官禄看事业、迁移看际遇，四宫连着看才是你的主线；其余八宫是支线，作辅助参考。`,
          }
        })(),
      },
      {
        key: 'palaces', title: '十二宫星曜', kind: 'table',
        data: { headers: ['宫位', '干支', '主星', '辅星'], rows: palaceRows },
      },
      ...(ming ? [{
        key: 'minggong', title: '命宫解析', kind: 'kv',
        data: {
          items: [
            { k: '命宫位置', v: `${ming.heavenlyStem}${ming.earthlyBranch}` },
            ...(ming.majorStars.length ? [{ k: '命宫主星', v: ming.majorStars.map(s => `${s.name}（${s.brightness || '平'}${s.mutagen ? ' · 化' + mutagenText(s.mutagen) : ''}）`).join('、') }] : []),
            ...(ming.minorStars.length ? [{ k: '辅星', v: ming.minorStars.map(s => s.name).join('、') }] : []),
            ...(ming.adjectiveStars.length ? [{ k: '杂曜', v: ming.adjectiveStars.map(s => s.name).join('、') }] : []),
            ...(gegeName ? [{ k: '格局', v: gegeName }] : []),
          ],
        },
        note: (() => {
          const lead = ming?.majorStars[0]
          const brightOk = lead && ['庙', '旺', '得', '利'].includes(lead.brightness)
          const mu = ming?.majorStars.find(s => s.mutagen)
          const starTxt = ming?.majorStars.length ? ming.majorStars.map(s => `${s.name}（${s.brightness || '平'}）`).join('、') : '无主星'
          return {
            term: `命宫坐 ${starTxt}${mu ? `、化${mutagenText(mu.mutagen)}入命` : ''}——${brightOk ? '主星得地，气质外显、早年际遇顺遂' : '主星失辉，性偏内敛、成就多赖后天磨砺'}。`,
            plain: `你的先天底色：命宫主星 ${starTxt}，${brightOk ? '亮度佳，性格底色亮、做事易得回应，早年相对顺当' : '亮度平陷，性格内敛、早年经历磨炼较多，但中年后渐入佳境'}${mu ? `；命宫带化${mutagenText(mu.mutagen)}，这个特质会贯穿一生` : ''}。`,
          }
        })(),
      }] : []),
      ...(sanfangItems.length ? [{
        key: 'sanfang', title: '命宫三方四正', kind: 'palaceGrid',
        data: { items: sanfangItems, cols: 2 },
        note: (() => {
          const pick = (name) => {
            const it = sanfangItems.find(i => i.name === name)
            return it ? (it.sub || it.tag || '-') : '-'
          }
          return {
            term: `三方四正联动断格局：命宫 ${pick('命宫')}（气质）、财帛 ${pick('财帛')}（求财）、官禄 ${pick('官禄')}（事业）、迁移 ${pick('迁移')}（际遇）。`,
            plain: `你的人生主线：命宫 ${pick('命宫')}（性格）、财帛 ${pick('财帛')}（来钱路子）、官禄 ${pick('官禄')}（事业方向）、迁移 ${pick('迁移')}（出门际遇）——四宫连起来读，就是你的"人生剧本"，重点往主星亮、带四化的宫位使劲。`,
          }
        })(),
      }] : []),
      {
        key: 'palaceDetail', title: '十二宫逐宫详批', kind: 'palaceGrid',
        data: { items: palaceDetailItems, cols: 2 },
        note: (() => {
          const jiP = mutagenFull.filter(x => x.m === '忌').map(x => x.palace)
          const brightP = a.palaces.filter(p => p.majorStars.some(s => ['庙', '旺'].includes(s.brightness))).map(p => p.name)
          const mingTxt = ming?.majorStars.length ? ming.majorStars.map(s => s.name).join('、') : '无主星'
          const shenTxt = shen?.majorStars.length ? shen.majorStars.map(s => s.name).join('、') : '无主星'
          return {
            term: `命宫（先天之枢）坐 ${mingTxt}、身宫（后天之枢）坐 ${shenTxt}${jiP.length ? `；化忌入 ${jiP.join('、')}，主该领域多波折` : '；无化忌入宫，一生平顺'}${brightP.length ? `；星曜庙旺之宫：${brightP.join('、')}，成色为佳` : ''}。`,
            plain: `看全盘先看两个锚点：命宫（先天底色）坐 ${mingTxt}、身宫（后天发力处）坐 ${shenTxt}${jiP.length ? `；化忌落在 ${jiP.join('、')}，这领域一辈子多操心，早做打算` : '；没有化忌搅局，整体平顺'}${brightP.length ? `；哪个宫星曜亮度高（${brightP.join('、')}），那个领域的事就容易办成` : ''}。`,
          }
        })(),
      },
    ]
    if (decadalRows.length) {
      sections.push({
        key: 'decadal', title: '大限十年运程', kind: 'table',
        data: { headers: ['大限宫', '干支', '虚岁', '年份', '四化'], rows: decadalRows },
        note: (() => {
          const first = decadalRows[0]
          const keyRows = decadalRows.filter(r => r[4])
          const keyTxt = keyRows.length ? keyRows.map(r => `${r[0]}限（${r[2]}岁，${r[4]}）`).join('、') : ''
          return {
            term: `大限十年一运、从命宫流转；${qiyun ? qiyun.text : ''}${keyTxt ? `。带四化之大限：${keyTxt}，为人生关键窗口` : ''}。`,
            plain: `你的大运每十年换一个宫：${first ? `第一大限在 ${first[0]}（${first[2]}岁起）` : ''}${keyTxt ? `；其中 ${keyTxt} 这几段大运带四化，是人生的"转折窗口"，那几年发生的事要格外上心、顺势而为` : '；各限平稳，贵在坚持、以守为进'}。`,
          }
        })(),
      })
    }
    if (dec && yr) {
      const decPalace = a.palaces.find(p => p.name === dec.palaceNames[0])
      const yrPalace = a.palaces.find(p => p.name === yr.palaceNames[0])
      const starList = (p) => (p && p.majorStars.length ? p.majorStars.map(s => `${s.name}${s.brightness ? `（${s.brightness}）` : ''}`).join('、') : '')
      const starTags = (p) => (p && p.majorStars.length ? p.majorStars.map(s => ({ name: s.name, brightness: s.brightness })) : [])
      // 四化详解：利用生年四化查找表，将大限/流年四化星名定位到具体宫位与化曜。
      // 仅当该星曜在本命某宫发出过生年四化时才显示；运限独化不入本命者，从行运列表中移除
      // 四化详解：由宫干推导运限四化（禄权科忌），并定位每颗四化星在本命盘中的落宫。
      // 大限/流年为独立行运四化体系，完整呈现本宫宫干所飞四化，与本命生年四化互不干扰
      const sfDetail = (starNames, stem) => {
        if (!starNames || !starNames.length) return []
        const seq = (stem && ZW_GAN_SIHUA[stem]) || []
        return starNames.map(n => {
          // 化曜：按宫干四化表定位该星所化
          let m = ''
          if (seq.length) {
            const idx = seq.indexOf(n)
            if (idx !== -1) m = ZW_SIHUA_SEQ[idx]
          }
          // 本命落宫：遍历 12 宫主星/辅星定位（四化星含文昌、右弼等辅曜）
          let palaceName = ''
          for (const p of a.palaces) {
            const all = [...(p.majorStars || []), ...(p.minorStars || [])]
            if (all.some(s => s.name === n)) { palaceName = p.name; break }
          }
          const parts = [`${n}化${m || '—'}`]
          if (palaceName) parts.push(`落本命「${palaceName}」`)
          return parts.join(' · ')
        })
      }
      // 三方四正四宫（命/财帛/官禄/迁移）
      const sfQuad = (palaceName) => {
        try {
          const s = a.surroundedPalaces(palaceName)
          return [
            { label: '命', name: s.target.name, stars: starTags(s.target) },
            { label: '财帛', name: s.wealth.name, stars: starTags(s.wealth) },
            { label: '官禄', name: s.career.name, stars: starTags(s.career) },
            { label: '迁移', name: s.opposite.name, stars: starTags(s.opposite) },
          ]
        } catch (e) { return [] }
      }
      const yrShensha = yr.yearlyDecStar ? [...(yr.yearlyDecStar.jiangqian12 || []), ...(yr.yearlyDecStar.suiqian12 || [])] : []
      // 从大限列表反查当前大限的起止虚岁/年份，用于头注展示
      const curDec = decadalList.find(d => d.palaceName === dec.palaceNames[0])
      const decAge = curDec && curDec.ageRange ? `${curDec.ageRange[0]}–${curDec.ageRange[1]}` : ''
      const yrRange = yr.yearRange ? yr.yearRange.join('–') : ''
      sections.push({
        key: 'horoscope', title: '大限与流年', kind: 'bifold',
        data: {
          dec: {
            label: '当前大限', range: decAge ? `${decAge} 岁` : '', note: '主十年大势',
            name: decPalace ? decPalace.name : dec.palaceNames[0],
            ganzhi: `${dec.heavenlyStem}${dec.earthlyBranch}`,
            stars: starTags(decPalace),
            mutagen: sfDetail(dec.mutagen, dec.heavenlyStem),
            quad: sfQuad(dec.palaceNames[0]),
          },
          yr: {
            label: '流年落宫', range: yrRange ? `${yrRange} 年` : '', note: '断当年吉凶',
            name: yrPalace ? yrPalace.name : yr.palaceNames[0],
            ganzhi: `${yr.heavenlyStem}${yr.earthlyBranch}`,
            stars: starTags(yrPalace),
            mutagen: sfDetail(yr.mutagen, yr.heavenlyStem),
            quad: sfQuad(yr.palaceNames[0]),
            shensha: yrShensha,
          },
        },
        note: `大限主十年大势，流年断当年吉凶。四化所落之宫即此限此年得失关键：化禄宜进取取财、化权宜掌权担当、化科宜扬名求贵、化忌宜守成防损。${decPalace ? `当下${decAge ? `${decAge}岁` : ''}大限落「${decPalace.name}」${starList(decPalace) ? `，主星「${starList(decPalace)}」` : ''}${decPalace.majorStars.length ? '，此宫所主即为十年要务' : ''}` : ''}；${yrPalace ? `流年落「${yrPalace.name}」${starList(yrPalace) ? `，主星「${starList(yrPalace)}」` : ''}，本年吉凶以此宫与四化为纲` : ''}。`,
      })
    }
    sections.push({
      key: 'wuxingju', title: '五行局与命主详解', kind: 'note',
      data: { text: ziweiFiveElementsText(a) },
    })

    const advice = buildZiweiAdvice(a, dec, ming, gegeName)
    return makeReport('ziwei', {
      sub: `${a.solarDate}｜${gender === '女' ? '女命' : '男命'} · ${a.fiveElementsClass}`,
      hero: { main: ming && ming.majorStars.length ? `命主 <b>${ming.majorStars.map(s => s.name).join('、')}</b> · ${a.fiveElementsClass}` : `紫微命盘 · ${a.fiveElementsClass}` },
      meta: { solarDate: a.solarDate, zodiac: a.zodiac, fiveElementsClass: a.fiveElementsClass },
      sections,
      advice,
    })
  } catch (e) {
    return failReport(`紫微排盘失败：${e.message || e}`)
  }
}

// iztro 的 star.mutagen 可能是数组或字符串，统一转显示文本

function buildZiweiAdvice(astrolabe, dec, ming, gegeName) {
  const starNames = (ming?.majorStars || []).map(s => s.name)
  const gegeHint = gegeName && gegeName !== '主星平平（无明显大格局）' ? `命局成「${gegeName}」，一生大势已定，宜顺着格局气质选方向、借行运而进。` : '命局主星平实，重在行运之机，稳中求进即可。'
  let career = `${gegeHint}宜结合命宫主星气质选择方向。`
  if (starNames.includes('紫微')) career = '紫微坐命，领导力强，宜主导性、统筹性工作，管理、创业或公职皆宜。'
  else if (starNames.includes('天府')) career = '天府坐命，稳重守成，宜金融、地产、行政管理等需积累的领域。'
  else if (starNames.includes('天机')) career = '天机坐命，聪颖善变，宜技术、策划、咨询、教育等动脑型工作。'
  else if (starNames.includes('贪狼') || starNames.includes('廉贞')) career = '贪廉坐命，多才多艺、社交能力强，宜创意、销售、公关或跨界发展。'
  else if (starNames.includes('武曲')) career = '武曲坐命，刚毅果断，宜军警、金融、技术、经营等实干领域。'
  else if (starNames.includes('太阳') || starNames.includes('天梁')) career = '日梁坐命，光明磊落、乐善好施，宜公益、教育、医疗、法律等助人行业。'
  else if (starNames.includes('七杀') || starNames.includes('破军')) career = '杀破狼格局，魄力十足，宜开拓型、挑战型事业，忌一成不变。'

  // 中州派：结合事业宫/财帛宫/夫妻宫主星的差异化断辞，提升财运与感情建议的专业度
  // iztro 宫位名为短名：事业宫=官禄、财帛宫=财帛、夫妻宫=夫妻
  const palaceLead = name => {
    const p = astrolabe.palaces.find(x => x.name === name)
    return p?.majorStars[0]?.name
  }
  const careerLead = palaceLead('官禄')
  const wealthLead = palaceLead('财帛')
  const loveLead = palaceLead('夫妻')
  const careerZh = careerLead ? ZHONGZHOU_PALACE_BREAK['事业宫']?.[careerLead] : ''
  const wealthZh = wealthLead ? ZHONGZHOU_PALACE_BREAK['财帛宫']?.[wealthLead] : ''
  const loveZh = loveLead ? ZHONGZHOU_PALACE_BREAK['夫妻宫']?.[loveLead] : ''

  const wealth = careerZh || wealthZh
    ? `${careerLead ? `事业宫主星「${careerLead}」` : ''}${wealthLead ? `${careerLead ? '、' : ''}财帛宫主星「${wealthLead}」` : ''}。中州断：${wealthZh || careerZh}`
    : dec && dec.mutagen && dec.mutagen.length ? `大限四化含「${dec.mutagen.join('、')}」，当前十年财路与四化所在宫位相关，宜在${dec.palaceNames[0]}宫领域深耕；财帛宫主星若庙旺则求财顺遂，若化忌则宜守不宜搏。` : '理财以稳健为主，忌投机冒进。'

  // 关联：当前大限所落宫位 → 十年事业重心；生年四化若落命三方 → 一生职业主线
  const shen = astrolabe.palaces.find(p => p.isBodyPalace)
  const decName = dec && dec.palaceNames ? dec.palaceNames[0] : ''
  const decPalace = decName ? astrolabe.palaces.find(p => p.name === decName) : null
  const decLead = decPalace?.majorStars[0]?.name
  const decTxt = decName && decLead
    ? `当前大限落「${decName}」宫，主星「${decLead}」所主之事，即未来十年事业深耕方向；若此限宫位与命宫三方四正呼应，则十年内望有成。`
    : ''
  career = career.replace(/[。\s]+$/, '') + '。' + (decTxt ? ' ' + decTxt : '')

  const love = loveZh
    ? `夫妻宫主星「${loveLead}」。中州断：${loveZh}`
    : starNames.includes('天相') || starNames.includes('天同') ? '感情细腻温和，宜以柔克刚、多沟通。' : starNames.includes('七杀') ? '感情热烈直接，需学会收放，避免冲动伤情。' : '感情贵在真诚陪伴，正缘多在熟人圈与职场。'
  const health = '注意劳逸结合，五行局宜关注对应脏腑（水局肾、火局心）；疾厄宫若有煞星加临，对应系统需定期养护。'
  const soulTxt = astrolabe.soul ? `命主「${astrolabe.soul}」主一生权威归属` : ''
  const bodyTxt = astrolabe.body ? `身主「${astrolabe.body}」主晚景依托` : ''
  const sbLink = soulTxt && bodyTxt ? `${soulTxt}，${bodyTxt}` : soulTxt || bodyTxt
  const opening = `五行局 ${astrolabe.fiveElementsClass}，可依局取色（木局青绿、火局红紫、土局黄棕、金局白金、水局黑蓝）增运；身宫${shen ? `落「${shen.name}」宫` : ''}为后天努力之枢，可朝身宫所主领域多加修持${sbLink ? `。${sbLink}` : ''}；行运起伏，宜以大限四化之禄权科忌为进退之机，吉方取大限流年所落宫位对应方位。`
  return { career, wealth, love, health, opening }
}

// ============ 六爻纳甲报告 ============
export function buildLiuyaoReport(chart, question) {
  try {
    const now = new Date()
    const n1 = chart?.n1 || (Math.floor(Math.random() * 99) + 1)
    const n2 = chart?.n2 || (Math.floor(Math.random() * 99) + 1)
    const n3 = chart?.n3 || (Math.floor(Math.random() * 99) + 1)
    const r = castHexagram(n1, n2, n3, Date.now())
    const p = r.pan

    const yaoRows = r.yaoList.map(y => [
      `第${y.position}爻`,
      y.naJia || '-',
      y.wuXing || '-',
      y.liuQin || '-',
      y.liuShou || '-',
      y.shiYing || '-',
      y.isMoving ? '●' : '',
    ])
    const shenShaStr = Object.entries(r.shenSha).filter(([, v]) => v && v.length).map(([k, v]) => `${k}：${v.join('、')}`).join('；')

    const sections = [
      {
        key: 'info', title: '起卦信息', kind: 'kv',
        data: {
          items: [
            { k: '占问时间', v: `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}` },
            { k: '四柱', v: `${r.gz.year}年 ${r.gz.month}月 ${r.gz.day}日 ${r.gz.hour}时` },
            { k: '农历', v: `${r.lunar.month}月${r.lunar.day}日${r.lunar.isLeap ? '（闰）' : ''}` },
            { k: '月建', v: r.monthJian },
            { k: '日旬空', v: r.dayKong },
            { k: '时旬空', v: r.hourKong },
            { k: '节气', v: r.solarTerm },
          ],
        },
      },
      {
        key: 'gua', title: '卦象', kind: 'kv',
        data: {
          items: [
            { k: '本卦', v: `「${r.benName}」` },
            { k: '变卦', v: `「${r.bianName}」` },
            { k: '互卦', v: `「${r.huName}」` },
            { k: '卦辞', v: p.benGua.guaCi || '-' },
            { k: '宫', v: `${p.benGua.palace}（${p.benGua.palaceWuXing}）` },
            { k: '动爻', v: r.movingPositions.length ? `${r.movingPositions.join('、')}爻动` : '静卦无动爻' },
          ],
        },
      },
      {
        key: 'yao', title: '六爻详列（自初爻往上）', kind: 'table',
        data: { headers: ['爻', '纳甲', '五行', '六亲', '六兽', '世应', '动'], rows: yaoRows },
      },
    ]
    if (shenShaStr) {
      sections.push({ key: 'shensha', title: '神煞', kind: 'kv', data: { items: [{ k: '神煞', v: shenShaStr }] } })
    }
    // 用神取用（按所问事项）
    const yongshen = pickYongShen(r, question)
    sections.push({
      key: 'yongshen', title: '用神取用', kind: 'kv',
      data: { items: yongshen.items, vertical: true },
      note: { term: `问事取「${(yongshen.items[0]?.v || '').split('（')[0]}」为用神：${yongshen.strong ? '得位有力，事有可为，可积极谋之' : '偏弱受制，宜缓图渐进、蓄势而动'}。`, plain: `你问的这件事，结论取决于「${(yongshen.items[0]?.v || '').split('（')[0]}」这一爻——${yongshen.strong ? '它此刻得位有力、有人帮衬，说明这事有根底，值得积极去办；' : '它目前偏弱、劲使不上来，说明时机还没到，先稳扎稳打、别急着冲；'}成败方向再结合下面的世应关系判断。` },
    })

    // 世应分析
    sections.push({
      key: 'shiying', title: '世应分析', kind: 'kv',
      data: { items: shiyingAnalysis(r) },
    })

    // 旺衰分析（月建/日辰）
    const wangshuai = wangshuaiAnalysis(r)
    sections.push({
      key: 'wangshuai', title: '旺衰生克（月建·日辰）', kind: 'palaceGrid',
      data: { items: wangshuai, cols: 3 },
      note: (() => {
        const strongYao = wangshuai.find(x => /得月建|得日辰/.test(x.desc))
        const weakYao = wangshuai.find(x => /月建克|日辰克/.test(x.desc))
        return {
          term: `${r.movingPositions.length ? `动爻在第 ${r.movingPositions.join('、')} 爻，动则事有变化` : '静卦无动，主事态平稳'}${strongYao ? `；第 ${strongYao.name.replace('第', '').replace('爻', '')} 爻得月建/日辰生扶，为本卦主力` : ''}${weakYao ? `；第 ${weakYao.name.replace('第', '').replace('爻', '')} 爻受克休囚，为阻力所在` : ''}。`,
          plain: `本卦力量集中在${strongYao ? `第 ${strongYao.name.replace('第', '').replace('爻', '')} 爻` : '得生扶之爻'}，它跟当前月日"同气"，是成事的主力；${weakYao ? `第 ${weakYao.name.replace('第', '').replace('爻', '')} 爻则被月日所克、使不上劲，与它相关的事容易拖、容易反复，${r.movingPositions.length ? '重点盯住动爻的变化。' : '宜守不宜攻。'}` : (r.movingPositions.length ? '全局无受克之爻，阻力不大，重点盯住动爻的变化即可。' : '全局无明显受克之爻，事态平稳推进。')}`,
        }
      })(),
    })

    // 动爻逐爻详解
    const movingDetail = movingYaoDetail(r)
    if (movingDetail.length) {
      sections.push({
        key: 'movingDetail', title: '动爻逐爻详解', kind: 'palaceGrid',
        data: { items: movingDetail, cols: 2 },
      })
    }

    const gd = r.gaodao
    if (gd && gd.intro) {
      const mvLine = r.movingPositions[0] && gd.movingLines ? gd.movingLines[r.movingPositions[0] - 1] : null
      const yao = mvLine && (mvLine.yaoCi || mvLine.explanation || '')
      const yaoPlain = mvLine && mvLine.explanation ? `\n\n┄ 即：${mvLine.explanation}` : ''
      sections.push({
        key: 'gaodao', title: '高岛易断', kind: 'note',
        data: { text: `${gd.intro}${yao ? '\n' + yao + yaoPlain : ''}` },
      })
    }
    if (p.explanation) {
      sections.push({ key: 'dongyao', title: '动爻断语', kind: 'note', data: { text: p.explanation } })
    }

    const advice = buildLiuyaoAdvice(r)
    return makeReport('liuyao', {
      sub: question ? `所问：「${question.slice(0, 30)}」` : `占问时间：${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
      hero: { main: `本卦 <b>「${r.benName}」</b> → 变卦「${r.bianName}」` },
      meta: { benName: r.benName, bianName: r.bianName, movingPositions: r.movingPositions },
      sections,
      advice,
    })
  } catch (e) {
    return failReport(`六爻起卦失败：${e.message || e}`)
  }
}

// ============ 六爻报告丰富内容单元 ============

const LIUQIN_MEANING = {
  父母: '主文书、长辈、房屋、学业、印信（读书、考试、靠山、房子都看它）',
  兄弟: '主同辈、竞争、破财、朋友（兄弟姐妹、合伙人、一起抢机会的人）',
  子孙: '主晚辈、福气、医药、解忧、财源（孩子、贵人、治病解愁、来财的路子）',
  妻财: '主钱财、妻妾、物质、享受（钱、收入、对象、吃穿用度）',
  官鬼: '主事业、功名、丈夫、病灾、官非（工作、升职、另一半、生病和麻烦事）',
}

// 用神取用：按所问事项 → 六亲
function pickYongShen(r, question) {
  const q = question || ''
  const rules = [
    { keys: ['财', '生意', '赚钱', '投资', '收益', '升职加薪', '偏财', '正财', '基金', '股票'], yongshen: '妻财', rel: '钱财物质' },
    { keys: ['事业', '工作', '升迁', '考试', '求职', '跳槽', '官', '职位', '晋升', '面试'], yongshen: '官鬼', rel: '事业功名' },
    { keys: ['学业', '学习', '考研', '考公', '读书', '文凭', '证书', '留学'], yongshen: '父母', rel: '文书学业' },
    { keys: ['感情', '婚姻', '恋爱', '对象', '结婚', '桃花', '姻缘', '配偶', '女朋友', '男朋友', '离婚'], yongshen: '官鬼', rel: '情缘婚恋' },
    { keys: ['健康', '疾病', '身体', '生病', '医院', '治疗', '康复', '养生'], yongshen: '子孙', rel: '医药福气' },
    { keys: ['出行', '旅行', '出差', '搬家', '远行', '交通', '自驾'], yongshen: '父母', rel: '出行文书' },
    { keys: ['官司', '诉讼', '官非', '纠纷', '仲裁', '维权'], yongshen: '官鬼', rel: '官非成败' },
  ]
  let picked = null
  for (const rule of rules) {
    if (rule.keys.some(k => q.includes(k))) { picked = rule; break }
  }
  if (!picked) picked = { yongshen: '世爻', rel: '所问之事' }
  const yongYao = r.yaoList.filter(y => y.liuQin === picked.yongshen)
  const strong = yongYao.some(y => y.isMoving) || yongYao.length >= 2
  const desc = picked.yongshen === '世爻'
    ? '未明确所问范畴，以世爻为用神，主自身立场与所问之事的大方向。'
    : `「${picked.yongshen}」${yongYao.length ? `现于第 ${yongYao.map(y => y.position).join('、')} 爻（${yongYao.map(y => y.wuXing).join('、')}${yongYao.some(y => y.isMoving) ? '，有动' : ''}）` : '卦中不显，用神伏藏'}，主${LIUQIN_MEANING[picked.yongshen] || ''}。`
  return {
    items: [
      { k: '用神', v: `${picked.yongshen}（主${picked.rel}）` },
      { k: '用神状态', v: strong ? '有力，事有可为' : '偏弱，宜缓图渐进' },
      { k: '用神详释', v: desc },
    ],
    strong,
  }
}

// 世应分析
function shiyingAnalysis(r) {
  const shi = r.yaoList.find(y => y.shiYing === '世')
  const ying = r.yaoList.find(y => y.shiYing === '应')
  const shiName = shi ? `第${shi.position}爻` : '世'
  const yingName = ying ? `第${ying.position}爻` : '应'
  const shiWx = shi?.wuXing || ''
  const yingWx = ying?.wuXing || ''
  let rel = ''
  if (shiWx && yingWx) {
    if (shiWx === yingWx) rel = '世应比和，内外一心，事易和合（你俩/内外想一块儿去了，事容易成）。'
    else if (isSheng(shiWx, yingWx)) rel = '世爻生应爻，你主动付出较多，防所问之事耗己之力（这局你出力多、占便宜少，注意别被拖累）。'
    else if (isSheng(yingWx, shiWx)) rel = '应爻生世爻，对方或外部环境对你有助益，事多顺利（有人或环境帮你，办事顺）。'
    else if (isKe(shiWx, yingWx)) rel = '世克应，你占主动权，宜把握分寸（你占上风，拿捏好分寸就行）。'
    else rel = '应克世，外部环境制约，宜迂回化解（对方或环境压着你，硬碰硬吃亏，绕着走）。'
  }
  return [
    { k: '世爻（我）', v: shiName ? `${shiName}·${shiWx || ''}·${shi?.liuQin || ''}` : '世' },
    { k: '应爻（彼）', v: yingName ? `${yingName}·${yingWx || ''}·${ying?.liuQin || ''}` : '应' },
    { k: '关系', v: rel || '世应相安，事态平稳。' },
  ]
}

// 五行生克
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
function isSheng(a, b) { return SHENG[a] === b }
function isKe(a, b) { return KE[a] === b }

// 旺衰分析：月建/日辰 vs 各爻
function wangshuaiAnalysis(r) {
  const zhiWx = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' }
  const mj = (r.monthJian || '').replace(/[月日]/g, '').trim()
  const dj = (r.gz?.day || '').slice(-1)
  const monthWx = zhiWx[mj] || ''
  const dayWx = zhiWx[dj] || ''
  return r.yaoList.map(y => {
    const wx = y.wuXing || ''
    let level = ''
    if (monthWx && dayWx) {
      const m1 = isSheng(monthWx, wx) || monthWx === wx ? '得月建' : isKe(monthWx, wx) ? '月建克' : ''
      const d1 = isSheng(dayWx, wx) || dayWx === wx ? '得日辰' : isKe(dayWx, wx) ? '日辰克' : ''
      const parts = [m1, d1].filter(Boolean)
      const moving = y.isMoving ? '·动' : ''
      level = parts.length
        ? parts.join('·') + (y.isMoving ? '·发动' : '') + (parts.some(p => /克/.test(p)) ? '（被克，事有阻力，宜缓）' : '（有人撑腰，这爻有力）')
        : (y.isMoving ? '发动主事（动起来就是关键，重点盯它）' : '休囚平稳（平平无奇，慢慢来）')
    } else {
      level = y.isMoving ? '发动主事' : '平稳'
    }
    return {
      name: `第${y.position}爻`,
      tag: y.liuQin || '', tone: y.isMoving ? 'good' : '',
      sub: `${y.wuXing || ''}·${y.liuShou || ''}${y.shiYing ? `·${y.shiYing}` : ''}${y.isMoving ? '·动' : ''}`,
      desc: level,
    }
  })
}

// 动爻逐爻详解
const YAO_POSITION_MEANING = {
  1: '初爻为根基，动于初爻，事在萌芽，宜稳根基（这爻动，说明事情刚起头，先把底子打牢，别急着冲刺）。',
  2: '二爻为内主，动于二爻，时机渐明，宜守中道（事情渐渐有了眉目，稳着点来，别偏激）。',
  3: '三爻为门户，动于三爻，多有波折，防半途而废（中间容易出岔子，别干一半就撒手）。',
  4: '四爻为外枢，动于四爻，接近关键，进退须慎（快到节骨眼了，走哪步都要想清楚）。',
  5: '五爻为尊位，动于五爻，居要之地，成败在此（最关键的位置，成不成就在这一下）。',
  6: '上爻为终局，动于上爻，事近尾声，宜见好就收（事情快收尾了，见好就收，别贪心）。',
}
function movingYaoDetail(r) {
  return r.movingPositions.map(pos => {
    const y = r.yaoList[pos - 1]
    if (!y) return null
    const shiYingDesc = y.shiYing === '世' ? '，为世爻，主自身' : y.shiYing === '应' ? '，为应爻，主对方' : ''
    return {
      name: `第${pos}爻动`,
      tag: `${y.liuQin || ''}·${y.wuXing || ''}`, tone: 'good',
      sub: `${y.naJia || ''} · ${y.liuShou || ''}${shiYingDesc}`,
      desc: `${YAO_POSITION_MEANING[pos] || ''}${y.liuQin ? `动而化出${y.liuQin}之象，主${LIUQIN_MEANING[y.liuQin] || ''}之变。` : ''}`,
    }
  }).filter(Boolean)
}

function buildLiuyaoAdvice(r) {
  const benDesc = r.ben.desc || ''
  const moving = r.movingPositions.length
    ? `动爻在第${r.movingPositions.join('、')}爻，动则事有变化（哪一爻动，那件事就有动静）：${r.movingPositions.length > 1 ? '多爻齐动主变数较大，宜多方权衡（变数多，多听听意见再定）。' : '宜以本卦定方向、变卦看结果（本卦看该往哪走，变卦看最后落到哪）。'}`
    : '静卦主事态平稳（这卦没动爻，事态稳当），维持现状、顺势而为即可。'
  return {
    career: `${benDesc}${moving}`,
    wealth: r.movingPositions.includes(5) ? '五爻动，财利之事易成，可适度进取（财运这事有戏，可以试着往前够一够）。' : '财运宜守不宜攻（先把钱看住，别冲动），逢冲则止，见好就收。',
    love: r.bianName === r.benName ? '感情贵在稳定，一心一意自有回响（本卦变卦一样，说明感情要的是稳稳当当，用心自有回报）。' : '感情之事有变数，宜坦诚沟通、以真换真（这卦感情有波折，把话摊开说，别藏着掖着）。',
    health: '卦象提示留意作息，动爻在艮宫位则注意饮食与肠胃（早睡早起，管住嘴，肠胃舒坦）。',
    opening: `本卦「${r.benName}」提示以「${r.ben.desc?.slice(0, 12) || '平常心'}」处世（说白了就是平常心、别太较劲）；占事之要，心诚则灵。`,
  }
}

// ============ 奇门遁甲报告 ============
export function buildQimenReport(chart, date = new Date(), question = '') {
  try {
    const pan = castQimen(date)
    // 完整日家/月家/年家盘（含空亡、门迫、入墓、击刑、马星等格局标记）
    const daily = buildQimenDailyChart(date)
    const monthly = buildQimenMonthlyChart(date)
    const yearly = buildQimenYearlyChart(date.getFullYear())

    const sections = [
      // 1. 用事总断：先给结论，再谈细节
      {
        key: 'zonglun', title: '用事总断', kind: 'note',
        data: { text: qimenZongLun(pan, daily, date, question) },
      },
      // 2. 本盘关键信息
      {
        key: 'info', title: '本盘要点', kind: 'kv',
        data: { items: qimenInfoItems(pan, daily), vertical: true },
      },
      // 3. 用神落宫分析（奇门立极核心）
      {
        key: 'yongshen', title: '用神落宫分析', kind: 'kv',
        data: { items: qimenYongShen(pan, daily, question), vertical: true },
        note: (() => {
          const zf = pan.layout.find(l => l.shen === '值符')
          const op = pan.layout.find(l => l.men === '开')
          const zfGood = zf && (zf.menNature === '吉' || zf.menNature === '大吉')
          const opBad = op && op.menNature === '凶'
          return {
            term: `本盘立极：值符落${zf?.pos || '-'}宫（${zfGood ? '门吉，大势得助' : '门性欠佳，大势受掣'}），值使落${op?.pos || '-'}宫（${opBad ? '门凶，行事慎动' : '门性尚可'}）；用神落宫吉则事顺，凶则宜缓。`,
            plain: `这一局大势已定：关键人物（值符）落在${zf?.pos || '-'}宫${zfGood ? '，门性吉利、有人撑腰，事情大方向是顺的' : '，门性欠佳、助力有限，大方向上有掣肘'}；执行要点（值使）在${op?.pos || '-'}宫${opBad ? '，门凶，动手前务必三思、别硬闯' : '，门性尚可，按部就班推进即可'}。你问的事落哪一宫，吉则可为、凶则缓图。`,
          }
        })(),
      },
      // 4. 九宫吉凶成因（宫位 × 星门神 × 五行生克 × 格局标记）
      {
        key: 'palaceDetail', title: '九宫吉凶成因', kind: 'palaceGrid',
        data: { items: qimenPalaceCards(pan, daily), cols: 3 },
        note: (() => {
          const goodN = pan.layout.filter(l => (l.menNature === '吉' || l.menNature === '大吉') && l.starNature === '吉').length
          const grave = daily && Array.isArray(daily.palaces)
            ? daily.palaces.flatMap(p => (p.marks || []).filter(m => ['刑', '墓', '迫', '空'].includes(m)).map(m => `${p.palaceName}宫${m}`))
            : []
          return {
            term: `本局吉门吉星同聚之宫 ${goodN} 个${grave.length ? `；凶格 ${grave.length} 处（${grave.join('、')}），此等方位宜避或缓议` : '；全盘无凶格，动静皆宜'}。`,
            plain: `综合看，这一局有 ${goodN} 个宫位门、星皆吉，是办事的好方位${grave.length ? `；但 ${grave.map(g => g.slice(0, 2)).join('、')} 这些位置带 ${grave.map(g => g.slice(2)).join('、')} 等凶格，相关方向的事易受阻、易反复，能避则避` : '，本局整体清朗，没有明显要避开的凶方'}。每宫的吉凶成因见下方格盘。`,
          }
        })(),
      },
      // 5. 格局标记判定（门迫/入墓/击刑/空亡/马星）
      {
        key: 'geju', title: '格局判定（门迫·入墓·击刑·空亡）', kind: 'table',
        data: qimenGeJuTable(daily),
        note: (() => {
          const gRows = qimenGeJuTable(daily).rows
          const isPlain = gRows.length === 1 && gRows[0][1] === '格局平顺'
          const graveTxt = isPlain ? '全盘无门迫、入墓、击刑、空亡等凶格' : gRows.map(r => `${r[0]}·${r[1]}`).join('、')
          return {
            term: `${isPlain ? '本日全盘格局平顺，动静皆宜，谋事可按原计划进行' : `本日凶格见诸：${graveTxt}；带凶格之宫，大事宜缓议或择吉再动`}。`,
            plain: `${isPlain ? '今天这个盘相当干净，没有门迫（被卡）、入墓（使不上劲）、空亡（一场空）这类凶格，想办的事可以直接动手，不必太多顾虑。' : `今天这个盘有 ${gRows.length} 处格局要留意：${graveTxt}。凡标了这些记号的地方，大事尽量缓一缓、换个时间或方位再谈，别硬碰。`}`,
          }
        })(),
      },
      // 6. 三奇六仪（乙丙丁）得位
      {
        key: 'sanqi', title: '三奇得位（乙丙丁）', kind: 'table',
        data: qimenSanQiTable(daily, pan),
        note: (() => {
          const qiRows = qimenSanQiTable(daily, pan).rows
          const noQi = qiRows.length === 1 && qiRows[0][0] === '-'
          const okN = qiRows.filter(r => r[2] === '三奇得吉门，大利行事').length
          const badN = qiRows.filter(r => r[2] === '三奇逢凶格，虽奇亦须慎用').length
          return {
            term: noQi ? '本时三奇（乙丙丁）不临，谋事以吉门吉方为凭。' : `三奇落宫 ${qiRows.length} 处：${qiRows.map(r => r[0]).join('、')}；其中 ${okN} 处得吉门、大利行事${badN ? `，${badN} 处逢凶格、须慎用` : ''}。`,
            plain: noQi ? '这一时三颗"吉祥星"（乙丙丁）都没在场，办事不靠它们，选吉门吉方位照常进行即可。' : `三奇这局落在 ${qiRows.map(r => r[0]).join('、')}：${okN ? `其中 ${okN} 处正好配上吉门，能帮你化解麻烦、把事办顺` : '可惜一处都没配上吉门，能化解的力量有限'}${badN ? `；还有 ${badN} 处虽显了奇却落在凶格局里，非但不能借力，行事反要格外谨慎` : okN ? '；整体可用，不必担心' : ''}。`,
          }
        })(),
      },
      // 7. 星·门·神 吉凶解读
      {
        key: 'xingmen', title: '星·门·神 吉凶解读', kind: 'table',
        data: qimenXingMenTable(pan),
        note: (() => {
          const gStar = pan.layout.filter(l => l.starNature === '吉').length
          const gMen = pan.layout.filter(l => l.menNature === '吉' || l.menNature === '大吉').length
          const gShen = pan.layout.filter(l => ['值符', '六合', '九天', '太阴'].includes(l.shen)).length
          const best = pan.layout.filter(l => (l.menNature === '吉' || l.menNature === '大吉') && l.starNature === '吉').map(l => `${l.pos}宫`)
          return {
            term: `本局吉星 ${gStar} 颗、吉门 ${gMen} 个、吉神 ${gShen} 位${best.length ? `；门星皆吉之宫为 ${best.join('、')}，取向谋事事半功倍` : '；无门星皆吉之宫，行事取吉方缓图' }。`,
            plain: `这一局里有 ${gStar} 颗吉星（托底）、${gMen} 个吉门（顺路）、${gShen} 位吉神（帮衬），整体气运${gStar + gMen >= 6 ? '偏吉，适合拿主意、往前推进' : '中平，谋事求稳、择吉而动'}${best.length ? `；最顺的是 ${best.join('、')} 这几个方位，办事优先往那儿靠` : '。'}`,
          }
        })(),
      },
      // 8. 择吉用事分类（依事务定向）
      {
        key: 'yongshi', title: '择吉用事分类', kind: 'palaceGrid',
        data: { items: qimenYongShi(pan, daily), cols: 2 },
        note: '按不同事务分类，取向对应吉门吉星之方位谋事，事半功倍。',
      },
    ]
    // 日家 / 月家 / 年家分析结论
    if (daily) sections.push({ key: 'daily', title: '日家奇门分析', kind: 'note', data: { text: qimenDailySummary(daily, date) } })
    if (monthly) sections.push({ key: 'monthly', title: '月家奇门分析', kind: 'note', data: { text: qimenMonthlySummary(monthly, date) } })
    if (yearly) sections.push({ key: 'yearly', title: '年家奇门分析', kind: 'note', data: { text: qimenYearlySummary(yearly, date) } })

    const advice = buildQimenAdvice(pan, daily, question)
    return makeReport('qimen', {
      sub: `${pan.pillarsLabel}｜${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}${question ? `｜问事：${question}` : ''}`,
      hero: { main: `${pan.juLabel} · 宜取 <b>${pan.goodPos}</b> 方` },
      meta: { juLabel: pan.juLabel, goodPos: pan.goodPos, shiChen: pan.shiChen, yongShen: qimenZhuYongShen(pan, daily, question) },
      sections,
      advice,
    })
  } catch (e) {
    return failReport(`奇门排盘失败：${e.message || e}`)
  }
}

// ============ 奇门报告丰富内容单元 ============

const QIMEN_GONG_MEANING = {
  坎: '坎宫属水｜点子多、脑子活，主意常藏在心里', 艮: '艮宫属土｜像山一样沉稳，先蓄力再出手',
  震: '震宫属木｜雷厉风行、冲劲足，适合打头阵', 巽: '巽宫属木｜像风会钻缝，眼尖手快、见机行事',
  离: '离宫属火｜光明亮眼，容易出名、露脸', 坤: '坤宫属土｜厚道能扛事，适合守住阵地',
  兑: '兑宫属金｜靠嘴吃饭、擅长谈，口才就是本钱', 乾: '乾宫属金｜刚强果断，适合拿主意、掌大权',
  中: '中宫寄坤｜枢纽地段，承前启后、管协调',
}

// 从日家盘取某宫的格局信息（marks/星门神/五行），用于补充时盘分析
function qimenDailyPalace(daily, pos) {
  if (!daily || !Array.isArray(daily.palaces)) return null
  return daily.palaces.find(p => p.palaceName === pos) || null
}

// 星门神五行生克断语（奇门规则：门迫=门克宫；宫生门=有助；门生宫=泄气；宫克门=门受制）
function qimenWxRelation(matterWx, palaceWx) {
  if (!matterWx || !palaceWx) return ''
  if (matterWx === palaceWx) return '比和'
  if (isSheng(matterWx, palaceWx)) return '门生宫（门泄于宫，主气泄势减）'
  if (isSheng(palaceWx, matterWx)) return '得宫生（宫生门，主有助有源）'
  if (isKe(matterWx, palaceWx)) return '门迫（门克宫，主受困受阻）'
  if (isKe(palaceWx, matterWx)) return '门受制（宫克门，主压抑难伸）'
  return ''
}

const QIMEN_MARK_DESC = {
  空: '空亡｜看似有、实则一场空，谋事容易落空', 时空: '时空｜时机空转，急也没用，宜等一等',
  马: '马星｜动荡奔波，宜快刀斩乱麻，别拖', 刑: '击刑｜易起纠葛口舌，当心争吵、犯小人',
  墓: '入墓｜气机藏起使不上劲，宜低调潜伏', 迫: '门迫｜办事被卡，宜缓一缓、别硬闯',
}

function qimenPalaceCards(pan, daily) {
  return pan.layout.map(l => {
    const dp = qimenDailyPalace(daily, l.pos)
    const qi = l.qiXing ? '·三奇' : ''
    const menOk = l.menNature === '吉' || l.menNature === '大吉'
    const starOk = l.starNature === '吉'
    const shenOk = ['值符', '六合', '九天', '太阴'].includes(l.shen)
    let tone = ''
    if (menOk && starOk) tone = 'good'
    else if (l.menNature === '凶' || l.starNature === '凶') tone = 'bad'

    // 格局标记 + 五行生克，合成本宫吉凶成因
    const marks = (dp && dp.marks && dp.marks.length) ? dp.marks : []
    const markTxt = marks.map(m => QIMEN_MARK_DESC[m] || m).join('；')
    const wxRel = dp ? qimenWxRelation(dp.doorElement, dp.palaceElement) : ''
    const grave = marks.includes('刑') || marks.includes('墓') || marks.includes('迫') || marks.includes('空')

    let combo
    if (grave && marks.includes('空')) combo = '此宫逢空亡，虚而不实，谋事宜缓议'
    else if (grave && marks.includes('刑')) combo = '此宫犯击刑，防纠葛刑伤，宜避锋芒'
    else if (grave && marks.includes('墓')) combo = '此宫入墓，气衰潜藏，宜藏守不宜张扬'
    else if (grave && marks.includes('迫')) combo = '此宫门迫，事多受阻，宜缓不宜急'
    else if (l.starNature === '凶' || l.menNature === '凶') combo = '星门偏凶，宜避'
    else if (menOk && starOk) combo = '星门皆吉，大利行动'
    else combo = '吉凶参半，须看用事'

    const tags = []
    if (l.qiXing) tags.push('三奇')
    if (marks.length) tags.push(...marks)

    return {
      name: `${l.pos}宫`,
      tag: tags.length ? tags.join('·') : `${l.men}门·${l.star}`, tone,
      sub: `${QIMEN_GONG_MEANING[l.pos] || ''}${wxRel ? `｜${wxRel}` : ''}`,
      desc: `${l.starContent}（${l.starNature}）；${l.menContent}（${l.menNature}）；${l.shenContent}${qi}。${markTxt ? markTxt + '。' : ''}${combo}。`,
    }
  })
}

function qimenXingMenTable(pan) {
  const rows = pan.layout.map(l => [
    `${l.pos}宫`,
    l.star,
    l.starNature,
    l.men,
    l.menNature,
    l.shen,
  ])
  return {
    headers: ['宫位', '九星', '星性', '八门', '门性', '八神'],
    rows,
  }
}

function qimenZhiShi(pan) {
  const zhiFu = pan.layout.find(l => l.shen === '值符')
  const open = pan.layout.find(l => l.men === '开')
  return [
    { k: '值符落宫', v: zhiFu ? `${zhiFu.pos}宫 · ${zhiFu.star}星 · ${zhiFu.gan}` : '-' },
    { k: '值使（开门）', v: open ? `${open.pos}宫` : '-' },
    { k: '时干', v: `${pan.shiGan}（天盘引值符星）` },
    { k: '遁局', v: pan.juLabel },
    { k: '取用提示', v: `值符为贵人主导，落${zhiFu?.pos || '-'}宫；开门为谋事之门，落${open?.pos || '-'}宫，取向此二方多吉。` },
  ]
}

// 择吉用事分类
function qimenYongShi(pan, daily) {
  const l = pan.layout
  const findDir = (menSet, starSet) => {
    const hit = l.find(x => menSet.includes(x.men) && (!starSet || starSet.includes(x.star)))
    return hit ? hit.pos : l.find(x => menSet.includes(x.men))?.pos || '中宫'
  }
  const openDir = findDir(['开'], null)
  const shengDir = findDir(['生'], null)
  const xiuDir = findDir(['休'], null)
  const jingDir = findDir(['景'], null)
  return [
    { name: '出行·远行', tag: openDir, tone: 'good', desc: `宜取${openDir}方开门，主通达顺利；忌向凶门方位。` },
    { name: '谋事·谈判', tag: shengDir, tone: 'good', desc: `宜向${shengDir}方生门，主生发有成；择吉时而行事半功倍。` },
    { name: '签约·合作', tag: '六合', tone: 'good', desc: `六合神主合同和合，其所在宫为${l.find(x => x.shen === '六合')?.pos || '-'}宫，谋合作之事宜向此方。` },
    { name: '休养·安神', tag: xiuDir, tone: '', desc: `休门宜静养安神，向${xiuDir}方休憩、理疗、修整更佳。` },
    { name: '文书·考试', tag: jingDir, tone: '', desc: `景门主文书印信，考试立约宜向${jingDir}方；天辅（文昌）亦主学业。` },
    { name: '避凶·守成', tag: '凶门', tone: 'bad', desc: `死门、惊门所在宫主收束或口舌，大事慎往；宜守不宜攻。` },
  ]
}

function buildQimenAdvice(pan, daily, question = '') {
  const good = pan.layout.filter(l => (l.menNature === '吉' || l.menNature === '大吉'))
  const dirs = good.map(l => l.pos).join('、') || '中宫'
  const men = good.map(l => `${l.pos}（${l.men}门）`).join('、')
  const yongShen = qimenZhuYongShen(pan, daily, question)
  const t = (question || '').trim()
  let care = ''
  if (/事业|工作|跳槽|求职|升迁|创业/.test(t)) care = `事业以「${yongShen}」为用神（官爻·开门）：求职、跳槽、求升，宜挑吉门方位、挑个好时辰再谈，别在门迫（办事被卡）或逢空（使不上劲）的宫位拍板。`
  else if (/财|求财|生意|金钱|财运/.test(t)) care = `求财以「${yongShen}」为用神：宜奔生门（生发有财）吉方去谈、择吉时签约，别在门迫（被堵）的宫位脑子一热就出手。`
  else if (/婚|感情|恋爱|婚姻|脱单/.test(t)) care = `感情以「${yongShen}」为用神，六合主和合（最利成双配对）：宜真诚把话说开，最忌翻旧账、斗嘴伤和气。`
  else if (/学业|考试|读书|考学/.test(t)) care = `学业以「${yongShen}」为用神，天辅主文昌（管学业）：宜静下心来踏实学，最忌浮躁、想走捷径。`
  else if (/病|健康|康复/.test(t)) care = `健康以「${yongShen}」为用神，天芮主疾厄（管病痛）：宜养神、作息规律，最忌过度劳累、整天胡思乱想。`
  else if (/出行|出差|旅行|搬家/.test(t)) care = `出行以「${yongShen}」为用神，九天主远行高飞（管出远门）：宜挑吉门方位、吉时出发，路上更顺当。`
  return {
    career: care || `当刻吉门在${dirs}，谋事、谈判、签约宜取向吉方开展（朝吉利方向使劲，事半功倍）；${pan.ju <= 3 ? '上元局利开创起步（适合开张、起步、冲刺）' : pan.ju <= 6 ? '中元局利推进协调（适合稳步推进、搞好配合）' : '下元局利收束巩固（适合收尾、稳住成果）'}。`,
    wealth: men ? `财气方位可参考${men}所在宫，主财帛之事多顺（往这几个方向求财更容易成）。` : '财运宜静观其变（先别急着投钱），等时机对了再动。',
    love: `${pan.shiChen}时值符居中，感情之事宜真诚坦白（心里怎么想就说出来），最忌遮遮掩掩让人猜。`,
    health: '奇门时盘提示：注意作息规律，别熬夜，适度活动活动身体，精力才撑得住。',
    opening: `今日宜取 ${pan.goodPos} 方为开运方位（往这个方向发力更顺）；${pan.shiChen}时出行、会面、拍板都可以参考吉门方位。`,
  }
}

// 九星 / 八门吉凶基准（奇门通论）
const QIMEN_STAR_NATURE = { 天蓬: '凶', 天芮: '凶', 天冲: '平', 天辅: '吉', 天禽: '平', 天心: '吉', 天柱: '凶', 天任: '吉', 天英: '平' }
const QIMEN_MEN_NATURE = { 开: '大吉', 休: '吉', 生: '吉', 杜: '平', 景: '平', 死: '凶', 惊: '凶', 伤: '凶' }

// 按问事关键词取奇门用神（值符/值使/日干/时干/三奇 之一或组合）
function qimenZhuYongShen(pan, daily, question = '') {
  const t = (question || '').trim()
  if (/财|求财|生意|金钱|挣钱|财运/.test(t)) return `财爻·生门（${qimenDirByMen(pan, '生')}）`
  if (/婚|感情|恋爱|婚姻|对象|姻缘|脱单/.test(t)) return `婚爻·六合（${qimenDirByShen(pan, '六合')}）`
  if (/学业|考试|读书|考学|考研|职称|录取/.test(t)) return `文昌·天辅（${qimenDirByStar(pan, '天辅')}）`
  if (/病|健康|康复|疾|体|养身/.test(t)) return `病爻·天芮（${qimenDirByStar(pan, '天芮')}）`
  if (/事业|工作|跳槽|求职|升迁|升职|仕途|求官|名望|换工作|创业/.test(t)) return `官爻·开门（${qimenDirByMen(pan, '开')}）`
  if (/出行|出差|旅行|外出|搬家|远行/.test(t)) return `出行·九天（${qimenDirByShen(pan, '九天')}）`
  if (/开店|投资|项目|公司|生意/.test(t)) return `谋事·生门（${qimenDirByMen(pan, '生')}）`
  return `值符（${qimenDirByShen(pan, '值符')}）`
}

function qimenDirByMen(pan, men) {
  return pan.layout.find(l => l.men === men)?.pos || '中宫'
}
function qimenDirByShen(pan, shen) {
  return pan.layout.find(l => l.shen === shen)?.pos || '中宫'
}
function qimenDirByStar(pan, star) {
  return pan.layout.find(l => l.star === star)?.pos || '中宫'
}

// 用神落宫分析：值符/值使/时干/三奇 + 问事取向
function qimenYongShen(pan, daily, question = '') {
  const zhiFu = pan.layout.find(l => l.shen === '值符')
  const open = pan.layout.find(l => l.men === '开')
  const qiPalaces = pan.layout.filter(l => l.qiXing)
  const items = [
    { k: '值符（纲）', v: zhiFu ? `${zhiFu.pos}宫 · ${zhiFu.star} · ${zhiFu.gan}${zhiFu.menNature === '吉' || zhiFu.menNature === '大吉' ? ' · 门吉' : ''}` : '-' },
    { k: '值使（用）', v: open ? `${open.pos}宫 · ${open.star}星 · ${open.men}门${open.menNature === '凶' ? '（门凶慎动）' : ''}` : '-' },
    { k: '时干（事）', v: `${pan.shiGan} · 落${pan.layout.find(l => l.gan === pan.shiGan)?.pos || '-'}宫` },
    { k: '三奇（乙丙丁）', v: qiPalaces.length ? qiPalaces.map(l => `${l.gan}落${l.pos}宫`).join('、') : '本时三奇未显' },
  ]
  if ((question || '').trim()) {
    items.push({ k: '问事用神', v: qimenZhuYongShen(pan, daily, question) })
  }
  return items
}

// 本盘要点（信息卡片）
function qimenInfoItems(pan, daily) {
  const dun = daily && daily.dun === 'yang' ? '阳遁' : daily && daily.dun === 'yin' ? '阴遁' : pan.juLabel
  const fp = daily && daily.fourPillars
  const four = fp ? `${fp.year.gan}${fp.year.zhi}年 ${fp.month.gan}${fp.month.zhi}月 ${fp.day.gan}${fp.day.zhi}日${fp.hour ? ' ' + fp.hour.gan + fp.hour.zhi + '时' : ''}` : pan.pillarsLabel
  const kong = daily && Array.isArray(daily.kongWang) && daily.kongWang.length ? daily.kongWang.join('、') : ''
  const term = (daily && daily.solarTerm) || ''
  return [
    { k: '时盘', v: four },
    { k: '遁局', v: daily ? `${dun}${daily.juNumber}局` : pan.juLabel },
    { k: '节气', v: term || '-' },
    { k: '旬空', v: kong || '-' },
    { k: '值符', v: daily ? `${daily.zhiFuStar}（${daily.zhiFuPalace}宫）` : '-' },
    { k: '值使', v: daily ? `${daily.zhiShiDoor}（${daily.zhiShiPalace}宫）` : '-' },
  ]
}

// 格局判定表：门迫/入墓/击刑/空亡/马星
function qimenGeJuTable(daily) {
  if (!daily || !Array.isArray(daily.palaces)) {
    return { headers: ['宫位', '格局', '判断'], rows: [['-', '-', '缺少完整日盘，暂无法判定格局。']] }
  }
  const rows = []
  for (const p of daily.palaces) {
    const marks = (p.marks || []).slice()
    if (!marks.length) continue
    marks.forEach(m => {
      rows.push([`${p.palaceName}宫`, m, QIMEN_MARK_DESC[m] || m])
    })
  }
  if (!rows.length) {
    rows.push(['全盘', '格局平顺', '本日无门迫、入墓、击刑、空亡等凶格，动静皆宜。'])
  }
  return { headers: ['宫位', '格局', '判断'], rows }
}

// 三奇（乙丙丁）得位分析
function qimenSanQiTable(daily, pan) {
  const rows = []
  const QI = ['乙', '丙', '丁']
  if (daily && Array.isArray(daily.palaces)) {
    for (const p of daily.palaces) {
      if (QI.includes(p.skyStem)) {
        const nature = QIMEN_MEN_NATURE[p.door] || '平'
        const grave = (p.marks || []).some(m => ['刑', '墓', '迫', '空'].includes(m))
        const verdict = grave ? '三奇逢凶格，虽奇亦须慎用' : nature === '吉' || nature === '大吉' ? '三奇得吉门，大利行事' : '三奇落平门，中平可用'
        rows.push([`${p.palaceName}宫·天盘${p.skyStem}`, `${p.door}门（${nature}）`, verdict])
      }
    }
  }
  if (!rows.length && pan) {
    for (const l of pan.layout) {
      if (l.qiXing) {
        const nature = l.menNature
        rows.push([`${l.pos}宫·${l.gan}`, `${l.men}门（${nature}）`, nature === '吉' || nature === '大吉' ? '三奇得吉门，大利行事' : '三奇落平门，中平可用'])
      }
    }
  }
  if (!rows.length) rows.push(['-', '本时三奇未显', '三奇不临，谋事以吉门吉方为凭。'])
  return { headers: ['落宫', '门性', '得位判断'], rows }
}

// 日家 / 月家 / 年家分析结论（结构化 → 文本）
function qimenJuSummary(chart, label) {
  if (!chart || !Array.isArray(chart.palaces)) return `（${label}排盘失败）`
  const dun = chart.dun === 'yang' ? '阳遁' : chart.dun === 'yin' ? '阴遁' : String(chart.dun || '')
  const kong = Array.isArray(chart.kongWang) && chart.kongWang.length ? chart.kongWang.join('、') : '无'
  const goodPalaces = []
  const gravePalaces = []
  for (const p of chart.palaces) {
    const doorOk = (QIMEN_MEN_NATURE[p.door] || '平') === '吉' || (QIMEN_MEN_NATURE[p.door] || '平') === '大吉'
    const starOk = (QIMEN_STAR_NATURE[p.star] || '平') === '吉'
    const marks = p.marks || []
    if (doorOk && starOk && !marks.some(m => ['刑', '墓', '迫', '空'].includes(m))) goodPalaces.push(`${p.palaceName}宫`)
    if (marks.length) gravePalaces.push(`${p.palaceName}宫${marks.join('/')}`)
  }
  const goodTxt = goodPalaces.length ? goodPalaces.join('、') : '暂无明显大吉之宫'
  const graveTxt = gravePalaces.length ? `；凶格见诸：${gravePalaces.join('、')}，宜避其锋` : '；全盘无门迫入墓击刑等凶格'
  const term = chart.solarTerm ? `（${chart.solarTerm}）` : ''
  return `${label}·${dun}${chart.juNumber}局${term}，值符${chart.zhiFuStar}落${chart.zhiFuPalace}宫，值使${chart.zhiShiDoor}落${chart.zhiShiPalace}宫；旬空${kong}。吉门吉星同聚之宫为：${goodTxt}${graveTxt}。`
}
function qimenDailySummary(daily, date) { return qimenJuSummary(daily, '日家') }
function qimenMonthlySummary(monthly, date) { return qimenJuSummary(monthly, '月家') }
function qimenYearlySummary(yearly, date) { return qimenJuSummary(yearly, '年家') }

// 用事总断（结论先行）
function qimenZongLun(pan, daily, date, question = '') {
  const juTxt = pan.juLabel
  const zhiFu = pan.layout.find(l => l.shen === '值符')
  const good = pan.layout.filter(l => (l.menNature === '吉' || l.menNature === '大吉') && l.starNature === '吉')
  const graveCount = daily && Array.isArray(daily.palaces)
    ? daily.palaces.reduce((n, p) => n + (p.marks || []).filter(m => ['刑', '墓', '迫', '空'].includes(m)).length, 0) : 0
  const yongShen = qimenZhuYongShen(pan, daily, question)
  const overall = good.length > 1 && graveCount === 0
    ? '本时辰奇门格局清朗，吉门吉星多聚，正宜顺势进取。'
    : graveCount > 1
      ? '本时辰格局偏杂，凶格较多，宜静观守成、择吉而动。'
      : '本时辰吉凶参半，凡事务求稳字，择吉方缓图可成。'
  const qTxt = (question || '').trim() ? `就「${question}」一事，` : ''
  const plain = good.length > 1 && graveCount === 0
    ? '总之一句话：这阵子运势挺顺，该出手就出手。'
    : graveCount > 1
      ? '总之一句话：这阵子坑不少，稳住别冒进，挑吉日吉时再动手。'
      : '总之一句话：好坏参半，求稳为上，往吉利方位、挑好时辰慢慢来。'
  return `${qTxt}此刻行${juTxt}，值符落${zhiFu ? zhiFu.pos + '宫' : '中宫'}，主用取「${yongShen}」。${overall}取吉门吉星所聚之宫（${good.length ? good.map(g => g.pos).join('、') : pan.goodPos}）谋事，方位合五行者事半功倍。\n┄ 即：${plain}`
}

// ============ 个性化黄历报告 ============
export function buildHuangliReport(chart, date = new Date(), scenario) {
  try {
    const d = buildDaily(date, chart)
    const sections = []
    // 根据订阅人身份/年纪确定的场景人设（若提供）
    if (scenario) {
      const sc = getSceneData(scenario)
      sections.push({
        key: 'persona', title: `今日身份人设 · ${sc.emoji} ${sc.name}`, kind: 'kv',
        data: {
          items: [
            { k: '人设', v: sc.persona },
            { k: '今日BGM', v: sc.bgm },
          ],
        },
        note: `现代宜：${sc.yi.slice(0, 3).map(v => v.split('——')[0]).join('、')}｜现代忌：${sc.ji.slice(0, 3).map(v => v.split('——')[0]).join('、')}`,
      })
    }
    sections.push(
      {
        key: 'info', title: '今日基本信息', kind: 'kv',
        data: {
          items: [
            { k: '日期', v: `${d.date} ${d.week}` },
            { k: '干支', v: `${d.yearGanzhi} ${d.dayGanzhi}` },
            { k: '日五行', v: d.dayWx },
            { k: '农历', v: d.lunar },
            { k: '节气', v: d.term || '-' },
            { k: '冲煞', v: d.chong },
          ],
        },
      },
      {
        key: 'yiji', title: '宜忌', kind: 'chips',
        data: { items: [...d.yi.map(v => ({ label: '宜', value: v })), ...d.ji.map(v => ({ label: '忌', value: v }))] },
      },
      {
        key: 'theme', title: '今日主题', kind: 'kv',
        data: {
          items: [
            { k: '主题', v: d.theme },
            { k: '基调', v: d.tone },
            { k: '与命关系', v: d.relation === '顺' ? '顺·五行生扶于你' : d.relation === '慎' ? '慎·略有冲克' : '平·顺势而为' },
          ],
        },
        note: d.scenes?.join('；') || '',
      },
    )
    if (d.action) {
      sections.push({
        key: 'action', title: '行动建议', kind: 'kv',
        data: {
          items: [
            { k: '今日策略', v: `${d.action.head}（${d.action.mode}）` },
            { k: '详释', v: d.action.body },
          ],
        },
      })
    }
    if (d.tips && chart) {
      sections.push({
        key: 'tips', title: '开运提示', kind: 'kv',
        data: {
          items: [
            { k: '喜用色', v: `${d.tips.color}（${d.tips.fav}）` },
            { k: '吉方', v: d.tips.dir },
            { k: '贵人', v: d.tips.noble },
            { k: '幸运数字', v: d.tips.num },
          ],
        },
      })
    }

    const advice = {
      career: d.action ? `${d.action.head}。${d.action.body}` : '今日按部就班即可。',
      wealth: d.relation === '慎' ? '今日财运宜守，避免大额冲动消费。' : '今日适合处理与钱相关的事项，量入为出。',
      love: d.relation === '顺' ? '今日人际和谐，适合约会、聚会，感情升温。' : '今日宜多沟通体谅，避免因小事起争执。',
      health: d.tips ? `今日适合适量运动，${d.tips.color}色系衣物有助提升状态。` : '注意劳逸结合。',
      opening: d.tips ? `今日开运色 ${d.tips.color}，吉方 ${d.tips.dir}，贵人 ${d.tips.noble}，幸运数字 ${d.tips.num}。` : '保持平常心即是好风水。',
    }
    return makeReport('huangli', {
      sub: `${d.date} ${d.week}｜${d.yearGanzhi} ${d.dayGanzhi}｜${d.lunar}`,
      hero: { chars: [d.yearGanzhi.replace('年', ''), d.dayGanzhi.replace('日', '')], main: d.relation === '顺' ? `今日运势：<b>顺</b> · ${d.theme}` : d.relation === '慎' ? `今日运势：<b>慎</b> · ${d.theme}` : `今日运势：平 · ${d.theme}` },
      meta: { date: d.date, dayGanzhi: d.dayGanzhi, relation: d.relation },
      sections,
      advice,
    })
  } catch (e) {
    return failReport(`黄历生成失败：${e.message || e}`)
  }
}

// ============ 塔罗报告 ============
export function buildTarotReport(args = {}) {
  try {
    const { question, spreadId = 'time' } = args
    const result = drawCards(spreadId)
    if (!result) return failReport('牌阵不存在，请选择有效牌阵')
    const interp = interpret(result, question)
    const { spread, cards } = result

    const cardSections = interp.perCard.map(c => ({
      title: c.position,
      sub: `${c.card.name}${c.isReversed ? '（逆位）' : ''}`,
      desc: `${c.positionDesc}。${c.text}`,
    }))

    const sections = [
      { key: 'summary', title: '牌阵总论', kind: 'note', data: { text: interp.summary } },
      { key: 'cards', title: `逐位解读（${spread.name}）`, kind: 'cards', data: { items: cardSections } },
      { key: 'suggestion', title: '行动指引', kind: 'note', data: { text: interp.suggestion } },
    ]

    const upright = cards.filter(c => !c.reversed).length
    const advice = {
      career: upright >= cards.length * 0.6 ? '多数牌正位，气场支持你向前推进，宜果断行动、把握机会。' : upright <= cards.length * 0.4 ? '逆位偏多，事业上宜先沉淀反思、修正方向，不宜仓促决策。' : '正逆交杂，凡事顺势而为，不过度执着于一时得失。',
      wealth: cards.some(c => c.suit === 'pentacles') ? '星币元素显现，与钱财、物质相关之事将被提上日程，量入为出。' : '财运平稳，宜做长期规划而非短线投机。',
      love: cards.some(c => c.suit === 'cups') ? '圣杯元素出现，感情之事重感受与交流，宜敞开心扉。' : '感情上保持真诚，顺其自然即可。',
      health: '注意情绪与身体的平衡，规律作息是最好的补养。',
      opening: `本次牌阵关键词：${cards.map(c => c.kw.join('、')).join('；')}。以平常心看待结果，命运之轮始终在转动。`,
    }
    return makeReport('tarot', {
      sub: question ? `所问：「${question.slice(0, 40)}」` : '今日指引',
      hero: { main: `牌阵 <b>${spread.name}</b> · 整体能量 ${cards.filter(c => !c.reversed).length}/${cards.length} 正位` },
      meta: { spreadId: spread.id, count: cards.length, drawnAt: result.drawnAt },
      sections,
      advice,
    })
  } catch (e) {
    return failReport(`塔罗解读失败：${e.message || e}`)
  }
}

// ============ 姓名分析报告 ============
export function buildNameReport(chart, args = {}) {
  try {
    const { fullName = chart?.fullName || '', surname } = args
    if (!fullName && !surname) return failReport('请提供姓名（fullName 或 surname）')
    const input = { fullName: fullName || surname, surname, chart }
    const a = analyzeName(input)

    const gridRows = a.grid.map(g => [
      g.name,
      g.value,
      g.wuxing,
      g.luck.吉 ? '吉' : '凶',
      g.luck.category || '',
      (g.luck.desc || '') + (g.luck.plain ? `\n┄ ${g.luck.plain}` : ''),
    ])
    const sanCaiDesc = {
      吉: '三才相生，根基稳固',
      中: '三才中平，尚可调和',
      凶: '三才相克，宜以五行调和',
    }[a.sanCai.verdict] || ''

    let recommendCards = []
    try {
      const rec = recommendName(chart, fullName || surname)
      recommendCards = rec.map(r => ({
        title: r.input.fullName,
        sub: `${r.score} 分 · ${r.grade}`,
        desc: r.summaryText,
      }))
    } catch (e) { /* ignore */ }

    const sections = [
      {
        key: 'info', title: '姓名信息', kind: 'kv',
        data: {
          items: [
            { k: '姓名', v: a.input.fullName },
            { k: '三才配置', v: `${a.sanCai.tian}-${a.sanCai.ren}-${a.sanCai.di}` },
            { k: '三才吉凶', v: `${a.sanCai.verdict}（${sanCaiDesc}）` },
            { k: '综合评分', v: `${a.score} 分` },
            { k: '评级', v: a.grade },
          ],
        },
      },
      {
        key: 'grid', title: '五格数理', kind: 'table',
        data: { headers: ['格', '数理', '五行', '吉凶', '类别', '含义'], rows: gridRows },
      },
    ]
    if (a.summaryText) {
      sections.push({ key: 'summary', title: '评语', kind: 'note', data: { text: a.summaryText } })
    }
    if (recommendCards.length) {
      sections.push({ key: 'recommend', title: '推荐名字（结合喜用神）', kind: 'cards', data: { items: recommendCards } })
    }

    const advice = {
      career: `人格数理${a.grid.find(g => g.name === '人格')?.luck.吉 ? '主吉' : '中平'}，事业宜选能发挥自身优势的领域，稳扎稳打。`,
      wealth: `总格${a.grid.find(g => g.name === '总格')?.luck.吉 ? '主吉' : '中平'}，后运渐隆，理财宜稳健积累。`,
      love: `三才${a.sanCai.verdict === '吉' ? '配置相生，感情平顺' : '中平，感情需用心经营'}。`,
      health: '姓名五行与身心调和相关，宜注意与喜用神相合的作息与饮食。',
      opening: a.favorable.length ? `喜用神为${a.favorable.join('、')}，名字或改名宜取五行属${a.favorable.join('、')}的字，可增运助势。` : '保持名字的五行平衡即为佳运。',
    }
    return makeReport('name', {
      sub: `姓名「${a.input.fullName}」· ${a.score} 分 · ${a.grade}`,
      hero: { main: `「<b>${a.input.fullName}</b>」 ${a.score} 分 <b>${a.grade}</b>` },
      meta: { fullName: a.input.fullName, score: a.score, grade: a.grade },
      sections,
      advice,
    })
  } catch (e) {
    return failReport(`姓名分析失败：${e.message || e}`)
  }
}

// ============ 风水报告 ============
export function buildFengshuiReport(chart, args = {}) {
  try {
    const layout = args.layout || {}
    const birthInfo = args.birthInfo || (chart ? { year: chart.year, month: chart.month, day: chart.day, hour: chart.hour, gender: chart.gender } : undefined)
    const f = analyzeFengshui({ layout, birthInfo })

    const roomCards = f.rooms.map(r => ({
      title: r.name,
      sub: `${r.dir}方（${r.wuxing}） · ${r.score} 分`,
      desc: r.tips.join('；') || '方位平顺，可正常布置。',
    }))

    const sections = [
      {
        key: 'overview', title: '整体评估', kind: 'kv',
        data: {
          items: [
            { k: '整体得分', v: `${f.overallScore} 分` },
            { k: '大门朝向', v: `${f.door.dir}（${f.door.wuxing}）· 吉位 ${f.door.lucky}` },
            { k: '大门吉凶', v: f.door.match },
            { k: '床头朝向', v: `${f.bed.dir} · ${f.bed.verdict}` },
            { k: '喜用神', v: f.favorable.join('、') },
            { k: '忌神', v: f.avoid.join('、') },
          ],
        },
      },
      {
        key: 'rooms', title: '房间布局分析', kind: 'cards',
        data: { items: roomCards },
      },
    ]
    if (f.summary && f.summary.length) {
      sections.push({ key: 'summary', title: '风水总评', kind: 'note', data: { text: f.summary.join('\n') } })
    }
    if (f.bed.desc) {
      sections.push({ key: 'bed', title: '床头详解', kind: 'note', data: { text: f.bed.desc } })
    }

    const advice = {
      career: `大门为宅之气口，${f.door.match}宜保持玄关整洁明亮，有助事业运。`,
      wealth: `吉位推荐「${f.lucky.生方}」生气方作主卧或客厅，财气流通更佳。`,
      love: f.bed.verdict === '吉' ? '床头朝向与命格相合，利于安眠与感情稳定。' : `床头朝向需调整：${f.bed.desc}。`,
      health: '注意通风采光，忌杂物堆积，厨房明火朝吉方。',
      opening: `推荐主题色：${f.rooms[0]?.colorList?.join(' / ') || '青绿 / 米黄'}；整体得分 ${f.overallScore} 分，${f.overallScore >= 80 ? '格局优良' : f.overallScore >= 60 ? '尚可，宜微调' : '需重点调整弱位'}。`,
    }
    return makeReport('fengshui', {
      sub: `整体得分 ${f.overallScore} 分｜大门 ${f.door.dir}｜床头 ${f.bed.dir}`,
      hero: { main: `家宅风水 <b>${f.overallScore} 分</b> · 吉位 <b>${f.lucky.生方}</b>` },
      meta: { overallScore: f.overallScore, door: f.door.dir, bed: f.bed.dir },
      sections,
      advice,
    })
  } catch (e) {
    return failReport(`风水分析失败：${e.message || e}`)
  }
}

// ============ 盲派命理报告 ============
// 基于「盲派命理 · 终极实战操作系统 V3.0」落地：三秒定太极 → 体用宾主 → 根基五维 → 做功七法 → 效率评级 → 墓库 → 应期 → 取象 → 伤门
export function buildMangpaiReport(chart) {
  if (!chart) return failReport('尚未排盘，请先生成命盘')
  let bazi
  const pad2 = n => String(n).padStart(2, '0')
  try {
    bazi = buildBaziFromSolar({
      solarTime: `${chart.year}-${pad2(chart.month)}-${pad2(chart.day)} ${pad2(chart.hour ?? 12)}:00`,
      gender: chart.gender === '女' ? 0 : 1,
      sect: 2,
    })
  } catch (e) {
    return failReport(`盲派排盘失败：${e.message || e}`)
  }
  const m = analyzeMangpai(bazi)
  if (!m) return failReport('盲派分析失败')

  const { pre, ty, genji, zuo, muku, yingqi, quxiang, shangmen } = m
  const ganKe = pre.ganKe || []

  // ============ 模块一：P0-P3 预处理（锁定太极点） ============
  const dayGan = bazi.日主 || m.dayGan || ''
  const dayZhi = pre.dayZhi || ''
  const dayKong = pre.dayKong && pre.dayKong.length ? pre.dayKong.join('、') : '无'
  // P0-P3 预处理表：优先级 / 特征提取 / 判定结果
  const p0p3Rows = (pre.results || []).map(r => [
    r.key + ' ' + r.label,
    r.found ? r.detail.join('；') : '无',
    r.found ? '✅ 触发' : '未触发',
  ])
  // 空亡补充行（即使日柱不空，也告知旬空落点）
  p0p3Rows.push([
    '空亡',
    `日柱${dayGan}${dayZhi}（${kongXunName(dayGan, dayZhi) || '无旬'}）旬空：${dayKong}`,
    dayKong === '无' ? '未落空亡' : '空亡待填实',
  ])
  const taijiItems = [
    { k: '最大动静', v: firstFound(pre, ['P0', 'P1', 'P2', 'P3']) || '原局平静，动静待岁运引动', tone: firstFound(pre, ['P0', 'P1']) ? 'bad' : 'good' },
    { k: '次级动静', v: restFound(pre, ['P0', 'P1', 'P2', 'P3']) || '无' },
    { k: '空亡', v: dayKong === '无' ? '日柱未落空亡' : `日主坐${dayZhi}（${dayGan}${dayZhi}），旬空${dayKong}，属${kongXunName(dayGan, dayZhi) || '无旬'}` },
  ]

  // ============ 模块二：宾主体用 ============
  const tiYongRows = pillarTenRows(m)
  const tiYongNote = tiYongConclusion(m)

  // ============ 模块三：核心做功拆解 ============
  const zuoGongCards = zuo.methods.length
    ? zuo.methods.map((x, i) => {
        const tone = i === 0 ? 'good' : undefined
        const name = `${['合', '冲', '穿', '刑', '制', '化', '暗合'][x.priority] || x.name}${x.target ? ` · ${x.target}` : ''}`
        const plain = workPlain(x.name)
        return {
          name,
          tag: x.desc ? x.desc.split('。')[0] : '',
          desc: `${plain}${x.desc ? `（专业上讲：${x.desc}）` : ''}`,
          tone,
        }
      })
    : []

  // ============ 模块四：势与富贵层级 ============
  const wealthNote = wealthLevel(m, genji)

  // ============ 模块五：根基分析 ============
  const genJiRows = [
    ...genji.dims.map(d => [d.name, d.score, `${genjiPlain(d.name)}。${d.desc}`]),
    ['总分', genji.total, genji.conclusion],
  ]

  // ============ 模块六：大运详解 ============
  const dayunCards = dayunDetailList(bazi, m)

  // ============ 模块七：流年应期 ============
  const liunianRows = liunianForecast(bazi, m, yingqi)

  // ============ 模块七补：逐年深度应期 + 行动路线（V12.0 第八/十一卷） ============
  // 当前大运逐年（含未来10年）深度预测
  const curYear = currentY()
  const nextYun = (() => {
    const yun = (bazi.大运 && bazi.大运.大运) || []
    const curIdx = yun.findIndex(d => {
      const ys = Number(d.开始年份) || 0
      const ye = Number(d.结束) || ys + 9
      return curYear >= ys && curYear <= ye
    })
    // 取「当前运的下一运」（若当前为最后一运则取当前运），即未来完整十年窗口
    const idx = curIdx >= 0 ? Math.min(curIdx + 1, yun.length - 1) : Math.max(0, yun.length - 1)
    const d = yun[idx]
    return {
      ganZhi: (d && d.干支) || '',
      start: Number((d && d.开始年份)) || curYear + 1,
      end: Number((d && d.结束)) || Number((d && d.开始年份)) + 9 || curYear + 10,
    }
  })()
  const kongArr = Array.isArray(pre.dayKong) ? pre.dayKong : []
  const yunGan = nextYun.ganZhi ? nextYun.ganZhi[0] : ''
  const yunZhi = nextYun.ganZhi ? nextYun.ganZhi[1] : ''
  const origKu = (m.pillars || []).map(p => p.zhi).filter(z => '辰戌丑未'.includes(z))
  const yearRouteRows = yearDeepForecast(bazi, pre.dayZhi || '', kongArr, ty, m.dayWx, yunGan, yunZhi, origKu, nextYun.start, nextYun.end)
  // 当年逐月防御清单（未来12个月，应事提示结合流年 + 八字）
  const monthDeepRows = monthDeepForecast(bazi, dayGan, pre.dayZhi || '', kongArr, curYear)

  // ============ 模块八：象法直读 ============
  const xiangfaCards = xiangfaRead(m, bazi)

  // ============ 模块九：最终定论 ============
  const conclusionNote = finalConclusion(m, genji)
  const sanGangItems = sanGang(m, pre)
  const heartNote = heartMantra(m, pre)

  // ============ 模块四副数据：流年趋势 / 注意事项 / 重要应期 ============
  // 流年主要趋势：当前+未来 2 步大运走向
  const dayunTrend = (() => {
    if (!dayunCards || !dayunCards.length) return { tag: '无', desc: '暂无大运数据。' }
    // 找当前大运索引，向后取 3 步
    const curIdx = dayunCards.findIndex(d => /当前/.test(d.tag))
    const startIdx = curIdx >= 0 ? curIdx : Math.max(0, dayunCards.length - 1)
    const upcoming = dayunCards.slice(startIdx, startIdx + 3)
    if (!upcoming.length) return { tag: '无', desc: '暂无大运数据。' }
    const isCur = d => /当前/.test(d.tag)
    const isUp = d => /财官到位|做功目标到位|该出手|该要敢要|往上走/.test(d.desc)
    const isDown = d => /凶险|动荡|克|冲|坑|非顺|下行/.test(d.desc)
    const isFlat = d => /平运|稳扎稳打|守成/.test(d.desc)
    const summary = upcoming.map(d => `${d.name}(${isCur(d) ? '当前' : '未来'})`).join(' → ')
    const up = upcoming.filter(isUp).length
    const down = upcoming.filter(isDown).length
    const flat = upcoming.filter(isFlat).length
    const trend = up >= 2 ? '上升期' : up === 1 && (down === 0 || flat <= 1) ? '先稳后升' : up === 1 && down === 1 ? '高低交替' : down >= 2 ? '下行期（宜守）' : up === 0 && flat >= 2 ? '平稳期' : '平稳偏升'
    return {
      tag: trend,
      sub: summary,
      desc: `近 ${upcoming.length * 10} 年大运走向：${summary}。${up >= 2 ? '整体在上升通道，机会大于风险，该出手就出手。' : up === 1 && down === 0 ? '前段打底、后段发力，中段积攒。' : up === 1 && down >= 1 ? '几段运各有起伏，节奏踩对最关键——用神到的年份冲业绩，平顺的年份练内功。' : down >= 2 ? '大运整体偏弱，宜守不宜攻，靠积累人脉和技能等下一轮窗口。' : '平运为主，无大起大落，按部就班即可。'}`,
    }
  })()

  // 注意事项：从命局弱势点提炼
  const warnItem = (() => {
    const warns = []
    if (pre.dayKong && pre.dayKong.length) warns.push(`日坐空亡（${pre.dayKong.join('、')}）——关键事容易差口气，逢填实之年才稳`)
    if (m.shangmen && m.shangmen.length) warns.push(`命带${m.shangmen.map(s => s.name).join('、')}——发动时防官非纠纷和暗损`)
    if (genji.total < 4) warns.push(`根基偏虚（${genji.total}分）——不可主攻，宜借势顺势，逢应期才发力`)
    if (ty.feiGong && ty.feiGong.length && /飞宫|换象/.test(ty.feiGong[0])) warns.push(`飞宫换象——早年压力/地位可转化，但转化不顺时易生闷气`)
    if (ty.tiCount) {
      const maxTi = Object.values(ty.tiCount).reduce((a, b) => Math.max(a, b), 0)
      if (maxTi < 2 && genji.total < 6) warns.push(`体弱无强根——主位做功乏力，重大决策忌孤注一掷`)
    }
    if (muku && muku.found && muku.details && muku.details.length) warns.push(`命带墓库——开库得财时易伴官非暗疾，见好就收`)
    if (!warns.length) warns.push('命局无重大风险点，正常生活即可。')
    return { tag: `${warns.length} 项`, desc: warns.join('；') + '。' }
  })()


  // ============ V12.0 前置数据：新增卷目所需 ============
  const benXiang = benXiangTables(m, bazi)
  const xiuZheng = xiuZhengDingLun(m, genji)
  const binZhu = binZhuFour(m, bazi)
  const kongTriple = kongWangTriple(m, bazi)
  const charPortrait = characterPortrait(m, bazi)
  const kouJue = coreKouJue(m, pre, genji)
  const naYinReso = naYinGongZhen(m)
  const zuoVisual = zuoGongVisual(m)
  // 卷首基础数据（含盲派备注列）
  // 注意：pre.ganKe 在 mangpai.js 里是字符串数组（如 "日主克年柱乙（木）"），
  // 不是对象数组 —— 旧代码按 {from,to,action} 取值导致 "undefined→undefined：undefined"。
  // 兼容两种形态：字符串直接用，对象才走 from→to：action 模板。
  // naYinReso（第四卷·纳音共振）等变量在卷内多处引用，保留计算
  const ganKeStr = ganKe.length
    ? ganKe.map(g => typeof g === 'string' ? g : `${g.from}→${g.to}：${g.action}`).join('；')
    : '四干相安'
  const tiDist = ty.tiCount
    ? Object.entries(ty.tiCount).filter(([, v]) => v > 0).map(([k, v]) => `${k}${v}`).join('·')
    : ''
  const tiTotal = ty.tiCount ? Object.values(ty.tiCount).reduce((a, b) => a + b, 0) : 0
  const kongZhu = (m.pillars || []).filter(p => pre.dayKong && pre.dayKong.includes(p.zhi)).map(p => p.name).join('、') || '（旬空落于年/时）'
  const baseRows = [
    ['八字', pillarsChars(bazi).join(' '), `${dayGan}日主 · ${m.dayWx}命`, '日主五行确立全局主基调'],
    ['日主空亡', dayKong === '无' ? '未落空亡' : `旬空${dayKong}`, kongZhu, pre.dayKong && pre.dayKong.length ? '空亡填实之年发力，应期见第六卷' : '日主本身不空，状态稳定'],
    ['做功取用', ty.yong ? `以${yongTens(ty.yong)}为用` : '依局取用', ty.ti && ty.ti.length ? `体神${ty.ti.length}位` : '体用随局', '取财官为用，以体生用，做功成格'],
    ['体用关系', tiDist || '体神均衡', tiTotal ? `体神${tiTotal}处` : '体用均匀', '冲合穿刑见第九卷'],
    ['干支相克', ganKeStr, ganKe.length ? `${ganKe.length}组天干相克` : '四干相安', '发动防官非'],
    ['刑冲破害', shangmen.length ? shangmen.map(s => s.name).join('、') : '无', shangmen.length ? `${shangmen.length}组冲刑` : '格局清净', shangmen.length ? '发动防官非，见第九卷' : '无冲刑暗损'],
  ]
  const shangmenRows = shangmen.map(s => ['刑冲破害·' + s.name, s.desc])

  // 第六卷·空亡与神煞应期密钥：神煞做成小方块卡片，按吉凶标色
  const shenToneMap = {
    '禄神':     { hit: 'good', miss: 'bad'  },
    '天乙贵人': { hit: 'good', miss: 'bad'  },
    '华盖':     { hit: 'good', miss: 'bad'  },
    '桃花':     { hit: 'bad',  miss: 'good' },
    '驿马':     { hit: 'bad',  miss: 'good' },
  }
  // 神煞卡：只展示命中的神煞——八字没有的缺失项不上页面（"缺失"也是非该命信息）
  const shenItems = (m.shensha || [])
    .filter(s => s.found)
    .map(s => {
      const t = shenToneMap[s.name] || { hit: 'bad', miss: 'good' }
      return {
        name: s.name,
        tag: '命中',
        tone: t.hit,
        desc: s.pos ? `${s.pos}：${s.note}` : s.note,
      }
    })
  // 刑冲破害（伤门）：命中项全是应事隐患，统一标"命中/凶"；只在有命中时生成卡片
  const shangItems = shangmen.map(s => ({
    name: s.name,
    tag: '命中',
    tone: 'bad',
    desc: s.desc,
  }))

  const sections = [
    {
      key: 'pre', title: '卷首·超精微命局基础数据', kind: 'table',
      data: { headers: ['项目', '数值', '状态', '盲派备注'], rows: baseRows, className: 'br-table-kpi' },
      note: (() => {
        const main = firstFound(pre, ['P0', 'P1', 'P2', 'P3']) || '原局相对平静，动静待岁运引动'
        // 核心矛盾 / 总纲定性已点出，下方表格只补充主基调，不再罗列具体矛盾（避免重复）
        return `先给你一句总评：${taijiPlain(pre.conclusion)}这就是你命局的"主基调"。其中特别要留意的是——${main}，顺着它发力事半功倍，硬要逆着来容易事倍功半。`
      })(),
    },
    {
      key: 'benxiang', title: '第一卷·天干地文本象（定性情与材质）', kind: 'table',
      data: { headers: ['柱', '天干', '五行', '本象', '在局状态', '性情影响'], rows: benXiang.ganRows },
      note: (() => {
        const dayWx = m.dayWx
        // 4 条天干"在局状态 + 性情影响"已完整呈现在下方四行表里，note 不再罗列避免重复；
        // 只留一句全局视角："日主是火全局以火之性情为底色"
        return `从"干"上看，日主${dayGan}${MP_TIANGAN_BENXIANG[dayGan] ? '（' + MP_TIANGAN_BENXIANG[dayGan] + '）' : ''}是最底色的一层，看人看事带着${dayWxChar(dayWx)}的味道——全局以${dayWx}之性情为底色，其他三干各司其职，详见下方表。`
      })(),
    },
    {
      key: 'dizhi', title: '第一卷·续 地支小表（宫位职司与全局定位）', kind: 'table',
      data: { headers: ['柱', '地支', '五行', '本象', '藏干', '宫位职司', '全局定位'], rows: benXiang.zhiRows },
      note: (() => {
        // 4 条宫位职司/全局定位已完整呈现在下方 4 行表里，note 不再罗列避免重复；
        // 只留一句视角判断（"暗藏的力量"）作为补充
        return `地支藏干${benXiang.zhiRows.map(r => r[4]).filter(Boolean).join('、')}是暗藏的力量——看命不能只看天干表面，地支里藏的人事物、关系网才是真正"干实事"的底层结构。`
      })(),
    },
    {
      key: 'genji', title: '第二卷·寻根基与通根距离量化（辨虚实真伪）', kind: 'table',
      data: { headers: ['柱', '天干', '坐支', '通根路径', '距离档位', '有效距离系数', '虚实判定'], rows: (m.tonggen || []).map(t => [t.pos, t.gan, t.zhi, t.roots || '无根', { 日柱: '坐支贴身', 月柱: '邻柱贴近', 时柱: '隔柱稍远', 年柱: '遥根最远' }[t.pos] || '别柱', t.coeff ? t.coeff + '%' : '无根', t.virtual]) },
      note: (() => {
        // 结构化分段：底子→借势→补校；分号切分让 BrNote 自动按行渲染
        const baseLevel = genji.total >= 8 ? '高' : genji.total >= 4 ? '中' : '低'
        const tone = genji.total >= 8 ? '自己为主、能撑局面' : genji.total >= 4 ? '自己为主、遇事借力' : '借势为主、不可硬刚'
        // 去掉结论里已由【底子】涵盖的"<level>（…），"前缀，避免重复
        const borrow = genji.conclusion.replace(new RegExp(`^${genji.level}（[^）]+），\\s*`), '')
        const parts = [
          `**【底子】** ${baseLevel}（${genji.total}分，${genji.level}），${tone}`,
          `**【借势】** ${borrow}`,
        ]
        // sub 自身去末尾句号，外层统一加句号收尾
        const subParts = xiuZheng.map((p, i) => `**【补校${i + 1}】** ${p.sub.replace(/[。.]$/, '')}`)
        return [...parts, ...subParts].join('；') + '。'
      })(),
    },
    {
      key: 'binzhu', title: '第三卷·四重宾主与体用深度嵌套', kind: 'palaceGrid',
      data: { items: binZhu.layers.map(l => ({ name: l.name, tag: l.target, desc: l.desc })), cols: 2 },
      note: (() => {
        // 各重与体用归属已完整呈现在下方 4 张宫位卡（第一重～第四重），note 不再复述名目避免重复
        return `从宾主关系看，你命中四柱层层嵌套——核心是${binZhu.layers[0] ? binZhu.layers[0].name : '内围'}，越往里越贴身、越是你真正靠得住的力量。事业上按这个层次分清主次，主位有力就主攻、主位弱就借外围。`
      })(),
    },
    {
      key: 'shi', title: '第四卷·势·气象与制度层级', kind: 'palaceGrid',
      data: (() => {
        const items = [
          {
            name: '做功级别（势）', tag: zuo.xiaoLv.grade + '级',
            desc: `你的命属「${zuo.xiaoLv.grade}级${zuo.xiaoLv.grade === 'S' ? '（能赚大钱的命格）' : zuo.xiaoLv.grade === 'A' ? '（能拿大头的命格）' : zuo.xiaoLv.grade === 'B' ? '（中富格局）' : '（温饱格局）'}」——${zuo.xiaoLv.grade === 'S' || zuo.xiaoLv.grade === 'A' ? '财路开得大、效率高，把握住了能挣大钱' : zuo.xiaoLv.grade === 'B' ? '赚得到钱、但有天花板，求稳更顺' : '先求立足再图发展'}。`,
            tone: zuo.xiaoLv.grade === 'S' || zuo.xiaoLv.grade === 'A' ? 'good' : zuo.xiaoLv.grade === 'C' ? 'bad' : undefined,
          },
          { name: '富贵层级（气象）', tag: wealthNote.level, desc: wealthNote.level === 'A级' ? '能大富大贵，别把自己看小了。' : wealthNote.level === 'B级偏上' ? '家底厚一层，靠本事吃饭还能再上台阶。' : wealthNote.level === 'B级' ? '小富小康，求稳则富、贪进则险。' : '温饱平顺，先求立足再图发展。' },
          { name: '纳音共振', tag: naYinReso.rows.length ? `${naYinReso.rows.length}处` : '无', desc: naYinReso.rows.length ? `从纳音看，${naYinReso.rows.map(r => r[2]).join('；')}——这几处纳音同类，能量能互相接续，做事连贯、不易断档。` : '纳音层面没有明显同类呼应，主要能量看正五行。' },
          { name: '流年主要趋势', tag: dayunTrend.tag, desc: dayunTrend.desc, tone: /上升|先稳后升/.test(dayunTrend.tag) ? 'good' : /下行/.test(dayunTrend.tag) ? 'bad' : undefined },
          { name: '注意事项', tag: warnItem.tag, desc: warnItem.desc, tone: /[2-9] 项/.test(warnItem.tag) ? 'bad' : undefined },
          { name: '墓库开合', tag: muku.found ? '有库' : '无库', desc: muku.found ? `你命里带墓库（${(muku.kuZhi || []).join('、')}），${muku.details.map(d => d.desc).join('；')}——逢开库年份能得偏财，但多半带点代价，见好就收。` : muku.conclusion, tone: muku.found ? 'good' : undefined },
        ]
        return { items, cols: 2 }
      })(),
      note: (() => {
        return `这一卷看"势""气象"与"制度层级"：你的命局是「${zuo.xiaoLv.grade}级」+「${wealthNote.level}」，大运走势「${dayunTrend.tag}」，纳音${naYinReso.rows.length ? '有' + naYinReso.rows.length + '处共振，做事连贯' : '无共振，靠正五行'}，还带${warnItem.tag.split(' ')[0]}个风险点${muku.found ? '和墓库、逢开库年份能得偏财' : ''}——具体看下方卡片。`
      })(),
    },
    {
      key: 'zuogong', title: '第五卷·做功系统终极拆解', kind: 'palaceGrid',
      data: { items: zuoGongCards.length ? zuoGongCards : [{ name: '做功', tag: '原局无显', desc: '原局无明显做功组合，逢岁运引动方显。' }], cols: 2 },
      note: (() => {
        const gong = zuoVisual.gong || []
        const target = zuoVisual.target || []
        const act = zuoVisual.rows.filter(r => r.exists)
        const chain = zuoVisual.chain || []
        const main = zuoGongCards && zuoGongCards[0] && zuoGongCards[0].name !== '做功' ? zuoGongCards[0] : null
        const works = zuoVisual.rows.filter(r => r.exists).map(r => r.name).join('、')
        return main ? `你命里的核心"发力方式"是「${main.name}」，生效的有 ${act.length} 种（${works}）。主功神在${gong.map(s => s.char).join('、') || '日支'}，帮你把${target.map(s => s.char).join('、') || '财官'}取回来；链条是：${chain.length ? chain[chain.length - 1].replace(/【收获端】/, '') : ''}。这就是你吃饭的本事，往这个方向靠越干越顺。` : '你原局没有现成的发力组合，属于"蓄势型"——机会要靠大运流年引动，见后面第七卷的关键年份再果断出手。'
      })(),
    },
    {
      key: 'zuofa', title: '第五卷·续 做功十二法全筛查', kind: 'table',
      // 本八字没有的做功方式直接不显示，避免出现 ❌ 与"—"空行——只展示真正生效的做功
      data: { className: 'br-table-zuofa', headers: ['做功方式', '具体表现', '效率'], rows: (m.zuoFull && m.zuoFull.rows || []).filter(r => r.exists).map(r => [r.name, r.detail, '★'.repeat(Math.max(1, Math.min(5, r.stars)))]) },
      note: (() => {
        const act = (m.zuoFull && m.zuoFull.rows || []).filter(r => r.exists)
        const gong = (zuoVisual.gong || []).map(s => s.char + (s.note ? '（' + s.note + '）' : '')).join('、') || '日支'
        const target = (zuoVisual.target || []).map(s => s.char).join('、') || '财官'
        return `全筛查下来，你的命里真正生效的做功方式有 ${act.length} 种（${act.map(r => r.name).slice(0, 3).join('、')}），主力已标 ★。主功神在${gong}，帮你把${target}取回来；未列出的就是"用不上"，不用管它。`
      })(),
    },
    // 第六卷·空亡与神煞应期密钥 —— 神煞做成小方块卡片，与空亡命中卡片一起展示
    {
      key: 'kongwang', title: '第六卷·空亡与神煞应期密钥', kind: 'palaceGrid',
      // 空亡命中维度 + 命中的神煞（八字没有的缺失项不展示）+ 重点流月（合穿冲/填实/应期/动荡/用神到位/比劫分财）均做成小方块卡片
      data: {
        items: [
          ...kongTriple.filter(k => k.hit).map(k => ({ name: k.name, tag: '命中', desc: k.desc, tone: 'bad' })),
          ...shenItems,
          ...shangItems,
          // 重点流月：吉凶翻倍（空亡填实 / 冲穿日支 / 流年应期 / 流年动荡 / 年事应期）的月份用 mark='重点' 触发橙色高亮
          ...monthDeepRows
            .filter(r => /合|穿|冲|填实|应期|动荡/.test(r.evt))
            .map(r => ({ name: `${r.m}·${r.gz}`, tag: '重点月份', mark: '重点', desc: r.evt })),
        ],
        cols: 2,
      },
      note: (() => {
        const hit = kongTriple.filter(k => k.hit)
        // 空亡 留文本；神煞/刑冲破害/重点流月已上移为小方块卡片，此处不再列文本
        const parts = []
        if (hit.length) parts.push(`命中${hit.map(k => k.name).join('、')}`)
        if (shangItems.length) parts.push(`带${shangItems.map(s => s.name).join('、')}`)
        const monthCount = monthDeepRows.filter(r => /合|穿|冲|填实|应期|动荡/.test(r.evt)).length
        if (!parts.length && !monthCount) return '无空亡与冲刑暗损命中，格局清静。'
        let txt = ''
        if (parts.length) txt = `${parts.join('，')}。大运/流年走到该位或填实之月容易应事`
        if (monthCount) txt += `${parts.length ? '；' : '。'}下方橙色高亮的 ${monthCount} 张为重点月份`
        return txt + '。'
      })(),
    },
    {
      key: 'dayun', title: '第七卷·大运流年起承应期', kind: 'dayunGroup',
      data: {
        dayuns: dayunCards,
        liunianRows: (liunianRows || []).filter(r => r[0] && r[2]).slice(0, 4),
      },
      // 重点大运直接在大运卡片内高亮（mark 徽章 + tone 高亮），不再另起一组重复卡片
      note: '每张大运卡都是一个十年窗口；其中标「做功目标到位 / 比劫当旺」的就是你要盯紧的重点大运，其余是平运节奏、稳扎稳打即可。',
    },
    {
      key: 'xiangfa', title: '第八卷·全息象法映射（职业/六亲/健康/性格）', kind: 'palaceGrid',
      data: { items: [...xiangfaCards, { name: '性格终极画像', tag: `${dayGan}${m.dayWx}命`, desc: charPortrait.summary, wide: true }], cols: 2 },
      note: (() => {
        // 简短总览：仅列出本卷几张卡的名称，不再拼接卡片内容
        // （详细象法描述已在下方宫位卡中铺开，避免一处文字在 note 和卡片里重复两次）
        return xiangfaCards.length ? `你这辈子的方向都画出来了：${xiangfaCards.map(c => c.name).join('、')}，外加「性格终极画像」——事业走哪行、家里靠谁、身体注意啥，详细见下方卡片。照着走财源就稳。` : `性格上：${charPortrait.summary}目前命里没有明显取象，属于"财随运走"，大运流年带财星到位时该出手就出手。`
      })(),
    },
    {
      key: 'shangmen', title: '第九卷·特殊盲派技法深度应用（换象/逢冲与断体/死活）', kind: 'kv',
      data: { items: shangmen.length ? shangmen.map(s => ({ k: s.name, v: s.desc, tone: 'bad' })) : [{ k: '命局清净', v: '无特殊刑冲破害组合，技法上无重点断体对象。' }] },
      note: (() => {
        const names = shangmen.map(s => s.name).join('、')
        const hasZhi = shangmen.some(s => /有制|可制|被合|有解/.test(s.desc))
        return names ? `你命里带 ${names} 这些冲刑组合，${hasZhi ? '好在有"管得住"的力量，逢这类年份发动反而容易变机遇，可积极把握' : '发动时容易带来官非、纠纷或健康问题，逢相关年份要多加小心'}。这就是盲派"逢冲与断体"的技法——有制则活、无制则死，逐月应事见下方逐月防御清单。` : '命局清净，无特殊断体对象，正常过日子即可。'
      })(),
    },
    {
      key: 'yueying', title: '第九卷·续 当月逐月防御清单', kind: 'table',
      data: { headers: ['月份', '月干支', '与日主·流年关系'], rows: monthDeepRows.map(r => [r.m, r.gz, r.evt]) },
      note: (() => {
        // 不再罗列月份（避免与下方表格重复），只留一句行动节奏 + 一句话提示
        const important = monthDeepRows.filter(r => /合|穿|冲|填实|应期|动荡/.test(r.evt)).length
        const yong = monthDeepRows.filter(r => /利·目标到位/.test(r.evt)).length
        if (!important && !yong) return `【${curYear} 年逐月提示】全年节奏相对平稳，没有明显的刑冲破害应期，按部就班即可。逐月十神细节见下方表格。`
        const a = important ? `本年有 ${important} 个月容易踩节奏（合穿冲、空亡填实、流年应期），吉凶都翻倍。` : ''
        const b = yong ? `另有 ${yong} 个月财官目标到位，可主动出击。` : ''
        return `【${curYear} 年逐月提示】${a}${b}具体哪几个月、对应什么十神，见下方表格逐行看即可。`
      })(),
    },
    {
      key: 'yearroute', title: `第十卷·终极行动路线图（${nextYun.start}-${nextYun.end}）`, kind: 'table',
      // 表中已精简为 5 列：年份 / 干支 / 流年引动 / 风险 / 核心动作（删除了"定性/角色/绝对禁忌"三列 —— 这三列内容是核心动作的同义反复/通用化补语，放在表里与"核心动作"重复表达）
      data: { headers: ['年份', '干支', '流年引动', '风险', '核心动作'], rows: yearRouteRows.map(r => [r.year, r.gz, r.yinDong, r.risk, r.act]) },
      note: (() => {
        const high = yearRouteRows.filter(r => /⚠️⚠️⚠️⚠️/.test(r.risk) && !/⚠️⚠️⚠️⚠️⚠️/.test(r.risk))
        const max = yearRouteRows.filter(r => /⚠️⚠️⚠️⚠️⚠️/.test(r.risk))
        const top = max.length ? max : high
        // 逐年路线（含警戒年份、核心动作）已完整呈现在下方逐年表里，note 只提炼最要拎清的警戒年份
        return top.length ? `下表逐年列出未来 ${yearRouteRows.length} 年（${nextYun.ganZhi}运）的核心动作；标⚠️最多的年份是重点风险点（执行细则见表中该行）。` : `下表逐年列出未来 ${yearRouteRows.length} 年（${nextYun.ganZhi}运）的核心动作，按表照做即可。`
      })(),
    },
    {
      key: 'dinglun', title: '终章·总断与核心口诀', kind: 'palaceGrid',
      // 核心口诀已并入"命局总评"卡（作为结语口诀），避免两张卡内容重复
      // 终章 4 张宫位卡布局：第 1 行 = 功神 + 废神（用神论的两端），第 2 行 = 病神 + 命局总评（问题与总结）
      data: {
        items: [
          sanGangItems[0], // 功神
          sanGangItems[2], // 废神
          sanGangItems[1], // 病神
          { name: '命局总评 · 核心口诀', tag: '总断', desc: `${conclusionNote}\n\n**【核心口诀】** ${kouJue}` },
        ],
        cols: 2,
      },
      note: (() => {
        // 总断已在下方 4 张宫位卡（三纲 + 命局总评·核心口诀）完整呈现，note 不再罗列做功/用神/空亡等基础要素
        // 避免与下方卡片重复
        return `${heartNote}平时做事记住：该借力就借力、有坑就绕开、有禁忌就守住，日子自然越走越顺。`
      })(),
    },
  ]

  const advice = mangpaiAdvice(m)
  return makeReport('mangpai', {
    sub: `${chart.year}年${chart.month}月${chart.day}日${chart.hour ?? ''}时 · ${chart.gender === '女' ? '坤造' : '乾造'} · ${bazi.生肖}肖`,
    hero: { chars: pillarsChars(bazi), main: `日主 <b>${bazi.日主}</b>（${m.dayWx}） · 根基 ${genji.total} 分 · ${zuo.xiaoLv.grade}级效率 · ${wealthNote.level}` },
    meta: {
      dayGan: bazi.日主, dayWx: m.dayWx,
      genJiScore: genji.total, grade: zuo.xiaoLv.grade,
      mainWork: zuo.main ? zuo.main.name : '',
      kongWang: pre.dayKong.join('、'),
      wealthLevel: wealthNote.level,
    },
    sections,
    advice,
  })
}

// 去掉字符串结尾的标点（用于列表拼接，避免"。。""。、")
function trimDot(s) {
  return (s || '').replace(/[。！？，、；：\s]+$/, '')
}

// 用神 → 十神名（去重，去掉干支只留十神名，讲人话）
function yongTens(yong) {
  const tens = (yong || []).map(y => {
    const m = y.match(/\(([^)]+)\)/)
    return m ? m[1] : y
  })
  return [...new Set(tens)].slice(0, 2).join('、') || '财官'
}

// 盲派四柱大字（复用 baziReport 的柱解析）
function pillarsChars(bazi) {
  const rows = []
  for (const k of ['年柱', '月柱', '日柱', '时柱']) {
    const p = bazi[k]
    if (!p) continue
    rows.push(`${p.天干.天干}${p.地支.地支}`)
  }
  return rows
}

// ============ 盲派报告辅助函数 ============

// 干支五行 / 生克表（本地常量，避免依赖内部）
const MP_GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' }
const MP_ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' }
// 地支藏干（本气/中气/余气）
const MP_ZHI_CANG = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
}
// 地支六合 / 相冲 / 相害（用于分目标评级时判断被谁制）
const MP_ZHI_LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' }
const MP_ZHI_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' }
const MP_ZHI_HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' }
// 天干相克（干 A 克干 B：克我的为官杀，我克的为财）
const MP_GAN_KE = {
  甲: ['戊', '己'], 乙: ['戊', '己'], 丙: ['庚', '辛'], 丁: ['庚', '辛'],
  戊: ['壬', '癸'], 己: ['壬', '癸'], 庚: ['甲', '乙'], 辛: ['甲', '乙'],
  壬: ['丙', '丁'], 癸: ['丙', '丁'],
}
const MP_XUN = { 甲子: '甲子旬', 甲戌: '甲戌旬', 甲申: '甲申旬', 甲午: '甲午旬', 甲辰: '甲辰旬', 甲寅: '甲寅旬' }
const MP_GAN_HE = { 甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火' }

// 旬名（甲子/甲戌/甲申/甲午/甲辰/甲寅）
function kongXunName(gan, zhi) {
  const seq = (g, z) => {
    const G = '甲乙丙丁戊己庚辛壬癸', Z = '子丑寅卯辰巳午未申酉戌亥'
    for (let n = 0; n < 60; n++) if (G[n % 10] === g && Z[n % 12] === z) return n
    return 0
  }
  const s = seq(gan, zhi)
  const base = Math.floor(s / 10) * 10
  const names = ['甲子旬', '甲戌旬', '甲申旬', '甲午旬', '甲辰旬', '甲寅旬']
  return names[base / 10]
}

// 找到第一个命中的预处理项文字
function firstFound(pre, keys) {
  for (const k of keys) {
    const r = pre.results.find(x => x.key === k)
    if (r && r.found && r.detail.length) return r.detail[0]
  }
  return ''
}

// 除第一项外其余命中的预处理项文字
function restFound(pre, keys) {
  const out = []
  let first = true
  for (const k of keys) {
    const r = pre.results.find(x => x.key === k)
    if (r && r.found && r.detail.length) {
      for (const d of r.detail) {
        if (first) { first = false; continue }
        out.push(d)
      }
    }
  }
  return out.join('；')
}

// 模块二：宾主体用表格行（位置/天干/十神/体用/主宾/根气）
function pillarTenRows(m) {
  const posMap = { 年柱: '宾', 月柱: '宾', 日柱: '主', 时柱: '主' }
  const tenList = m.tenList || []
  // 以天干透干十神为准，补 p.ten 缺失
  const tenByPos = {}
  for (const t of tenList) {
    if (t.depth === '天干') tenByPos[t.pos] = t.ten
  }
  return m.pillars.map(p => {
    const isDay = p.name === '日柱'
    const ten = isDay ? '日主' : (tenByPos[p.name] || p.ten || '')
    const zhiCang = (MP_ZHI_CANG[p.zhi] || []).join('/')
    const root = pillarRoot(m, p)
    const bodyUse = isDay ? '体' : tenUse(ten, m)
    return [p.name, p.gan, p.zhi, zhiCang, ten, bodyUse, posMap[p.name] || '宾', root]
  })
}

// 天干属于体还是用：体=印/比劫/食伤（生助日主、耗泄者属体之技术），用=财官（目标）
function tenUse(ten, m) {
  if (!ten) return '体'
  if (['正财', '偏财', '正官', '七杀'].includes(ten)) return '用'
  return '体'
}

// 根基气：看地支藏干与本柱天干/日主关系（简化：根型）
function pillarRoot(m, p) {
  const zhi = p.zhi
  const zhiWx = MP_ZHI_WX[zhi] || ''
  const ganWx = MP_GAN_WX[p.gan] || ''
  // 本气通根
  if (zhiWx === ganWx) return `${zhi}${zhiWx}本气根`
  // 墓库
  if (['辰', '戌', '丑', '未'].includes(zhi)) return `${zhi}${zhiWx}（库）`
  // 生我之根（印）或我生（食伤）均可作根
  return `${zhi}${zhiWx}根`
}

// ============ 分目标评级（V12.0 第六卷：制尽效率与层级精确定位） ============
// 对每个用神目标（财/官/杀）逐一评级：目标 → 根气 → 被谁制 → 制的方式 → 制尽率 → 评级
// 最终综合出做功级别，把"怎么得出 S/A/B/C"讲清楚
function targetGradeRates(m, genji) {
  const dayGan = m.dayGan
  const dayWx = m.dayWx
  const pillars = m.pillars
  const zhiSet = pillars.map(p => p.zhi)
  const tenList = m.tenList || []
  // 用神目标候选：透干用神（财/官/杀）+ 地支本气用神
  const yongTenMap = { 正财: '财', 偏财: '财', 正官: '官', 七杀: '杀', 正印: '印', 偏印: '印' }
  const targets = []
  const seen = {}
  // ① 天干透出的用神
  for (const t of tenList) {
    if (t.depth !== '天干') continue
    if (t.ten === '日主') continue
    if (!yongTenMap[t.ten]) continue
    if (seen[t.ten]) continue
    seen[t.ten] = true
    targets.push({ ten: t.ten, group: yongTenMap[t.ten], char: t.char, pos: t.pos, from: '透干' })
  }
  // ② 若透干用神不足，补充地支本气用神
  if (targets.length < 2) {
    for (const t of tenList) {
      if (t.depth !== '本气') continue
      if (t.ten === '日主') continue
      if (!yongTenMap[t.ten]) continue
      if (seen[t.ten]) continue
      seen[t.ten] = true
      targets.push({ ten: t.ten, group: yongTenMap[t.ten], char: t.char, pos: t.pos, from: '藏支' })
    }
  }
  // 评级（V12.0 校准：库根目标若库门被冲开 → 「待冲开库」提级）
  const genjiLevel = genji.level // 体强/体平/体虚
  const main = m.zuo.main ? m.zuo.main.name : '制'
  const kaiKu = !!(m.zuo && m.zuo.kaiKu) // 库门是否被冲/穿开
  return targets.map(t => {
    // 根气：目标之根是否在天干/地支有根（同五行藏干）
    const wx = MP_GAN_WX[t.char] || ''
    const hasRoot = zhiSet.some(z => (MP_ZHI_CANG[z] || []).includes(t.char) || (MP_ZHI_CANG[z] || [])[0] === wx)
    // 根是否落在墓库（财/官库根）
    const rootInKu = zhiSet.some(z => '辰戌丑未'.includes(z) && ((MP_ZHI_CANG[z] || []).includes(t.char) || (MP_ZHI_CANG[z] || [])[0] === wx))
    // 被谁制：找克制该目标的天干（克我/我克方向），及合冲穿
    const zhiBeKe = (MP_GAN_KE[t.char] || [])
    const keTarget = pillars.filter(p => zhiBeKe.includes(p.gan)).map(p => p.gan + p.name)
    const heZhi = MP_ZHI_LIUHE[t.char]
    const chongZhi = MP_ZHI_CHONG[t.char]
    let zhiZuo = []
    if (heZhi && zhiSet.includes(heZhi)) zhiZuo.push(`${heZhi}合`)
    if (chongZhi && zhiSet.includes(chongZhi)) zhiZuo.push(`${chongZhi}冲`)
    for (const z of zhiSet) { if (MP_ZHI_HAI[z] === t.char) zhiZuo.push(`${z}穿`) }
    const beZhi = [...new Set([...keTarget, ...zhiZuo])]
    // 制尽率估算
    const isXuTou = t.from === '透干' && !hasRoot
    let rate, grade, gradeNote
    if (kaiKu && rootInKu && genjiLevel !== '体虚') {
      // V12.0：库根目标被冲开 → 原本「闭锁」转为「开库可取」，提级
      rate = '70%'; grade = 'A'; gradeNote = '库根被冲开（开库取物），虽制不尽但取大头，冲库之年可全收'
    } else if (isXuTou && genjiLevel === '体强' && (main === '制' || main === '冲')) {
      rate = '100%'; grade = 'S'; gradeNote = '虚透无根，被彻底制服 → 制尽，效率100%'
    } else if (hasRoot && genjiLevel === '体强') {
      rate = '70%'; grade = 'A'; gradeNote = '有中气根，体强能压制住 → 制不尽但拿大头'
    } else if (hasRoot && genjiLevel === '体平') {
      rate = '50%'; grade = 'B'; gradeNote = '有强根，体只能压制一半 → 有天花板，伴随竞争'
    } else if (genjiLevel === '体虚') {
      rate = '20%'; grade = 'C'; gradeNote = '体虚或被反制 → 做功效率低下'
    } else if (isXuTou) {
      rate = '40%'; grade = 'B'; gradeNote = '虚透但体不强，制不尽 → 总有漏财'
    } else {
      rate = '60%'; grade = 'B'; gradeNote = '常规格局，稳中求进'
    }
    return { ...t, hasRoot, rootInKu, isXuTou, beZhi, rate, grade, gradeNote }
  })
}

// 模块二：定性结论文案
function tiYongConclusion(m) {
  const zhu = m.ty.zhu || ''
  const bin = m.ty.bin || ''
  const zhuWork = m.ty.ti.filter(t => /比肩|劫财/.test(t)).length
  const binWork = m.ty.yong.length
  const segs = [`体在${m.ty.ti.length ? '多位' : '弱位'}，用在${m.ty.yong.length ? '宾位' : '弱位'}，主位（${zhu}）偏静，宾位（${bin}）主动`]
  if (binWork && zhuWork <= 1) segs.push('是"借势型"格局，靠宾位伤官生财取用，非独立创业型')
  else if (zhuWork >= 2) segs.push('主位比劫当旺，可独立担当，属"自力型"格局')
  else segs.push('体用分明，各安其位')
  if (m.ty.feiGong && m.ty.feiGong.length) segs.push('飞宫换象：' + m.ty.feiGong[0])
  return segs.join('。') + '。'
}


// 模块四：富贵三档
function wealthLevel(m, genji) {
  const grade = m.zuo.xiaoLv.grade
  const g = genji.total
  let level, desc
  if (g >= 8 && grade === 'S') { level = 'A级'; desc = '大富大贵：体强功显，能独立执掌全局，主位有力、用神得力，可承大事。' }
  else if (g >= 5 && grade !== 'C') { level = 'B级偏上'; desc = '中富偏上：比普通小富高一档，靠才华和技术赚钱，不是权力型大富，但家底殷实；逢旺财大运还能再往上走。' }
  else if (g >= 4) { level = 'B级'; desc = '小富小康：根基平正，能借势而行，一生求稳则富，贪进则险。' }
  else if (g >= 2) { level = 'C级偏上'; desc = '温饱平顺：体偏弱，宜顺势而为，先求立足再图发展，切忌逆势冒进。' }
  else { level = 'C级'; desc = '体虚难扛，宜借势顺势、稳住根基，逢应期再发力，人生以安稳为先。' }
  return { level, desc }
}

// 模块六：大运逐运详解
function dayunDetailList(bazi, m) {
  const yun = (bazi.大运 && bazi.大运.大运) || []
  if (!yun.length) return [{ name: '大运', tag: '无', desc: '暂无大运信息。' }]
  const dayWx = m.dayWx
  // ty.yong 元素形如 '甲(正财)'：取天干字符映射五行，用于"用神到位"判断（原实现取天干直接比五行，永不命中）
  const yongSet = (m.ty.yong || []).map(y => MP_GAN_WX[(y.match(/^[甲乙丙丁戊己庚辛壬癸]/) || [])[0]] || '').filter(Boolean)
  return yun.map(d => {
    const gz = d.干支 || ''
    const gan = gz[0] || ''
    const ganWx = MP_GAN_WX[gan] || ''
    const ten = d.天干十神 || ''
    const cur = d.开始年份 && d.开始年份 <= currentY() && d.结束 >= currentY()
    // 大运干支与日主冲合
    let note = `${d.开始年份}-${d.结束} · ${d.开始年龄}-${d.结束年龄}岁`
    const tag = `${ten || ''}${gan}`
    // 重点标记：用神到位 / 比劫当旺（与 keyNodeList 同一套判断，避免另起一组重复卡）
    const key = yongSet.includes(ganWx) ? '做功目标到位' : (ganWx === dayWx ? '比劫当旺' : '')
    // 简断（讲人话）
    let brief = '这步运总体平稳，适合守成、攒家底，别乱折腾。'
    if (key === '做功目标到位') brief = `这步运财官目标到位——${ganWx}气当旺，是做功目标兑现的窗口，该主动出击、该要敢要，事业财运都能往上走。`
    else if (key === '比劫当旺') brief = `这步运比劫当旺——人缘旺、合伙办事容易成，适合拉队伍、靠朋友，但要防分财、防竞争，账要算清。`
    else brief = `这步运走的是"平运"——${ten ? ten + '透出' : '五行平稳'}，适合稳扎稳打、修身养性，不宜大动作冒险。`
    return { name: gz, tag: cur ? `${tag}·当前` : tag, sub: note, desc: brief, tone: cur || key ? 'good' : undefined, mark: key || (cur ? '当前' : '') }
  })
}

// 模块七：流年应期展望（未来 8 年）
function liunianForecast(bazi, m, yingqi) {
  const now = currentY()
  const rows = []
  const dayGan = bazi.日主
  const dayZhi = m.pre.dayZhi || ''
  const kong = m.pre.dayKong || []
  for (let y = now; y <= now + 8; y++) {
    const gz = yearGanzhiStr(y)
    const gan = gz[0], zhi = gz[1]
    const ganWx = MP_GAN_WX[gan] || ''
    const yongSet = (m.ty.yong || []).map(x => MP_GAN_WX[(x.match(/^[甲乙丙丁戊己庚辛壬癸]/) || [])[0]] || '').filter(Boolean)
    const evt = []
    // 空亡填实
    if (kong.includes(zhi)) evt.push(`空亡${zhi}填实，${dayGan}主有力，执行力大增`)
    // 与日柱冲合
    const heKey = dayGan + gan
    if (MP_GAN_HE[heKey] || MP_GAN_HE[gan + dayGan]) evt.push(`${gan}合日主${dayGan}，有合作/姻缘之象`)
    // 财官目标到位
    if (yongSet.includes(ganWx)) evt.push(`${ganWx}气当旺，财官之事顺遂`)
    // 冲日支
    if (ZHI_CHONG[dayZhi] === zhi || ZHI_CHONG[zhi] === dayZhi) evt.push(`冲日支${dayZhi}，变动之象`)
    rows.push([String(y), gz, evt.length ? evt.join('；') : '平顺之年，宜守成积累'])
  }
  return rows
}

// 模块七补：逐年深度应期 + 行动路线（V12.0 第八/十一卷）
// 对当前/指定大运的每一年，依据「流年-大运-日柱-空亡-库冲」关系给出定性/风险/动作/禁忌
// 返回逐年数组，供报告「逐年行动路线图」与「庚辰运逐年详解」使用
function yearDeepForecast(bazi, dayZhi, dayKong, ty, dayWx, yunGan, yunZhi, origKu, yunStart, yunEnd) {
  const dayGan = bazi.日主
  const kong = dayKong || []
  const yongSet = (ty && ty.yong || []).map(x => MP_GAN_WX[(x.match(/^[甲乙丙丁戊己庚辛壬癸]/) || [])[0]] || '').filter(Boolean)
  const isKu = z => '辰戌丑未'.includes(z)
  // 库刑关系：丑-戌刑 / 丑-未刑 / 未-戌刑（库刑 → 开库变破库/内耗）
  const kuXingPair = s => (s.includes('丑') && s.includes('戌')) || (s.includes('丑') && s.includes('未')) || (s.includes('未') && s.includes('戌'))
  const rows = []
  for (let y = yunStart; y <= yunEnd; y++) {
    const gz = yearGanzhiStr(y)
    const gan = gz[0], zhi = gz[1]
    const ganWx = MP_GAN_WX[gan] || ''
    const zhiWx = MP_ZHI_WX[zhi] || ''
    const evt = []   // 流年引动
    let ding = '守成' // 定性
    let risk = '⚠️'
    let act = ''
    let taboo = ''
    let role = ''
    // —— 空亡填实（V12.0 第六卷：应期密钥）
    if (kong.includes(zhi)) evt.push(`空亡${zhi}填实（${dayGan}${dayZhi}旬空${kong.join('、')}），${zhiWx}字应事，吉凶翻倍`)
    // —— 与日支冲（变动）
    const chongDay = MP_ZHI_CHONG[dayZhi] === zhi
    if (chongDay) evt.push(`冲日支${dayZhi}（${dayGan}宫动摇），变动/抉择之年`)
    // —— 日主天干合
    if (MP_GAN_HE[dayGan + gan] || MP_GAN_HE[gan + dayGan]) evt.push(`${dayGan}合${gan}，人际/合作牵扯`)
    // —— 库池 = 原局库支 ∪ 大运库支（V12.0：庚辰运「运辰+日辰」双辰冲戌）
    const kuPool = [...new Set([...(origKu || []), ...(yunZhi && isKu(yunZhi) ? [yunZhi] : [])])]
    // —— 库冲：流年库支 冲 库池中任一库（冲开取财 / 双库对冲更烈）
    const zhiIsKu = isKu(zhi)
    let kuChongHit = false, kuChongTarget = ''
    if (zhiIsKu) {
      const chongPair = MP_ZHI_CHONG[zhi]
      if (kuPool.includes(chongPair) || chongPair === dayZhi) {
        kuChongHit = true
        kuChongTarget = (kuPool.includes(chongPair) ? chongPair : dayZhi)
      }
    }
    if (kuChongHit) evt.push(`库支${zhi}冲${kuChongTarget}（库门开合，双库对冲更烈）`)
    // —— 库刑：未戌刑 → 开库启动（偏吉）；丑戌刑/丑未刑 → 破库清账（偏凶，财损内耗）
    let kuPao = false, kuKai = false
    if (zhiIsKu) {
      const xingHits = kuPool.filter(k => k !== zhi && kuXingPair(zhi + k))
      if (xingHits.length) {
        const hasChou = zhi === '丑' || xingHits.some(k => k === '丑')
        const isWeiXu = (zhi === '未' && xingHits.includes('戌')) || (zhi === '戌' && xingHits.includes('未'))
        if (hasChou) {
          kuPao = true // 丑刑 → 破库，财损内耗
          evt.push(`${zhi}刑${xingHits.join('、')}（丑刑破库，财损内耗，清账断舍离）`)
        } else if (isWeiXu) {
          kuKai = true // 未戌刑 → 开库启动
          evt.push(`${zhi}刑${xingHits.join('、')}（未戌刑开库，启动/换赛道之机）`)
        }
      }
    }
    // —— 财官目标到位
    const yongOn = yongSet.includes(ganWx) || yongSet.includes(zhiWx)
    if (yongOn && !kuPao && !kuChongHit) evt.push(`${ganWx || zhiWx}气当旺，财官之事顺遂`)
    // —— 比劫当旺 / 防分财
    const biJie = ganWx === dayWx || (zhiWx === dayWx && (zhi === '子' || zhi === '亥'))
    // —— 伏吟反吟
    const fuyin = gz === `${dayGan}${dayZhi}`

    // ===== 定性 + 风险 + 动作 + 禁忌（V12.0 逐年规则化） =====
    if (kuPao) {
      // 库刑破 → 清账/断舍离高危年（十年内最高危）
      ding = '清账高危'; risk = '⚠️⚠️⚠️⚠️⚠️'
      act = '全面体检、财务审计、断舍离；该补税补税，该分手分手，认亏保命'
      taboo = '不惹官司、不担保、不恋战'
      role = '清道夫'
    } else if (kuKai) {
      // 未戌刑开库 → 启动年（换赛道/签大协议）
      ding = '启动开库'; risk = '⚠️⚠️'
      act = '动起来换赛道，协议必须签死，落袋为安'
      taboo = '别裸辞、别谈感情伤财'
      role = '起跑者'
    } else if (y === yunEnd && (kuChongHit || fuyin || chongDay)) {
      // 大运最后一年 → 收官收手年（平稳交接，勿贪）
      ding = '收官收手'; risk = '⚠️⚠️'
      act = '平稳交接，培养接班人，别贪最后一笔，为养老留德'
      taboo = '不贪最后一分钱、不接超负荷活'
      role = '智者'
    } else if (kuChongHit) {
      // 库冲 → 冲发年（身家翻动）
      const doubleKu = kuPool.length >= 2
      ding = doubleKu ? '冲发顶峰' : '冲发腾挪'
      risk = doubleKu ? '⚠️⚠️⚠️⚠️⚠️' : '⚠️⚠️⚠️⚠️'
      act = '全力冲业绩，赚后及时锁定（黄金/核心房产）；资金紧到崩溃月后必回血'
      taboo = '不恋战、不把利润全滚进去'
      role = doubleKu ? '猎豹' : '猛将'
    } else if (fuyin && yunZhi === zhi) {
      // 大运+流年同支 → 伏吟叠加
      ding = '加倍之年'; risk = '⚠️⚠️⚠️'
      act = '守成，不投新项目，谁敢拉你合伙就拉黑谁'
      taboo = '不扩张、不赌身家'
      role = '石佛'
    } else if (yongOn && !chongDay) {
      ding = '顺势发越'; risk = '⚠️⚠️'
      act = '主动出击，敢要敢拼，接大项目、拿最高资质'
      taboo = '别嫌累、别错过窗口'
      role = '铁人'
    } else if (biJie) {
      ding = '分财防劫'; risk = '⚠️⚠️⚠️'
      act = '盯死账户、减少签约、防下属/客户压价分账'
      taboo = '不签新长期合同、谁拉合伙谁警惕'
      role = '门神'
    } else if (fuyin || chongDay) {
      ding = '变动抉择'; risk = '⚠️⚠️'
      act = '守成镀金、清旧账、查漏补缺，不急扩张'
      taboo = '不激进、不赌身家'
      role = '隐士'
    } else if (kong.includes(zhi)) {
      ding = '应期之年'; risk = '⚠️⚠️'
      act = '借势而为，快进快出，见好就收'
      taboo = '不拖泥带水、不贪'
      role = '守夜人'
    } else {
      ding = '守成积累'; risk = '⚠️'
      act = '稳扎稳打、攒家底、养身体'
      taboo = '不折腾、不冒进'
      role = '石佛'
    }

    rows.push({
      year: String(y), gz,
      yinDong: evt.length ? evt.join('；') : '平顺之年，宜守成积累',
      ding, risk,
      role,
      act, taboo,
    })
  }
  return rows
}

// 当年逐月应期（第九卷·续 逐月防御清单）—— 针对指定年份的逐月
// 月柱推算按"年上起月法"：年干定正月之干（甲己之年丙作首，乙庚之岁戊为头，丙辛之岁寻庚上，
// 丁壬壬寅顺水流，戊癸之年何处起，甲寅之上来追求），月支固定为正月寅、二月卯……十二月丑。
// 应事提示结合 ① 月干 vs 日主十神；② 月干 vs 流年干十神；③ 月支 vs 日支六合/穿/冲；
// ④ 空亡填实；⑤ 库月；⑥ 流月 vs 流年的冲合关系 —— 让提示与本八字和当年流年都挂钩。
function monthDeepForecast(bazi, dayGan, dayZhi, dayKong, year) {
  const YG_TO_MONTH = {
    甲: {1:'丙',2:'丁',3:'戊',4:'己',5:'庚',6:'辛',7:'壬',8:'癸',9:'甲',10:'乙',11:'丙',12:'丁'},
    己: {1:'丙',2:'丁',3:'戊',4:'己',5:'庚',6:'辛',7:'壬',8:'癸',9:'甲',10:'乙',11:'丙',12:'丁'},
    乙: {1:'戊',2:'己',3:'庚',4:'辛',5:'壬',6:'癸',7:'甲',8:'乙',9:'丙',10:'丁',11:'戊',12:'己'},
    庚: {1:'戊',2:'己',3:'庚',4:'辛',5:'壬',6:'癸',7:'甲',8:'乙',9:'丙',10:'丁',11:'戊',12:'己'},
    丙: {1:'庚',2:'辛',3:'壬',4:'癸',5:'甲',6:'乙',7:'丙',8:'丁',9:'戊',10:'己',11:'庚',12:'辛'},
    辛: {1:'庚',2:'辛',3:'壬',4:'癸',5:'甲',6:'乙',7:'丙',8:'丁',9:'戊',10:'己',11:'庚',12:'辛'},
    丁: {1:'壬',2:'癸',3:'甲',4:'乙',5:'丙',6:'丁',7:'戊',8:'己',9:'庚',10:'辛',11:'壬',12:'癸'},
    壬: {1:'壬',2:'癸',3:'甲',4:'乙',5:'丙',6:'丁',7:'戊',8:'己',9:'庚',10:'辛',11:'壬',12:'癸'},
    戊: {1:'甲',2:'乙',3:'丙',4:'丁',5:'戊',6:'己',7:'庚',8:'辛',9:'壬',10:'癸',11:'甲',12:'乙'},
    癸: {1:'甲',2:'乙',3:'丙',4:'丁',5:'戊',6:'己',7:'庚',8:'辛',9:'壬',10:'癸',11:'甲',12:'乙'},
  }
  const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
  // 当年流年干支
  const yIdx = (((year - 4) % 60) + 60) % 60
  const yG = '甲乙丙丁戊己庚辛壬癸'[yIdx % 10]
  const yZ = ZHI[yIdx % 12]

  const monthMap = []
  for (let m = 1; m <= 12; m++) {
    const g = YG_TO_MONTH[yG][m]
    const z = ZHI[(m + 1) % 12]
    monthMap.push({ m, gz: g + z })
  }

  // 十神表：日干对其他干
  const SHISHEN = {
    甲: {甲:'比肩',乙:'劫财',丙:'食神',丁:'伤官',戊:'偏财',己:'正财',庚:'七杀',辛:'正官',壬:'偏印',癸:'正印'},
    乙: {甲:'劫财',乙:'比肩',丙:'伤官',丁:'食神',戊:'正财',己:'偏财',庚:'正官',辛:'七杀',壬:'正印',癸:'偏印'},
    丙: {甲:'偏印',乙:'正印',丙:'比肩',丁:'劫财',戊:'食神',己:'伤官',庚:'偏财',辛:'正财',壬:'七杀',癸:'正官'},
    丁: {甲:'正印',乙:'偏印',丙:'劫财',丁:'比肩',戊:'伤官',己:'食神',庚:'正财',辛:'偏财',壬:'正官',癸:'七杀'},
    戊: {甲:'七杀',乙:'正官',丙:'偏印',丁:'正印',戊:'比肩',己:'劫财',庚:'食神',辛:'伤官',壬:'偏财',癸:'正财'},
    己: {甲:'正官',乙:'七杀',丙:'正印',丁:'偏印',戊:'劫财',己:'比肩',庚:'伤官',辛:'食神',壬:'正财',癸:'偏财'},
    庚: {甲:'偏财',乙:'正财',丙:'七杀',丁:'正官',戊:'偏印',己:'正印',庚:'比肩',辛:'劫财',壬:'食神',癸:'伤官'},
    辛: {甲:'正财',乙:'偏财',丙:'正官',丁:'七杀',戊:'正印',己:'偏印',庚:'劫财',辛:'比肩',壬:'伤官',癸:'食神'},
    壬: {甲:'食神',乙:'伤官',丙:'偏财',丁:'正财',戊:'七杀',己:'正官',庚:'偏印',辛:'正印',壬:'比肩',癸:'劫财'},
    癸: {甲:'伤官',乙:'食神',丙:'正财',丁:'偏财',戊:'正官',己:'七杀',庚:'正印',辛:'偏印',壬:'劫财',癸:'比肩'},
  }

  // 盲派体用定性：用（财官=做功目标）／体（印食伤=手段、比劫=合伙竞争防分财）
  const YONG_TENS = ['正财', '偏财', '正官', '七杀']
  // 体神（食伤/印）在盲派做功里的取向
  const TEN_TONE = { 食神: '助', 伤官: '助', 正印: '护', 偏印: '护' }

  const kong = dayKong || []
  return monthMap.map(({ m, gz }) => {
    const mG = gz[0], mZ = gz[1]
    const evt = []
    // ① 月干对日主的十神（盲派按体用/做功定性）
    const ssDay = dayGan && SHISHEN[dayGan] ? SHISHEN[dayGan][mG] : ''
    if (ssDay) {
      const isUse = YONG_TENS.includes(ssDay)
      const isBi = ssDay === '比肩' || ssDay === '劫财'
      const tone = isUse ? '利·目标到位' : isBi ? '防·比劫分财' : TEN_TONE[ssDay] || ''
      evt.push(`月干${mG}为日主「${ssDay}」${tone ? `（${tone}）` : ''}`)
    }
    // ② 月干对流年干的十神
    if (dayGan && yG !== mG) {
      const ssYear = SHISHEN[dayGan] && SHISHEN[dayGan][yG]
      // 流月与流年的干关系（天干合：甲己/乙庚/丙辛/丁壬/戊癸）
      const HE = [['甲','己'],['乙','庚'],['丙','辛'],['丁','壬'],['戊','癸']]
      const isHe = HE.some(p => (p[0] === mG && p[1] === yG) || (p[1] === mG && p[0] === yG))
      if (isHe) evt.push(`月干${mG}合流年${yG}（年事应期、合动主力）`)
    }
    // ③ 月支 vs 日支（六合/穿/冲）
    if (dayZhi) {
      if (MP_ZHI_LIUHE[dayZhi] === mZ || MP_ZHI_LIUHE[mZ] === dayZhi) evt.push(`日支${dayZhi}合月支${mZ}（身被合/锁定）`)
      if (MP_ZHI_HAI[dayZhi] === mZ || MP_ZHI_HAI[mZ] === dayZhi) evt.push(`月支${mZ}穿日支${dayZhi}（暗损）`)
      if (MP_ZHI_CHONG[dayZhi] === mZ) evt.push(`月支${mZ}冲日支${dayZhi}（剧变）`)
    }
    // ④ 月支 vs 流年支（冲/合）
    if (MP_ZHI_LIUHE[yZ] === mZ || MP_ZHI_LIUHE[mZ] === yZ) evt.push(`月支${mZ}合流年${yZ}（流年应期）`)
    if (MP_ZHI_CHONG[yZ] === mZ) evt.push(`月支${mZ}冲流年${yZ}（流年动荡）`)
    // ⑤ 空亡填实
    if (kong.includes(mZ)) evt.push(`月支${mZ}落日主旬空（填实，应事翻倍）`)
    // ⑥ 库月
    if ('辰戌丑未'.includes(mZ)) evt.push(`${mZ}为库月（库气旺，易引动财官）`)
    return { m: `${m}月`, gz, evt: evt.length ? evt.join('；') : '月令平和，可按部就班', y: year }
  })
}

// ============ V12.0 新增辅助函数（超精微全维精校报告） ============

// 第一卷：天干地文本象表（定性情与材质）
// 天干小表：五行/本象/在局状态/性情影响；地支小表：本象/藏干/宫位职司/全局定位
const MP_TIANGAN_BENXIANG = {
  甲: '参天大树，主刚直向上', 乙: '花草藤蔓，主柔韧依附', 丙: '太阳之火，主光明普照', 丁: '灯烛之火，主柔和明亮',
  戊: '高岗厚土，主稳重承托', 己: '田园之土，主温润包容', 庚: '刀剑之金，主刚锐肃杀', 辛: '珠玉之金，主精致锋锐',
  壬: '江河大水，主奔流灵动', 癸: '雨露之水，主细密润泽',
}
const MP_DIZHI_BENXIANG = {
  子: '墨池之水，为众水汇聚之渊', 丑: '湿土金库，为寒土暗藏之库', 寅: '山林火源，为阳气初生之地', 卯: '花木之象，为草木繁盛之态',
  辰: '水库湿土，为蓄水藏气之库', 巳: '炉冶之火，为火旺升腾之地', 午: '离火正盛，为火烈照人之时', 未: '木库燥土，为藏木蓄气之库',
  申: '顽金坚铁，为金锋初展之地', 酉: '金鸡独立，为至刚至锐之位', 戌: '火库燥土，为藏火焚化之库', 亥: '江河归海，为水聚成势之位',
}
const MP_DIZHI_GONG = { 年柱: '祖上/根基/早年家世', 月柱: '父母/兄弟/青年平台', 日柱: '自身/配偶/中年核心', 时柱: '子女/晚景/归宿之地' }
function benXiangTables(m, bazi) {
  const dayGan = bazi.日主
  const tenList = m.tenList || []
  const tenByGan = {}
  for (const t of tenList) if (t.depth === '天干') tenByGan[t.pos] = t.ten
  // 天干小表
  const ganRows = (m.pillars || []).map(p => {
    const wx = MP_GAN_WX[p.gan] || ''
    const isDay = p.name === '日柱'
    const ten = isDay ? '日主' : (tenByGan[p.name] || '')
    const state = p.gan === dayGan ? '日主当位，全局之主' : (ten === '比肩' || ten === '劫财') ? '比劫同气，主合伙竞争' : (ten === '正官' || ten === '七杀') ? '克身之官杀，主约束压力' : (ten === '正财' || ten === '偏财') ? '我所克之财，主财源收益' : (ten === '食神' || ten === '伤官') ? '我所生之食伤，主才华输出' : (ten === '正印' || ten === '偏印') ? '生我之印，主庇护学识' : '主事之神'
    return [p.name, p.gan, wx, MP_TIANGAN_BENXIANG[p.gan] || '', state, ten ? `${ten}当值，${tenStateText(ten, m)}` : '辅佐之干']
  })
  // 地支小表
  const zhiRows = (m.pillars || []).map(p => {
    const cang = (MP_ZHI_CANG[p.zhi] || []).join('/')
    const gong = MP_DIZHI_GONG[p.name] || ''
    const zhiWx = MP_ZHI_WX[p.zhi] || ''
    // 宫位职司：日支为配偶宫，月支为兄弟，年支为祖辈，时支为子女
    const zhiState = p.name === '日柱' ? '配偶宫·自身根气所在' : p.name === '月柱' ? '父母兄弟宫·气脉枢纽' : p.name === '年柱' ? '祖基宫·家世渊源' : '子女宫·归宿晚景'
    return [p.name, p.zhi, zhiWx, MP_DIZHI_BENXIANG[p.zhi] || '', cang, gong, zhiState]
  })
  return { ganRows, zhiRows }
}
function tenStateText(ten, m) {
  const yongSet = (m.ty.yong || []).map(y => (y.match(/\(([^)]+)\)/) || [])[1])
  if (yongSet.includes(ten)) return '为用神，喜其有力，主助力'
  if ((m.ty.ti || []).some(t => t.includes(ten))) return '为体，喜其有根，主根基'
  return '平位之干，随局而动'
}

// 第二卷：做功视角的补充校准要点（精简短句，不与他派对比）
function xiuZhengDingLun(m, genji) {
  const dayGan = m.dayGan
  const dayWx = m.dayWx
  const pill = m.pillars || []
  const dayZhi = m.pre.dayZhi || ''
  const tong = m.tonggen || []
  const dayTong = tong.find(t => t.pos === '日柱')
  const kuSet = pill.filter(p => '辰戌丑未'.includes(p.zhi))
  const points = []
  // ① 日主藏根待用
  if (dayTong && dayTong.virtual === '虚·假') {
    points.push({ label: '藏根待用', sub: dayZhi + '宫藏干' + (MP_ZHI_CANG[dayZhi] || []).join('/') + '，见' + (dayTong.roots || '本气藏根') + '，实为' + (kuSet.length ? '藏库待冲，逢冲开库即发力' : '藏根待用，非彻底无根') + '。此命根基虚而不绝，当以"待发之根"论，逢岁运引动即发力。' })
  }
  // ② 比劫亦可作功神
  const biJie = (m.tenList || []).filter(t => (t.ten === '比肩' || t.ten === '劫财') && t.depth === '天干').map(t => t.char)
  if (biJie.length && m.zuo.methods && m.zuo.methods.some(x => /合|制/.test(x.name))) {
    points.push({ label: '比劫亦可作功神', sub: biJie.join('、') + '为' + (m.zuo.methods[0] && m.zuo.methods[0].name) + '之功神，可"合制"反得财——比劫非必凶，看能否成为功神。' })
  }
  // ③ 体平可借力做功
  if (genji.total < 6) {
    points.push({ label: '体平可借力做功', sub: '做功比旺衰关键——有' + (m.zuo.main ? m.zuo.main.name : '制') + '的通路，可借"制化"成格，宜担当敢进取。' })
  }
  // ④ 若都无明显补充，给一条"做功效率"视角的提醒
  if (!points.length) {
    points.push({ label: '做功效率视角', sub: '看' + dayWx + '气在' + (m.zuo.main ? m.zuo.main.name : '制') + '中的实际"做功效率"——是否"制尽"、"合制"、有无破坏，乃本报告的核心视角。' })
  }
  return points
}

// 第三卷：四重宾主嵌套架构 + 体用对照表
// 第一重核心级=日克辰；第二重内围=日干主+财联印刃；第三重中层=月柱两透；第四重外圈=年柱之部
function binZhuFour(m, bazi) {
  const dayGan = m.dayGan
  const dayZhi = m.pre.dayZhi || ''
  const dayWx = m.dayWx || MP_GAN_WX[dayGan] || ''
  const tenByPos = {}
  for (const t of (m.tenList || [])) if (t.depth === '天干') tenByPos[t.pos] = t.ten
  // 第一重·核心级：日主与日支本气的关系（克坐支=我所制；同气=根；坐印=庇护；坐财官=财官贴身）
  const dayZhiMain = (MP_ZHI_CANG[dayZhi] || [])[0] || ''
  const dayZhiMainWx = MP_GAN_WX[dayZhiMain] || MP_ZHI_WX[dayZhi] || ''
  const dayKeZhi = dayWx && dayZhiMainWx && KE[dayWx] === dayZhiMainWx
  const daySameZhi = dayWx && dayZhiMainWx && dayWx === dayZhiMainWx
  let f1Target, f1Desc
  if (dayKeZhi) {
    f1Target = `日主${dayGan}克${dayZhi}（日克坐支）`
    f1Desc = `日主${dayGan}坐于${dayZhi}（本气${dayZhiMain}），日克之即为"我所制"，是全局最贴身的一重做功核心。`
  } else if (daySameZhi) {
    f1Target = `日主${dayGan}坐${dayZhi}（同气得根）`
    f1Desc = `日主${dayGan}坐于${dayZhi}（本气${dayZhiMain}同五行），日主得根有靠，是全局最贴身的一重根基核心。`
  } else {
    f1Target = `日主${dayGan}坐${dayZhi}（本气${dayZhiMain}${dayZhiMainWx}，非我所克）`
    f1Desc = `日主${dayGan}坐于${dayZhi}（本气${dayZhiMain}），日主不克坐支，此支非我直接所制，是全局最贴身的一重做功核心。`
  }
  const f1 = { name: '第一重·核心级', target: f1Target, desc: f1Desc }
  // 第二重·内围：动态判断日干旁是否真有财/印/比劫（不再写死"财联印刃"）
  const allTen = (m.tenList || []).map(t => t.ten)
  const hasCai = allTen.some(t => t === '正财' || t === '偏财')
  const hasYin = allTen.some(t => t === '正印' || t === '偏印')
  const hasBiJie = allTen.some(t => t === '比肩' || t === '劫财')
  const f2Parts = [`日干${dayGan}主`]
  if (hasCai) f2Parts.push('财星为所克目标')
  if (hasYin) f2Parts.push('印星护卫')
  if (hasBiJie) f2Parts.push('比劫合伙竞争')
  const f2 = { name: '第二重·内围', target: f2Parts.join('，') || `日干${dayGan}主`, desc: `以日干为主，${f2Parts.slice(1).join('、') || '四柱无明显财印比劫，内围以日主自身为用'}，构成第二重内围。` }
  const f3 = { name: '第三重·中层', target: `月柱透干（${(tenByPos['月柱'] || '月柱枢纽')}）`, desc: `月柱透干${(tenByPos['月柱'] || '月柱枢纽之星')}为中层枢纽，承上启下，接引内外。` }
  const f4 = { name: '第四重·外圈', target: `年柱之部（${(tenByPos['年柱'] || '年上主星')}）`, desc: `年柱为远位外圈，主祖上根基与早年环境，为第四重之部。` }
  // 体用对照表：体（印比食伤）= 手段/本钱；用（财官）= 目标
  const bodyUseRows = (m.pillars || []).map(p => {
    const isDay = p.name === '日柱'
    const ten = isDay ? '日主' : (tenByPos[p.name] || '')
    const bodyUse = isDay ? '体' : tenUse(ten, m)
    const layer = p.name === '日柱' ? '核心' : p.name === '月柱' ? '中层' : p.name === '时柱' ? '内围' : '外圈'
    return [p.name, p.gan, p.zhi, ten, bodyUse, layer]
  })
  return { layers: [f1, f2, f3, f4], bodyUseRows }
}

// 第六卷：空亡三重重度分析（原局空亡 / 大运空亡 / 流年空亡的应期密钥）
function kongWangTriple(m, bazi) {
  const dayKong = m.pre.dayKong || []
  const dayGan = m.dayGan
  const dayZhi = m.pre.dayZhi || ''
  const rows = []
  // 第一重：原局空亡
  const benJu = dayKong.includes(dayZhi)
  rows.push({ name: '第一重·原局空亡', hit: benJu, desc: benJu
    ? `日柱${dayGan}${dayZhi}落空亡（旬空${dayKong.join('、')}），日主减分，做事易"差口气"，逢${dayKong.join('、')}填实之年才真正发力。`
    : `日柱${dayGan}${dayZhi}不落空亡（旬空${dayKong.join('、')}），空亡之象落在别柱，日主本身无大碍。` })
  // 第二重：大运空亡（未来大运干支是否逢空）
  const yun = (bazi.大运 && bazi.大运.大运) || []
  const yunHit = yun.filter(d => {
    const z = (d.干支 || '')[1]
    return z && dayKong.includes(z)
  })
  rows.push({ name: '第二重·大运空亡', hit: yunHit.length > 0, desc: yunHit.length
    ? `未来大运中有空亡填实之运：${yunHit.map(d => `${d.干支}（${d.开始年份}-${d.结束}）`).join('、')}——此运应事，吉凶翻倍，是原局空亡真正被"激活"的窗口。`
    : '未来大运干支无逢空亡填实，原局空亡之象主要靠流年引动。' })
  // 第三重：流年空亡（当前流年是否填实）
  const now = currentY()
  const nowZhi = yearGanzhiStr(now)[1]
  const nowHit = dayKong.includes(nowZhi)
  rows.push({ name: '第三重·流年空亡', hit: nowHit, desc: nowHit
    ? `今年（${now}）流年${nowZhi}恰为日主旬空，空亡填实，主应事、变动翻倍，宜主动布局。`
    : `今年（${now}）流年${nowZhi}未落空亡，暂无空亡填实之应，按常理行事。` })
  return rows
}

// 第八卷：性格终极画像（综合日主五行 + 十神透干 + 做功方式）
function characterPortrait(m, bazi) {
  const dayGan = bazi.日主
  const dayWx = m.dayWx
  const tens = (m.tenList || []).filter(t => t.depth === '天干').map(t => t.ten)
  const traits = []
  // 日主五行底色
  traits.push(`${dayWx}命，${dayWxChar(dayWx)}。`)
  // 十神特质
  const tenSets = [...new Set(tens)]
  for (const t of tenSets) {
    if (t === '日主') continue
    traits.push(`透${t}，${tenCharPlain(t)}。`)
  }
  // 做功方式
  const work = m.zuo.main ? m.zuo.main.name : '制'
  traits.push(`谋事以「${work}」为主，${workPlain(work)}。`)
  // 空亡修正
  if (m.pre.dayKong && m.pre.dayKong.includes(m.pre.dayZhi)) traits.push('然日柱落空亡，心性中有"留一手、不轻易全押"的底色，关键处易犹豫。')
  const summary = `性格终极画像：你是${dayWx}命（${dayGan}日主），底色${dayWxChar(dayWx)}。${tenSets.filter(t => t !== '日主').map(t => t + '=' + tenCharPlain(t)).join('，') || '五行搭配均衡'}。做事路子是「${work}」，${workPlain(work).replace(/。$/, '')}。` + (m.pre.dayKong && m.pre.dayKong.includes(m.pre.dayZhi) ? '内心常有"差口气"的谨慎感，机会来了要逼自己果断。' : '整体是能成事也能处人的性子，越放得开越有发挥。')
  return { traits, summary }
}

// 终章：核心口诀（古诀风格，一句定局）
function coreKouJue(m, pre, genji) {
  const main = m.zuo.main ? m.zuo.main.name : '制'
  const yong = yongTens(m.ty.yong)
  const kong = pre.dayKong && pre.dayKong.length ? pre.dayKong[0] : ''
  const kongTxt = kong ? `空亡${kong}填实则发` : '空亡不现路自通'
  const yongTxt = yong ? `得${yong}之助` : '得财官之助'
  return `以${main}求财，${yongTxt}；${kongTxt}；应期年进、平顺年守，识时务者得始终。`
}

// 第四卷：纳音共振强化（独立成卷，量化纳音同气呼应 + 纳音与正五行的势能）
function naYinGongZhen(m) {
  const nayin = m.nayin || []
  const rows = []
  const gong = {}
  for (const n of nayin) {
    if (!gong[n.wx]) gong[n.wx] = []
    gong[n.wx].push(n)
  }
  const pairs = []
  for (const wx of Object.keys(gong)) {
    if (gong[wx].length >= 2) {
      pairs.push({ wx, cols: gong[wx] })
      rows.push([`${wx}气呼应`, gong[wx].map(n => `${n.pos}${n.gan}${n.zhi}${n.nayin}`).join('、'), `${gong[wx].length}柱同类，能量可接续`])
    }
  }
  return { rows, pairs, count: rows.length }
}

// 第五卷：做功星系可视化（功神/废神/目标神 + 做功链条 + 收获端）
function zuoGongVisual(m) {
  const full = m.zuoFull || {}
  const chain = full.workChain || []
  const rows = (full.rows || []).filter(r => r.exists)
  return {
    gong: full.gongShen || [],
    target: full.feiShen || [],
    half: full.half || [],
    chain,
    rows,
    main: m.zuo.main ? m.zuo.main.name : '制',
    grade: m.zuo.xiaoLv.grade,
  }
}

// 模块八：象法直读（职业/六亲/健康/性格，专业术语 + 大白话）
function xiangfaRead(m, bazi) {
  const dayGan = bazi.日主
  const dayWx = m.dayWx
  const out = []
  // 职业象
  const career = (m.quxiang || []).map(q => q.career).slice(0, 3).join('、') || '技术和专业'
  const careerTens = (m.quxiang || []).map(q => q.ten).slice(0, 2).join('、') || '财官'
  const workName = m.zuo.main ? m.zuo.main.name : '制'
  out.push({
    name: '职业象', tag: dayWx + '命',
    desc: `你是${dayWx}命，${dayWxChar(dayWx)}。命里${careerTens}这一路最旺，往这个方向走最顺：**${career}**。赚钱靠「${workName}」——${workPlain(workName)}。`,
  })
  // 六亲象
  const liuqin = (m.quxiang || []).map(q => `**${q.ten}**（${q.liuqin}）`).slice(0, 4).join('、')
  out.push({
    name: '六亲象', tag: '家庭缘分',
    desc: liuqin ? `命里跟你缘分最深的几位：${liuqin}——家庭和贵人是你的"软实力"，该托关系、靠人脉的时候别抹不开面子。` : '六亲缘分大体平稳，家庭关系顺其自然即可。',
  })
  // 健康象
  const body = (m.quxiang || []).map(q => bodyPlain(q.ten, q.body)).slice(0, 3).join('；')
  const shang = m.shangmen && m.shangmen.length
    ? `命里带${m.shangmen.map(s => s.name).join('、')}（${m.shangmen.map(s => s.desc.split('：')[1] || s.desc).join('、')}），容易有暗损和隐疾，平时作息规律、少操心、别太累。`
    : '命里没有重大刑冲穿害，先天底子不错，正常保养即可。'
  out.push({ name: '健康象', tag: '先天底子', desc: `${body ? body + '；' : '命局无特别虚弱的脏腑。'}${shang}` })
  // 性格象
  const xing = (m.quxiang || []).map(q => `${q.ten}透出，说明${tenCharPlain(q.ten)}`).slice(0, 2).join('；')
  out.push({
    name: '性格象', tag: dayGan + '之性',
    desc: `你是${dayWx}命，${dayWxChar(dayWx)}${xing ? '，' + xing : ''}。总体上重情讲义、能进能退，是个能成事也能处人的性子。`,
  })
  return out
}

// 十神 → 性格大白话
function tenCharPlain(ten) {
  const map = {
    正印: '你内敛、爱学习，重名声面子', 偏印: '你想法多、思维独特，不走寻常路',
    比肩: '你重义气、认死理，朋友多', 劫财: '你大方讲义气，但花钱也快，合伙要防分账',
    食神: '你心宽、嘴甜、会享受，人缘好', 伤官: '你聪明有才、敢想敢说，但易锋芒过露',
    正财: '你务实、守财、肯吃苦，过日子稳', 偏财: '你出手大方、人脉广，来财路子活',
    正官: '你守规矩、有责任心，适合稳定发展', 七杀: '你雷厉风行、能扛压，越挫越勇',
  }
  return map[ten] || '有主见、有想法'
}

// 十神 → 健康部位大白话
function bodyPlain(ten, body) {
  const map = {
    '头/心/血': '多注意头、心脏和血液循环', '脑/神经': '多注意脑部和神经、睡眠', '手足/肌/骨': '多注意手脚、肌肉骨骼',
    '手足/血液': '多注意手足和血液、血糖', '生殖/排泄': '多注意泌尿生殖和消化', '生殖/口舌': '多注意口腔、咽喉和内分泌',
    '内分泌/代谢': '多注意代谢和内分泌、体重', '肝胆': '多注意肝胆，少熬夜、少动怒',
    '筋骨/胆/泌尿': '多注意筋骨、胆和泌尿，别太拼',
  }
  return map[body] || `${ten}对应${body}这些部位，日常多留意`
}

// 模块九：最终定论（命局总评，讲人话）
function finalConclusion(m, genji) {
  const yong = yongTens(m.ty.yong)
  const kong = m.pre.dayKong && m.pre.dayKong.length
    ? `你日柱落空亡，做事容易"临门一脚差口气"，遇到关键的年份（见第七节）要抓住补上的机会。`
    : '你日主根基贴身有力，做事有底气，想做就能做出结果。'
  const typeTxt = /借势/.test(m.ty.conclusion || '') ? '靠才华本事吃饭，更适合跟着平台、跟着人一起干' : '靠自己单干也能立得住，独立越强发挥越好'
  return `总评一句话：你这辈子的财和名，${typeTxt}。真正能成事的是${yong}这一路——那是你命里的做功目标，平时往这个方向使劲；${kong}${genji.total >= 8 ? '根基扎实（' + genji.total + '分），大事敢想敢干，逢好年份果断出手。' : genji.total >= 4 ? '根基中等（' + genji.total + '分），别硬扛，学会借力更省力。' : '根基偏虚（' + genji.total + '分），先求稳、再图进，别逆势冒进。'}`
}

// 根基维度的大白话解释（专业维度 → 讲人话）
function genjiPlain(name) {
  const map = {
    量级: '根气多寡——你命里的"底子"够不够厚，这是加分最多的项',
    距离: '根离日主的远近——根越近（坐支/月支）越贴身、越有用',
    状态: '根有没有被合走/冲散/关进墓库——底子稳不稳，会不会漏',
    真假: '根在不在"主位"——是真正能用到自己身上的，还是给别人的',
    护卫: '有没有"印"护着——像有没有靠山，有靠山根就不容易被拔',
  }
  return map[name] || '根基指标'
}

// 太极点结论的大白话解读（先论冲/合/虚神/空亡 → 讲人话）
function taijiPlain(conclusion) {
  if (!conclusion) return '命局平静，机会要看大运流年引动。'
  if (/合能解冲|先论合.*后论冲/.test(conclusion)) return '你命里"冲"和"合"同时存在，但合能把冲化解——外在看变动多、环境常变，其实背后有贵人、合作关系在托底。越是在合作里求进、借力发力，越能化险为夷、越动越有财。'
  if (/先论冲/.test(conclusion)) return '你命里"冲"最厉害——环境一变你就容易动、容易有变化，而且往往是越动越有财。稳中求进，别怕换地方。'
  if (/先论合/.test(conclusion)) return '你命里"合"最旺——天生重感情、有人缘，成事靠合作、靠贵人，千万别单打独斗。'
  if (/先论虚神/.test(conclusion)) return '你命里有个"虚神"暗中发力——这代表你有隐藏的底牌和潜力，平时看不出来，一到大运流年补上，能突然翻盘。'
  if (/空亡/.test(conclusion)) return '你日柱落空亡——做事常有力不从心、"差口气"的感觉，但别灰心，关键年份一到、空亡一填实，反而会发力。'
  return '你命局整体平静、结构分明，按部就班、稳扎稳打即可。'
}

// 做功方式的大白话解释（专业术语 → 讲人话）
function workPlain(name) {
  const map = {
    制: '靠真本事直接"制服"目标——压力越大越能激发你，越硬碰硬越能出成绩',
    化: '遇事不硬刚，用学识、关系、谋略把难题"化"掉——四两拨千斤的路子',
    合: '天生有人脉、有贵人缘，靠合作、靠人牵线成事，单打独斗反而吃力',
    冲: '安分守不住，越"动"越有财——换环境、挪地方、跳槽反而能打开局面',
    穿: '低调做事、防小人——容易有暗中损耗，合作要多留个心眼、防暗亏',
    刑: '对自己够狠，越是高压越出成绩，但要防官非口舌、别钻牛角尖',
    暗合: '闷声发大财的路子——来钱偏门、靠隐秘人脉和机会，不适合大张旗鼓',
  }
  return map[name] || '靠自身本事的命'
}

// 模块九：盲派三纲（功神=吃饭的本事 / 病神=天生的坑 / 废神=用不上的闲神）
function sanGang(m, pre) {
  const items = []
  // 功神：你靠什么赚钱成事
  const gong = m.zuo.methods.length ? m.zuo.methods[0] : null
  // 终章只做"总断"式点题，不复述做功白话详解（已在第五卷·做功系统展开），避免同句多卷重复
  items.push({
    name: '功神', tag: gong ? gong.name : '制',
    desc: `你命里最"能赚钱"的招是「${gong ? gong.name : '制'}」——完整拆解与白话详解见第五卷·做功系统终极拆解。`,
  })
  // 病神：你天生的短板和坑
  const kong = pre.dayKong && pre.dayKong.length ? `日主空亡（${pre.dayKong.join('、')}）` : ''
  const hai = m.shangmen && m.shangmen.length ? m.shangmen.map(s => s.name).join('、') : ''
  if (kong || hai) {
    const kongPlain = pre.dayKong && pre.dayKong.length ? `日柱落空亡，意思是做事常有"使不上劲、临门一脚差口气"的感觉，得等应期年份（见第七节）才能补上` : ''
    const haiPlain = m.shangmen && m.shangmen.length ? `${m.shangmen.map(s => s.name).join('、')}这些冲刑组合，代表你身上天生有几处"坎"，发动时要防官非、纠纷和健康` : ''
    items.push({
      name: '病神', tag: kong || hai,
      desc: `这是你命里的"坑"：${kong ? '日主空亡（' + pre.dayKong.join('、') + '）' : ''}${kong && hai ? '，还有' : ''}${hai || ''}。${kongPlain}${kongPlain && haiPlain ? '；' : ''}${haiPlain}——知道了坑在哪，平时就能绕着走。`,
    })
  } else {
    items.push({ name: '病神', tag: '无大碍', desc: '原局没查出明显的"坑"，格局清爽，先天没什么硬伤，正常过日子即可。' })
  }
  // 废神：用不上的闲神，反而能成为大运引爆点
  items.push({
    name: '废神', tag: '蓄势之神',
    desc: '命里还有几个"闲神"，眼下帮不上忙、也拖不了后腿。别小看它们——一旦大运流年把闲神"激活"，反而可能变成突然的机会（比如偏财、贵人临时到场）。',
  })
  return items
}

// 模块九：一句话心法（大白话口诀，用户最容易记住的一句）
function heartMantra(m, pre) {
  const main = m.zuo.main ? m.zuo.main.name : '制'
  const yong = yongTens(m.ty.yong)
  const kong = pre.dayKong && pre.dayKong.length ? pre.dayKong[0] : ''
  return `你这辈子记住八个字——「以${main}求财，靠${yong}起家」${kong ? `；只是日柱坐空亡，关键处容易差口气，机会来了要趁早抓住` : ''}。`
}

// 通用：当前年份
function currentY() {
  return new Date().getFullYear()
}

// 流年干支字符串
function yearGanzhiStr(y) {
  const G = '甲乙丙丁戊己庚辛壬癸', Z = '子丑寅卯辰巳午未申酉戌亥'
  return G[(y - 4) % 10] + Z[(y - 4) % 12]
}

// 地支相冲表
const ZHI_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' }

// 五行性格
function dayWxChar(wx) {
  return { 木: '仁厚条达，具生发之志', 火: '热情明礼，具礼乐之才', 土: '敦厚守信，具承载之德', 金: '刚毅果断，具正义之气', 水: '聪慧灵动，具应变之智' }[wx] || '性情中和'
}

// 五行健康部位
function healthPart(wx) {
  return { 木: '肝胆', 火: '心小肠', 土: '脾胃', 金: '肺大肠', 水: '肾膀胱' }[wx] || '周身'
}

// ============ 统一分发入口 ============
// type: bazi / ziwei / liuyao / qimen / huangli / tarot / name / fengshui / mangpai
// 报告缓存：同一命盘/参数的完整报告内容确定，重复生成时直接复用，显著加速连续/综合报告
const reportCache = new Map()
const REPORT_CACHE_MAX = 40
function cacheKey(type, chart, args) {
  const p = chart && chart.pillars ? chart.pillars : {}
  const chartKey = [p.year, p.month, p.day, p.hour, chart && chart.gender].join(':')
  let argsKey = ''
  try { argsKey = JSON.stringify(args) } catch { argsKey = '' }
  return `${type}|${chartKey}|${argsKey}`
}
function cached(fn, type, chart, args) {
  const key = cacheKey(type, chart, args)
  const hit = reportCache.get(key)
  if (hit) return hit
  const out = fn()
  if (out && out.ok) {
    if (reportCache.size >= REPORT_CACHE_MAX) reportCache.delete(reportCache.keys().next().value)
    reportCache.set(key, out)
  }
  return out
}

export function buildReport(type, chart, args = {}) {
  switch (type) {
    case 'bazi': return cached(() => buildBaziReport(chart), type, chart, args)
    case 'ziwei': return cached(() => buildZiweiReport(chart, args.date), type, chart, args)
    case 'liuyao': return cached(() => buildLiuyaoReport(chart, args.question), type, chart, args)
    case 'qimen': return cached(() => buildQimenReport(chart, args.date), type, chart, args)
    case 'huangli': return cached(() => buildHuangliReport(chart, args.date), type, chart, args)
    case 'tarot': return cached(() => buildTarotReport(args), type, chart, args)
    case 'name': return cached(() => buildNameReport(chart, args), type, chart, args)
    case 'fengshui': return cached(() => buildFengshuiReport(chart, args), type, chart, args)
    case 'mangpai': return cached(() => buildMangpaiReport(chart), type, chart, args)
    case 'hehun': return cached(() => buildHehunReport(chart, args.partner), type, chart, args)
    case 'zejiri': return cached(() => buildZejiReport(args.purpose || 'marry', chart), type, chart, args)
    case 'consult': return cached(() => buildConsultReport(chart, {
      bazi: buildReport('bazi', chart, {}),
      mangpai: buildReport('mangpai', chart, {}),
      ziwei: buildReport('ziwei', chart, {}),
    }), type, chart, args)
    default: return failReport(`未知报告类型：${type}`)
  }
}

export default buildReport
