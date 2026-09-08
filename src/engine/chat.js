// 灵枢聊天引擎：意图识别 + 结合命盘生成个性化回答

import { TIAN_GAN, DI_ZHI, WUXING_SHENG, WUXING_KE } from '../data/ganzhi.js'
import { INTENTS, RESPONSES, HELPERS } from '../data/knowledge.js'
import { currentYearGanzhi } from './bazi.js'

// 五行 → 生活映射
const WX_MAP = {
  木: { color: '青绿', dir: '东方', season: '春季（农历正月至三月）', organs: '肝胆、筋腱、眼睛', field: '教育、出版、设计、文化传媒、医疗养生', items: '木质摆件、绿色植物', example: '文化创意、教育培训、园艺花木' },
  火: { color: '红紫', dir: '南方', season: '夏季（农历四月至六月）', organs: '心脏、小肠、血脉', field: '互联网、传媒、能源、餐饮、市场营销', items: '暖色灯具、红色饰品', example: '互联网科技、影视传媒、餐饮能源' },
  土: { color: '黄棕', dir: '中原', season: '季末（农历三六九十二月）', organs: '脾胃、肌肉、皮肤', field: '房地产、建筑、农业、仓储物流、咨询', items: '陶瓷器皿、黄水晶', example: '房地产建筑、农业食品、咨询服务' },
  金: { color: '白金', dir: '西方', season: '秋季（农历七月至九月）', organs: '肺、大肠、皮肤毛发', field: '金融、机械制造、五金、珠宝、法律', items: '金属摆件、白色饰品', example: '金融投资、精密制造、珠宝行业' },
  水: { color: '黑蓝', dir: '北方', season: '冬季（农历十月至十二月）', organs: '肾、膀胱、骨骼牙齿', field: '物流、贸易、旅游、水产、饮品', items: '鱼缸水景、蓝色布艺', example: '物流贸易、旅游出行、饮品水产' }
}

function wx(key) {
  return WX_MAP[key] || WX_MAP.木
}

// 计算当前流年与日柱的生克关系
function yearRelation(chart) {
  const now = currentYearGanzhi()
  const dayWx = chart.dayMasterWx
  const yearWx = (() => {
    const i = TIAN_GAN.indexOf(now.gan)
    return ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'][i]
  })()

  let impact, remark, pace
  if (WUXING_SHENG[yearWx] === dayWx) {
    impact = '流年生你，是「得印」之年：贵人运旺，长辈、上级愿意提携，学习深造、考证进修之事顺利，适合打基础、攒人脉。'
    remark = '流年生助你身，属「吉年」，整体顺遂，是难得的蓄势之年。'
    pace = '稳中有升'
  } else if (WUXING_SHENG[dayWx] === yearWx) {
    impact = '流年为你所生，是「泄秀」之年：你的才华、创意、表达欲会被放大，适合展示自己、输出作品、开拓新领域，但要注意精力消耗。'
    remark = '才华有施展空间的年份，忙碌中藏着机会。'
    pace = '先忙后顺'
  } else if (WUXING_KE[yearWx] === dayWx) {
    impact = '流年克你，是「官杀」之年：压力与责任并存，工作上易有变动与挑战，但这也是晋升、担当重任的关口——扛过去就是上一层楼。'
    remark = '压力与机遇并存之年，宜稳扎稳打，不宜冒进。'
    pace = '先紧后松'
  } else if (WUXING_KE[dayWx] === yearWx) {
    impact = '你克流年，是「财运」之年：财星当令，正财偏财都有机会，但求财需主动出击，坐等不来。注意量入为出，防破财。'
    remark = '财运有起色之年，行动力就是财气。'
    pace = '忙碌生财'
  } else {
    impact = '流年与你同气，是「比劫」之年：同辈朋友、同行竞争增多，合作机会与竞争压力并存，宜广结善缘，但也要守住自己的边界与钱包。'
    remark = '平顺之年，重在经营关系与自我管理。'
    pace = '平稳过渡'
  }

  // 日柱与流年的干支关系
  const dzIdx = DI_ZHI.indexOf(chart.pillars[2].zhi)
  const nzIdx = DI_ZHI.indexOf(now.zhi)
  const relation = nzIdx === dzIdx ? '伏吟（同气相通）'
    : (nzIdx + 6) % 12 === dzIdx ? '相冲（有变动之象）'
    : '相安（节奏平稳）'

  const bestMonth = wx(chart.favorable[0]).season.replace('（', '前后（')
  return {
    now, impact, remark, pace, relation, bestMonth,
    bestDates: nearbyGoodDates(chart.favorable[0]),
    goodTime: goodTimeOf(chart.favorable[0])
  }
}

