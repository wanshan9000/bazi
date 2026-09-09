// 参天八字排盘引擎（基于 cantian-tymext 0.0.26，浏览器可直接运行）
// 提供比本地简化引擎更精确的八字排盘与黄历数据。
import {
  buildBaziFromSolar,
  buildBaziFromLunar,
  baziToMarkdown,
  getChineseCalendar,
  getChineseCalendarMarkdown
} from 'cantian-tymext'
import { buildDaily } from './huangli.js'

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

// 场景配置：现代幽默只负责把传统黄历翻译成生活语言，不能替代传统规则。
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
    tips: {
      '换脑地点': '卡住时去接水、走两分钟再回来；带着一个问题回来，比空刷消息更有用。',
      '呈现状态': '开会或汇报前选利落、方便行动的搭配；少穿需要反复整理的衣服。',
      '工作节奏': '先处理需要别人配合的消息，再留一段完整时间做深度任务。',
      '协作边界': '听到“就五分钟”先确认范围、截止时间和谁拍板；没标准的紧急最容易变成加班。'
    },
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
    tips: {
      '学习开场': '先打开资料写三行或做一道题；启动完成后，再决定要不要继续加码。',
      '专注环境': '选一个手机不容易拿起的位置，把最难的任务放在这段时间。',
      '复习节奏': '先补一个薄弱点，再整理笔记；别在资料收集里假装复习。',
      '消费提醒': '生活费先留出本周必要开销，想买的东西隔一天再决定。'
    },
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
    tips: {
      '工作开场': '先完成最能带来进展的一小步，让灵感有一个落点。',
      '交付节奏': '把今天的交付拆成可发出的版本；先发出去，再慢慢打磨。',
      '收入边界': '报价、时间和修改次数写清楚，松弛不等于把细节交给运气。',
      '休息安排': '给休息留出明确时段；放松是安排，不是拖延后的愧疚。'
    },
    zodiac: { '鼠': '今天适合囤货休整，为自由的日子做准备', '牛': '稳步推进，自由不等于躺平，节奏自己定', '虎': '今天状态在线，自由发挥正当时', '兔': '卖萌装可爱，今天想怎么过就怎么过', '龙': '自带主角光环，做自己的主人', '蛇': '沉得住气，静待属于自己的时机', '马': '今天想跑就跑，不想跑就遛弯', '羊': '心情惬意，享受当下的松弛感', '猴': '机灵变通，今天点子特别多', '鸡': '自律作息，把自由的日子过得有声有色', '狗': '忠于自己，今天不必讨好任何人', '猪': '吃饱喝足，把日子过成向往的样子' },
    mental: ['收入焦虑：默念"今天也是自由的一天，焦虑不解决任何事"', '看到别人晒奋斗：笑笑，"他在过他的，我在过我的"', '被劝"找份稳定工作"：感谢关心，"我现在就挺稳的"', '闲下来心虚：放松也是生产力，自在就是好状态']
  },
  enjoy: {
    name: '享受族（退休人士）', emoji: '🍵',
    persona: '从容安排日：日程表可以有，但不必赶着把每格都填满',
    bgm: '《慢慢来》',
    yi: [
      '晨间遛弯——步数不必登顶，心情先到位',
      '约老友喝茶——把群里的“改天”落实成今天',
      '整理旧照片——原来年轻时的发量也是真实存在过的',
      '逛菜场——用买一把葱的预算，聊半小时家常',
      '午后小憩——不是偷懒，是给下午留一点精神余额',
      '给晚辈点赞——朋友圈巡查工作，今日照常开展'
    ],
    ji: [
      '替全家操心——成年人的作业，留给成年人自己写',
      '空腹抢保健品——先吃饭，再研究“限量福利”',
      '久坐刷短视频——再精彩也不如出门晒十分钟太阳',
      '跟体检报告硬碰硬——按医嘱复查，比搜索症状靠谱',
      '为了面子逞强——今天的英雄任务，交给年轻人也行'
    ],
    tips: {
      '今日仪式': '泡一杯喜欢的茶，把一件惦记的小事慢慢做完。',
      '出门安排': '菜场、公园或老友家选一处轻松走走；不用把行程排得太满。',
      '聊天主题': '少比较成绩，多问近况；把“改天见”换成一个具体时间。',
      '信息提醒': '群聊转发前先看来源；身体不舒服时，记录后再咨询专业人士。'
    },
    zodiac: { '鼠': '今天适合把零食藏好，留给下午茶的自己', '牛': '稳稳当当过日子，慢一点并不耽误抵达', '虎': '精神头不错，散步时别把广场当赛场', '兔': '今天适合约人聊聊，温柔比道理更管用', '龙': '气场在线，合照请站到自己喜欢的位置', '蛇': '适合安静读几页书，困了就把书签夹好', '马': '腿脚想动就出门走走，别把好天气辜负了', '羊': '心软是优点，钱包也要留一点原则', '猴': '点子很多，给家里添个小物件正合适', '鸡': '早起的精神头值得夸，午休也值得安排', '狗': '今天适合关心老朋友，一句问候比表情包暖', '猪': '吃好睡好就是正经事，其他排队办理' },
    mental: ['子女忙：忙是他们的节奏，照顾好自己也是给家里省心', '身体小不适：先记录、再咨询，别让群消息替医生看诊', '想念老朋友：发一句“出来喝茶吗”，比翻通讯录更有效', '觉得一天太快：把喜欢的小事写进日程，日子自然慢下来']
  }
}

