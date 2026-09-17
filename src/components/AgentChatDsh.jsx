// 元氣 AI · dsh 基座版：只做渲染与流式接管，编排/工具/记忆全在服务端 dsh
import { useEffect, useRef, useState } from 'react'
import { createAgentApi } from '../api/agent.js'
import { reportApi } from '../api/reports.js'
import { buildChart } from '../engine/bazi.js'
import { listCollection, saveToCollection, removeFromCollection } from '../engine/chartCollection.js'
import { refreshSession } from '../data/users.js'
import { canAfford, nextPlanKey } from '../engine/membership.js'
import { LanguageSwitcher } from '../i18n.jsx'
import { renderMarkdown } from '../utils/markdown.jsx'
import { ThinkBlock, ToolCallsBlock, CopyButton, StructuredAnswer, parseStructuredAnswerText, renderAiText, timeNow, fmtSessionTime, quickQuestionsForConversation, isNearScrollBottom } from './agent/ChatParts.jsx'

const api = createAgentApi()
const ROUTE_KEY = 'genki-agent-route'
const ROUTE_PREF_PREFIX = 'v2:'
const OPENING = ['我是「三门先生」，一位玄学大师。八字、紫微、六爻、奇门、黄历、塔罗、取名、风水，心有所问，尽管开口。', '把出生年月日时和性别告诉我，我先为你排盘；也可以直接问今年运势、事业、姻缘。']
const OPENING_EN = ['I am Mr. Sanmen, your personal metaphysics guide. Ask about Bazi, Ziwei, Qimen, the Almanac, Tarot, names, or Feng Shui.', 'Share your birth date, time, and gender to create a chart, or ask about your year, career, or relationships.']
const SHI_CHEN = ['子', '丑', '丑', '寅', '寅', '卯', '卯', '辰', '辰', '巳', '巳', '午', '午', '未', '未', '申', '申', '酉', '酉', '戌', '戌', '亥', '亥', '子']

function agentCopy(locale, key, fallback = key) {
  const en = {
    session: 'Session', unnamedSession: 'Untitled session', report: 'Reading report', malformedReply: '⚠️ The reply format was incomplete. Please ask again.', loginExpired: '⚠️ Your session expired. Please sign in again.', stopped: '⏹ Generation stopped', networkFailed: 'Network issue. The reply was not completed.', historyFailed: 'Could not load conversations. Check your connection and try again.', sessionMissing: 'This conversation is unavailable.', deleteFailed: 'Could not delete this conversation. Please try again.', noChart: 'No chart is active. Share your birth details before saving one.', chartName: 'Name this chart (for example: Me, Mom, Child):',
    agentName: 'Mr. Sanmen', shortName: 'Sanmen', usage: 'Usage-based billing · Keep asking', trial: 'Trial credits included · Subscribe when used', newChat: 'New chat', history: 'History', totalChats: count => `${count} chats · Select to restore`, close: 'Close', noHistory: 'No saved conversations yet. Start chatting to save one.', messages: count => `${count} messages`, delete: 'Delete', myCharts: 'My charts', totalCharts: count => `${count} saved · Select to switch`, saveChart: '+ Save current', noCharts: 'No saved charts. Create one, then save it here.', saved: 'saved', removeSaved: 'Remove saved chart', you: 'You', copyReport: 'Copy full report', askAnything: 'Ask Mr. Sanmen anything…', switchModel: 'Switch model', modelTitle: 'Choose model (starts a new chat)', modelDeepNote: 'Deep mode is more thorough and may take longer.', modelQuick: 'Quick', modelDeep: 'Deep', stop: 'Stop generating',
  }
  return locale === 'en' ? (en[key] ?? fallback) : fallback
}

function isDeepRoute(route) {
  return route === 'deepseek-pro' || route === 'minimax'
}

function routeModeCopy(route, locale) {
  return isDeepRoute(route)
    ? agentCopy(locale, 'modelDeep', '深度')
    : agentCopy(locale, 'modelQuick', '快速')
}

// v1 只存一个裸路由名，历史用户曾因此被永久锁在 MiniMax。v2 仅保存用户主动点选的
// 路由；所有旧裸值一律交回默认 Flash，保留之后手动选择深度模型的能力。
export function resolveAgentRoute(stored, fallback = 'deepseek-flash', available = null) {
  if (typeof stored !== 'string' || !stored.startsWith(ROUTE_PREF_PREFIX)) return fallback
  const route = stored.slice(ROUTE_PREF_PREFIX.length)
  if (!route) return fallback
  return Array.isArray(available) && available.length && !available.includes(route) ? fallback : route
}

export function serializeAgentRoute(route) {
  return `${ROUTE_PREF_PREFIX}${route}`
}

// 报告页进入聊天时，实际请求会带完整报告资料；用户只需要看到自然的咨询意图。
// 保持字符串输入兼容普通首页入口与快捷提问。
export function normalizeAgentSeed(input, fallback = '') {
  const isSeed = input && typeof input === 'object' && !Array.isArray(input)
  const requestText = String(isSeed ? (input.text || '') : (input || fallback)).trim()
  const displayText = String(isSeed && input.displayText ? input.displayText : requestText).trim()
  return { requestText, displayText }
}