// 最近喜用神的干支日（从今天起 60 天内）
function nearbyGoodDates(favWx) {
  const out = []
  const today = new Date()
  for (let i = 0; i < 120 && out.length < 3; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const y = d.getFullYear()
    const idx = ((y - 1900 + 36) % 60 + 60) % 60
    const gan = TIAN_GAN[((idx + Math.round((d - new Date(y, 0, 1)) / 86400000)) % 60 + 60) % 60 % 10]
    const gwx = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'][TIAN_GAN.indexOf(gan)]
    if (gwx === favWx) out.push(`${d.getMonth() + 1}月${d.getDate()}日`)
  }
  return out.length ? out.join('、') : '近期请查阅当日干支'
}

function goodTimeOf(favWx) {
  const map = { 木: '寅卯时（3-7点）', 火: '巳午时（9-13点）', 土: '辰戌丑未时（7-9、19-21点）', 金: '申酉时（15-19点）', 水: '亥子时（21-1点）' }
  return map[favWx] || '吉时'
}

// 构建个性化上下文变量
export function buildContext(chart) {
  const y = yearRelation(chart)
  const dayZhi = chart.pillars[2].zhi
  const dayGanIdx = TIAN_GAN.indexOf(chart.dayMaster)
  const weak = chart.strength.weak
  const strong = chart.strength.strong

  // 财星（我克）
  const woKe = WUXING_KE[chart.dayMasterWx]
  const wealthDesc = strong ? `财星${woKe}为用，有主动求财的能力，但须防因刚愎而破财` : `财星${woKe}虽现，然身弱财旺，须防「财多身弱」，赚钱要靠稳扎稳打`
  const wealthWay = strong ? '主动出击、明刀明枪' : '借力合作、细水长流'
  const wealthSign = strong ? '旺' : '平'
  const wealthCaveat = strong ? '财来财去较快，需设好止损线' : '贵人带财，但不可贪心'
  const wealthPersonality = strong ? '进取型' : '稳健型'

  // 官杀（克我）
  const keWo = Object.keys(WUXING_KE).find(k => WUXING_KE[k] === chart.dayMasterWx)

  // 感情
  const loveTraits = { 子: '心思细腻，情感内敛', 丑: '务实专一，慢热真诚', 寅: '热烈主动，重情重义', 卯: '温和感性，桃花不浅', 辰: '稳重顾家，责任感强', 巳: '外冷内热，情感浓烈', 午: '热情直率，敢爱敢恨', 未: '温柔体贴，念旧重情', 申: '机敏开朗，崇尚自由', 酉: '精致优雅，要求颇高', 戌: '忠诚踏实，认定了就是一辈子', 亥: '浪漫多情，精神契合至上' }
  const loveTrait = loveTraits[dayZhi] || '情感丰富'
  const loveSelf = strong ? '习惯在关系中占据主导，偶尔需示弱' : '在感情中细腻敏感，需要被坚定选择'
  const loveStar = ['桃花有动', '正缘渐显', '情缘需静待', '红鸾星动'][Math.abs(dayGanIdx + new Date().getFullYear()) % 4]
  const loveForecast = {
    得印: '感情更重精神共鸣，单身者易在进修、社交场合遇缘',
    泄秀: '你的魅力会自然散发，主动表达就有故事',
    官杀: '感情中压力与责任增多，是考验真心的年份',
    财运: '因忙生财而冷落感情，记得给关系留时间',
    比劫: '身边人多但良缘需辨别，谨防烂桃花'
  }[y.now ? pickLoveType(chart, y) : '得印']
  const loveMatch = wx(chart.favorable[0]).example.split('、')[0] + '、脾气温和' + (strong ? '能包容你' : '能给你安全感') + '的类型'
  const loveSign = strong ? '宜主动创造相处机会' : '宜耐心等待，顺势而为'

  // 健康
  const healthOrgans = wx(chart.dayMasterWx).organs
  const healthTrait = strong ? '精力旺盛但容易透支' : '体质偏敏感，需要规律养护'
  const healthSign = chart.strength.weak ? '脾胃与睡眠' : '心绪与作息'

  // 事业
  const careerType = { 木: '生长型', 火: '绽放型', 土: '承载型', 金: '锐进型', 水: '流动型' }[chart.dayMasterWx]
  const careerField = wx(chart.dayMasterWx).field
  const strongWord = strong ? '敢闯敢拼、执行力强' : '善借力、韧劲足、贵人缘好'

  // 学业
  const indiaStar = wx(Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === chart.dayMasterWx)).example
  const studyTrait = strong ? '悟性高、学得快，但容易三分钟热度' : '坐得住、肯钻研，属于厚积薄发型'
  const studySign = chart.strength.weak ? '多有助益，适合深耕' : '需克服分心，重在专注'

  // 综合
  const generalProfile = strong
    ? `身强喜克泄，格局偏「开创型」：有主见、不服输，适合开拓与承担`
    : `身弱喜生扶，格局偏「配合型」：善于借势、亲和力强，适合协作与深耕`
  const missingWx = chart.wuxingRank[chart.wuxingRank.length - 1]
  const mainLine = `以${chart.dayMasterWx}为根，以${chart.favorable[0]}为用`
  const monthCn = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][chart.month - 1]
  const pillarRelation = y.relation

  const fallbackAdvice = `顺势而谋，以${chart.favorable[0]}为突破方向；避${chart.avoid[0]}之虚耗，守正出奇，答案自然浮现`

  return {
    dayMaster: chart.dayMaster,
    dayMasterWx: chart.dayMasterWx,
    shengxiao: chart.shengxiao,
    pillars: chart.pillars.map(p => `${p.gan}${p.zhi}`).join(' '),
    strength: strong ? '强' : weak ? '弱' : '中和',
    strongWord,
    fav: chart.favorable.join('、'),
    avoid: chart.avoid.join('、'),
    nowGan: y.now.gan,
    nowZhi: y.now.zhi,
    woSheng: WUXING_SHENG[chart.dayMasterWx],
    shaguan: keWo,
    example: wx(chart.favorable[0]).example,
    careerType, careerField,
    wealthDesc, wealthWay, wealthSign, wealthCaveat, wealthPersonality,
    loveTrait, loveStar, loveForecast, loveMatch, loveSelf, loveSign,
    dayZhi,
    healthOrgans, healthTrait, healthSign,
    yearRemark: y.remark, yearImpact: y.impact, bestMonth: y.bestMonth, yearPace: y.pace,
    bestDates: y.bestDates, goodTime: y.goodTime,
    nameAdvice: `取「${wx(chart.favorable[0]).color}」色系意象的字（如${wx(chart.favorable[0]).items.split('、')[0]}相关），兼顾声韵与笔画数，可补${chart.favorable[0]}之气`,
    indiaStar, studyTrait, studySign,
    generalProfile, mainLine, missingWx, month: monthCn,
    pillarRelation,
    fallbackAdvice
  }
}

