// 风水分析算法：基于「玄空派」简化思路 + 「八宅派」入门算法
// 输入：户型（客厅/主卧/厨房/书房/门向）和八字喜用神
// 输出：各房间的方位、五行调和、宜忌清单

import { buildChart } from './bazi.js'

// 八方位
const DIRECTIONS = [
  { code: '东', wx: '木', element: 'Wood', color: '青绿', label: '震', alias: '青龙', family: '长男' },
  { code: '南', wx: '火', element: 'Fire', color: '朱红', label: '离', alias: '朱雀', family: '中女' },
  { code: '西', wx: '金', element: 'Metal', color: '白金', label: '兑', alias: '白虎', family: '少女' },
  { code: '北', wx: '水', element: 'Water', color: '玄黑', label: '坎', alias: '玄武', family: '中男' },
  { code: '中', wx: '土', element: 'Earth', color: '米黄', label: '中', alias: '勾陈', family: '家主' },
  { code: '东南', wx: '木', element: 'Wood', color: '青绿', label: '巽', alias: '青龙', family: '长女' },
  { code: '西南', wx: '土', element: 'Earth', color: '米黄', label: '坤', alias: '勾陈', family: '老母' },
  { code: '西北', wx: '金', element: 'Metal', color: '白金', label: '乾', alias: '白虎', family: '老父' },
  { code: '东北', wx: '土', element: 'Earth', color: '米黄', label: '艮', alias: '勾陈', family: '少男' }
]

// 八宅派：按门向 → 找出 4 吉位 / 4 凶位
// 这里用简化路线：以天医、生气、延年、伏位为四吉方
// 生气（贪狼木）、天医（巨门土）、延年（武曲金）、伏位（辅弼木）—— 取与门相生方
// 实际以卦的「伏位反推」或「八卦属性」推得。这里采用经典「生气为门向巨门对宫」:
// 公式：生气 = 与门同阴阳的 生气方位；天医 = 门逆生第三宫... (示意)
//
// 简化版本：四个吉位按"门向"五行推算：
//  生方：门同阴阳之木方   天医：同阴之土方   延年：同阳之金方   伏位：与门同宫

const MEN_GUA = {
  // 震 → 东南(巽)；离 → 东南；坎 → 西南 ... 等等，八宅标准映射
  // 简化：以门向对应的后天八卦四吉位推算
  '震': {
    生方: '东南',
    天医: '北',
    延年: '南',
    伏位: '东',
    绝命: '西', 五鬼: '中'
  },
  '巽': { 生方: '东', 天医: '南', 延年: '中', 伏位: '东南' },
  '离': { 生方: '东', 天医: '东南', 延年: '中', 伏位: '南' },
  '坤': { 生方: '东南', 天医: '西', 延年: '东北', 伏位: '西南' },
  '兑': { 生方: '西南', 天医: '西北', 延年: '东北', 伏位: '西' },
  '乾': { 生方: '西', 天医: '东', 延年: '南', 伏位: '西北' },
  '坎': { 生方: '南', 天医: '东南', 延年: '中', 伏位: '北' },
  '艮': { 生方: '东北', 天医: '东', 延年: '北', 伏位: '东北' }
}

const GUA_OF_DIR = {
  '东': '震', '东南': '巽', '南': '离', '西南': '坤',
  '西': '兑', '西北': '乾', '北': '坎', '东北': '艮', '中': '中'
}

// 五行生克
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' }

// 户型基础配置
function defaultLayout() {
  return {
    living: '东',  // 客厅
    master: '南',  // 主卧
    kitchen: '西', // 厨房
    study: '北',   // 书房
    door: '南',    // 大门朝向
    bedDir: '东南', // 床头
    deskDir: '东', // 书桌/座位面向
    seatBack: 'wall', // 背后：实墙 / 门 / 窗
    seatFront: 'open', // 前方：开阔 / 门 / 窗 / 墙
    seatLeft: 'solid', // 左侧：有靠 / 窗 / 高柜
    seatRight: 'open', // 右侧：开阔 / 窗 / 高柜
    seatHazard: 'none', // 头顶与周边：无 / 横梁 / 尖角
  }
}

// 颜色推荐映射
const COLOR_PALETTE = {
  木: ['青', '翠绿', '薄荷', '木原色', '浅蓝绿'],
  火: ['朱红', '暖橙', '琥珀', '玫粉'],
  土: ['土黄', '赭色', '奶咖', '岩米'],
  金: ['白金', '银灰', '米白', '香槟'],
  水: ['玄黑', '海蓝', '墨青', '雾紫']
}

