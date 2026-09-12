// /api/agent/*：把 dsh 子进程的会话事件以 SSE 转给前端。
//
// 身份（R2 M1 已落地）：登录用户凭 Authorization: Bearer <jwt>，游客凭自报的
// anon:* 标识。**不再接受自报的账号 uid** —— 以前 `X-Genki-Uid: u123` 就能读、
// 删 u123 的全部会话。
import { Router } from 'express'
import crypto from 'node:crypto'
import { availableRoutes, resolveDefaultRoute, sharedPool } from '../dsh/pool.js'
import { sharedStore } from '../dsh/agentStore.js'
import { sharedAccounts } from '../accounts.js'
import { sharedGuestQuota } from '../guestQuota.js'
import { TOOL_NAME_CN } from '../dsh/events.js'
import { identify } from './auth.js'
import { config } from '../config.js'
import { generateHuangli } from '../../src/engine/cantian.js'
import { buildChart } from '../../src/engine/bazi.js'
import { AGENT_TOKEN_BILLING, canAfford } from '../../src/engine/membership.js'

const MAX_TEXT = 2000
const RATE_LIMIT = 20 // 次/分钟/uid+IP
// uid 是客户端自报的（X-Genki-Uid），换一个就能把上面那个桶清零，所以必须再有一层
// 只按来源 IP 计数的闸门，否则轮换 uid 即可无限调用付费模型。
// 生效前提：server/index.js 设了 trust proxy，否则经 Caddy 后 req.ip 恒为 127.0.0.1。
const IP_RATE_LIMIT = 60 // 次/分钟/IP（不分 uid）
// 游客额度更紧：游客标识仍是自报的，换一个就是一个新桶，只有把单桶压低
// 才能让 IP 桶真正成为主闸门。登录用户有服务端身份，可以放宽。
const GUEST_RATE_LIMIT = 10
/** 将各模型供应商不同形态的 usage 统一为真实总 Token 数。 */
function totalTokens(usage) {
  if (!usage || typeof usage !== 'object') return 0
  const direct = usage.totalTokens ?? usage.total_tokens ?? usage.tokens
  if (Number.isFinite(Number(direct)) && Number(direct) > 0) return Math.floor(Number(direct))
  const input = usage.promptTokens ?? usage.prompt_tokens ?? usage.inputTokens ?? usage.input_tokens ?? 0
  const output = usage.completionTokens ?? usage.completion_tokens ?? usage.outputTokens ?? usage.output_tokens ?? 0
  const sum = Number(input) + Number(output)
  return Number.isFinite(sum) && sum > 0 ? Math.floor(sum) : 0
}

/**
 * 归一化并校验前端传来的 chart。
 *
 * ⚠ 这些字段会被直接拼进发给模型的 prompt。此前完全不校验类型与长度，
 * 意味着 MAX_TEXT（2000 字）那道闸门可以被绕过：把几十 KB 文本塞进 chart.gender
 * 就行。这里只接受形状正确的数值/枚举，其余一律丢弃（当作没传命盘）。
 */
function normalizeChart(chart) {
  if (!chart || typeof chart !== 'object' || Array.isArray(chart)) return null
  const num = (v, min, max) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= min && n <= max ? n : null
  }
  const year = num(chart.year, 1900, 2100)
  const month = num(chart.month, 1, 12)
  const day = num(chart.day, 1, 31)
  if (year === null || month === null || day === null) return null
  const gender = chart.gender === '女' ? '女' : chart.gender === '男' ? '男' : null
  if (!gender) return null
  // hour 允许缺省（时辰未知），但给了就必须合法
  const hour = chart.hour === null || chart.hour === undefined ? null : num(chart.hour, 0, 23)
  if (chart.hour !== null && chart.hour !== undefined && hour === null) return null
  return { year, month, day, hour, gender }
}

function chartKeyOf(chart) {
  if (!chart) return null
  return `${chart.year}-${chart.month}-${chart.day}-${chart.hour ?? 'x'}-${chart.gender}`
}

function chartLine(chart) {
  const hour = chart.hour === null || chart.hour === undefined
    ? '时辰未知'
    : `${chart.hour}时`
  return `【当前缘主命盘】${chart.year}年${chart.month}月${chart.day}日 ${hour} ${chart.gender}（公历）`
}

function chartFromKey(key) {
  const match = String(key || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})-(x|\d{1,2})-(男|女)$/)
  if (!match) return null
  return normalizeChart({ year: match[1], month: match[2], day: match[3], hour: match[4] === 'x' ? null : match[4], gender: match[5] })
}

function chartSessionTitle(chart) {
  if (!chart) return null
  const shiChen = chart.hour === null || chart.hour === undefined
    ? '时辰未知'
    : `${['子', '丑', '丑', '寅', '寅', '卯', '卯', '辰', '辰', '巳', '巳', '午', '午', '未', '未', '申', '申', '酉', '酉', '戌', '戌', '亥', '亥', '子'][chart.hour]}时`
  return `${chart.gender === '女' ? '坤造' : '乾造'} · ${chart.year}年${chart.month}月${chart.day}日 · ${shiChen}`
}

// 聊天框里直接输入的出生资料没有 chart 字段。仅在年月日、时刻与性别齐全时
// 识别为可校盘资料；缺时辰不能假装成完整八字，以免把午时估算当作用户已确认的盘。
function chartFromBirthText(text) {
  const source = String(text || '')
  const date = source.match(/(19\d{2}|20\d{2})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})(?:日|号)?/)
  const gender = source.match(/(?:性别\s*[:：]?\s*)?(男|女)(?:性|士|生)?/)
  if (!date || !gender) return null

  // 从日期之后找时刻，避免把日期中的“6日”误判成 6 时。
  const afterDate = source.slice((date.index || 0) + date[0].length)
  const clock = afterDate.match(/(?:凌晨|清晨|早上|上午|中午|下午|晚上|傍晚)?\s*(\d{1,2})(?:(?:\s*[:：]\s*\d{1,2})(?:\s*分)?|\s*(?:点|时))/)
  const shiChen = afterDate.match(/(子|丑|寅|卯|辰|巳|午|未|申|酉|戌|亥)时/)
  const shiChenHour = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 }
  const hour = clock ? clock[1] : shiChen ? shiChenHour[shiChen[1]] : null
  return normalizeChart({ year: date[1], month: date[2], day: date[3], hour, gender: gender[1] })
}