// 场景名解析（支持中文/英文/别名）
// 收敛为四大类：打工人 / 学生党 / 自由族 / 享受族（退休人士）
function parseScenario(input) {
  const map = {
    '打工人': 'worker', 'worker': 'worker', '上班族': 'worker', 'office': 'worker',
    '程序员': 'worker', 'programmer': 'worker', '程序猿': 'worker',
    '学生': 'student', '学生党': 'student', 'student': 'student', '考研': 'student',
    '自由': 'free', '自由族': 'free', '自由一族': 'free', '自由职业': 'free', 'free': 'free',
    '躺平': 'free', '躺平族': 'free', '躺': 'free', 'tangping': 'free',
    '退休': 'enjoy', '退休族': 'enjoy', '享受族': 'enjoy', '退休人士': 'enjoy', 'enjoy': 'enjoy',
    '自由人': 'free', '闲云野鹤': 'free'
  }
  if (!input) return 'worker'
  return map[String(input).trim().toLowerCase()] || map[String(input).trim()] || 'worker'
}

// 根据订阅人的「年纪 + 性别 + 身份」推断黄历场景
// 身份优先（明确选择），未选择时按年纪和性别兜底推断
// 返回场景 key：worker | student | free | enjoy
export function inferScenario(age, role, gender) {
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
  // 退休/享受族：男性 60 岁起，女性 50 岁起。
  // 性别缺失时沿用较保守的男性阈值，避免过早自动归类。
  const retirementAge = gender === '女' ? 50 : 60
  if (a >= retirementAge) return 'enjoy'
  // 23 岁起至退休前默认归入打工人；自由族需由用户主动选择。
  if (a >= 23) return 'worker'
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

// 拆分 "宜事项——说明" 为 [head, tail]
function splitYi(item) {
  const idx = item.indexOf('——')
  if (idx === -1) return [item, '']
  return [item.slice(0, idx), item.slice(idx + 2)]
}

function almanacItems(value) {
  return String(value || '').split(/[、,，]/).map(item => item.trim()).filter(Boolean)
}

function containsAny(items, words) {
  return items.some(item => words.some(word => item.includes(word)))
}

/**
 * 将传统宜忌翻译为四类人的日常安排。
 * 这不是新的黄历规则：source 明确保留所参考的传统字段，展示层也与彭祖黄历分开。
 */
function buildSceneGuidance(scenario, cal, daily) {
  const key = parseScenario(scenario)
  const yi = almanacItems(cal?.宜)
  const ji = almanacItems(cal?.忌)
  const context = {
    worker: {
      active: ['把外勤、客户拜访或跨团队沟通排在前半天；能走出工位办成的事，别开第三个会。', '今天适合推进一件卡住的小事，先发消息、再开文档，别在标题上加“紧急”制造新焦虑。'],
      calm: '适合清理待办、补流程和回收会议纪要；把“我晚点看”变成一个明确时间。',
      avoid: '容易越做越多的事先写清边界；临时接到“就五分钟”的需求，先问交付标准。',
      chong: '涉及出行或重要沟通时多留十分钟缓冲，别把赶路的脾气带进会议室。'
    },
    student: {
      active: ['适合去图书馆、找同学讨论或把拖延的作业开个头；先写三行，也算启动成功。', '适合处理报名、借书或课程沟通；消息回了，DDL 就少一分神秘感。'],
      calm: '适合复盘笔记、整理资料和补基础题；今天不追“速成”，追“看得懂”。',
      avoid: '少开“再刷五分钟”的盲盒；学习间隙可以休息，但别把休息演成通宵。',
      chong: '赶课、赶考或出门见人时提早一点；从容到场，比卡点冲刺更像主角。'
    },
    free: {
      active: ['适合见客户、跑一趟现场或把灵感落成一个小样；自由的好处，是先做最有感觉的那件。', '适合投递、对账或更新作品；给未来的自己留一个可复用的成果。'],
      calm: '适合排期、整理素材和收尾；不接新活也没关系，先把旧坑填平。',
      avoid: '别把“灵感来了再说”当作唯一流程；先定一个最小交付，心会安一点。',
      chong: '出门、报价或签约前多核一次时间和金额；松弛不等于把细节交给宇宙。'
    },
    enjoy: {
      active: ['适合约老友喝茶、去公园走走或顺路买些喜欢的菜；今天的行程，舒服比打卡重要。', '适合探望、联络和安排一件惦记已久的小事；一句“出来坐坐”就很有分量。'],
      calm: '适合整理照片、读书或收拾家中小角落；慢慢做，日子会自己显出光。',
      avoid: '别替全家把每件事都操心到底；把自己的午休和散步先排进日程。',
      chong: '外出办事不赶时间，路上多留余量；稳稳当当到达，就是今天的满分。'
    }
  }[key] || null
  if (!context) return []

  const movementDay = containsAny(yi, ['出行', '会友', '开市', '交易', '移徙', '纳财'])
  const settleDay = containsAny(yi, ['扫舍', '修饰', '修造', '祭祀', '祈福', '解除', '安床'])
  const majorTaboo = containsAny(ji, ['动土', '破土', '开市', '交易', '嫁娶', '安葬'])
  const primaryYi = yi[0] || '待规则库补齐'
  const primaryJi = ji[0] || '待规则库补齐'
  const bazi = baziContext(daily).short
  const activeText = movementDay ? context.active[0] : context.active[1]
  const calmText = settleDay ? context.calm : `${context.calm} ${movementDay ? '' : '先把节奏稳下来，下午再决定要不要加码。'}`
  const pace = daily?.relation === '顺'
    ? `命局与今日五行关系较顺，${bazi}，可把精力优先放在这一项。`
    : daily?.relation === '慎'
      ? `命局与今日五行略有冲克，${bazi}，先确认边界与节奏再推进。`
      : `命局与今日五行关系平稳，${bazi}，按自己的节奏完成即可。`
  const calendar = daily?.monthGanzhi && daily?.jianchu ? `日历依据：${daily.monthGanzhi}${daily.jianchu}日` : '日历依据：当天黄历'

  return [
    { kind: '宜', source: `${calendar}｜传统宜：${primaryYi}`, title: movementDay ? '把脚步用在要紧处' : '先完成一个小闭环', body: `${activeText} ${pace}` },
    { kind: '宜', source: `${calendar}｜传统宜：${yi[1] || primaryYi}`, title: '留一点从容给自己', body: `${calmText} ${pace}` },
    { kind: '忌', source: `${calendar}｜传统忌：${primaryJi}`, title: majorTaboo ? '大动作先不抢跑' : '别让待办无限繁殖', body: `${context.avoid} ${pace}` },
    ...(cal?.冲煞 ? [{ kind: '冲', source: `${calendar}｜传统冲煞：${cal.冲煞}`, title: '出门和沟通都留余量', body: `${context.chong} ${pace}` }] : [])
  ]
}

function relationLabel(daily) {
  if (daily?.relation === '顺') return '命局与日气较顺'
  if (daily?.relation === '慎') return '命局与日气宜多确认'
  return '命局与日气较平稳'
}

function baziContext(daily) {
  const bazi = daily?.bazi
  if (!bazi?.dayMaster) return { short: '未录入日主信息', detail: '未录入完整八字信息' }
  const favorable = bazi.favorable?.filter(Boolean).join('、') || '平衡五行'
  const avoid = bazi.avoid?.filter(Boolean).join('、') || '五行失衡'
  return {
    short: `${bazi.dayMaster}${bazi.dayMasterWx || ''}日主 · 偏好${favorable}`,
    detail: `八字依据：${bazi.dayMaster}${bazi.dayMasterWx || ''}日主，偏好${favorable}，留意${avoid}`
  }
}

// 同一份上下文供个性化黄历各区块复用，避免场景、八字、传统黄历各说各话。
function buildPersonalContext(scene, cal, daily) {
  const yi = almanacItems(cal?.宜)
  const ji = almanacItems(cal?.忌)
  const calendar = daily?.monthGanzhi && daily?.jianchu
    ? `${daily.monthGanzhi}${daily.jianchu}日`
    : '当日黄历'
  const traditional = `传统宜${yi[0] || '待规则库补齐'}，忌${ji[0] || '待规则库补齐'}`
  const relation = relationLabel(daily)
  const bazi = baziContext(daily)
  const pace = daily?.action?.body || '按自己的节奏安排今天。'
  const sceneLabel = `${scene.emoji} ${scene.name}`
  const anchor = `${calendar}｜${relation}｜${sceneLabel}`
  const chong = cal?.冲煞 ? `，并留意${cal.冲煞}` : ''

  return {
    anchor,
    calendarHint: `日历为${calendar}。`,
    traditionalHint: `${traditional}。`,
    relationHint: `${relation}。`,
    baziHint: bazi.detail,
    baziShort: bazi.short,
    persona: `${scene.persona} 今天是${calendar}，${traditional}；${bazi.detail}，${relation}，${pace}`,
    personaTitle: scene.persona,
    personaSummary: `${calendar}：${traditional}。${bazi.short}，${relation}。`,
    personaFacts: [
      `${scene.emoji} ${scene.name}`,
      calendar,
      relation,
      bazi.short,
    ],
    rhythm: `${sceneLabel} · ${calendar} · ${relation} · ${bazi.short}`,
    guideTitle: `${scene.name}的今日安排`,
    guideSubtitle: `以${calendar}、${traditional}、${bazi.short}和身份场景为依据`,
    guideNote: `生成依据：日历 + 传统黄历 + ${bazi.detail} + 身份场景。传统条目与冲煞决定边界；命局关系只用于安排优先级。`,
    yiHeading: `${scene.name} · 可优先安排`,
    jiHeading: `${scene.name} · 先缓一缓`,
    ruleLead: `${calendar}的传统规则为：${traditional}${chong}。结合${bazi.short}、${scene.name}场景与${relation}，请把传统条目作为边界，个人提示只作排序参考。`,
    rhythmLead: `${calendar}下，${traditional}；结合${bazi.short}，放进${scene.name}的日常，并以${relation}作为推进节奏。`,
    arrangeLead: `以下安排同时参考${calendar}、${traditional}、${bazi.detail}与${scene.name}场景。`,
    notesLead: '以下四项已结合今天的传统宜忌、个人节奏和身份场景整理，可直接用来安排日常。',
    zodiacLead: `${calendar}的整体节奏为${relation}；以下按${scene.name}场景做轻松参考。`,
    source: '日历 + 传统黄历 + 八字 + 身份场景'
  }
}

function buildIntegratedAdvice(scene, cal, daily, context) {
  if (!daily) return null
  const yi = almanacItems(cal?.宜)
  const ji = almanacItems(cal?.忌)
  const yiText = yi.slice(0, 2).join('、') || '当日宜事'
  const jiText = ji[0] || '当日忌事'
  const direction = daily.tips?.dir || '适合的方向'
  const people = daily.tips?.noble || '熟悉的人'
  const color = daily.tips?.color || '-'
  const number = daily.tips?.num || '-'
  const cautious = daily.relation === '慎'
  const chong = cal?.冲煞 ? `留意${cal.冲煞}` : '路线和时间都留一档余量'
  const sceneActions = sceneItemContext(scene)
  const primaryAction = scenePriority(scene, yi[0]) || sceneActions?.settle || '推进一件最关键的待办'
  const secondaryAction = scenePriority(scene, yi[1] || yi[0]) || sceneActions?.settle || '完成一个小闭环'
  const peopleChars = String(people).replace(/[、,，]/g, '').split('').filter(Boolean)
  const peopleText = peopleChars.length > 1 && peopleChars.length <= 3
    ? peopleChars.map(item => `属${item}`).join('、')
    : people

  return {
    career: `优先${primaryAction}；若时间允许，再${secondaryAction}。${jiText}相关的大改动先放进待确认清单。`,
    wealth: `支出先分成“必要、可等、想买”三档，今天只处理前两档；不因传统宜事临时放大预算。`,
    love: `适合${sceneActions?.relationship || '主动回应一位重要的人'}；有分歧先确认事实再表达看法，不抢着给结论。`,
    health: `先把吃饭、补水和活动排进日程；连续久坐或奔波时主动留出一段缓冲。`,
    noble: `可优先联系${peopleText}的熟人、同事或伙伴；邀约时说明目标和下一步，减少来回确认。`,
    travel: `${sceneActions?.travel || '出门办事'}；方向可参考${direction}，${chong}。${cautious ? '临时改线前先核对一次。' : '不把行程排得过满。'}`,
    decision: `${cautious ? '重要承诺至少核对一次时间、成本与后果。' : '先把目标、范围与资源写清，再决定是否扩大范围。'} 涉及${jiText}的不可逆变动，今天别仓促拍板。`,
    opening: `配色可参考${color}，数字提示${number}。把它当作轻量提醒，不替代行程、预算和安全判断。`,
  }
}

function scenePriority(scene, almanacItem) {
  const item = String(almanacItem || '')
  const sceneName = String(scene?.name || scene || '')
  const key = sceneName.includes('享受族') ? 'enjoy'
    : sceneName.includes('学生') ? 'student'
      : sceneName.includes('自由') ? 'free'
        : parseScenario(sceneName)
  const byScene = {
    worker: {
      travel: '外勤、客户沟通或跨团队对齐',
      social: '约一次关键沟通，把话说清楚',
      commitment: '关系梳理、关键协作或认真沟通',
      settle: '清理待办、补流程或收尾',
      default: '推进一件卡住的小事'
    },
    student: {
      travel: '办报名、借书或和同学讨论',
      social: '约同学交流，把问题问明白',
      commitment: '和同学、家人好好沟通',
      settle: '复盘笔记、整理资料或补基础',
      default: '给作业或复习开一个头'
    },
    free: {
      travel: '见客户、跑现场或收集素材',
      social: '联系合作方、报价或更新作品',
      commitment: '见重要合作方或推进长期关系',
      settle: '排期、对账或完成交付收尾',
      default: '把灵感落实成一个小样'
    },
    enjoy: {
      travel: '散步、探望或约老友喝茶',
      social: '联络惦记的人，慢慢聊一会儿',
      commitment: '和家人团聚，联络亲友',
      settle: '整理照片、读书或收拾家中小角落',
      default: '一件让自己舒心的小事'
    }
  }[key] || null
  if (!byScene) return ''
  if (/(嫁娶|纳采|订盟)/.test(item)) return byScene.commitment
  if (/(出行|移徙|会友)/.test(item)) return byScene.travel
  if (/(开市|交易|纳财|立券|求嗣)/.test(item)) return byScene.social
  if (/(祭祀|祈福|修造|扫舍|安床|解除)/.test(item)) return byScene.settle
  return byScene.default
}

function sceneItemContext(scene) {
  const name = String(scene?.name || scene || '')
  const key = name.includes('享受族') ? 'enjoy'
    : name.includes('学生') ? 'student'
      : name.includes('自由') ? 'free'
        : parseScenario(name)
  return {
    worker: {
      relationship: '把关键协作与承诺谈清楚', ritual: '复盘、致谢或给项目收个尾', craft: '打磨方案、完成对外呈现',
      travel: '安排外勤、拜访或线下沟通', reset: '清理阻塞、回收待办', grooming: '整理状态后再出面',
      foundation: '启动基础性工作，先定范围和资源', settle: '安顿工位与节奏', cleanup: '清理资料和桌面',
      avoid: '别用硬碰硬的方式强推进度'
    },
    student: {
      relationship: '和同学、家人把话说开', ritual: '复盘笔记或感谢帮过你的人', craft: '打磨作业、作品或展示材料',
      travel: '办报名、借书或和同学讨论', reset: '清掉拖延任务，给学习重新开个头', grooming: '整理状态后再去见人',
      foundation: '补基础、定计划，先把范围写清楚', settle: '把学习空间和作息安顿好', cleanup: '整理资料和书桌',
      avoid: '别靠熬夜和硬扛解决问题'
    },
    free: {
      relationship: '推进长期合作或认真沟通', ritual: '复盘交付并感谢合作方', craft: '打磨作品、提案或样稿',
      travel: '见客户、跑现场或收集素材', reset: '收掉旧坑，再开新任务', grooming: '整理状态后再出面',
      foundation: '启动基础工作，先把报价和边界写清楚', settle: '安顿排期与工作台', cleanup: '对账、归档和整理素材',
      avoid: '别把灵感当成跳过流程的理由'
    },
    enjoy: {
      relationship: '和家人团聚、联络亲友', ritual: '读书、回想或向老朋友问候', craft: '整理照片、兴趣作品或家中小物',
      travel: '散步、探望或约老友喝茶', reset: '放下惦记的小事，轻松收尾', grooming: '整理仪容，舒服地见人',
      foundation: '处理家中基础安排，先不赶进度', settle: '安顿卧室和休息节奏', cleanup: '收拾家中小角落',
      avoid: '别替所有人的事情都操心到底'
    }
  }[key] || null
}

function itemCategory(item) {
  if (/(嫁娶|纳采|订盟)/.test(item)) return 'relationship'
  if (/(祭祀|祈福)/.test(item)) return 'ritual'
  if (/(塑绘|开光)/.test(item)) return 'craft'
  if (/(出行|移徙|会友)/.test(item)) return 'travel'
  if (/(解除)/.test(item)) return 'reset'
  if (/(理发|整手足甲)/.test(item)) return 'grooming'
  if (/(动土|开池|放水|修造)/.test(item)) return 'foundation'
  if (/(安床)/.test(item)) return 'settle'
  if (/(扫舍)/.test(item)) return 'cleanup'
  return ''
}

function buildTraditionalItemNotes(scene, cal, daily) {
  if (!daily) return { yi: [], ji: [] }
  const context = sceneItemContext(scene)
  if (!context) return { yi: [], ji: [] }
  const pace = daily.relation === '顺' ? '可优先排进日程'
    : daily.relation === '慎' ? '先确认细节再推进'
      : '按自己的节奏完成'
  const describeYi = item => {
    const category = itemCategory(item)
    const action = category ? context[category] : '完成一个小闭环'
    return `${action}，${pace}。`
  }
  const describeJi = item => {
    if (/(伐木|破土|作梁)/.test(item)) return `${context.avoid}，涉及基础改动先多核一遍。`
    if (/(行丧|安葬)/.test(item)) return '涉及结束、告别或沉重议题时，别急着下结论。'
    if (/(作灶)/.test(item)) return '别临时重搭流程或开新摊子，先把手头的事收好。'
    return `${context.avoid}，今天宜留一点缓冲。`
  }
  return {
    yi: almanacItems(cal?.宜).map(item => ({ item, note: describeYi(item) })),
    ji: almanacItems(cal?.忌).map(item => ({ item, note: describeJi(item) })),
  }
}

// “你的今日节奏”使用这份融合结果，避免卡片局部只取八字日运字段。
function buildRhythmData(scene, cal, daily, context) {
  if (!daily) return null
  const yi = almanacItems(cal?.宜)
  const ji = almanacItems(cal?.忌)
  const primaryYi = yi[0] || '当日宜事'
  const secondaryYi = yi[1] || primaryYi
  const primaryJi = ji[0] || '当日忌事'
  const activity = scenePriority(scene, primaryYi)
  const favorableScene = daily.scenes?.[0] || ''
  const nextScene = daily.scenes?.[1] || ''
  const tips = daily.tips
    ? [
        { label: '命局配色', value: daily.tips.color, source: '八字喜用' },
        { label: '命局方位', value: daily.tips.dir, source: '八字喜用' },
        ...(cal?.喜神方位 ? [{ label: '传统喜神', value: cal.喜神方位, source: '传统黄历' }] : []),
        { label: '数字提示', value: daily.tips.num, source: '八字喜用' },
        { label: '人际提示', value: daily.tips.noble, source: '八字喜用' },
      ]
    : []

  return {
    theme: daily.theme,
    // 数据层保留传统宜忌来源，展示层只在宜忌与日程区使用，避免同一句话重复出现。
    tone: daily.tone ? `${daily.tone} 传统宜${primaryYi}，忌${primaryJi}。` : `传统宜${primaryYi}，忌${primaryJi}。`,
    action: daily.action
      ? {
          head: daily.action.head,
          primary: daily.action.body,
          secondary: `今天传统宜${primaryYi}${activity ? `，可优先安排${activity}` : ''}；${primaryJi}相关的大动作先缓一缓。`,
          body: `${daily.action.body} 今天传统宜${primaryYi}${activity ? `，可优先安排${activity}` : ''}；${primaryJi}相关的大动作先缓一缓。`
        }
      : null,
    meta: {
      dayGanzhi: daily.dayGanzhi,
      dayWx: daily.dayWx,
      term: daily.term,
      chong: cal?.冲煞 || daily.chong,
      yi: primaryYi,
      ji: primaryJi,
    },
    priorities: [
      ...(favorableScene ? [{ text: favorableScene, source: '八字喜用' }] : []),
      ...(activity ? [{ text: activity, source: `传统宜·${primaryYi}` }] : []),
      ...(nextScene && nextScene !== favorableScene ? [{ text: nextScene, source: '八字喜用' }] : []),
    ].slice(0, 3),
    tips,
    source: `${context.source} · ${context.calendarHint.replace('日历为', '').replace('。', '')}`,
    traditional: { yi: primaryYi, secondaryYi, ji: primaryJi }
  }
}

function contextualizeSceneMap(map) {
  return Object.fromEntries(Object.entries(map || {}))
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
 * @param {string} scenario 场景：打工人/学生党/自由族/享受族
 * @param {object} extra 内部已计算的日运数据
 * @param {'practical'|'humorous'} tone 生活化文案风格
 * @returns {string} Markdown
 */
function renderHuangliMarkdown(dateStr, scenario, extra, tone = 'practical') {
  const { y, m, d } = parseYMD(dateStr)
  const s = MODERN_SCENARIOS[parseScenario(scenario)] || MODERN_SCENARIOS.worker
  const cal = realHuangli(y, m, d)
  const daily = extra?.daily || null
  const context = buildPersonalContext(s, cal, daily)
  const guidance = buildSceneGuidance(scenario, cal, daily)

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

  const humorous = tone === 'humorous'

  // 身份场景只负责解释传统条目，不替代传统规则。
  lines.push(`## 🎭 今天的生活场景（${s.emoji} ${s.name}）`)
  lines.push(`**${daily ? context.persona : s.persona}**`)
  lines.push(`**今日节奏**：${daily ? context.rhythm : s.bgm}`)
  lines.push('')

  if (guidance.length) {
    lines.push(`## ✦ ${daily ? context.guideTitle : '把黄历放进今天'}`)
    lines.push(`> ${daily ? context.guideSubtitle : '以下为传统宜忌的生活化安排，不替代传统黄历规则。'}`)
    for (const item of guidance) lines.push(`- **${item.title}**：${item.body}（${item.source}）`)
    lines.push('')
  }

  lines.push('---')
  lines.push('')

  // 幽默模式才附加网络化宜忌；实用模式只保留传统条目与生活安排。
  if (humorous) {
    lines.push('## ✅ 轻松宜办（幽默参考）')
    for (const it of s.yi) {
      const [head, tail] = splitYi(it)
      lines.push(`✅ **${head}**——${tail || ''}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## ❌ 先缓一缓（幽默参考）')
    for (const it of s.ji) {
      const [head, tail] = splitYi(it)
      lines.push(`❌ **${head}**——${tail || ''}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // 传统真实宜忌 + 冲煞 + 方位（真实数据，幽默标题）
  if (cal) {
    lines.push('## 📜 传统规则层')
    if (daily) lines.push(`> ${context.ruleLead}`)
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
    lines.push('## 🔮 你的今日节奏')
    if (daily) lines.push(`> ${context.rhythmLead}`)
    lines.push(`**${extra.action.head}**——${extra.action.body}`)
    if (extra.tips) {
      lines.push(`**随身提示**：配色参考${extra.tips.color}、方向参考${extra.tips.dir}、数字提示${extra.tips.num}、人际提示${extra.tips.noble}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // 场景便签（轻松参考）
  lines.push('## 🧭 场景生活便签')
  if (daily) lines.push(`> ${context.notesLead}`)
  lines.push('| 项目 | 建议 |')
  lines.push('|------|------|')
  for (const [k, v] of Object.entries(s.tips)) lines.push(`| **${k}** | ${v} |`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // 生肖轻松参考
  lines.push(`## 🐭 十二生肖${humorous ? '轻松参考（幽默版）' : '参考'}`)
  if (daily) lines.push(`> ${context.zodiacLead}`)
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
  lines.push('历法、节气与干支为计算字段；宜忌、神煞与方位属于传统民俗规则；场景内容仅作生活参考。')
  lines.push('愿今天的你：事情有进度，心里有余地。')
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
function buildHuangliData(dateStr, scenario, extra) {
  const { y, m, d } = parseYMD(dateStr)
  const s = MODERN_SCENARIOS[parseScenario(scenario)] || MODERN_SCENARIOS.worker
  const cal = realHuangli(y, m, d)
  const daily = extra?.daily || null
  const context = buildPersonalContext(s, cal, daily)
  const jieqiData = cal?.节气
  const jieqi = cal && (typeof jieqiData === 'string' ? jieqiData : (jieqiData && (jieqiData.name || jieqiData.jieqi || jieqiData.term)) || '')
  const jieqiProgress = jieqi && typeof jieqiData === 'object'
    ? `${jieqi}${Number.isFinite(jieqiData.afterDays) ? `第${jieqiData.afterDays}日` : ''}${jieqiData.nextTerm ? ` · 距${jieqiData.nextTerm}${jieqiData.beforeNextTermDays != null ? `${jieqiData.beforeNextTermDays}日` : ''}` : ''}`
    : ''
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
    daily,
    presentation: { mode: daily ? 'personalized' : 'standard', tone: 'practical' },
    real: cal ? {
      yi: cal.宜 || '',
      ji: cal.忌 || '',
      chong: cal.冲煞 || '',
      pengzu: cal.彭祖百忌 || '',
      xishen: cal.喜神方位 || '',
      caishen: cal.财神方位 || '',
      fushen: cal.福神方位 || '',
      yanggui: cal.阳贵神方位 || '',
      yingui: cal.阴贵神方位 || '',
      ershiba: cal.二十八宿 || '',
      jieqiProgress,
    } : null,
    scene: {
      name: s.name, emoji: s.emoji,
      persona: daily ? context.persona : s.persona,
      personaTitle: daily ? context.personaTitle : s.persona,
      personaSummary: daily ? context.personaSummary : '',
      personaFacts: daily ? context.personaFacts : [],
      bgm: daily ? context.rhythm : s.bgm,
      yi: yiJiItems(s.yi), ji: yiJiItems(s.ji),
      tips: daily ? contextualizeSceneMap(s.tips) : s.tips,
      zodiac: daily ? contextualizeSceneMap(s.zodiac) : s.zodiac,
      mental: s.mental,
      guidance: buildSceneGuidance(scenario, cal, daily),
      traditionalItems: buildTraditionalItemNotes(s, cal, daily),
      context,
      advice: buildIntegratedAdvice(s, cal, daily, context),
      rhythm: buildRhythmData(s, cal, daily, context),
    },
    fortune: extra || null,
  }
}

function hasHuangliChart(chart) {
  return Boolean(chart && (
    (Array.isArray(chart.pillars) && chart.pillars.length === 4) ||
    (chart.year && chart.month && chart.day && chart.gender)
  ))
}

/**
 * 黄历的唯一算法入口。
 * - standard：只计算传统黄历与日历字段；不使用出生信息。
 * - personalized：在已具备生辰时额外计算八字日运与身份场景。
 * - practical / humorous：只控制生活化表达，不改变传统历法、宜忌与八字计算。
 * - data / markdown：同一份结果分别供页面与 AI 工具使用。
 */
export function generateHuangli(options = {}) {
  const {
    chart = null,
    date = new Date(),
    scenario,
    mode,
    tone = 'practical',
    format = 'data',
    // 仅供旧入口迁移时注入，正式调用由本函数自行计算。
    daily: suppliedDaily = null,
  } = options
  const canPersonalize = Boolean(suppliedDaily) || hasHuangliChart(chart)
  const requestedMode = mode === 'standard' || mode === 'personalized'
    ? mode
    : (canPersonalize ? 'personalized' : 'standard')
  let daily = suppliedDaily
  if (requestedMode === 'personalized' && canPersonalize && !daily) {
    const { y, m, d } = parseYMD(date)
    try {
      daily = buildDaily(new Date(y, m - 1, d), chart)
    } catch {
      daily = null
    }
  }
  // 月令、建除属于当天历法基础字段，标准模式也应展示；仅以 null 命盘计算，
  // 不把八字关系、喜用或身份场景混入通用黄历。
  let calendarDaily = null
  try {
    const { y, m, d } = parseYMD(date)
    calendarDaily = buildDaily(new Date(y, m - 1, d), null)
  } catch {
    calendarDaily = null
  }
  const effectiveMode = requestedMode === 'personalized' && daily ? 'personalized' : 'standard'
  const effectiveTone = tone === 'humorous' ? 'humorous' : 'practical'
  const extra = daily ? { action: daily.action, tips: daily.tips, daily } : null
  const data = buildHuangliData(date, scenario, extra)
  data.presentation = { mode: effectiveMode, tone: effectiveTone }
  data.calendar = {
    monthGanzhi: daily?.monthGanzhi || calendarDaily?.monthGanzhi || '',
    jianchu: daily?.jianchu || calendarDaily?.jianchu || '',
  }

  if (format === 'markdown') {
    return renderHuangliMarkdown(date, scenario, extra, effectiveTone)
  }
  return data
}

// 旧入口保留为兼容包装；页面和工具均应改用 generateHuangli。
export function buildFusedHuangli(dateStr, scenario, extra = {}) {
  return generateHuangli({
    date: dateStr,
    scenario,
    mode: extra.daily ? 'personalized' : 'standard',
    tone: 'humorous',
    format: 'markdown',
    daily: extra.daily || null,
  })
}

export function buildFusedHuangliData(dateStr, scenario, extra = {}) {
  return generateHuangli({
    date: dateStr,
    scenario,
    mode: extra.daily ? 'personalized' : 'standard',
    tone: 'practical',
    format: 'data',
    daily: extra.daily || null,
  })
}

// 兼容旧调用，统一走同一个生成器，不再维持独立算法。
export function buildModernHuangli(dateStr, scenario) {
  return generateHuangli({ date: dateStr, scenario, mode: 'standard', tone: 'humorous', format: 'markdown' })
}