// 解读进度展示的是用户可理解的执行阶段，而不是模型原始推理。这样既能让等待过程有
// 反馈，也不会泄漏 Skill、系统提示、工具参数或模型自言自语。
export function safeThinkStep(type, toolName = '', locale = 'zh-CN') {
  if (locale === 'en') {
    const stages = {
      start: 'Request received. Identifying the reading topic…', session_ready: 'Conversation ready. Preparing this consultation…', context_ready: 'Conversation context is ready. Checking whether a chart or prior report is needed…', engine_connecting: 'Connecting the reading engine…', engine_ready: 'Reading engine is ready. Delivering your request…', engine_requested: 'Reading request delivered. Waiting for the first response…', reasoning: 'Reviewing the relevant chart relationships and key facts…\nCross-checking the available information…', answering: 'Organizing the key conclusion and practical guidance…\nChecking that the reply directly addresses your question…', completed: 'Reading complete. You can ask a follow-up question.',
    }
    const calls = { bazi: 'Calculating the Four Pillars and luck cycles…', ziwei: 'Calculating the Ziwei chart and twelve palaces…', qimen: 'Casting the Qimen chart and reviewing the pattern…', liuyao: 'Casting the hexagram and reviewing changing lines…', huangli: 'Checking the date and Almanac guidance…', tarot: 'Reviewing the spread and card positions…', fengshui: 'Reviewing space, direction, and movement…', name: 'Reviewing name structure and element balance…', wuyunliuqi: 'Reviewing seasonal wellness factors…' }
    const results = { bazi: 'Four Pillars data returned. Checking its relevance to this question…', ziwei: 'Ziwei chart data returned. Checking palace and star relationships…', qimen: 'Qimen chart returned. Checking the relevant signifiers…', liuyao: 'Hexagram returned. Checking the changing-line relationship…', huangli: 'Date guidance confirmed. Converting it into practical advice…', tarot: 'Spread details are ready. Relating the positions to your question…', fengshui: 'Space details are ready. Preparing actionable suggestions…', name: 'Name details are ready. Organizing the key points…', wuyunliuqi: 'Wellness factors are ready. Organizing daily recommendations…' }
    if (stages[type]) return stages[type]
    return type === 'tool_result' ? (results[toolName] || 'Required information returned. Preparing the reply…') : (calls[toolName] || 'Checking the information needed for this reading…')
  }
  if (type === 'start') return '已接收咨询，正在识别本次解读主题…'
  if (type === 'session_ready') return '已建立本次咨询会话，正在接入解读引擎…'
  if (type === 'context_ready') return '已同步本轮会话上下文与可用资料…\n正在确认本次问题是否需要命盘或历史报告辅助判断…'
  if (type === 'engine_connecting') return '正在连接解读引擎…\n连接建立后将立即提交本次咨询…'
  if (type === 'engine_ready') return '解读引擎已就绪…\n正在提交本次咨询并等待接收确认…'
  if (type === 'engine_requested') return '已将咨询主题与上下文提交给解读引擎…\n正在等待模型返回首个推断片段…'
  if (type === 'reasoning') return '模型已开始推断，正在梳理命盘关系与问题重点…\n正在对照已有资料，检查关键信息是否一致…\n正在提取与本次问题最相关的判断依据…\n正在交叉核验信息之间的关联…'
  if (type === 'answering') return '已收到模型正文，正在整理核心判断…\n正在把判断转成清晰、可执行的建议…\n正在检查结论是否直接回应本次问题…'
  if (type === 'completed') return '本次解读已完成，结论与建议已整理。\n本轮实时输出已结束，可继续追问相关细节。'
  const key = String(toolName || '')
  const calls = {
    bazi: '正在请求八字排盘计算…\n正在复核出生时间、性别与起运方向…',
    ziwei: '正在请求紫微命盘计算…\n正在核对十二宫与主星落位…',
    qimen: '正在起局并核对格局…\n正在整理与提问相关的宫位信息…',
    liuyao: '正在起卦并核对动爻…\n正在整理卦象与变卦关系…',
    huangli: '正在核对日期与宜忌…\n正在整理与当前场景相关的时间信息…',
    tarot: '正在整理牌阵信息…\n正在核对牌位与问题主题的对应关系…',
    fengshui: '正在分析空间信息…\n正在核对方位、动线与个人命盘的关系…',
    name: '正在核对姓名结构…\n正在整理笔画、五行与音形信息…',
    wuyunliuqi: '正在整理养生要点…\n正在核对节气与体质相关信息…',
  }
  const results = {
    bazi: '四柱与大运计算已返回…\n正在校验排盘结果能否用于本轮解读…\n正在提取与当前问题相关的命盘信息…',
    ziwei: '紫微命盘计算已返回…\n正在校验宫位与主星信息的对应关系…',
    qimen: '奇门格局已返回…\n正在校验用神与问事方向的关联…',
    liuyao: '卦象计算已返回…\n正在校验动爻、变卦与问题重点的关系…',
    huangli: '日期宜忌已核对…\n正在转化为适合当前场景的建议…',
    tarot: '牌阵信息已整理…\n正在结合牌位关系形成解读…',
    fengshui: '空间信息已核对…\n正在转化为可执行的布局建议…',
    name: '姓名结构已核对…\n正在整理与问题相关的判断要点…',
    wuyunliuqi: '养生要点已整理…\n正在组织日常可执行的提醒…',
  }
  if (type === 'tool_result') return results[key] || '所需信息已返回，正在校验是否适用于本轮解读…\n正在组织答复…'
  return calls[key] || '正在查询所需信息…\n正在等待结果返回…'
}