function baziSkillInvocation(text) {
  const source = String(text || '')
  const wantsBothSchools = /(?:两派|双派|子平[\s、，,和与及]*盲派|盲派[\s、，,和与及]*子平|对比|综合)/i.test(source)
  const wantsZiping = /(?:子平派|按\s*子平|子平(?:法|取法|格局|用神)|易学[\s·・-]*泰山)/i.test(source)
  // 八字问题的流派边界本身也是 Skill 的职责。不能因为服务端能猜到默认流派，
  // 就跳过 router 后让模型自由补全大运、术语或推法。
  if (wantsBothSchools) return '/bazi-router /mangpai /yixue-taishan'
  return wantsZiping ? '/bazi-router /yixue-taishan' : '/bazi-router /mangpai'
}

const BAZI_TERMS = /(?:八字|命盘|四柱|大运|流年|流月|三合|三会|自刑|刑冲|合局|日主|十神|喜用神|格局)/
const ZIWEI_TERMS = /(?:紫微|斗数|命宫|十二宫|星曜|四化|大限)/
const QIMEN_TERMS = /(?:奇门|遁甲|九宫|八门|值符|值使|起局)/
const HUANGLI_TERMS = /(?:黄历|宜忌|择日|吉日|建除|冲煞)/
const TAROT_TERMS = /(?:塔罗|抽牌|牌阵|正位|逆位)/
const LIUYAO_TERMS = /(?:六爻|起卦|本卦|变卦|动爻|用神)/
const CHENGGU_TERMS = /(?:称骨|骨重|几两命|袁天罡)/
const FENGSHUI_TERMS = /(?:风水|户型|门向|书桌|座位|方位布局)/
const NAME_TERMS = /(?:姓名|取名|改名|五格|三才)/
const WUYUNLIUQI_TERMS = /(?:五运六气|司天|在泉|运气养生)/
const PERSONAL_FORECAST_TERMS = /(?:今年|明年|当下|目前|事业|工作|财运|感情|恋爱|婚姻|学业|关系)/

function hasCompleteBirth(chart) {
  return Boolean(chart && chart.hour !== null && chart.hour !== undefined)
}

/**
 * 将术数方法路由固定在服务端。Skill 不是“可选的参考资料”：只要用户点名了
 * 某种术数，模型收到问题前就已经加载对应的方法与边界，不能临场自行选法。
 */
function skillInvocationForQuestion(text, { knownBirth = false } = {}) {
  const source = String(text || '')
  if (BAZI_TERMS.test(source) || (knownBirth && PERSONAL_FORECAST_TERMS.test(source))) return baziSkillInvocation(source)
  if (ZIWEI_TERMS.test(source)) return '/ziwei'
  if (QIMEN_TERMS.test(source)) return '/qimen'
  if (HUANGLI_TERMS.test(source)) return '/huangli'
  if (TAROT_TERMS.test(source)) return '/tarot'
  if (LIUYAO_TERMS.test(source)) return '/liuyao'
  if (CHENGGU_TERMS.test(source)) return '/chenggu'
  if (FENGSHUI_TERMS.test(source)) return '/fengshui'
  if (NAME_TERMS.test(source)) return '/name'
  if (WUYUNLIUQI_TERMS.test(source)) return '/wuyunliuqi'
  return ''
}

/**
 * 只有能实际运行的测算才进入交付闸门。没有出生资料的八字/紫微问题仍会加载
 * Skill 并由它索要缺失资料，不会为了满足“调用工具”而凭空补一个时辰。
 */
function strictToolRequirement(text, { currentChart = null, suppliedChart = null } = {}) {
  const source = String(text || '')
  const knownBirth = hasCompleteBirth(suppliedChart) || hasCompleteBirth(currentChart)
  if ((BAZI_TERMS.test(source) || (knownBirth && PERSONAL_FORECAST_TERMS.test(source))) && knownBirth) {
    return { tool: 'bazi', label: '八字排盘', skill: baziSkillInvocation(source) }
  }
  if (ZIWEI_TERMS.test(source) && knownBirth) return { tool: 'ziwei', label: '紫微命盘', skill: '/ziwei' }
  if (CHENGGU_TERMS.test(source) && knownBirth) return { tool: 'chenggu', label: '称骨结果', skill: '/chenggu' }
  if (QIMEN_TERMS.test(source) && /(?:起局|测算|择时|方位|什么时候|何时|吉凶|用事)/.test(source)) return { tool: 'qimen', label: '奇门局', skill: '/qimen' }
  if (HUANGLI_TERMS.test(source) && /(?:今天|今日|明天|日期|择日|吉日|宜忌|冲煞)/.test(source)) return { tool: 'huangli', label: '黄历', skill: '/huangli' }
  if (TAROT_TERMS.test(source) && /(?:抽|测|解读|看|问|占)/.test(source)) return { tool: 'tarot', label: '塔罗抽牌', skill: '/tarot' }
  if (LIUYAO_TERMS.test(source) && /(?:起卦|占|问|测|看)/.test(source)) return { tool: 'liuyao', label: '六爻卦象', skill: '/liuyao' }
  if (FENGSHUI_TERMS.test(source) && /(?:测|看|分析|布局|方位)/.test(source)) return { tool: 'fengshui', label: '风水测算', skill: '/fengshui' }
  if (NAME_TERMS.test(source) && /(?:测|看|分析|取|改|评分)/.test(source)) return { tool: 'name', label: '姓名分析', skill: '/name' }
  if (WUYUNLIUQI_TERMS.test(source)) return { tool: 'wuyunliuqi', label: '五运六气', skill: '/wuyunliuqi' }
  return null
}

function strictToolInstruction(requirement, chart = null) {
  if (!requirement) return ''
  const baziArgs = requirement.tool === 'bazi' && hasCompleteBirth(chart)
    ? `本会话已核验生辰，调用时必须使用：\`{"year":${chart.year},"month":${chart.month},"day":${chart.day},"hour":${chart.hour},"gender":"${chart.gender}","calendar":"solar","school":"mangpai","detail":"full"}\`。`
    : ''
  return `【强制测算规约·不可跳过】本轮涉及 ${requirement.label}。已加载对应 Skill，必须成功调用 \`${requirement.tool}\` 工具并只依据其返回结果作答。${baziArgs} 工具未返回、参数不足或执行失败时，只能说明“本次未完成核验”，并补充所缺信息；禁止凭记忆、常识或语言模型推算任何盘面、年份、干支、宫位、牌面或结论。`
}

function strictVerificationFailure(requirement, chart = null) {
  const retained = hasCompleteBirth(chart)
    ? `会话已保留你的出生资料（${chart.year}年${chart.month}月${chart.day}日${chart.hour}时，${chart.gender}），无需重复提交。`
    : '请补充必要信息后重新测算。'
  return `本轮未取得可核验的${requirement.label}结果，为避免以推测代替测算，暂不输出结论。${retained}`
}

