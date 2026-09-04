// 参天八字排盘引擎（基于 cantian-tymext 0.0.26，浏览器可直接运行）
// 提供比本地简化引擎更精确的八字排盘与黄历数据。
import {
  buildBaziFromSolar,
  buildBaziFromLunar,
  baziToMarkdown,
  getChineseCalendar,
  getChineseCalendarMarkdown
} from 'cantian-tymext'

// chart: { year, month, day, hour, minute, gender }
function fmtSolarTime(chart) {
  const pad2 = n => String(n).padStart(2, '0')
  const y = chart.year ?? new Date().getFullYear()
  const m = chart.month ?? new Date().getMonth() + 1
  const d = chart.day ?? new Date().getDate()
  const h = chart.hour ?? 12
  const min = chart.minute ?? 0
  return `${y}-${pad2(m)}-${pad2(d)} ${pad2(h)}:${pad2(min)}`
}

// 完整八字排盘 Markdown（供 LLM 解读）
export function buildBaziFull(chart) {
  if (!chart || !chart.year || !chart.month || !chart.day) {
    return '（尚未提供出生时间，请补充公历年月日）'
  }
  try {
    const solarTime = fmtSolarTime(chart)
    const bazi = buildBaziFromSolar({
      solarTime,
      gender: chart.gender === '女' ? 0 : 1,
      sect: 2
    })
    return baziToMarkdown(bazi)
  } catch (e) {
    return `（八字排盘失败：${e.message}）`
  }
}

// 农历转八字（chart: { lunarYear, lunarMonth, lunarDay, lunarHour?, isLeap?, gender }）
export function buildBaziFromLunarFull(chart) {
  if (!chart || !chart.lunarYear || !chart.lunarMonth || !chart.lunarDay) {
    return '（尚未提供农历时间，请补充农历年月日）'
  }
  try {
    // cantian-tymext 0.0.26 的 buildBaziFromLunar 内部以 new Date(lunarTime) 解析，
    // 必须使用补零的 YYYY-MM-DD HH:mm 格式，否则返回 Invalid Date（illegal lunar year: NaN）。
    // 注意：0.0.26 无法表达闰月（原 '*1' 后缀会导致 new Date 解析失败），闰月请先转公历后走 buildBaziFull。
    const pad2 = n => String(n).padStart(2, '0')
    const y = Number(chart.lunarYear), m = Number(chart.lunarMonth), d = Number(chart.lunarDay)
    const h = chart.lunarHour != null ? Number(chart.lunarHour) : 12
    const lunarTime = `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)} ${pad2(h)}:00`
    const bazi = buildBaziFromLunar({
      lunarTime,
      gender: chart.gender === '女' ? 0 : 1,
      sect: 2
    })
    return baziToMarkdown(bazi)
  } catch (e) {
    return `（农历八字排盘失败：${e.message}）`
  }
}

// 黄历（date: Date 或 'YYYY-MM-DD'）
export function buildCantianHuangli(dateStr) {
  let y, m, d
  if (typeof dateStr === 'string' && dateStr.length >= 8) {
    const p = dateStr.split('-').map(Number)
    y = p[0]; m = p[1]; d = p[2]
  } else {
    const now = new Date()
    y = now.getFullYear(); m = now.getMonth() + 1; d = now.getDate()
  }
  try {
    const cal = getChineseCalendar({ year: y, month: m, day: d })
    const md = getChineseCalendarMarkdown(cal)
    // 修正节气字段：[object Object] → 文本
    return md.replace('节气：[object Object]', '')
  } catch (e) {
    return `（黄历排盘失败：${e.message}）`
  }
}

// ===== 现代幽默黄历（移植自 cantian-bazi skill 的 generateModernHuangli）=====
// 底部用 0.0.26 的 getChineseCalendar 融入真实农历/干支数据，使幽默黄历"有据可依"。