function pickLoveType(chart, y) {
  const dayWx = chart.dayMasterWx
  const yearWx = (() => {
    const i = TIAN_GAN.indexOf(y.now.gan)
    return ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'][i]
  })()
  if (WUXING_SHENG[yearWx] === dayWx) return '得印'
  if (WUXING_SHENG[dayWx] === yearWx) return '泄秀'
  if (WUXING_KE[yearWx] === dayWx) return '官杀'
  if (WUXING_KE[dayWx] === yearWx) return '财运'
  return '比劫'
}

// 模板替换
function render(template, ctx) {
  return template.replace(/\{(\w+)\}/g, (_, k) => ctx[k] !== undefined ? ctx[k] : `{${k}}`)
}

// 强信号词：命中即直接判定意图，解决歧义（如「正缘」vs「什么时候」）
const STRONG_HINTS = {
  love: ['正缘', '桃花', '姻缘', '分手', '复合', '相亲', '结婚', '男朋友', '女朋友', '老公', '老婆', '恋爱', '婚姻'],
  date: ['吉日', '黄道吉日', '良辰', '择日', '开业日子', '搬家日子', '好日子'],
  career: ['跳槽', '升职', '换工作', '创业', '辞职', '转行'],
  wealth: ['财运', '破财', '发财', '暴富', '投资'],
  health: ['失眠', '生病', '养生', '亚健康'],
  luck: ['本命年', '犯太岁', '流年', '运势'],
  study: ['考研', '升学', '考公', '考试'],
  fengshui: ['风水', '招财位', '布局']
}

// 意图识别：优先强信号词，其次按命中数（平手取列表顺序靠前者）
function detectIntent(text) {
  for (const [key, words] of Object.entries(STRONG_HINTS)) {
    if (words.some(w => text.includes(w))) {
      return INTENTS.find(i => i.key === key) || null
    }
  }
  let best = null
  let bestHits = 0
  for (const intent of INTENTS) {
    const hits = intent.keywords.filter(kw => text.includes(kw)).length
    if (hits > bestHits) {
      best = intent
      bestHits = hits
    }
  }
  return bestHits > 0 ? best : null
}