// Agent 工具与网页排盘共用 buildChart。对于会话里已核验的生辰，服务端先用这份
// 同源确定性引擎生成盘面事实，避免模型偶发漏发 tool_call 后只能中断整轮咨询。
// 这不是模型推算：四柱、起运和大运均由排盘引擎计算，Skill 仍负责断法边界与表达。
function baziPreflight(chart) {
  if (!hasCompleteBirth(chart)) return null
  try {
    const result = buildChart(chart.year, chart.month, chart.day, chart.hour, chart.gender)
    const pillars = (result?.pillars || []).map(p => `${p.gan || ''}${p.zhi || ''}`).filter(Boolean)
    const yun = (result?.daYunList || []).map(item => ({
      key: item.key,
      startAge: item.startAge,
      endAge: item.endAge,
      start: item.start,
      end: item.end,
    })).filter(item => item.key)
    if (pillars.length !== 4 || !yun.length) return null
    const yunLine = yun.map(item => `${item.key}（${item.startAge}-${item.endAge}岁，${item.start}-${item.end}）`).join('｜')
    return {
      text: `【服务端八字预检·同源排盘引擎】\n- 出生口径：${chart.year}年${chart.month}月${chart.day}日${chart.hour}时，${chart.gender}，公历\n- 四柱：${pillars.join('｜')}\n- 日主：${result.dayMaster || '待核对'}\n- 起运：${result.qiYunText || result.qiYunAge || '待核对'}（${result.qiYunDate || '日期待核对'}）\n- 完整大运：${yunLine}\n以上是本轮唯一可引用的盘面与大运原始事实；不得新增、改写或用记忆替换。`,
      anchors: [...pillars, ...yun.map(item => item.key)],
    }
  } catch {
    return null
  }
}

function citesBaziPreflight(text, preflight) {
  if (!preflight) return false
  const source = String(text || '')
  return preflight.anchors.filter(anchor => anchor && source.includes(anchor)).length >= 2
}

// 关系断语和日期口径是最容易被自然语言“补全”的命理事实。凡当轮问题触及这两类
// 内容，都把核验协议放在用户问题前，避免模型把另一张盘、流年或节气月的资料混进原局。
function needsEvidenceProtocol(text) {
  return /(?:八字|命盘|四柱|大运|流年|流月|三合|三会|自刑|刑冲|合局|农历|阴历|阳历|公历|(?:\d{1,2}|九)\s*月)/.test(String(text || ''))
}

export function agentEvidenceProtocol() {
  return `【事实核验与时间口径·最高优先】
1. 原局的四柱、地支、三合三会、自刑、刑冲合害、起运和大运，必须先有本轮 \`bazi\` 工具结果或会话中可逐字引用的工具事实；没有依据就说“需重新排盘核对”，不得凭记忆补造。
2. 断原局关系前，先列出实际参与的地支。三合/三会必须三支齐全；自刑必须有两个相同地支。原局与大运、流年、节气月分别标注，不能混说成“原局有”。
3. 用户未特别说明时，“9月/九月份”一律指公历9月。只有明确说“农历/阴历”才写农历九月；流月或节气月必须写“节气月”，不得简称“9月”。日期口径不明且会影响结论时，先追问。
4. 若需更正旧结论，先重新核对事实，再写“重新核对后”；不得在没有核对依据时断言此前存在某项具体错误。`
}

// 被点名的年份、年龄和人生阶段不能被“青年期”“这一阶段”等概述吞掉。这里仅在
// 问题确实带有时间锚点时注入，普通闲聊与不涉及时间的咨询保持轻量。
function needsCoverageProtocol(text) {
  return /(?:(?:19|20)\d{2}\s*年|(?:\d{1,3}|[一二三四五六七八九十]{1,4})\s*岁|逐年|每年|哪一年|哪年|年龄段|人生阶段)/.test(String(text || ''))
}

export function agentCoverageProtocol() {
  return `【问题覆盖校验·最高优先】
1. 先在内部列出用户本轮明确点名的年份、年龄、阶段和咨询主题；每一项都必须在答案中得到对应回应，不能用“青少年期”“某一阶段”或泛泛总结替代具体年份/年龄。
2. 年份与年龄同时出现时，先依据已核对的出生资料确认二者是否对应；不能确认就明确写“年份与年龄对应关系需核对”，不得擅自把它们绑定。涉及干支年份也必须先核对其公历年份与干支。
3. 对每个被点名的关键年份或年龄，用独立小标题或独立条目说明其依据、趋势与建议；篇幅可以简短，但不得遗漏或合并带过。
4. 输出前自行核对上述清单是否全部覆盖。只交付结论和依据，不展示内部清单、检查过程或执行说明。`
}

function needsCurrentDateContext(text) {
  return /(?:今天|今日|今年|当下|现在|目前|本月|这个月)/.test(String(text || ''))
}

function needsCalendarVerification(text) {
  return /(?:农历|阴历|阳历|公历|节气月|干支年|(?:19|20)\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号))/i.test(String(text || ''))
}

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = type => parts.find(part => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function agentCurrentDateProtocol() {
  // IANA 的中国标准时区名为 Asia/Shanghai；面对缘主统一写作“北京时间”，
  // 避免把实现细节误解成按上海本地日期进行额外换算。
  return `【当前日期口径】系统当前日期为公历${shanghaiDate()}（北京时间，中国标准时间）。「今天／今年／本月」等相对时间必须以此为准；若需换算农历、节气月或干支日期，必须先调用 \`huangli\` 工具核验具体日期，不能凭农历新年或记忆推算。`
}

export function agentCalendarVerificationProtocol() {
  return `【日期换算核验】涉及公历、农历、节气月、干支年或具体日期归属时，必须先调用 \`huangli\` 工具核验该具体日期。八字流年交接以节气口径为准，不能把“农历新年”“整个公历年份”或记忆中的生肖年份直接等同为八字流年；没有工具结果时只说明需要核验。`
}

function compactUserMessage(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180)
}

// DSH 会在长会话中自行压缩上下文；服务端镜像却保留着缘主逐条给出的信息。
// 只重注入用户原话和已校验命盘，绝不把模型此前的臆断作为“记忆”回灌。
export function agentSessionMemory(session, messages) {
  const chart = chartFromKey(session?.chartKey)
  const userTurns = (messages || [])
    .filter(message => message?.role === 'user')
    .map(message => compactUserMessage(message.text))
    .filter(Boolean)
  const recentUserTurns = userTurns.slice(-12)
  const stableFacts = stableSessionFacts(userTurns)
  if (!chart && !recentUserTurns.length && !stableFacts.length) return ''
  const lines = ['【会话事实备忘·优先于模型记忆】']
  if (chart) lines.push(`- 已核对的出生资料：${chartLine(chart)}`)
  if (stableFacts.length) {
    lines.push('- 已确认的长期事实（来自缘主原话，不得遗忘或反问）：')
    lines.push(...stableFacts.map(fact => `  - ${fact}`))
  }
  if (recentUserTurns.length) {
    lines.push('- 缘主近期原话（按时间顺序，仅用户原话，不含模型推测）：')
    lines.push(...recentUserTurns.map(text => `  - ${text}`))
  }
  lines.push('只能把其中明确陈述当作事实，提问本身不是事实。已列出的日期、婚姻状态或出生资料不得要求缘主重复提供；若事实互相矛盾，先指出矛盾并核对，不能擅自改写。')
  return lines.join('\n')
}