// 场景配置（打工人 / 程序员 / 学生党）
const MODERN_SCENARIOS = {
  worker: {
    name: '打工人版', emoji: '💼',
    persona: '职场社畜日：表面"好的收到"，内心"又来？"',
    bgm: '《打工行》',
    yi: [
      '带薪拉屎——15分钟起步，手机必带',
      '会议摸鱼——假装记笔记，其实在回微信',
      '甩锅给流程——"这个要走审批，我一个人决定不了"',
      'PPT美化——内容不行，排版来凑',
      '准时下班——今天不一样，今天我要做自己',
      '老板画饼时微笑——配合演出，奖金靠演技'
    ],
    ji: [
      '主动揽活——"这个我可以负责"= 给自己挖坟',
      '跟HR说实话——"我想离职"= 被离职',
      '开会抢着发言——说多错多，沉默是金',
      '答应周末加班——答应一次，一辈子被钉死',
      '跟同事交心——转正那天他就是你的竞争对手'
    ],
    tips: { '幸运方位': '茶水间（摸鱼 safe house）', '幸运色': '黑色（显瘦+耐脏+看起来很忙）', '幸运数字': '250（别问为什么，问就是缘分）', '避雷同事': '那种"简单嘛五分钟就好"的人' },
    zodiac: { '鼠': '今天适合藏零食，别让同事发现', '牛': '今天被当成牛马使唤，忍住不哭', '虎': '今天气场两米八，适合怼人（但别怼老板）', '兔': '今天适合卖萌，有问题卖萌解决', '龙': '今天自带BGM，走路带风', '蛇': '今天适合躺平，但躺着也要卷', '马': '今天跑得飞快，但不知道在跑啥', '羊': '今天有点丧，喝点奶茶续命吧', '猴': '今天适合上蹿下跳，但别跳太欢', '鸡': '今天适合早起，虽然你起不来', '狗': '今天适合摇尾巴，谁给饭就跟谁走', '猪': '今天适合吃吃睡睡，人生理想达成' },
    mental: ['如果老板骂你：默念"他工资高所以他变态，我工资低我正常"', '如果客户刁难：想想下个月的花呗，忍住！', '如果同事甩锅：微笑说"好的我看一下"（然后甩回去）', '如果加班到崩溃：记住，你还年轻，还可以熬10年']
  },
  programmer: {
    name: '程序员版', emoji: '💻',
    persona: 'Debug地狱日：代码能跑就行，别问我为什么',
    bgm: '《梦中的代码》',
    yi: [
      'Ctrl+C/V——开源精神，能抄绝不写',
      'Stack Overflow——全世界程序员的共同老师',
      '甩锅给浏览器——"这个bug是Chrome的锅！"',
      '重构拖延症——"下个版本再优化"（永远不会有下个版本）',
      '跟产品说"技术上实现不了"——万能挡箭牌',
      '深夜commit——凌晨3点的代码最纯洁（也最buggy）'
    ],
    ji: [
      '修改生产环境——手滑=全网崩溃=上新闻',
      '说"这个很简单"——简单=免费=你的活',
      '帮妹子修电脑——修好是应该的，修不好是废物',
      '在会上说"我估计一下"——说出去的时间乘以3才是真实的',
      '看自己的老代码——"哪个傻X写的这破代码？" "哦，是我"'
    ],
    tips: { '幸运编程语言': 'Python（人生苦短）', '幸运编辑器': 'Vim（装X神器）', '幸运Bug': '别人发现的Bug', '避雷操作': 'rm -rf /' },
    zodiac: { '鼠': '今天适合写单元测试（虽然你不会写）', '牛': '牛郎织女都不如你跟代码的异地恋', '虎': '今天适合Code Review，挑别人毛病最爽', '兔': '敏捷开发=快速出bug', '龙': '今天代码一次过，太阳从西边出来', '蛇': 'Python之禅：优雅胜于丑陋（但你的代码很丑）', '马': '跑得最快的是你的Deadline', '羊': '今天适合养羊城（服务器又崩了）', '猴': '上蹿下跳debug，但bug在别人的代码里', '鸡': '今天适合打log，console.log大法好', '狗': '今天被产品经理遛，汪汪汪', '猪': '吃吃睡睡等发版，发版即背锅' },
    mental: ['遇到Bug：先重启，不行就怪缓存', '需求变更：深呼吸，默念"习惯就好"', '被测试小姐姐找bug：请她喝奶茶，保命要紧', '线上崩溃：背锅是成长的代价（误）']
  },
  student: {
    name: '学生党版', emoji: '📚',
    persona: '期末挣扎日：平时不努力，临时抱佛脚',
    bgm: '《同桌的你》',
    yi: [
      '图书馆打卡——拍张照发朋友圈，假装很努力',
      '抄作业——作业可以抄，但姿势要帅',
      '跟学霸套近乎——"大佬，这题怎么做？"（考前专用）',
      '逃课睡觉——选修课而已，不逃白不逃',
      '食堂抢饭——跑得快有肉吃',
      '深夜网抑云——"我是谁，我在哪，我为什么要考研"'
    ],
    ji: [
      '考试作弊——被抓=档案黑历史=后悔一辈子',
      '跟室友吵架——抬头不见低头见，忍住',
      '通宵打游戏——明天的课，但明天再说吧',
      '表白——毕业就分手，何必呢（真香）',
      '花生活费买皮肤——月底吃土的是你自己'
    ],
    tips: { '幸运座位': '最后一排（摸鱼专属）', '幸运科目': '体育（能及格就行）', '避雷科目': '高数（挂科之王）', '幸运食物': '泡面（学生党续命水）' },
    zodiac: { '鼠': '今天适合藏零食在图书馆，饿了来一口', '牛': '今天适合死记硬背，虽然背了也忘', '虎': '今天气场强，适合课堂提问（装X专用）', '兔': '今天适合卖萌求学霸帮忙写作业', '龙': '今天自带学霸光环，但实际并没有', '蛇': '今天适合躺平，但躺着也要背单词', '马': '跑得最快的是你的DDL', '羊': '今天有点丧，喝杯奶茶续命', '猴': '上蹿下跳，但静不下心学习', '鸡': '今天早起也没用，还是会迟到教室', '狗': '谁给分跟谁走，老师的忠犬', '猪': '吃吃睡睡等放假，学生时代理想状态' },
    mental: ['考试焦虑：默念"及格就行，60分万岁"', '被点名：假装肚子疼，虽然你并不疼', '挂科危机：找学霸帮忙，请吃饭有用', '生活费不够：跟爸妈撒娇，虽然你已成年', '暗恋不敢说：毕业前不说，这辈子别说了']
  },
  free: {
    name: '自由一族版', emoji: '🌿',
    persona: '自由自在日：时间自己说了算，节奏自己定',
    bgm: '《自由地呼吸》',
    yi: [
      '睡到自然醒——没有早八没有打卡，爽',
      '自由安排——想干活就干活，想发呆就发呆',
      '宅家充电——追剧、撸猫、打游戏，快乐到飞起',
      '随缘接活——有钱就赚，累了就歇',
      '出门散步——阳光正好，不被会议室绑架',
      '养生放空——岁月静好，血压平稳'
    ],
    ji: [
      '跟别人比进度——自由不等于躺平，但也不要比',
      '过度焦虑——接不到活是暂时的，慌啥',
      '熬夜刷手机——自由也要健康作息',
      '自我怀疑——"我是不是在浪费时间"？不，你在生活',
      '冲动消费——自由职业收入波动，花钱悠着点'
    ],
    tips: { '幸运姿势': '舒服坐姿（怎么舒服怎么来）', '幸运活动': '按自己的节奏做事', '幸运食物': '健康轻食（为长久自由攒本钱）', '避雷行为': '和上班族比作息（自讨苦吃）' },
    zodiac: { '鼠': '今天适合囤货休整，为自由的日子做准备', '牛': '稳步推进，自由不等于躺平，节奏自己定', '虎': '今天状态在线，自由发挥正当时', '兔': '卖萌装可爱，今天想怎么过就怎么过', '龙': '自带主角光环，做自己的主人', '蛇': '沉得住气，静待属于自己的时机', '马': '今天想跑就跑，不想跑就遛弯', '羊': '心情惬意，享受当下的松弛感', '猴': '机灵变通，今天点子特别多', '鸡': '自律作息，把自由的日子过得有声有色', '狗': '忠于自己，今天不必讨好任何人', '猪': '吃饱喝足，把日子过成向往的样子' },
    mental: ['收入焦虑：默念"今天也是自由的一天，焦虑不解决任何事"', '看到别人晒奋斗：笑笑，"他在过他的，我在过我的"', '被劝"找份稳定工作"：感谢关心，"我现在就挺稳的"', '闲下来心虚：放松也是生产力，自在就是好状态']
  }
}