export function appendSafeThinkStep(message, step) {
  const nextSteps = String(step || '').split('\n').map(item => item.trim()).filter(Boolean)
  const current = String(message?.reasoning || '').trim()
  const currentSteps = current.split('\n').map(item => item.trim()).filter(Boolean)
  const additions = nextSteps.filter(item => !currentSteps.includes(item))
  if (!additions.length) return message
  return { ...message, reasoning: [...currentSteps, ...additions].join('\n') }
}

// 状态恢复、热更新和最终渲染都使用同一个判断。即使旧消息绕过了状态迁移，
// 也绝不能把结构化协议的 JSON 原文直接呈现给用户。
export function renderableAgentAnswer(message) {
  if (!message || message.role !== 'ai' || message.streaming) return null
  if (message.answer && typeof message.answer === 'object' && typeof message.answer.summary === 'string') return message.answer
  return parseStructuredAnswerText(message.text)
}

function readAgentRoutePreference() {
  try {
    const stored = localStorage.getItem(ROUTE_KEY)
    const route = resolveAgentRoute(stored)
    if (stored && !stored.startsWith(ROUTE_PREF_PREFIX)) localStorage.removeItem(ROUTE_KEY)
    return route
  } catch { return 'deepseek-flash' }
}

// hour 缺失表示「时辰未知」，不能悄悄补成 12 点：服务端会把它当成确定的午时写进
// 命盘行，模型据此排出的时柱是编的，用户却看不出来。原样传 null，由服务端与人设
// 决定怎么向用户说明。
function chartMeta(c) { return c ? { year: c.year, month: c.month, day: c.day, hour: c.hour ?? null, gender: c.gender } : null }
function chartLabel(c, locale = 'zh-CN') {
  const shiChen = Number.isInteger(c.hour) ? ` · ${SHI_CHEN[c.hour]}时` : ''
  if (locale === 'en') return `${c.gender === '女' ? 'Female' : 'Male'} · ${c.year}-${c.month}-${c.day}${Number.isInteger(c.hour) ? ` · ${SHI_CHEN[c.hour]} hour` : ''}`
  return `${c.gender === '女' ? '坤造' : '乾造'} · ${c.year}年${c.month}月${c.day}日${shiChen}`
}
export function displaySessionTitle(title, locale = 'zh-CN') {
  const value = String(title || '').replace(/\s+/g, ' ').trim()
  return /(?:【\s*(?:回答长度|问题覆盖校验|当前日期口径|日期换算核验|会话事实备忘|最终交付格式|当前缘主命盘|输出语言|輸出語言|Output language)|这是一次常规咨询|不要复述整张命盘)/i.test(value)
    ? agentCopy(locale, 'session', '本次咨询')
    : value || agentCopy(locale, 'unnamedSession', '未命名会话')
}
function sessionTitle(s, locale = 'zh-CN') {
  const title = displaySessionTitle(s.title, locale)
  if (!s.chartKey) return title
  const [year, month, day, hour, gender] = s.chartKey.split('-')
  const h = hour === 'x' ? null : Number(hour)
  if (!Number.isInteger(+year) || !Number.isInteger(+month) || !Number.isInteger(+day) || (h !== null && !Number.isInteger(h))) {
    return title
  }
  return chartLabel({ year: +year, month: +month, day: +day, hour: h, gender }, locale)
}
function canRestoreSession(session) {
  // 积分余额与会话独立；只要会话存在，就应能恢复完整上下文。
  return Boolean(session?.id)
}