// 长会话只能回灌最近若干轮，容易把“已婚”“结婚日期”这类已确认事实挤掉。
// 这里从完整用户原话中提炼少量、可核验且与后续命理咨询高相关的长期事实；不采用
// 模型说过的话，也不把用户的猜测当事实，避免把臆断重新写回上下文。
function stableSessionFacts(userTurns) {
  const facts = []
  let marriageContextTurns = 0
  for (const text of userTurns) {
    const mentionsMarriage = /(?:已婚|已经结婚|我结婚|结婚(?:日期|时间|年份)?|婚期|婚姻状态)/.test(text)
    if (/(?:已婚|已经结婚)/.test(text)) facts.push('缘主明确表示：已婚')
    if (mentionsMarriage) marriageContextTurns = 2
    const date = text.match(/(?:19|20)\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号)?/)
    if (date && (mentionsMarriage || marriageContextTurns > 0)) {
      facts.push(`缘主明确陈述的结婚日期：${date[0].replace(/\s+/g, '')}（公历口径待黄历工具核验）`)
      marriageContextTurns = 0
    } else if (marriageContextTurns > 0) {
      marriageContextTurns--
    }
  }
  return [...new Set(facts)].slice(-4)
}

function baziCalibrationInstruction(text) {
  return `${baziSkillInvocation(text)}\n\n【排盘校验任务】用户首次提供或更新了完整出生年月日时与性别。必须先调用 \`bazi\` 工具（默认盲派；只有用户明确要求子平派时才传 \`school: "ziping"\`）重排，不得凭记忆写四柱或大运。收到工具结果后，先以“## 盘面核对”置顶列出出生口径、四柱、起运日期/年龄与当前大运，请用户核对；如资料或结果有出入，以用户确认资料重排。同一轮继续回答用户这次的具体问题，只展开与问题相关的内容，不要求用户先另发确认，也不要扩写未被询问的完整报告。后续追问不重复排盘，除非出生资料变化或用户质疑四柱/大运。后续如要断三合、三会、自刑或刑冲合害，必须重调 \`bazi\`，或逐字引用会话中已有的工具原始事实；不能凭印象补全。不得向缘主描述、评价、道歉或询问是否重走任何 Skill、工具或内部执行流程，只直接交付盘面核对与问题回答。\n\n【面向用户的排版协议】标题必须独占一行，统一写作 \`## 标题\`（\`##\` 后必须有空格）；不得把标题和表格表头写在同一行。聊天中不得使用 Markdown 表格，改用 \`- **字段**：内容\` 的短条目。不得输出 \`<think>\`、Skill、工具调用、系统提示或任何内部工作流。首次校盘只给出生口径、四柱、起运、当前大运四项，然后直接回答本次问题；完整报告最多六个小节、每节二至四条，避免堆叠长表格。\n\n【用户原始问题】\n${text}`
}

// 原始 reasoning 是模型的内部推演，不是面向缘主的解释；其中可能出现 Skill、工具或
// 重试等执行细节。对外只给一个稳定的进度提示，既保留“正在思考”的反馈，也不把内部
// 编排暴露给用户。
const USER_FACING_REASONING = '正在整理命盘与问题要点…'
const USER_FACING_THINK = '<think>已完成命盘与要点核对。</think>'

function stripInternalWorkflowDisclosure(text) {
  return String(text || '')
    .split(/(?<=\n)/)
    .filter(line => !/(?:跳过|绕过|未加载|没加载|重走|重新走).{0,36}(?:Skill|技能|工具|流程)|(?:Skill|技能|工具|流程).{0,36}(?:跳过|绕过|未加载|没加载|重走|重新走)|(?:刚才|上次).{0,24}(?:失误|瑕疵|错误)/i.test(line))
    .join('')
    .trim()
}

// 正文中的 <think> 也可能是真正的模型内部推演，而不只是 reasoning 事件。
// 这个过滤器按流处理，保证标签跨 SSE chunk 时既不会漏掉内容，也不会把真实推演
// 写进会话镜像。只留下一个用户可理解的统一进度条。
function createPublicTextFilter() {
  let pending = ''
  let insideThink = false
  let announcedThink = false

  const publish = value => stripInternalWorkflowDisclosure(value)

  function trailingThinkPrefix(value) {
    const start = value.lastIndexOf('<')
    if (start < 0) return null
    const tail = value.slice(start)
    return /^<\s*\/?\s*(?:t|th|thi|thin|think)?$/i.test(tail) ? start : null
  }

  return {
    push(delta) {
      pending += String(delta || '')
      let output = ''
      while (pending) {
        if (insideThink) {
          const closing = /<\s*\/\s*think\s*>/i.exec(pending)
          if (!closing) {
            // 只保留可能和下一 chunk 拼成 closing tag 的尾巴，其余全部丢弃。
            const keepAt = trailingThinkPrefix(pending)
            pending = keepAt === null ? pending.slice(-10) : pending.slice(keepAt)
            break
          }
          pending = pending.slice(closing.index + closing[0].length)
          insideThink = false
          continue
        }

        const opening = /<\s*think\s*>/i.exec(pending)
        if (!opening) {
          const keepAt = trailingThinkPrefix(pending)
          const publicPart = keepAt === null ? pending : pending.slice(0, keepAt)
          pending = keepAt === null ? '' : pending.slice(keepAt)
          output += publish(publicPart)
          break
        }

        output += publish(pending.slice(0, opening.index))
        pending = pending.slice(opening.index + opening[0].length)
        insideThink = true
        if (!announcedThink) {
          output += USER_FACING_THINK
          announcedThink = true
        }
      }
      return output
    },
    finish() {
      if (insideThink) {
        pending = ''
        return announcedThink ? '' : USER_FACING_THINK
      }
      const output = publish(pending)
      pending = ''
      return output
    },
  }
}

function sanitizePublicText(text) {
  const filter = createPublicTextFilter()
  return `${filter.push(text)}${filter.finish()}`
}