// 场景名解析（支持中文/英文/别名）
// 收敛为三大类：打工人 worker / 学生党 student / 自由一族 free
function parseScenario(input) {
  const map = {
    '打工人': 'worker', 'worker': 'worker', '上班族': 'worker', 'office': 'worker',
    '程序员': 'worker', 'programmer': 'worker', '程序猿': 'worker',
    '学生': 'student', '学生党': 'student', 'student': 'student', '考研': 'student',
    '自由': 'free', '自由族': 'free', '自由一族': 'free', '自由职业': 'free', 'free': 'free',
    '躺平': 'free', '躺平族': 'free', '躺': 'free', 'tangping': 'free',
    '退休': 'free', '退休族': 'free', '自由人': 'free', '闲云野鹤': 'free'
  }
  if (!input) return 'worker'
  return map[String(input).trim().toLowerCase()] || map[String(input).trim()] || 'worker'
}

// 根据订阅人的「年纪 + 身份」推断黄历场景
// 身份优先（明确选择），未选择时按年纪兜底推断
// 返回场景 key：worker | student | free
export function inferScenario(age, role) {
  // 明确身份优先
  if (role) {
    const parsed = parseScenario(role)
    if (parsed !== 'worker') return parsed
    if (role && role !== 'worker') return 'worker' // 明确选了打工人/上班族
  }
  const a = Number(age)
  if (!Number.isFinite(a)) return role ? parseScenario(role) : 'worker'
  // 学生阶段：6-22 岁
  if (a >= 6 && a <= 22) return 'student'
  // 退休/老年：60 岁及以上，自动归入自由一族
  if (a >= 60) return 'free'
  // 23-59 职场阶段
  if (a >= 23 && a <= 59) return 'worker'
  // 其余（<6 岁等）用身份或默认
  return role ? parseScenario(role) : 'worker'
}