export default function AgentChatDsh({ chart: chartProp, seedQuery, user, reportId, initialSessionId, locale = 'zh-CN', onRequireLogin, onUpgrade, onUserChange }) {
  const [messages, setMessages] = useState(() => (locale === 'en' ? OPENING_EN : OPENING).map((text, i) => ({ id: `boot-${i}`, role: 'ai', text, time: timeNow(), _counted: true })))
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [activeChart, setActiveChart] = useState(() => chartProp || null)
  const [sessionId, setSessionId] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [collection, setCollection] = useState(() => listCollection())
  const [showCollection, setShowCollection] = useState(false)
  const [models, setModels] = useState({ routes: [], default: null })
  const [route, setRoute] = useState(readAgentRoutePreference)
  // 历史会话的路由由服务端 session 决定。单独保存它，避免本地“下一段新会话”的偏好
  // 被错误地显示成当前会话模型，特别是旧 MiniMax 会话会因此看起来像 Flash 却很慢。
  const [sessionRoute, setSessionRoute] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const scrollRef = useRef(null)
  const followScrollRef = useRef(true)
  const abortRef = useRef(null)
  // React 的 typing 状态要到下一次渲染才生效；快捷问题连续点击时用 ref 同步挡住
  // 同一帧里的重复请求，避免触发服务端的并发保护。
  const sendLockRef = useRef(false)
  const booted = useRef(false)
  const autoResumeAttempted = useRef(false)
  // 报告和会话的关联只需建立一次。重复 SSE session 事件或 React 重渲染都不能
  // 让同一条咨询在报告详情里重复出现。
  const linkedReportSessions = useRef(new Set())

  useEffect(() => {
    let cancelled = false
    api.listModels().then(m => {
      if (cancelled) return
      const routes = m.routes || []
      const available = routes.map(item => item.key)
      const fallback = m.default || 'deepseek-flash'
      setModels({ routes, default: fallback })
      setRoute(current => {
        if (available.includes(current)) return current
        try { localStorage.removeItem(ROUTE_KEY) } catch { /* 私密模式下无需持久化 */ }
        // 可用模型列表只决定「下一段新会话」的默认路由。已有会话的真实路由由
        // 服务端 session 记录决定；这里清 sessionId 会让用户下一次发言创建新会话，
        // 于是出现“历史还显示着，Agent 却忘了”的假续聊。
        return fallback
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const el = scrollRef.current
    if (el && followScrollRef.current) el.scrollTop = el.scrollHeight
  }, [messages, typing])
  // 历史消息有时在热更新前已经进入浏览器状态，因而不会再次走 restore()。
  // 对已完成的 AI 消息做一次幂等恢复，让旧 JSON 信封也进入固定字段渲染。
  useEffect(() => {
    setMessages(prev => {
      let recovered = false
      const next = prev.map(message => {
        if (message.answer || !message.text) return message
        const answer = renderableAgentAnswer(message)
        if (!answer) return message
        recovered = true
        return { ...message, answer, text: '' }
      })
      return recovered ? next : prev
    })
  }, [messages])
  useEffect(() => {
    if (!pickerOpen) return
    const close = () => setPickerOpen(false)
    const t = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', close) }
  }, [pickerOpen])

  // 积分扣减由服务端根据模型 usage 换算。回答完成后刷新一次账户镜像即可。
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'ai' || last.streaming || last._counted || (!last.text && !last.answer)) return
    if (last._failed) {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, _counted: true } : m))
      return
    }
    if (user) refreshSession().then(u => { if (u) onUserChange && onUserChange(u) })
    setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, _counted: true } : m))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user])

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    if (seedQuery) send(seedQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchLast = fn => setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'ai' && m.streaming ? fn(m) : m))
  const patchToolStatus = (tools, name, status) => {
    const index = [...tools].map(tool => typeof tool === 'string' ? tool : tool.name).lastIndexOf(name)
    return tools.map((tool, i) => i === index
      ? { name: typeof tool === 'string' ? tool : tool.name, status }
      : typeof tool === 'string' ? { name: tool, status: 'pending' } : tool)
  }
  const handleChatScroll = event => { followScrollRef.current = isNearScrollBottom(event.currentTarget) }

  const send = async (text) => {
    const { requestText: q, displayText } = normalizeAgentSeed(text, input)
    if (!q || typing || sendLockRef.current) return
    if (user && !canAfford(user, 'agent.chat')) { onUpgrade && onUpgrade(nextPlanKey(user.plan)); return }
    sendLockRef.current = true
    followScrollRef.current = true
    setInput('')
    setTyping(true)
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q, displayText, time: timeNow() }, { id: `a-${Date.now()}`, role: 'ai', text: '', reasoning: safeThinkStep('start', '', locale), tools: [], streaming: true, time: timeNow() }])
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await api.streamChat({
        // 已有会话的真实路由不可由前端覆盖；服务端会从 session 读取。只给新会话传用户
        // 明确选择的路由，既避免歧义，也使界面展示与实际调用保持一致。
        sessionId, text: q, chart: chartMeta(activeChart), route: sessionId ? undefined : (route || models.default || undefined), locale, signal: ac.signal,
        onEvent: e => {
          switch (e.type) {
            case 'session':
              if (!sessionId) setSessionId(e.sessionId)
              if (e.route) setSessionRoute(e.route)
              setActiveSession(prev => prev?.id === e.sessionId ? prev : { id: e.sessionId, title: q.slice(0, 14) })
              if (reportId && e.sessionId && !linkedReportSessions.current.has(e.sessionId)) {
                linkedReportSessions.current.add(e.sessionId)
                // 关联失败不影响本轮回答；下次收到 session 事件时允许重试。
                reportApi.linkSession(reportId, e.sessionId).then(result => {
                  if (!result.ok) linkedReportSessions.current.delete(e.sessionId)
                }).catch(() => linkedReportSessions.current.delete(e.sessionId))
              }
              break
            case 'usage':
              if (user) refreshSession().then(u => { if (u) onUserChange && onUserChange(u) })
              break
            case 'progress': patchLast(m => appendSafeThinkStep(m, safeThinkStep(e.stage, '', locale))); break
            case 'heartbeat':
              patchLast(m => ({ ...appendSafeThinkStep(m, safeThinkStep(e.stage, '', locale)),
                heartbeat: { stage: e.stage, elapsedSeconds: e.elapsedSeconds, at: Date.now() },
              }))
              break
            case 'text': patchLast(m => {
              if (e.structured === false) {
                return { ...appendSafeThinkStep(m, safeThinkStep('answering', '', locale)), structuredRaw: undefined, text: m.text + e.delta }
              }
              const candidate = `${m.structuredRaw || ''}${e.delta}`
              const isStructured = Boolean(m.structuredRaw) || /^\s*\{\s*"version"\s*:/.test(`${m.text || ''}${e.delta}`)
              if (isStructured) return { ...appendSafeThinkStep(m, safeThinkStep('answering', '', locale)), structuredRaw: candidate, text: '' }
              return { ...appendSafeThinkStep(m, safeThinkStep('answering', '', locale)), text: m.text + e.delta }
            }); break
            case 'answer':
              patchLast(m => ({
                ...appendSafeThinkStep(m, safeThinkStep('answering', '', locale)),
                answer: e.answer,
                text: '',
              }))
              break
            case 'reasoning': patchLast(m => appendSafeThinkStep(m, safeThinkStep('reasoning', '', locale))); break
            case 'tool_call': patchLast(m => ({ ...appendSafeThinkStep(m, safeThinkStep('tool_call', e.name, locale)), tools: [...m.tools, { name: e.name, status: 'pending' }] })); break
            case 'tool_result':
              patchLast(m => ({ ...appendSafeThinkStep(m, safeThinkStep('tool_result', e.name, locale)), tools: patchToolStatus(m.tools, e.name, e.ok === false ? 'failed' : 'complete') }))
              if (e.kind === 'report') {
                // 报告卡片插在流式气泡之前
                setMessages(prev => { const last = prev[prev.length - 1]; return [...prev.slice(0, -1), { id: `r-${Date.now()}`, role: 'ai', kind: 'report', report: { title: (e.text.match(/^# (.+)$/m) || [])[1] || agentCopy(locale, 'report', '测算报告'), markdown: e.text }, time: timeNow(), _counted: true }, last] })
              }
              break
            // 追加而不是二选一：模型已经吐了半截又报错时，丢掉已渲染的文字
            // 会让用户看着内容凭空消失；把错误接在后面，两样都留住。
            case 'error': patchLast(m => ({ ...m, text: (m.text ? m.text + '\n\n' : '') + `⚠️ ${e.message}`, streaming: false, _failed: true })); break
            case 'done': patchLast(m => {
              const raw = m.structuredRaw || m.text
              const answer = m.answer || parseStructuredAnswerText(raw)
              return answer
                ? { ...appendSafeThinkStep(m, safeThinkStep('completed', '', locale)), answer, text: '', structuredRaw: undefined, streaming: false }
                : { ...appendSafeThinkStep(m, safeThinkStep('completed', '', locale)), text: m.structuredRaw ? agentCopy(locale, 'malformedReply', '⚠️ 本次回复格式未完成，请重新提问。') : m.text, structuredRaw: undefined, streaming: false }
            }); break
            default: break
          }
        },
      })
    } catch (err) {
      // 服务端说积分不足（402）。本地的 canAfford 是拿镜像算的，可能偏旧或被改过，
      // 服务端才是权威 —— 这里把那一条空气泡撤掉并引导升级，而不是给用户看一句报错。
      if (err && err.reason === 'guest_tokens_exhausted') {
        setMessages(prev => prev.slice(0, -2))
        setInput(q)
        onRequireLogin && onRequireLogin('agent')
        return
      }
      if (err && (err.reason === 'insufficient' || err.status === 402)) {
        // 这一轮根本没发生：把刚插进去的「提问 + 空回复」两条一起撤掉，
        // 并把问题放回输入框，用户升级完可以直接再发一次，不用重打。
        setMessages(prev => prev.slice(0, -2))
        setInput(q)
        refreshSession().then(u => { if (u) onUserChange && onUserChange(u) })
        onUpgrade && onUpgrade(nextPlanKey(user && user.plan))
        return
      }
      // 登录态失效（401）：token 过期或账号已注销。api 层已清掉 token，
      // 这里只需给出一句能让人知道该干什么的提示。
      if (err && err.status === 401) {
        patchLast(m => ({ ...m, text: agentCopy(locale, 'loginExpired', '⚠️ 登录已失效，请重新登录后继续'), streaming: false, _failed: true }))
        return
      }
      // 会话在服务端已不存在（重启/淘汰/删除）→ 清掉本地 sessionId，
      // 否则之后每一次发送都会打到同一个 404 上，用户只能刷新页面。
      if (/会话不存在|404/.test(String(err && err.message))) setSessionId(null)
      // 连接中断时若已经吐了半截字，此前只是把 streaming 关掉、错误被吞掉，
      // 用户看到的是一段没有任何提示的截断回复。补上提示并标记为失败（不计费）。
      const aborted = err && (err.name === 'AbortError' || ac.signal.aborted)
      patchLast(m => ({
        ...m,
        text: aborted
          ? (m.text ? m.text + `\n\n${agentCopy(locale, 'stopped', '⏹ 已停止生成')}` : agentCopy(locale, 'stopped', '⏹ 已停止生成'))
          : (m.text ? m.text + '\n\n' : '') + `⚠️ ${err.message || agentCopy(locale, 'networkFailed', '网络异常，回复未完成')}`,
        streaming: false,
        _failed: true,
      }))
    } finally {
      patchLast(m => ({ ...m, streaming: false }))
      setTyping(false)
      abortRef.current = null
      sendLockRef.current = false
    }
  }

  const stopGenerating = () => {
    if (abortRef.current) abortRef.current.abort()
  }

  const newChat = () => {
    if (abortRef.current) abortRef.current.abort()
    setSessionId(null)
    setSessionRoute(null)
    setActiveSession(null)
    setActiveChart(null)
    setShowHistory(false)
    setInput('')
    setMessages((locale === 'en' ? OPENING_EN : OPENING).map((text, i) => ({ id: `boot-${Date.now()}-${i}`, role: 'ai', text, time: timeNow(), _counted: true })))
  }

  // 历史面板的加载/恢复/删除此前一律 catch 后静默吞掉：网络断了、会话在服务端
  // 已不存在，用户点了什么都不发生，只能一直重试。统一给出可见反馈。
  const [historyErr, setHistoryErr] = useState('')

  const openHistory = async () => {
    setHistoryErr('')
    setShowHistory(true)
    try {
      const r = await api.listSessions()
      setSessions(r.sessions || [])
    } catch (e) {
      setSessions([])
      setHistoryErr(agentCopy(locale, 'historyFailed', '会话列表加载失败，请检查网络后重试'))
    }
  }

  const restore = async (s) => {
    setHistoryErr('')
    try {
      const r = await api.loadMessages(s.id)
      const restored = r.session || s
      setMessages((r.messages || []).map((m, i) => m.kind === 'report'
        ? { id: `h-${i}`, role: 'ai', kind: 'report', report: { title: (m.text.match(/^# (.+)$/m) || [])[1] || agentCopy(locale, 'report', '测算报告'), markdown: m.text }, time: m.time, _counted: true }
        : { id: `h-${i}`, role: m.role, text: m.answer ? m.text : (parseStructuredAnswerText(m.text) ? '' : m.text), answer: m.answer || parseStructuredAnswerText(m.text), time: m.time, _counted: true }))
      setSessionId(restored.id)
      setSessionRoute(restored.route || null)
      setActiveSession({ id: restored.id, title: sessionTitle(restored, locale) })
      setActiveChart(null)
      if (restored.chartKey) { const [y, mo, d, h, g] = restored.chartKey.split('-'); try { setActiveChart(buildChart(+y, +mo, +d, +h, g)) } catch { /* 命盘键格式异常：不影响正文恢复 */ } }
      setShowHistory(false)
    } catch (e) {
      // 会话在服务端已不存在（被淘汰/删除）→ 从列表里摘掉，不要让用户反复点一个死条目
      setSessions(prev => prev.filter(x => x.id !== s.id))
      setHistoryErr(agentCopy(locale, 'sessionMissing', '该会话已不存在或加载失败'))
    }
  }

  // 从「我的报告」打开一段关联咨询时，直接恢复原会话，而不是只跳到空白聊天页。
  useEffect(() => {
    if (initialSessionId) restore({ id: initialSessionId })
    // restore 是当前组件内的稳定业务动作；只在目标会话变化时恢复一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId])

  // 重新进入 Agent 时默认接回最新会话。此前 sessionId 只存在组件内存：
  // 页面一卸载就丢，用户没有主动打开“会话历史”便直接续问时，会被悄悄创建成新会话。
  // 主动点“新会话”仍是唯一明确开始新话题的入口；带 initialSessionId 的报告咨询则优先
  // 恢复指定会话，绝不被自动恢复覆盖。首页带来的 seedQuery 同样代表一段新对话，
  // 绝不能与最近会话的异步恢复并发，否则旧记录会覆盖正在流式生成的首轮回复。
  useEffect(() => {
    if (initialSessionId || seedQuery || autoResumeAttempted.current) return
    autoResumeAttempted.current = true
    let cancelled = false
    api.listSessions().then(r => {
      if (cancelled) return
      const candidate = (r.sessions || []).find(session => canRestoreSession(session))
      if (candidate) restore(candidate)
    }).catch(() => { /* 首屏不因历史加载失败打断新咨询 */ })
    return () => { cancelled = true }
    // 只在本次页面挂载时寻找一次“最近主题”；restore 内部会接住服务端最新快照。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, seedQuery])

  const del = async (id) => {
    setHistoryErr('')
    try {
      await api.deleteSession(id)
      const remaining = sessions.filter(s => s.id !== id)
      setSessions(remaining)
      // 删掉最后一条历史时，不能继续显示已不属于任何会话的旧消息。
      if (remaining.length === 0 || sessionId === id) newChat()
    } catch (e) {
      setHistoryErr(agentCopy(locale, 'deleteFailed', '删除失败，请稍后重试'))
    }
  }

  const refreshCollection = () => setCollection(listCollection())
  const saveCurrentChart = () => {
    if (!activeChart) { window.alert(agentCopy(locale, 'noChart', '当前还没有命盘，请先提供出生信息排盘后再收藏。')); return }
    const label = window.prompt(agentCopy(locale, 'chartName', '为这个命盘起个名字（如：我自己、妈妈、孩子）：'), chartLabel(activeChart, locale))
    if (label === null) return
    saveToCollection(activeChart, label.trim())
    refreshCollection()
  }
  const switchToCollected = (it) => {
    try { setActiveChart(buildChart(it.year, it.month, it.day, it.hour, it.gender)); setSessionId(null); setSessionRoute(null); setActiveSession(null); setShowCollection(false) } catch { /* ignore invalid saved chart */ }
  }
  // 换模型 = 换一个服务端会话。此前只把 sessionId 置空却保留了聊天记录：
  // 界面上还挂着上文，服务端却是一张白纸，模型完全不知道前面聊过什么，
  // 用户以为它「突然失忆」。直接开一段新对话，语义才是一致的。
  const pickRoute = (key) => {
    const activeRoute = sessionRoute || route || models.default
    setRoute(key)
    try { localStorage.setItem(ROUTE_KEY, serializeAgentRoute(key)) } catch { /* 忽略 */ }
    setPickerOpen(false)
    if (key !== activeRoute) newChat()
  }
  // ⚠ 必须避开输入法组合态：中文拼音输入时按回车是「确认候选词」，
  // 不判 isComposing / keyCode 229 的话，那一下会把还没选完的半截文本直接发出去。
  const handleKey = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return
    e.preventDefault()
    send()
  }
  const quick = quickQuestionsForConversation(messages, { hasChart: Boolean(activeChart), locale })
  const currentRoute = sessionRoute || route || models.default || 'deepseek-flash'
  const currentRouteMeta = models.routes.find(item => item.key === currentRoute)
  const currentRouteIsDeep = isDeepRoute(currentRoute)
  return (
    <div className="agent-page-inner">
      <div className="agent-head">
        <div className="agent-avatar">三</div>
        <div className="agent-head-main">
          <div className="agent-head-top">
            {activeChart ? <div className="current-chart-chip"><span className="current-chart-txt">{chartLabel(activeChart, locale)}</span></div>
              : activeSession ? <div className="current-session-chip" title={displaySessionTitle(activeSession.title, locale)}><span className="current-session-label">{agentCopy(locale, 'session', '会话')}</span><span className="current-session-title">{displaySessionTitle(activeSession.title, locale)}</span></div>
                : <div className="name"><span className="agent-name-full">{agentCopy(locale, 'agentName', '三门先生')}</span><span className="agent-name-short">{agentCopy(locale, 'shortName', '三门')}</span></div>}
          </div>
          <div className="agent-topic-status">{user ? agentCopy(locale, 'usage', '按实际用量结算 · 可持续追问') : agentCopy(locale, 'trial', '赠送体验积分 · 用完后订阅')}</div>
        </div>
        <div className="agent-head-actions">
          <LanguageSwitcher mobile />
          <button className="agent-btn" onClick={newChat} title={agentCopy(locale, 'newChat', '新会话')} aria-label={agentCopy(locale, 'newChat', '新会话')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button className="agent-btn" onClick={openHistory} title={agentCopy(locale, 'history', '会话历史')} aria-label={agentCopy(locale, 'history', '会话历史')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 3" /></svg>
          </button>
        </div>

        {showHistory && (
          <div className="session-drawer">
            <div className="session-drawer-head">
              <div className="session-drawer-titles"><span className="session-drawer-title">{agentCopy(locale, 'history', '会话历史')}</span><span className="session-drawer-sub">{locale === 'en' ? agentCopy(locale, 'totalChats')(sessions.length) : `共 ${sessions.length} 次 · 点击恢复`}</span></div>
              <div className="session-drawer-ops"><button className="session-close-btn" onClick={() => setShowHistory(false)}>{agentCopy(locale, 'close', '关闭')}</button></div>
            </div>
            {historyErr && (
              <div className="session-empty" style={{ color: 'var(--danger, #c0392b)' }}>{historyErr}</div>
            )}
            <div className="session-list">
              {sessions.length === 0 ? <div className="session-empty">{agentCopy(locale, 'noHistory', '暂无历史会话，聊两句就会自动记录。')}</div> : sessions.map(s => (
                <div key={s.id} className={`session-item ${s.id === sessionId ? 'active' : ''}`} onClick={() => restore(s)}>
                  <div className="session-item-body">
                    <div className="session-item-title">{sessionTitle(s, locale)}</div>
                    <div className="session-item-meta"><span>{locale === 'en' ? agentCopy(locale, 'messages')(s.messageCount) : `${s.messageCount} 条消息`}</span><span>{fmtSessionTime(s.updatedAt, locale)}</span></div>
                  </div>
                  <button className="session-del" onClick={e => { e.stopPropagation(); del(s.id) }} title={agentCopy(locale, 'delete', '删除')} aria-label={agentCopy(locale, 'delete', '删除会话')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showCollection && (
          <div className="session-drawer">
            <div className="session-drawer-head">
              <div className="session-drawer-titles"><span className="session-drawer-title">{agentCopy(locale, 'myCharts', '我的命盘')}</span><span className="session-drawer-sub">{locale === 'en' ? agentCopy(locale, 'totalCharts')(collection.length) : `共 ${collection.length} 个 · 点击切换`}</span></div>
              <div className="session-drawer-ops"><button className="session-clear-btn" onClick={saveCurrentChart}>{agentCopy(locale, 'saveChart', '＋ 收藏当前')}</button><button className="session-close-btn" onClick={() => setShowCollection(false)}>{agentCopy(locale, 'close', '关闭')}</button></div>
            </div>
            <div className="session-list">
              {collection.length === 0 ? <div className="session-empty">{agentCopy(locale, 'noCharts', '还没有收藏的命盘。先排一个盘，点「＋收藏当前」保存。')}</div> : collection.map(it => (
                <div key={it.id} className="session-item" onClick={() => switchToCollected(it)}>
                  <div className="session-item-body">
                    <div className="session-item-title">⭐ {it.label}</div>
                    <div className="session-item-meta"><span className="session-pillar">{chartLabel(it, locale)}</span><span>{fmtSessionTime(it.savedAt, locale)} {agentCopy(locale, 'saved', '收藏')}</span></div>
                  </div>
                  <button className="session-del" onClick={e => { e.stopPropagation(); removeFromCollection(it.id); refreshCollection() }} title={agentCopy(locale, 'removeSaved', '取消收藏')} aria-label={agentCopy(locale, 'removeSaved', '取消收藏')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chat-scroll" ref={scrollRef} onScroll={handleChatScroll}>
        {messages.map(m => {
          const answer = renderableAgentAnswer(m)
          return (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="avatar">{m.role === 'ai' ? '三' : m.role === 'tool' ? '🔧' : agentCopy(locale, 'you', '我')}</div>
            <div className="msg-content">
              {m.kind === 'report' ? (
                <>
                  <div className="bubble bubble-report-md">
                    <div className="report-md-title">{m.report.title}</div>
                    <div className="report-md-body">{renderMarkdown(m.report.markdown)}</div>
                  </div>
                  <div className="msg-actions"><CopyButton text={m.report.markdown} title={agentCopy(locale, 'copyReport', '复制报告全文')} locale={locale} /></div>
                </>
              ) : m.role === 'tool' ? (
                <ToolCallsBlock names={m.text} locale={locale} />
              ) : (
                <div className={`bubble ${m.streaming ? 'bubble-streaming' : ''}`}>
                  {m.reasoning ? <ThinkBlock content={m.reasoning} streaming={!!m.streaming} collapseWhenStreamingText={Boolean(m.text || answer)} heartbeat={m.heartbeat} locale={locale} /> : null}
                  {m.tools && m.tools.length > 0 ? <ToolCallsBlock tools={m.tools} streaming={!!m.streaming} heartbeat={m.heartbeat} locale={locale} /> : null}
                  {answer ? <StructuredAnswer answer={answer} /> : m.streaming && !m.text ? (
                    <span className="typing"><i /><i /><i /></span>
                  ) : (
                    <>{renderAiText(m.role === 'user' ? (m.displayText || m.text) : m.text, !!m.streaming, { suppressThinkBlocks: Boolean(m.reasoning) })}{m.streaming && <span className="stream-cursor">▍</span>}</>
                  )}
                </div>
              )}
            </div>
          </div>
          )
        })}
      </div>

      <div className="quick-grid">
        <div className="quick-block">
          <div className="quick-label">{quick.label}</div>
          <div className="quick-row" data-quick-topic={quick.topic}>{quick.questions.map(q => <button key={q} className="quick-chip quick-ask" onClick={() => send(q)} disabled={typing}>{q}</button>)}</div>
        </div>
      </div>

      <div className="chat-input-bar">
        <textarea className="chat-input" rows={1} placeholder={agentCopy(locale, 'askAnything', '问三门先生任何问题…')} value={input}
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px' }}
          onKeyDown={handleKey} style={{ maxHeight: 110 }} />
        <div className="input-status-wrap">
          <button type="button" className={`input-model-control ${currentRouteIsDeep ? 'is-deep' : 'is-quick'}`} onClick={() => setPickerOpen(v => !v)} title={`${agentCopy(locale, 'switchModel', '切换模型')} · ${currentRouteMeta?.label || currentRoute}`} aria-label={agentCopy(locale, 'switchModel', '切换模型')}>
            <span className="input-status-dot on" />
            <span className="input-model-label">{routeModeCopy(currentRoute, locale)}</span>
          </button>
          {pickerOpen && (
            <div className="model-picker" onClick={e => e.stopPropagation()}>
              <div className="model-picker-title">{agentCopy(locale, 'modelTitle', '切换模型（新会话生效）')}</div>
              {models.routes.map(r => (
                <button key={r.key} type="button" className={`model-picker-item ${r.key === currentRoute ? 'active' : ''}`} onClick={() => pickRoute(r.key)}>
                  <span className={`model-picker-dot ${r.key === currentRoute ? 'on' : ''}`} />
                  <span className="model-picker-name">{r.label}</span>
                  <span className="model-picker-model">{r.hint || r.model}</span>
                </button>
              ))}
              <div className="model-picker-foot">{agentCopy(locale, 'modelDeepNote', '深度模式会进行更完整的推演，耗时会更长。')}</div>
            </div>
          )}
        </div>
        {/* 生成中把发送键换成停止键：此前一旦模型开始长篇输出就只能干等，没有任何出口 */}
        {typing ? (
          <button className="send-btn" onClick={stopGenerating} title={agentCopy(locale, 'stop', '停止生成')} aria-label={agentCopy(locale, 'stop', '停止生成')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          </button>
        ) : (
          <button className="send-btn" onClick={() => send()} disabled={!input.trim()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" /></svg>
          </button>
        )}
      </div>

    </div>
  )
}