function inferStoredChart(messages) {
  // 仅迁移同时出现「八字排盘」工具记录与完整出生信息的旧会话，避免把普通聊天里的
  // 日期、性别误当成命盘。新会话由工具参数直接落库，不会走这里。
  if (!messages.some(m => m.role === 'tool' && String(m.text).includes('八字排盘'))) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = String(messages[i].text || '')
    if (messages[i].role !== 'user') continue
    const birth = text.match(/(19\d{2}|20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/)
    const gender = text.match(/(?:性别\s*[:：]?\s*)?(男|女)(?:性|士|生)?/)
    if (!birth || !gender) continue
    const hour = text.match(/(?:凌晨|早上|上午|中午|下午|晚上|傍晚)?\s*(\d{1,2})(?:(?:\s*[:：]\s*\d{1,2})(?:\s*分)?|\s*(?:点|时))/)
    return normalizeChart({ year: birth[1], month: birth[2], day: birth[3], hour: hour ? hour[1] : null, gender: gender[1] })
  }
  return null
}

function timeNow() { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }

// 报告页进入元气 Agent 时，前端会在首行写入来源。保存为短标题，历史列表就不再
// 只显示长提示词的前十几个字；普通手动咨询仍继续用第一句命名。
function reportSessionTitle(text) {
  const match = String(text || '').match(/^报告咨询：([^\r\n]{1,32})/)
  const name = match?.[1].trim().replace(/报告$/, '')
  return name ? `${name.slice(0, 24)}报告咨询` : ''
}

const HUANGLI_SCENARIOS = new Set(['worker', 'student', 'free', 'enjoy'])
const HUANGLI_INSIGHT_VERSION = 'v1'

function insightDate(value) {
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(String(value || ''))) return null
  const [year, month, day] = String(value).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? `${year}-${month}-${day}`
    : null
}

// 模型只能解释这份已验证的快照；它不能重新推算或补写传统字段。
function huangliInsightFacts(data) {
  const daily = data.daily
  return {
    version: HUANGLI_INSIGHT_VERSION,
    date: data.date,
    mode: data.presentation?.mode || 'standard',
    scenario: data.scene?.name || '日常安排',
    calendar: {
      lunar: data.lunar || '',
      ganzhi: data.ganzhi || '',
      solarTerm: data.jieqi || '',
      monthGanzhi: data.calendar?.monthGanzhi || '',
      jianchu: data.calendar?.jianchu || '',
    },
    traditional: data.real ? {
      yi: data.real.yi || '',
      ji: data.real.ji || '',
      chongsha: data.real.chong || '',
      pengzu: data.real.pengzu || '',
      directions: `喜神${data.real.xishen || '待规则库补齐'}｜财神${data.real.caishen || '待规则库补齐'}｜福神${data.real.fushen || '待规则库补齐'}`,
    } : null,
    personal: daily ? {
      relation: daily.relation || '',
      dayGanzhi: daily.dayGanzhi || '',
      dayElement: daily.dayWx || '',
      action: daily.action?.body || '',
      tips: daily.tips ? `配色${daily.tips.color || ''}｜方向${daily.tips.dir || ''}｜人际${daily.tips.noble || ''}` : '',
    } : null,
    verifiedGuidance: (data.scene?.guidance || []).slice(0, 4).map(item => ({
      type: item.type || '', title: item.title || '', body: item.body || '', source: item.source || '',
    })),
  }
}

function huangliInsightPrompt(facts) {
  return `请先加载并严格遵守“huangli” Skill，然后为黄历报告写一段“AI 深度解读”。\n\n下面是服务端算法已经计算并验证过的事实快照：\n${JSON.stringify(facts)}\n\n硬性要求：\n1. 只能解释快照中的事实，禁止补写、改写或猜测宜忌、神煞、吉时、冲煞、八字字段。\n2. 有 personal 时才解释个人日气关系；没有 personal 时明确这是通用黄历，不假装个性化。\n3. 用简洁、务实的中文，避免重复快照里已经出现的原句，也不做医疗、法律、投资或宿命化判断。\n4. 仅输出以下三个 Markdown 二级标题及其正文，不要开场白、表格、免责声明：\n## 今日判断\n## 安排重点\n## 提醒\n总长度不超过 360 个汉字。`
}