// 计算周岁
export function calcAge(year, month, day, now) {
  const t = now || new Date()
  let age = t.getFullYear() - year
  if (t.getMonth() + 1 < month || (t.getMonth() + 1 === month && t.getDate() < day)) age -= 1
  return Math.max(age, 0)
}

// 取指定场景的数据对象（供报告/前端使用）
export function getSceneData(scenario) {
  return MODERN_SCENARIOS[parseScenario(scenario)] || MODERN_SCENARIOS.worker
}

// 场景 key → 中文名
export function sceneName(scenario) {
  return getSceneData(scenario).name
}

/**
 * 现代幽默黄历（娱乐向）
 * @param {string|Date} dateStr 日期，缺省今天
 * @param {string} scenario 场景：打工人/程序员/学生党
 * @returns {string} Markdown
 */
export function buildModernHuangli(dateStr, scenario) {
  let y, m, d
  if (typeof dateStr === 'string' && dateStr.length >= 8) {
    const p = dateStr.split('-').map(Number)
    y = p[0]; m = p[1]; d = p[2]
  } else if (dateStr instanceof Date && !isNaN(dateStr)) {
    y = dateStr.getFullYear(); m = dateStr.getMonth() + 1; d = dateStr.getDate()
  } else {
    const now = new Date()
    y = now.getFullYear(); m = now.getMonth() + 1; d = now.getDate()
  }
  const s = MODERN_SCENARIOS[parseScenario(scenario)] || MODERN_SCENARIOS.worker

  // 融入真实农历/干支（0.0.26 getChineseCalendar）
  let lunarText = ''
  try {
    const cal = getChineseCalendar({ year: y, month: m, day: d })
    lunarText = `农历${cal.lunarYear}年${cal.lunarMonth}${cal.lunarDay} · ${cal.yearGanZhi}年 ${cal.monthGanZhi}月 ${cal.dayGanZhi}日`
  } catch { lunarText = '' }

  const lines = []
  lines.push(`# 📅 现代幽默黄历 · ${y}年${m}月${d}日`)
  if (lunarText) lines.push(`> ${lunarText}`)
  lines.push('')
  lines.push(`## 🎭 今日人设（${s.emoji} ${s.name}）`)
  lines.push(`**${s.persona}**`)
  lines.push(`**今日BGM**：${s.bgm}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## ✅ 今日宜（老天爷让你做的事）')
  for (const it of s.yi) {
    const [head, tail] = splitYi(it)
    lines.push(`✅ **${head}**——${tail || ''}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## ❌ 今日忌（老天爷不让你做的事）')
  for (const it of s.ji) {
    const [head, tail] = splitYi(it)
    lines.push(`❌ **${head}**——${tail || ''}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 🧭 今日玄学指南')
  lines.push('| 项目 | 建议 |')
  lines.push('|------|------|')
  for (const [k, v] of Object.entries(s.tips)) lines.push(`| **${k}** | ${v} |`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 🐭 十二生肖今日运势（胡说八道版）')
  for (const [z, text] of Object.entries(s.zodiac)) lines.push(`${z}：${text}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 💊 今日心理健康小贴士')
  for (const tip of s.mental) lines.push(`- ${tip}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## ⚠️ 免责声明')
  lines.push('本黄历纯属**胡说八道**，如有雷同，纯属巧合。仅供娱乐，不构成任何建议。')
  lines.push('祝今天的你：少掉头发，多涨工资，少遇到bug，多喝奶茶不长胖！🎉')
  return lines.join('\n')
}

// 拆分 "宜事项——说明" 为 [head, tail]
function splitYi(item) {
  const idx = item.indexOf('——')
  if (idx === -1) return [item, '']
  return [item.slice(0, idx), item.slice(idx + 2)]
}

// 取真实黄历数据对象（getChineseCalendar），失败返回 null
function realHuangli(y, m, d) {
  try {
    return getChineseCalendar({ year: y, month: m, day: d })
  } catch {
    return null
  }
}

// 解析日期为 { y, m, d }
function parseYMD(dateStr, now) {
  if (typeof dateStr === 'string' && dateStr.length >= 8) {
    const p = dateStr.split('-').map(Number)
    return { y: p[0], m: p[1], d: p[2] }
  }
  if (dateStr instanceof Date && !isNaN(dateStr)) {
    return { y: dateStr.getFullYear(), m: dateStr.getMonth() + 1, d: dateStr.getDate() }
  }
  const t = now || new Date()
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
}

/**
 * 融合黄历（黄历功能的统一出口）
 * = 传统真实黄历数据（宜忌/冲煞/彭祖百忌/方位/农历干支） + 现代幽默宜忌
 * 保留冲煞/吉凶等真实数据，但用幽默风格呈现。
 * @param {string|Date} dateStr 日期，缺省今天
 * @param {string} scenario 场景：打工人/程序员/学生党
 * @param {object} extra 可选：附加段（如结合八字的开运建议）
 * @returns {string} Markdown
 */
export function buildFusedHuangli(dateStr, scenario, extra) {
  const { y, m, d } = parseYMD(dateStr)
  const s = MODERN_SCENARIOS[parseScenario(scenario)] || MODERN_SCENARIOS.worker
  const cal = realHuangli(y, m, d)

  const lines = []
  lines.push(`# 📅 黄历 · ${y}年${m}月${d}日`)

  // 真实农历/干支（有据可依）
  if (cal) {
    const lunar = String(cal.农历).replace(/^农历/, '')
    const jieqi = typeof cal.节气 === 'string' ? cal.节气 : (cal.节气 && (cal.节气.name || cal.节气.jieqi)) || ''
    lines.push(`> 农历${lunar} · ${cal.干支日期} · ${cal.生肖} · 纳音${cal.纳音}`)
    if (cal.农历节日) lines.push(`> 🏮 农历节日：${cal.农历节日}`)
    if (cal.公历节日) lines.push(`> 🎊 公历节日：${cal.公历节日}`)
    if (jieqi) lines.push(`> 🌦 节气：${jieqi}`)
  }
  lines.push('')

  // 现代幽默人设
  lines.push(`## 🎭 今日人设（${s.emoji} ${s.name}）`)
  lines.push(`**${s.persona}**`)
  lines.push(`**今日BGM**：${s.bgm}`)
  lines.push('')

  lines.push('---')
  lines.push('')

  // 现代幽默宜忌
  lines.push('## ✅ 今日宜（现代版，仅供参考）')
  for (const it of s.yi) {
    const [head, tail] = splitYi(it)
    lines.push(`✅ **${head}**——${tail || ''}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## ❌ 今日忌（现代版，仅供参考）')
  for (const it of s.ji) {
    const [head, tail] = splitYi(it)
    lines.push(`❌ **${head}**——${tail || ''}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  // 传统真实宜忌 + 冲煞 + 方位（真实数据，幽默标题）
  if (cal) {
    lines.push('## 📜 老黄历真相（传统数据，童叟无欺）')
    if (cal.宜) lines.push(`**宜**：${cal.宜}`)
    if (cal.忌) lines.push(`**忌**：${cal.忌}`)
    if (cal.冲煞) lines.push(`**冲煞**：${cal.冲煞}`)
    if (cal.彭祖百忌) lines.push(`**彭祖百忌**：${cal.彭祖百忌}`)
    lines.push(`**方位**：喜神${cal.喜神方位}｜财神${cal.财神方位}｜福神${cal.福神方位}`)
    lines.push(`**二十八宿**：${cal.二十八宿}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // 结合八字的开运建议（由调用方注入，幽默化表达）
  if (extra && extra.action) {
    lines.push('## 🔮 结合你的八字')
    lines.push(`**${extra.action.head}**——${extra.action.body}`)
    if (extra.tips) {
      lines.push(`**开运锦囊**：幸运色${extra.tips.color}、吉方${extra.tips.dir}、幸运数字${extra.tips.num}、贵人属相${extra.tips.noble}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // 玄学指南（幽默）
  lines.push('## 🧭 今日玄学指南')
  lines.push('| 项目 | 建议 |')
  lines.push('|------|------|')
  for (const [k, v] of Object.entries(s.tips)) lines.push(`| **${k}** | ${v} |`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // 生肖运势（幽默）
  lines.push('## 🐭 十二生肖今日运势（胡说八道版）')
  for (const [z, text] of Object.entries(s.zodiac)) lines.push(`${z}：${text}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // 心理小贴士
  lines.push('## 💊 今日心理健康小贴士')
  for (const tip of s.mental) lines.push(`- ${tip}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## ⚠️ 免责声明')
  lines.push('传统黄历数据来自真实历法排盘，现代宜忌纯属**胡说八道**，如有雷同纯属巧合。仅供娱乐，不构成任何建议。')
  lines.push('祝今天的你：少掉头发，多涨工资，少遇到bug，多喝奶茶不长胖！🎉')
  return lines.join('\n')
}

// 解析宜忌条目 head/tail 为数组
function yiJiItems(list) {
  return (list || []).map(it => {
    const [head, tail] = splitYi(it)
    return { head: head || it, tail: tail || '' }
  })
}

/**
 * 融合黄历结构化数据（供前端 UI 直接消费）
 * 返回 { 真实数据 + 幽默场景 + 可选八字开运 }，字段友好便于 JSX 渲染。
 * @param {string|Date} dateStr
 * @param {string} scenario
 * @param {object} extra 可选 { action, tips }
 */
export function buildFusedHuangliData(dateStr, scenario, extra) {
  const { y, m, d } = parseYMD(dateStr)
  const s = MODERN_SCENARIOS[parseScenario(scenario)] || MODERN_SCENARIOS.worker
  const cal = realHuangli(y, m, d)
  const jieqi = cal && (typeof cal.节气 === 'string' ? cal.节气 : (cal.节气 && (cal.节气.name || cal.节气.jieqi)) || '')
  return {
    date: `${y}年${m}月${d}日`,
    ymd: `${y}-${m}-${d}`,
    lunar: cal ? String(cal.农历).replace(/^农历/, '') : '',
    ganzhi: cal ? cal.干支日期 : '',
    shengxiao: cal ? cal.生肖 : '',
    nayin: cal ? cal.纳音 : '',
    lunarFestival: cal ? cal.农历节日 : '',
    solarFestival: cal ? cal.公历节日 : '',
    jieqi: jieqi || '',
    real: cal ? {
      yi: cal.宜 || '',
      ji: cal.忌 || '',
      chong: cal.冲煞 || '',
      pengzu: cal.彭祖百忌 || '',
      xishen: cal.喜神方位 || '',
      caishen: cal.财神方位 || '',
      fushen: cal.福神方位 || '',
      ershiba: cal.二十八宿 || '',
    } : null,
    scene: {
      name: s.name, emoji: s.emoji, persona: s.persona, bgm: s.bgm,
      yi: yiJiItems(s.yi), ji: yiJiItems(s.ji),
      tips: s.tips, zodiac: s.zodiac, mental: s.mental,
    },
    fortune: extra || null,
  }
}