// 无命盘时的通用回答
function noChartReply(q) {
  const intent = detectIntent(q)
  if (!intent || intent.key === 'gate') {
    return [
      `我是「三门先生」，一位玄学大师。`,
      `八字、紫微、六爻，三法归一。你可以直接问我问题，也可以先排一份命盘，让回答更贴合你的命局。`,
      `请告诉我你的生辰八字，我来帮你排盘+大运，或者你先讨论什么问题，请告诉我。`
    ]
  }
  if (intent.key === 'greeting') {
    return [
      `你好，我是三门先生。`,
      `在我这里，八字、紫微、六爻三门皆通。想问事业、财运、感情，还是先排一份命盘？`
    ]
  }
  if (intent.key === 'divine') {
    return [`占卜问卦，到「六爻门」报三个数，我来为你解卦。`, `心里默念所问之事，心诚则灵。`]
  }
  if (intent.key === 'ziwei') {
    return [`紫微斗数观十二宫星曜，到「紫微门」输入生辰即可览盘。`]
  }
  return [
    `这个问题，结合你的命局来分析会更准。`,
    `请先点开「八字门」输入出生信息排定命盘，之后我们细细聊。`
  ]
}

// 主入口：生成回答（数组分段）
export function generateReply(chart, question) {
  const q = question.trim()

  if (!chart) return noChartReply(q)

  const ctx = buildContext(chart)
  const intent = detectIntent(q)

  if (!intent) {
    return render(HELPERS.fallback[Math.floor(Math.random() * HELPERS.fallback.length)], ctx).split('\n')
  }

  if (intent.key === 'greeting') {
    return [
      `你好呀，我在的。我是三门先生，一位玄学大师。`,
      `你的命盘我已记得清清楚楚：日主${ctx.dayMaster}（${ctx.dayMasterWx}），生肖${ctx.shengxiao}。`,
      `今天想聊点什么？事业、财运、感情，还是今年的运势？也可以到六爻门起一卦。`
    ]
  }

  if (intent.key === 'divine') {
    return [
      `想占卜问事，好主意。六爻问卦，心诚则灵。`,
      `请到「六爻门」起一卦：报三个数字（心里默念所问之事），或者让我随机为你摇一卦。`,
      `卦象一出，我来为你解读趋吉避凶之道。`
    ]
  }

  if (intent.key === 'ziwei') {
    return [
      `紫微斗数以星曜观命，看的是命盘十二宫的星曜布局。`,
      `你的日主是${ctx.dayMaster}（${ctx.dayMasterWx}），生肖${ctx.shengxiao}——以此为基础，我已为你备好「紫微十二宫简览」，就在紫微门中。`,
      `命宫为总纲，财帛、官禄、夫妻诸宫各有分野。去紫微门看看吧。`
    ]
  }

  if (intent.key === 'gate') {
    return [
      `我是「三门先生」，一位玄学大师。`,
      `三门即三法：八字推命、紫微斗数、六爻占卜，三法归一，可断一生之格局，可解一时之疑惑。`,
      `你可以在首页直接问我问题，或点开八字门排盘、六爻门起卦、紫微门览星。心有所问，尽管开口。`
    ]
  }

  if (intent.key === 'luck' && q.includes('具体') === false && /今年|明年|流年|运势/.test(q) && Math.random() < 0.35) {
    return render(HELPERS.flowLuck, ctx).split('\n')
  }

  const pool = RESPONSES[intent.key]
  const template = pool[Math.floor(Math.random() * pool.length)]
  return render(template, ctx).split('\n')
}

// 开场白
export function openingLine(chart) {
  const ctx = buildContext(chart)
  return [
    `命盘已排定。你好，我是三门先生，一位玄学大师。`,
    `你是${ctx.dayMaster}日主（${ctx.dayMasterWx}），生肖${ctx.shengxiao}，四柱：${ctx.pillars}。今年${ctx.nowGan}${ctx.nowZhi}年，整体来看${ctx.yearRemark}`,
    `事业、财运、感情、健康……有什么想问的，尽管开口。`
  ]
}

// 无命盘时的开场白
export function openingNoChart() {
  return [
    `我是「三门先生」，一位玄学大师。`,
    `八字、紫微、六爻，三法归一。你可以直接问我问题，也可以先排一份命盘，让我的回答贴合你的命局。`,
    `请告诉我你的生辰八字，我来帮你排盘+大运，或者你先讨论什么问题，请告诉我。`
  ]
}