export function analyzeFengshui({ layout = {}, birthInfo }) {
  const ll = { ...defaultLayout(), ...layout }

  // 1. 求用户五行喜忌
  let chart = null
  if (birthInfo) {
    try {
      chart = buildChart(
        birthInfo.year, birthInfo.month, birthInfo.day,
        birthInfo.hour !== undefined ? birthInfo.hour : 12,
        birthInfo.gender || '男'
      )
    } catch (e) {}
  }
  const favorable = chart?.favorable || ['木']
  const avoid = chart?.avoid || ['金']

  // 2. 八宅吉位
  const doorGua = GUA_OF_DIR[ll.door]
  const lucky = MEN_GUA[doorGua] || MEN_GUA['震']
  const luckyKeys = ['生方', '天医', '延年', '伏位'].filter(k => lucky[k])
  // 四吉位：生气、天医、延年、伏位（延年此前因键名写错被永久丢失）
  const luckyDirs = [lucky.生方, lucky.天医, lucky.延年, lucky.伏位].filter(Boolean)

  // 3. 各房间方位 vs 喜忌
  const rooms = [
    { key: 'living',  name: '客厅', dir: ll.living, wuxing: wxOf(ll.living), role: '家人聚集、迎接来客的能量核心', ideal: '动静皆宜、明亮宽敞' },
    { key: 'master',  name: '主卧', dir: ll.master, wuxing: wxOf(ll.master), role: '休养生息之地，关乎夫妇感情与体力', ideal: '宜静、忌嘈、光线柔和' },
    { key: 'kitchen', name: '厨房', dir: ll.kitchen, wuxing: wxOf(ll.kitchen), role: '家宅火气与财库，掌家人饮食与健康', ideal: '整洁、明火朝吉方' },
    { key: 'study',   name: '书房', dir: ll.study, wuxing: wxOf(ll.study), role: '关乎学习、思考、决策与事业运', ideal: '背实而面虚，忌冲门' }
  ]

  // 4. 给每房间打分与建议
  const roomAnalysis = rooms.map(r => {
    let score = 70
    let tips = []
    let alert = false

    // 五行调和：与喜用神生/同 → 加分；与忌神同 → 减分
    if (favorable.includes(r.wuxing)) { score += 18; tips.push(`方位五行属${r.wuxing}，与你喜用神相合（正好是你需要的五行，帮你"接气"），宜作为主要活动空间。`) }
    else if (avoid.includes(r.wuxing)) { score -= 12; tips.push(`方位五行属${r.wuxing}，与你忌讳相冲（五行相冲相克，容易住着不顺），需以装修、颜色、摆件调和。`) }
    if (KE[favorable[0]] === r.wuxing) { score -= 8; tips.push(`门向${ll.door}克到${r.wuxing}宫位（门的方向压到了这个房间的气），平日多通风采光以化解。`) }

    // 是否为吉位
    if (luckyDirs.includes(r.dir)) {
      score += 10
      tips.push(`恰坐于「${luckyDirs.find(d => d === r.dir)}」吉位（八宅里的吉利方位，住着顺），建议将主位安排于此。`)
    }

    score = Math.max(20, Math.min(100, score))

    return {
      ...r,
      score,
      tips,
      colorSuggestion: COLOR_PALETTE[favorable[0]]?.[0] || COLOR_PALETTE['木'][0],
      colorList: COLOR_PALETTE[favorable[0]] || COLOR_PALETTE['木']
    }
  })

  // 5. 总体建议
  const overallScore = Math.round(roomAnalysis.reduce((a, b) => a + b.score, 0) / roomAnalysis.length)
  const topRoom = [...roomAnalysis].sort((a, b) => b.score - a.score)[0]
  const weakRoom = [...roomAnalysis].sort((a, b) => a.score - b.score)[0]

  // 6. 床头朝向
  const bedWuxing = wxOf(ll.bedDir)
  let bedVerdict = '吉'
  let bedDesc = ''
  if (favorable.includes(bedWuxing)) {
    bedDesc = `床头朝${ll.bedDir}（${bedWuxing}），与你喜用神相应（正好补你需要的五行），安稳减压，睡眠有根。`
  } else if (avoid.includes(bedWuxing)) {
    bedVerdict = '凶'
    bedDesc = `床头朝${ll.bedDir}（${bedWuxing}），与你忌讳冲克（睡的方位压着你的五行，容易睡不踏实），建议调整为${favorable.map(f => ({ 木: '东、东南', 火: '南', 土: '中央、西南、东北', 金: '西、西北', 水: '北' }[f]).slice(0, 1)).join('、')}。`
  } else {
    bedDesc = `床头朝${ll.bedDir}（${bedWuxing}），与命格无明显利害关系，但若能取喜用神之方更佳（朝对你有利的方位睡，效果更好）。`
  }

  // 7. 玄关 / 大门
  const doorWuxing = wxOf(ll.door)
  const doorMatch = SHENG[favorable[0]] === doorWuxing
    ? '门向与你喜用神相生（门一开正好接上你需要的五行气），是迎纳生气的好格局。'
    : KE[favorable[0]] === doorWuxing
    ? '门向与你喜用神相克（门的方向压着你的五行气），气场受到压制。可在玄关处添置木/火/水的摆件通其气。'
    : `门向属${doorWuxing}，与喜用神关系平和（不多不少、可调可改），可塑空间较大。`

  // 8. 书桌 / 座位：兼看方向与形势。方向只作为加分项，背有靠、避门冲、避横梁
  // 是更优先的现实布置原则，避免用户为了“吉向”牺牲基本使用舒适度。
  const deskWuxing = wxOf(ll.deskDir)
  let deskScore = 70
  const deskTips = []
  if (favorable.includes(deskWuxing)) {
    deskScore += 12
    deskTips.push(`书桌朝${ll.deskDir}，方位属${deskWuxing}，与喜用神相合，可作为学习、工作与决策的主座。`)
  } else if (avoid.includes(deskWuxing)) {
    deskScore -= 10
    deskTips.push(`书桌朝${ll.deskDir}，方位属${deskWuxing}，落在忌神方；优先调到喜用方向，不能移动时用${COLOR_PALETTE[favorable[0]]?.[0] || '柔和'}色软装调和。`)
  } else {
    deskTips.push(`书桌朝${ll.deskDir}，与命局没有明显冲突；若条件允许，可优先取${preferredDirection(favorable[0])}方。`)
  }
  if (luckyDirs.includes(ll.deskDir)) {
    deskScore += 8
    deskTips.push(`座位落在门向对应的吉位，利于专注与人际协作。`)
  }

  if (ll.seatBack === 'wall') {
    deskScore += 10
    deskTips.push('背后有实墙，形成“有靠”，适合长期伏案与稳定输出。')
  } else if (ll.seatBack === 'door') {
    deskScore -= 14
    deskTips.push('背后正对门或通道，容易受人流惊扰；尽量调位或加高靠背、屏风。')
  } else {
    deskScore -= 10
    deskTips.push('背后是窗，属于“无靠”；建议使用高靠椅，并在窗侧加厚帘或矮柜稳定气场。')
  }

  if (ll.seatFront === 'open') {
    deskScore += 8
    deskTips.push('前方留有开阔视野，利于思路展开；桌前保持清爽即可。')
  } else if (ll.seatFront === 'door') {
    deskScore -= 12
    deskTips.push('前方直冲门，容易分神；将桌面略偏转，避免正对门线。')
  } else if (ll.seatFront === 'wall') {
    deskScore -= 5
    deskTips.push('前方紧贴实墙，视野易受限；可留出桌前距离或加一幅明亮远景画。')
  } else {
    deskTips.push('前方临窗采光不错，但避免直射眩光；加可调百叶帘更稳妥。')
  }

  if (ll.seatLeft === 'solid') deskScore += 5
  else if (ll.seatLeft === 'window') {
    deskScore -= 4
    deskTips.push('左侧临窗，注意风直吹与反光，可用帘布或绿植作缓冲。')
  } else {
    deskScore -= 3
    deskTips.push('左侧高柜贴近座位，保持边缘圆润并留出活动距离。')
  }
  if (ll.seatRight === 'tall') {
    deskScore -= 6
    deskTips.push('右侧高柜或高物压近座位，宜降低高度或移远，避免形成压迫感。')
  } else if (ll.seatRight === 'window') {
    deskScore -= 3
    deskTips.push('右侧临窗时避免强光直射屏幕，可用纱帘柔化。')
  }

  if (ll.seatHazard === 'beam') {
    deskScore -= 22
    deskTips.push('座位上方有横梁，优先移位避开；无法调整时，以平整吊顶或高柜弱化梁感。')
  } else if (ll.seatHazard === 'corner') {
    deskScore -= 14
    deskTips.push('座位附近有尖角直冲，调整桌角或用圆叶植物、圆角收纳遮缓。')
  }
  deskScore = Math.max(20, Math.min(100, deskScore))
  const desk = {
    dir: ll.deskDir,
    wuxing: deskWuxing,
    score: deskScore,
    verdict: deskScore >= 78 ? '宜用' : '宜调整',
    preferredDir: preferredDirection(favorable[0]),
    tips: deskTips,
  }

  return {
    input: ll,
    chart,
    favorable,
    avoid,
    overallScore,
    door: {
      dir: ll.door,
      wuxing: doorWuxing,
      lucky: lucky.生方,
      match: doorMatch
    },
    bed: {
      dir: ll.bedDir,
      verdict: bedVerdict,
      desc: bedDesc
    },
    desk,
    lucky,
    rooms: roomAnalysis,
    summary: [
      `${topRoom.name}是您家宅能量之冠（得分 ${topRoom.score}），可作为长时间停留的位置。`,
      `弱位为「${weakRoom.name}」（得分 ${weakRoom.score}），建议通过装饰颜色与材质补强。`,
      `推荐主题色：${(COLOR_PALETTE[favorable[0]] || COLOR_PALETTE['木']).join(' / ')}，用于软装、家具、装饰画主色。`,
      `吉位推荐：「${lucky.生方}」生气方作主卧或客厅，是您一宅之首善之地。`
    ]
  }
}

function preferredDirection(element) {
  return ({ 木: '东、东南', 火: '南', 土: '东北、西南', 金: '西、西北', 水: '北' })[element] || '东、东南'
}

function wxOf(dir) {
  return DIRECTIONS.find(d => d.code === dir)?.wx || '木'
}

export const FENG_SHUI_META = { DIRECTIONS, COLOR_PALETTE, SHENG, KE }