export function createAgentRouter({ pool = sharedPool(), store = sharedStore(), accounts = sharedAccounts(), guestQuota = sharedGuestQuota() } = {}) {
  const r = Router()
  const hits = new Map() // `${uid}|${ip}` → { count, resetAt }
  const insightCache = new Map()
  const runningByUser = new Map()
  const runningByIp = new Map()

  function acquireRun(uid, ip) {
    const userCount = runningByUser.get(uid) || 0
    const ipCount = runningByIp.get(ip) || 0
    if (userCount >= config.security.agentInFlightPerUser || ipCount >= config.security.agentInFlightPerIp) return false
    runningByUser.set(uid, userCount + 1)
    runningByIp.set(ip, ipCount + 1)
    return true
  }

  function releaseRun(uid, ip) {
    const release = (map, key) => {
      const count = map.get(key) || 0
      if (count <= 1) map.delete(key)
      else map.set(key, count - 1)
    }
    release(runningByUser, uid)
    release(runningByIp, ip)
  }

  function bump(key, limit, now) {
    const h = hits.get(key)
    if (!h || h.resetAt < now) { hits.set(key, { count: 1, resetAt: now + 60000 }); return false }
    h.count++
    return h.count > limit
  }

  function rateLimited(uid, ip, authed = false) {
    const now = Date.now()
    // 每次写入顺手清掉过期窗口：否则 hits 会随 uid+IP 组合无界增长（长跑进程的内存泄漏）
    for (const [key, h] of hits) if (h.resetAt < now) hits.delete(key)
    // 两个闸门都要过。先各自计数再取或，不能短路——否则前一个桶满了之后
    // 后一个桶就不再累加，攻击者只要触发前者即可让后者永远清白。
    const overUid = bump(`u|${uid}|${ip}`, authed ? RATE_LIMIT : GUEST_RATE_LIMIT, now)
    const overIp = bump(`i|${ip}`, IP_RATE_LIMIT, now)
    return overUid || overIp
  }

  // 鉴别身份 + 限流：规格 §10 要求覆盖整个 /api/agent/*，不只是 /chat
  // （列表/删除同样能被刷）。/models 是无身份的静态路由表，放行。
  r.use('/agent', (req, res, next) => {
    if (req.path === '/models') return next()
    const id = identify(req)
    // 401 而不是 400：带了 token 但过期/被篡改也走到这里，前端需要据此去重新登录。
    if (!id) return res.status(401).json({ ok: false, msg: '请先登录' })
    if (id.authed) {
      // token 有效但账号已注销：不能让一张还没过期的 token 继续在无主 uid 下写数据。
      const acct = accounts.get(id.uid)
      if (!acct) return res.status(401).json({ ok: false, msg: '登录已失效，请重新登录' })
      if (!accounts.isActive(acct)) return res.status(403).json({ ok: false, msg: '该账号已被限制，请联系管理员' })
      req.account = acct
    }
    if (rateLimited(id.uid, req.ip, id.authed)) return res.status(429).json({ ok: false, msg: '请求太频繁，请稍后再试' })
    req.uid = id.uid
    req.authed = id.authed
    next()
  })

  r.get('/agent/models', (_req, res) => {
    const routes = availableRoutes()
    res.json({ ok: true, default: resolveDefaultRoute(), routes: routes.map(([key, v]) => ({ key, label: v.label, model: v.model, hint: v.hint })) })
  })

  // 黄历报告试点：工具先算事实，Skill 约束模型只负责解释。与聊天会话隔离，避免
  // 报告卡片被聊天上下文污染；按用户+输入缓存，刷新页面不会重复消耗模型额度。
  r.post('/agent/huangli-insight', async (req, res) => {
    if (!req.authed) return res.status(401).json({ ok: false, msg: '登录后可生成 AI 深度解读' })
    const routeKey = resolveDefaultRoute()
    if (!availableRoutes().some(([key]) => key === routeKey)) {
      return res.status(503).json({ ok: false, msg: '元气 Agent 暂未配置可用模型，请稍后再试' })
    }
    const date = insightDate(req.body?.date)
    if (!date) return res.status(400).json({ ok: false, msg: '日期格式不正确' })
    const chartInput = normalizeChart(req.body?.chart)
    // API 传输中只保留出生元数据；在此恢复为引擎完整命盘，日气关系才不会降级。
    const chart = chartInput ? buildChart(
      chartInput.year,
      chartInput.month,
      chartInput.day,
      chartInput.hour ?? 12,
      chartInput.gender,
    ) : null
    const scenario = HUANGLI_SCENARIOS.has(req.body?.scenario) ? req.body.scenario : 'worker'
    const mode = chart ? 'personalized' : 'standard'
    const data = generateHuangli({ chart, date, scenario, mode, tone: 'practical' })
    const facts = huangliInsightFacts(data)
    const signature = crypto.createHash('sha256')
      .update(`${req.uid}|${JSON.stringify(facts)}`)
      .digest('hex')
    const cached = insightCache.get(signature)
    if (cached) return res.json({ ok: true, text: cached.text, cached: true, version: HUANGLI_INSIGHT_VERSION })
    if (!acquireRun(req.uid, req.ip)) return res.status(429).json({ ok: false, msg: '当前请求过多，请稍后再试' })

    let charged = false
    let charge = null
    try {
      const paid = accounts.consumeCredit(req.uid, 'huangli.ai')
      if (!paid.ok) {
        return res.status(402).json({ ok: false, reason: paid.reason || 'insufficient', msg: '积分不足，暂无法生成 AI 深度解读' })
      }
      charged = paid.cost > 0
      charge = paid.charge || null
      const sessionId = `huangli-${signature.slice(0, 32)}`
      const result = await pool.run({
        routeKey,
        sessionId,
        text: huangliInsightPrompt(facts),
        onEvent: () => {},
      })
      const text = String(result.finalText || '').trim().slice(0, 1800)
      if (!text) throw new Error('EMPTY_INSIGHT')
      insightCache.set(signature, { text, createdAt: Date.now() })
      // 仅是进程内热缓存，限制规模，避免不同用户/日期长期运行后持续占内存。
      if (insightCache.size > 300) {
        const oldest = [...insightCache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt).slice(0, 80)
        for (const [key] of oldest) insightCache.delete(key)
      }
      res.json({ ok: true, text, cached: false, version: HUANGLI_INSIGHT_VERSION })
    } catch (err) {
      if (charged) {
        try { accounts.refundCredit(req.uid, 'huangli.ai', charge) } catch (refundError) { console.error('[huangli-insight] 退还积分失败', refundError) }
      }
      console.error('[huangli-insight] 生成失败', err?.code || err?.message || err)
      res.status(502).json({ ok: false, msg: 'AI 深度解读暂不可用，原报告不受影响' })
    } finally {
      releaseRun(req.uid, req.ip)
    }
  })

  r.get('/agent/sessions', (req, res) => {
    const sessions = store.listSessions(req.uid).map(session => {
      if (session.chartKey) return session
      const inferred = inferStoredChart(store.listMessages(req.uid, session.id))
      return inferred
        ? store.updateSession(req.uid, session.id, { chartKey: chartKeyOf(inferred), title: chartSessionTitle(inferred) })
        : session
    })
    res.json({ ok: true, sessions })
  })

  r.get('/agent/sessions/:id/messages', (req, res) => {
    const s = store.getSession(req.uid, req.params.id)
    if (!s) return res.status(404).json({ ok: false, msg: '会话不存在' })
    res.json({ ok: true, session: s, messages: store.listMessages(req.uid, s.id) })
  })

  // 登录后把游客期间产生的会话认领过来。
  // R2 方案里写的是 POST /api/import，但一直没有实现 —— 游客登录后会话直接消失。
  r.post('/agent/sessions/claim', (req, res) => {
    const from = String(req.body?.from || '').trim()
    if (!from || !from.startsWith('anon:') || from.length > 80) {
      return res.status(400).json({ ok: false, msg: '来源标识不合法' })
    }
    const moved = store.claimSessions(from, req.uid)
    res.json({ ok: true, moved })
  })

  r.delete('/agent/sessions/:id', (req, res) => {
    res.json({ ok: store.deleteSession(req.uid, req.params.id) })
  })

  r.post('/agent/chat', async (req, res) => {
    const { sessionId, text, chart, route } = req.body || {}
    const q = String(text || '').trim()
    if (!q) return res.status(400).json({ ok: false, msg: '内容为空' })
    if (q.length > MAX_TEXT) return res.status(400).json({ ok: false, msg: `内容过长（≤${MAX_TEXT} 字）` })

    const enabledRoutes = availableRoutes()
    const defaultRoute = resolveDefaultRoute()
    const enabledKeys = new Set(enabledRoutes.map(([key]) => key))
    if (!enabledKeys.has(defaultRoute)) {
      return res.status(503).json({ ok: false, msg: '元气 Agent 暂未配置可用模型，请稍后再试' })
    }

    let session = sessionId ? store.getSession(req.uid, sessionId) : null
    if (sessionId && !session) return res.status(404).json({ ok: false, msg: '会话不存在' })
    if (!session) {
      // ⚠ 必须用 hasOwnProperty：`ROUTES['constructor']` / `ROUTES['__proto__']`
      // 都是真值，直接判 `ROUTES[route]` 会让这些原型链上的键被当成合法路由存进
      // 会话，池子随后为它们各拉起一个 dsh 子进程。
      const routeKey = enabledKeys.has(route) ? route : defaultRoute
      session = store.createSession(req.uid, { route: routeKey, title: reportSessionTitle(q) || q.slice(0, 14) })
    } else if (!enabledKeys.has(session.route)) {
      // 已失效的旧路由（例如服务器撤掉 DeepSeek 凭据）不能让用户困在无法响应的
      // 会话里；服务端已只公布当前可选模型，迁到默认可用路由即可继续原主题。
      session = store.updateSession(req.uid, session.id, { route: defaultRoute }) || session
    }
    if (pool.isBusy(session.id)) return res.status(409).json({ ok: false, msg: '正在回复中，请稍候' })

    // 会员不按话题或轮次数计费：只要仍有积分即可继续任何历史会话。
    if (req.authed && !canAfford(req.account, 'agent.chat')) {
      return res.status(402).json({ ok: false, reason: 'insufficient', msg: '积分已用完，请订阅后继续咨询' })
    }
    // 游客使用服务端按来源 IP 保护的赠送体验额度；拿到真实 usage 后会替换预扣量。
    const guestLease = !req.authed ? guestQuota.begin(req.ip) : null
    if (guestLease && !guestLease.ok) {
      return res.status(402).json({ ok: false, reason: 'guest_tokens_exhausted', msg: '赠送体验积分已用完，订阅后可继续和元气 Agent 咨询' })
    }

    // 同一用户可以开多个会话，但不能借此并发占满模型池。
    if (!acquireRun(req.uid, req.ip)) {
      return res.status(429).json({ ok: false, msg: '当前对话请求过多，请等待上一轮回复完成' })
    }

    // 命盘变化时把命盘行拼到用户消息前。
    // chartKey 要等这一轮真的跑完再落库：此前在 pool.run 之前就写，本轮一旦失败，
    // 用户重试时 ck 已等于 session.chartKey，命盘行不再拼进去，模型永远不知道命盘。
    const safeChart = normalizeChart(chart)
    const directChart = safeChart ? null : chartFromBirthText(q)
    const suppliedChart = safeChart || directChart
    const ck = chartKeyOf(suppliedChart)
    const currentChart = chartFromKey(session.chartKey)
    const verifiedChart = suppliedChart || currentChart
    const strictRequirement = strictToolRequirement(q, { currentChart, suppliedChart })
    const preflight = strictRequirement?.tool === 'bazi' ? baziPreflight(verifiedChart) : null
    const skillInvocation = strictRequirement?.skill || skillInvocationForQuestion(q, {
      knownBirth: hasCompleteBirth(suppliedChart) || hasCompleteBirth(currentChart),
    })
    const promptProtocols = []
    if (needsEvidenceProtocol(q)) promptProtocols.push(agentEvidenceProtocol())
    if (needsCoverageProtocol(q)) promptProtocols.push(agentCoverageProtocol())
    // 八字咨询即使没有直接写“今年”，模型也常会主动给出“当前大运收官”、
    // “近两年”等时效建议。此时若不提供系统日期，模型可能沿用训练资料中的旧年份。
    // 因此凡进入八字强制测算路径，一律提供当前日期；其它普通闲聊仍按需注入，
    // 避免无关对话被日期提示干扰。
    if (needsCurrentDateContext(q) || strictRequirement?.tool === 'bazi') promptProtocols.push(agentCurrentDateProtocol())
    if (needsCalendarVerification(q)) promptProtocols.push(agentCalendarVerificationProtocol())
    const memory = agentSessionMemory(session, store.listMessages(req.uid, session.id))
    if (memory) promptProtocols.push(memory)
    let prompt = promptProtocols.length ? `${promptProtocols.join('\n\n')}\n\n${q}` : q
    if (preflight) prompt = `${preflight.text}\n\n${prompt}`
    const chartChanged = !!ck && ck !== session.chartKey
    if (safeChart && chartChanged) prompt = `${chartLine(safeChart)}\n${prompt}`
    // 只有时辰也明确时才进入“先校盘”协议。时辰未知仍交由普通对话补充，不能
    // 把工具按午时估算的时柱当成确认盘。
    const needsBaziCalibration = chartChanged && suppliedChart?.hour !== null
    if (needsBaziCalibration) {
      prompt = `${baziCalibrationInstruction(prompt)}\n\n${strictToolInstruction(strictRequirement, verifiedChart)}`
    }
    else if (skillInvocation) {
      const strictProtocol = strictToolInstruction(strictRequirement, verifiedChart)
      prompt = `${skillInvocation}\n\n${strictProtocol ? `${strictProtocol}\n\n` : ''}${prompt}`
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // nginx 默认会缓冲代理响应，那样流式回复会攒成一坨才到前端
    res.flushHeaders()
    const send = e => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`) }
    // 心跳：注释帧（前端解析器只认 data: 行，会忽略它），用来在模型长时间
    // 思考、一个字都没吐时保住中间代理和移动网络的连接。
    const beat = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n') }, 15000)
    const ac = new AbortController()
    // 流式过程中累积的正文：客户端中途断开时 pool.run 会以 abort 抛出，
    // result.finalText 拿不到，此前那一轮的 AI 回复就完全没进镜像 ——
    // 用户重新打开会话只看到自己的提问。这里自己留一份。
    let streamed = ''
    const publicTextFilter = createPublicTextFilter()
    // 这一轮是否产出了任何可交付的内容（正文或测算报告卡片）。只有成功回答才结算积分。
    let producedOutput = false
    let producedReport = false
    // 用 res 而非 req 的 'close'：req 在请求体读完（express.json 已消费）就会触发
    // 'close'，与客户端是否断开无关；res 的 'close' 只在底层 socket 关闭时触发，
    // writableFinished 为 true 说明是我们自己 res.end() 收尾的，不是真实断开。
    res.on('close', () => { if (!res.writableFinished) ac.abort() })
    const tools = []
    const verifiedTools = new Set()
    // 用户也可直接在对话中报出生信息，由 bazi 工具排盘。这种会话没有前端传入的
    // chart，因此需要从成功的工具调用中补齐会话命盘，历史标题才不会仍是提问摘要。
    let baziToolChart = null
    let inferredChart = null
    let sawError = false
    let sentReasoningProgress = false
    try {
    // session 帧与用户消息落库都放进 try：appendMessage 抛错时（磁盘满、
      // 目录只读）原先会把 beat 定时器和这条响应一起晾在那儿，连接永远不收尾。
      send({ type: 'session', sessionId: session.id, route: session.route })
      store.appendMessage(req.uid, session.id, { role: 'user', text: q, time: timeNow() })
      // 这些状态对应服务端已经发生的生命周期节点，供前端的「解读过程」逐步呈现。
      // 不包含模型原始推理、Skill 名或参数，且不写入会话正文。
      send({ type: 'progress', stage: 'session_ready' })
      send({ type: 'progress', stage: 'context_ready' })
      send({ type: 'progress', stage: 'engine_requested' })
      const result = await pool.run({
        routeKey: session.route, sessionId: session.id, text: prompt, signal: ac.signal,
        onEvent: e => {
          if (e.type === 'text' && e.delta) {
            const safeDelta = publicTextFilter.push(e.delta)
            if (safeDelta) {
              streamed += safeDelta
              // 对需要计算事实的请求，先等工具成功返回再交付正文。否则模型先流出
              // 一段“我自己推的”内容，事后即使发现没调用工具也无法收回。
              if (!strictRequirement) {
                producedOutput = true
                send({ ...e, delta: safeDelta })
              }
            }
            return
          }
          if (e.type === 'reasoning') {
            if (!sentReasoningProgress) {
              sentReasoningProgress = true
              send({ type: 'reasoning', delta: USER_FACING_REASONING })
            }
            return
          }
          if (e.type === 'tool_call') {
            tools.push(TOOL_NAME_CN[e.name] || e.name)
            if (e.name === 'bazi') baziToolChart = normalizeChart(e.args)
          }
          // e.ok === false 表示工具执行失败，e.text 是错误信息而不是报告正文。
          // 此前不看 ok，把「排盘失败：出生信息无效」也当成一张测算报告卡片持久化。
          if (e.type === 'tool_result' && e.ok !== false && e.name === strictRequirement?.tool) verifiedTools.add(e.name)
          if (e.type === 'tool_result' && e.name === 'bazi' && e.ok !== false && baziToolChart) inferredChart = baziToolChart
          if (e.type === 'tool_result' && e.kind === 'report' && e.ok !== false) { producedOutput = true; producedReport = true; store.appendMessage(req.uid, session.id, { role: 'ai', kind: 'report', name: e.name, text: e.text, time: timeNow() }) }
          if (e.type === 'title' && session.title.length <= 14) store.updateSession(req.uid, session.id, { title: e.title })
          if (e.type === 'error') sawError = true
          if (e.type !== 'message' && e.type !== 'done') send(e) // done 由下方统一发（带 usage）；若已见 error 则不再发 done
        },
      })
      if (tools.length) store.appendMessage(req.uid, session.id, { role: 'tool', text: tools.join('、'), time: timeNow() })
      // 对实时流优先使用已清理的正文，不能再以 result.finalText 覆盖它：后者是
      // 子进程的原始汇总，可能仍含 <think>。少数不发 text 事件的实现则走完整清理。
      // `bazi` 的预检与页面/工具同源，且模型须在答案中引用至少两项原始盘面事实。
      // 其余术数仍只接受工具成功事件，避免把随机起卦、抽牌等结果伪装为可复用预检。
      const toolVerified = !strictRequirement
        || verifiedTools.has(strictRequirement.tool)
        || (strictRequirement.tool === 'bazi' && citesBaziPreflight(streamed || result.finalText, preflight))
      const finalText = toolVerified
        ? (streamed || sanitizePublicText(result.finalText))
        : strictVerificationFailure(strictRequirement, verifiedChart)
      if (!toolVerified) producedOutput = false
      if (toolVerified && finalText) producedOutput = true
      // 严格测算在此时才发正文：已经确认对应工具成功执行，模型不能以未经核验
      // 的自然语言抢先形成“结论”。未通过闸门的模型文本会被上述固定提示替换。
      if (strictRequirement && finalText) send({ type: 'text', delta: finalText })
      if (finalText) store.appendMessage(req.uid, session.id, { role: 'ai', text: finalText, time: timeNow() })
      streamed = ''
      // 命盘是这段会话最稳定、最容易辨认的身份。排盘成功后用其覆盖提问摘要，
      // 让历史列表直接显示「乾造/坤造 · 出生日期 · 时辰」。
      const sessionChart = inferredChart || (chartChanged ? safeChart : null)
      if (sessionChart) store.updateSession(req.uid, session.id, { chartKey: chartKeyOf(sessionChart), title: chartSessionTitle(sessionChart) })
      // 只保留耗时，不存用户原文或模型的内部推理。会话记录由此能定位“首字慢”还是“总生成慢”。
      if (result.timing) store.updateSession(req.uid, session.id, { lastTiming: result.timing })
      const usedTokens = producedOutput && !sawError ? totalTokens(result.usage) : 0
      if (!req.authed && guestLease) guestQuota.settle(req.ip, usedTokens)
      if (req.authed && usedTokens > 0) {
        const billed = accounts.consumeTokens(req.uid, usedTokens)
        // usage 要等回答完成后才有。余额不够覆盖整次时 accounts 会结清余额，
        // 此处仍交付已完成回复，并由下一次请求统一拦截。
        if (billed.ok) send({ type: 'usage', billedPoints: billed.billedPoints, remaining: billed.remaining, exhausted: billed.exhausted })
        else send({ type: 'usage', billedPoints: 0, remaining: billed.available || 0, limited: true })
      } else if (!req.authed && guestLease) {
        send({ type: 'usage', guest: true })
      }
      if (!sawError) send({ type: 'done', reason: 'completed', usage: result.usage || undefined, timing: result.timing || undefined })
    } catch (err) {
      if (!req.authed && guestLease) guestQuota.settle(req.ip, 0)
      // 断开/失败时也要把已经流出去的正文写进镜像，否则用户回到会话只剩自己的提问。
      if (streamed) {
        try { store.appendMessage(req.uid, session.id, { role: 'ai', text: streamed, time: timeNow() }) } catch { /* 镜像失败不该盖掉真正的错误 */ }
      }
      const code = err?.code || err?.name || 'ERROR'
      // 已知错误给明确文案；其余一律回笼统提示 —— err.message 可能带着文件路径、
      // 上游返回体之类的内部信息，不该原样吐给公网客户端。详情只进服务端日志。
      const KNOWN = {
        BUSY: '正在回复中，请稍候',
        TIMEOUT: '回复超时，请重试',
        CLOSED: '命理助手暂不可用，请稍后重试',
        TransportClosedError: '命理助手暂不可用，请稍后重试',
        UNKNOWN_ROUTE: '模型路由不存在',
        AbortError: '已停止生成',
      }
      const message = KNOWN[code] || '服务异常，请稍后重试'
      if (!KNOWN[code]) console.error('[agent/chat]', code, err)
      send({ type: 'error', code, message })
    } finally {
      releaseRun(req.uid, req.ip)
      clearInterval(beat)
      if (!res.writableEnded) res.end()
    }
  })

  return r
}

export default createAgentRouter
