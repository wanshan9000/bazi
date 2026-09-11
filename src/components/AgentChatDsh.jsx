// 元氣 AI · dsh 基座版：只做渲染与流式接管，编排/工具/记忆全在服务端 dsh
import { useEffect, useRef, useState } from 'react'
import { createAgentApi } from '../api/agent.js'
import { reportApi } from '../api/reports.js'
import { buildChart } from '../engine/bazi.js'
import { listCollection, saveToCollection, removeFromCollection } from '../engine/chartCollection.js'
import { refreshSession } from '../data/users.js'
import { AGENT_CONSULTATION, canAfford, nextPlanKey } from '../engine/membership.js'
import { renderMarkdown } from '../utils/markdown.jsx'
import { ThinkBlock, ToolCallsBlock, CopyButton, renderAiText, timeNow, fmtSessionTime, QUICK, isNearScrollBottom } from './agent/ChatParts.jsx'

const api = createAgentApi()
const ROUTE_KEY = 'genki-agent-route'
const ROUTE_PREF_PREFIX = 'v2:'
const OPENING = ['我是「三门先生」，一位玄学大师。八字、紫微、六爻、奇门、黄历、塔罗、取名、风水，心有所问，尽管开口。', '把出生年月日时和性别告诉我，我先为你排盘；也可以直接问今年运势、事业、姻缘。']
const SHI_CHEN = ['子', '丑', '丑', '寅', '寅', '卯', '卯', '辰', '辰', '巳', '巳', '午', '午', '未', '未', '申', '申', '酉', '酉', '戌', '戌', '亥', '亥', '子']

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

// 思考条展示的是用户可理解的执行阶段，而不是模型原始推理。这样既能让等待过程有
// 反馈，也不会泄漏 Skill、系统提示、工具参数或模型自言自语。
export function safeThinkStep(type, toolName = '') {
  if (type === 'start') return '正在理解你的问题…'
  if (type === 'reasoning') return '正在梳理问题要点…'
  const key = String(toolName || '')
  const calls = {
    bazi: '正在排出四柱与大运…',
    ziwei: '正在排布紫微命盘…',
    qimen: '正在起局核对格局…',
    liuyao: '正在起卦并核对动爻…',
    huangli: '正在核对日期与宜忌…',
    tarot: '正在整理牌阵信息…',
    fengshui: '正在分析空间信息…',
    name: '正在核对姓名结构…',
    wuyunliuqi: '正在整理养生要点…',
  }
  const results = {
    bazi: '四柱与大运已核对，正在组织解读…',
    ziwei: '紫微命盘已核对，正在组织解读…',
    qimen: '格局已核对，正在组织解读…',
    liuyao: '卦象已核对，正在组织解读…',
    huangli: '日期宜忌已核对，正在组织建议…',
    tarot: '牌阵已整理，正在组织解读…',
    fengshui: '空间信息已核对，正在组织建议…',
    name: '姓名结构已核对，正在组织建议…',
    wuyunliuqi: '养生要点已整理，正在组织建议…',
  }
  if (type === 'tool_result') return results[key] || '所需信息已核对，正在组织答复…'
  return calls[key] || '正在查询所需信息…'
}

export function appendSafeThinkStep(message, step) {
  const next = String(step || '').trim()
  const current = String(message?.reasoning || '').trim()
  if (!next || current.split('\n').map(item => item.trim()).includes(next)) return message
  return { ...message, reasoning: current ? `${current}\n${next}` : next }
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
function chartLabel(c) {
  const shiChen = Number.isInteger(c.hour) ? ` · ${SHI_CHEN[c.hour]}时` : ''
  return `${c.gender === '女' ? '坤造' : '乾造'} · ${c.year}年${c.month}月${c.day}日${shiChen}`
}
function sessionTitle(s) {
  if (!s.chartKey) return s.title || '未命名会话'
  const [year, month, day, hour, gender] = s.chartKey.split('-')
  const h = hour === 'x' ? null : Number(hour)
  if (!Number.isInteger(+year) || !Number.isInteger(+month) || !Number.isInteger(+day) || (h !== null && !Number.isInteger(h))) {
    return s.title || '未命名会话'
  }
  return chartLabel({ year: +year, month: +month, day: +day, hour: h, gender })
}
function consultationLabel(consultation, user) {
  if (!consultation) return user
    ? '开启一个咨询主题：5 点 · 含 8 次具体问题解读 · 72 小时有效'
    : `客者免费体验 ${AGENT_CONSULTATION.guestRounds} 次具体问题解读 · 注册后可认领当前主题`
  const expiry = consultation.expiresAt ? new Date(consultation.expiresAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  return `${consultation.kind === 'guest' ? '免费体验' : '当前主题'} · 具体问题解读 ${consultation.remainingRounds}/${consultation.totalRounds} 次可用${expiry ? ` · ${expiry} 前有效` : ''}`
}

function canRestoreSession(session) {
  // 即使一轮主题已到期或用尽，也应恢复这段完整咨询：用户可以在原会话中续问，
  // 不能因为额度状态变化就把昨天的记忆藏起来、逼用户另开一个空白会话。
  return Boolean(session?.id)
}

export default function AgentChatDsh({ chart: chartProp, seedQuery, user, reportId, initialSessionId, onRequireLogin, onUpgrade, onUserChange }) {
  const [messages, setMessages] = useState(() => OPENING.map((text, i) => ({ id: `boot-${i}`, role: 'ai', text, time: timeNow(), _counted: true })))
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [activeChart, setActiveChart] = useState(() => chartProp || null)
  const [sessionId, setSessionId] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [consultation, setConsultation] = useState(null)
  const [renewal, setRenewal] = useState(null)
  const [sessions, setSessions] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [collection, setCollection] = useState(() => listCollection())
  const [showCollection, setShowCollection] = useState(false)
  const [models, setModels] = useState({ routes: [], default: null })
  const [route, setRoute] = useState(readAgentRoutePreference)
  const [pickerOpen, setPickerOpen] = useState(false)
  const scrollRef = useRef(null)
  const followScrollRef = useRef(true)
  const abortRef = useRef(null)
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
  useEffect(() => {
    if (!pickerOpen) return
    const close = () => setPickerOpen(false)
    const t = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', close) }
  }, [pickerOpen])

  // 计费和主题轮数都由服务端确认。客户端只同步服务端返还的余额和主题状态。
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'ai' || last.streaming || last._counted || !last.text) return
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
  const handleChatScroll = event => { followScrollRef.current = isNearScrollBottom(event.currentTarget) }

  const send = async (text, { renew = false } = {}) => {
    const q = (text || input).trim()
    if (!q || typing) return
    if (!consultation && user && !canAfford(user, 'agent.topic')) { onUpgrade && onUpgrade(nextPlanKey(user.plan)); return }
    followScrollRef.current = true
    setRenewal(null)
    setInput('')
    setTyping(true)
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q, time: timeNow() }, { id: `a-${Date.now()}`, role: 'ai', text: '', reasoning: safeThinkStep('start'), tools: [], streaming: true, time: timeNow() }])
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await api.streamChat({
        sessionId, text: q, chart: chartMeta(activeChart), route: route || models.default || undefined, renew, signal: ac.signal,
        onEvent: e => {
          switch (e.type) {
            case 'session':
              if (!sessionId) setSessionId(e.sessionId)
              setActiveSession(prev => prev?.id === e.sessionId ? prev : { id: e.sessionId, title: q.slice(0, 14) })
              if (e.consultation) setConsultation(e.consultation)
              if (reportId && e.sessionId && !linkedReportSessions.current.has(e.sessionId)) {
                linkedReportSessions.current.add(e.sessionId)
                // 关联失败不影响本轮回答；下次收到 session 事件时允许重试。
                reportApi.linkSession(reportId, e.sessionId).then(result => {
                  if (!result.ok) linkedReportSessions.current.delete(e.sessionId)
                }).catch(() => linkedReportSessions.current.delete(e.sessionId))
              }
              break
            case 'consultation': setConsultation(e.consultation || null); break
            case 'text': patchLast(m => ({ ...m, text: m.text + e.delta })); break
            case 'reasoning': patchLast(m => appendSafeThinkStep(m, safeThinkStep('reasoning'))); break
            case 'tool_call': patchLast(m => ({ ...appendSafeThinkStep(m, safeThinkStep('tool_call', e.name)), tools: [...m.tools, e.name] })); break
            case 'tool_result':
              patchLast(m => appendSafeThinkStep(m, safeThinkStep('tool_result', e.name)))
              if (e.kind === 'report') {
                // 报告卡片插在流式气泡之前
                setMessages(prev => { const last = prev[prev.length - 1]; return [...prev.slice(0, -1), { id: `r-${Date.now()}`, role: 'ai', kind: 'report', report: { title: (e.text.match(/^# (.+)$/m) || [])[1] || '测算报告', markdown: e.text }, time: timeNow(), _counted: true }, last] })
              }
              break
            // 追加而不是二选一：模型已经吐了半截又报错时，丢掉已渲染的文字
            // 会让用户看着内容凭空消失；把错误接在后面，两样都留住。
            case 'error': patchLast(m => ({ ...m, text: (m.text ? m.text + '\n\n' : '') + `⚠️ ${e.message}`, streaming: false, _failed: true })); break
            case 'done': patchLast(m => ({ ...m, streaming: false })); break
            default: break
          }
        },
      })
    } catch (err) {
      // 服务端说积分不足（402）。本地的 canAfford 是拿镜像算的，可能偏旧或被改过，
      // 服务端才是权威 —— 这里把那一条空气泡撤掉并引导升级，而不是给用户看一句报错。
      if (err && err.reason === 'guest_limit') {
        setMessages(prev => prev.slice(0, -2))
        setInput(q)
        onRequireLogin && onRequireLogin('agent')
        return
      }
      if (err && (err.reason === 'topic_exhausted' || err.reason === 'topic_expired')) {
        setMessages(prev => prev.slice(0, -2))
        setInput(q)
        // 主题轮数结束不等于对话记忆结束。保留同一个 sessionId，让用户明确确认
        // 后以新的八轮主题继续问；服务端会继续把同一 DSH 会话作为上下文。
        setRenewal({ text: q, reason: err.reason })
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
        patchLast(m => ({ ...m, text: '⚠️ 登录已失效，请重新登录后继续', streaming: false, _failed: true }))
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
          ? (m.text ? m.text + '\n\n⏹ 已停止生成' : '⏹ 已停止生成')
          : (m.text ? m.text + '\n\n' : '') + `⚠️ ${err.message || '网络异常，回复未完成'}`,
        streaming: false,
        _failed: true,
      }))
    } finally {
      patchLast(m => ({ ...m, streaming: false }))
      setTyping(false)
      abortRef.current = null
    }
  }

  const stopGenerating = () => {
    if (abortRef.current) abortRef.current.abort()
  }

  const newChat = () => {
    if (abortRef.current) abortRef.current.abort()
    setSessionId(null)
    setActiveSession(null)
    setConsultation(null)
    setRenewal(null)
    setActiveChart(null)
    setShowHistory(false)
    setInput('')
    setMessages(OPENING.map((text, i) => ({ id: `boot-${Date.now()}-${i}`, role: 'ai', text, time: timeNow(), _counted: true })))
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
      setHistoryErr('会话列表加载失败，请检查网络后重试')
    }
  }

  const restore = async (s) => {
    setHistoryErr('')
    try {
      const r = await api.loadMessages(s.id)
      const restored = r.session || s
      setMessages((r.messages || []).map((m, i) => m.kind === 'report'
        ? { id: `h-${i}`, role: 'ai', kind: 'report', report: { title: (m.text.match(/^# (.+)$/m) || [])[1] || '测算报告', markdown: m.text }, time: m.time, _counted: true }
        : { id: `h-${i}`, role: m.role, text: m.text, time: m.time, _counted: true }))
      setSessionId(restored.id)
      setActiveSession({ id: restored.id, title: sessionTitle(restored) })
      setConsultation(restored.consultation || null)
      setRenewal(null)
      setActiveChart(null)
      if (restored.chartKey) { const [y, mo, d, h, g] = restored.chartKey.split('-'); try { setActiveChart(buildChart(+y, +mo, +d, +h, g)) } catch { /* 命盘键格式异常：不影响正文恢复 */ } }
      setShowHistory(false)
    } catch (e) {
      // 会话在服务端已不存在（被淘汰/删除）→ 从列表里摘掉，不要让用户反复点一个死条目
      setSessions(prev => prev.filter(x => x.id !== s.id))
      setHistoryErr('该会话已不存在或加载失败')
    }
  }

  // 从「我的报告」打开一段关联咨询时，直接恢复原会话，而不是只跳到空白聊天页。
  useEffect(() => {
    if (initialSessionId) restore({ id: initialSessionId })
    // restore 是当前组件内的稳定业务动作；只在目标会话变化时恢复一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId])

  // 重新进入 Agent 时默认接回最新仍可继续的主题。此前 sessionId 只存在组件内存：
  // 页面一卸载就丢，用户没有主动打开“会话历史”便直接续问时，会被悄悄创建成新会话。
  // 主动点“新会话”仍是唯一明确开始新话题的入口；带 initialSessionId 的报告咨询则优先
  // 恢复指定会话，绝不被自动恢复覆盖。
  useEffect(() => {
    if (initialSessionId || autoResumeAttempted.current) return
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
  }, [initialSessionId])

  const continueTopic = () => {
    const q = (renewal?.text || input).trim()
    if (!q || typing) return
    send(q, { renew: true })
  }

  const del = async (id) => {
    setHistoryErr('')
    try {
      await api.deleteSession(id)
      const remaining = sessions.filter(s => s.id !== id)
      setSessions(remaining)
      // 删掉最后一条历史时，不能继续显示已不属于任何会话的旧消息。
      if (remaining.length === 0 || sessionId === id) newChat()
    } catch (e) {
      setHistoryErr('删除失败，请稍后重试')
    }
  }

  const refreshCollection = () => setCollection(listCollection())
  const saveCurrentChart = () => {
    if (!activeChart) { window.alert('当前还没有命盘，请先提供出生信息排盘后再收藏。'); return }
    const label = window.prompt('为这个命盘起个名字（如：我自己、妈妈、孩子）：', chartLabel(activeChart))
    if (label === null) return
    saveToCollection(activeChart, label.trim())
    refreshCollection()
  }
  const switchToCollected = (it) => {
    try { setActiveChart(buildChart(it.year, it.month, it.day, it.hour, it.gender)); setSessionId(null); setActiveSession(null); setShowCollection(false) } catch { /* 忽略 */ }
  }
  // 换模型 = 换一个服务端会话。此前只把 sessionId 置空却保留了聊天记录：
  // 界面上还挂着上文，服务端却是一张白纸，模型完全不知道前面聊过什么，
  // 用户以为它「突然失忆」。直接开一段新对话，语义才是一致的。
  const pickRoute = (key) => {
    setRoute(key)
    try { localStorage.setItem(ROUTE_KEY, serializeAgentRoute(key)) } catch { /* 忽略 */ }
    setPickerOpen(false)
    if (key !== route) newChat()
  }
  // ⚠ 必须避开输入法组合态：中文拼音输入时按回车是「确认候选词」，
  // 不判 isComposing / keyCode 229 的话，那一下会把还没选完的半截文本直接发出去。
  const handleKey = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return
    e.preventDefault()
    send()
  }
  return (
    <div className="agent-page-inner">
      <div className="agent-head">
        <div className="agent-avatar">三</div>
        <div className="agent-head-main">
          <div className="agent-head-top">
            {activeChart ? <div className="current-chart-chip"><span className="current-chart-txt">{chartLabel(activeChart)}</span></div>
              : activeSession ? <div className="current-session-chip" title={activeSession.title}><span className="current-session-label">会话</span><span className="current-session-title">{activeSession.title}</span></div>
                : <div className="name"><span className="agent-name-full">三门先生</span><span className="agent-name-short">三门</span></div>}
          </div>
          <div className={`agent-topic-status ${consultation?.kind || 'new'}`}>{consultationLabel(consultation, user)}</div>
        </div>
        <div className="agent-head-actions">
          <button className="agent-btn" onClick={newChat} title="新会话" aria-label="新会话">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button className="agent-btn" onClick={openHistory} title="会话历史" aria-label="会话历史">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 3" /></svg>
          </button>
        </div>

        {showHistory && (
          <div className="session-drawer">
            <div className="session-drawer-head">
              <div className="session-drawer-titles"><span className="session-drawer-title">会话历史</span><span className="session-drawer-sub">共 {sessions.length} 次 · 点击恢复</span></div>
              <div className="session-drawer-ops"><button className="session-close-btn" onClick={() => setShowHistory(false)}>关闭</button></div>
            </div>
            {historyErr && (
              <div className="session-empty" style={{ color: 'var(--danger, #c0392b)' }}>{historyErr}</div>
            )}
            <div className="session-list">
              {sessions.length === 0 ? <div className="session-empty">暂无历史会话，聊两句就会自动记录。</div> : sessions.map(s => (
                <div key={s.id} className={`session-item ${s.id === sessionId ? 'active' : ''}`} onClick={() => restore(s)}>
                  <div className="session-item-body">
                    <div className="session-item-title">{sessionTitle(s)}</div>
                    <div className="session-item-meta"><span>{s.messageCount} 条消息</span><span>{fmtSessionTime(s.updatedAt)}</span></div>
                  </div>
                  <button className="session-del" onClick={e => { e.stopPropagation(); del(s.id) }} title="删除" aria-label="删除会话">
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
              <div className="session-drawer-titles"><span className="session-drawer-title">我的命盘</span><span className="session-drawer-sub">共 {collection.length} 个 · 点击切换</span></div>
              <div className="session-drawer-ops"><button className="session-clear-btn" onClick={saveCurrentChart}>＋ 收藏当前</button><button className="session-close-btn" onClick={() => setShowCollection(false)}>关闭</button></div>
            </div>
            <div className="session-list">
              {collection.length === 0 ? <div className="session-empty">还没有收藏的命盘。先排一个盘，点「＋收藏当前」保存。</div> : collection.map(it => (
                <div key={it.id} className="session-item" onClick={() => switchToCollected(it)}>
                  <div className="session-item-body">
                    <div className="session-item-title">⭐ {it.label}</div>
                    <div className="session-item-meta"><span className="session-pillar">{chartLabel(it)}</span><span>{fmtSessionTime(it.savedAt)} 收藏</span></div>
                  </div>
                  <button className="session-del" onClick={e => { e.stopPropagation(); removeFromCollection(it.id); refreshCollection() }} title="取消收藏" aria-label="取消收藏">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chat-scroll" ref={scrollRef} onScroll={handleChatScroll}>
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="avatar">{m.role === 'ai' ? '三' : m.role === 'tool' ? '🔧' : '我'}</div>
            <div style={{ maxWidth: '100%' }}>
              {m.kind === 'report' ? (
                <>
                  <div className="bubble bubble-report-md">
                    <div className="report-md-title">{m.report.title}</div>
                    <div className="report-md-body">{renderMarkdown(m.report.markdown)}</div>
                  </div>
                  <div className="msg-actions"><CopyButton text={m.report.markdown} title="复制报告全文" /></div>
                </>
              ) : m.role === 'tool' ? (
                <ToolCallsBlock names={m.text} />
              ) : (
                <div className={`bubble ${m.streaming ? 'bubble-streaming' : ''}`}>
                  {m.reasoning ? <ThinkBlock content={m.reasoning} streaming={!!m.streaming} collapseWhenStreamingText={Boolean(m.text)} /> : null}
                  {m.tools && m.tools.length > 0 ? <ToolCallsBlock names={m.tools.join('、')} /> : null}
                  {m.streaming && !m.text ? (
                    <span className="typing"><i /><i /><i /></span>
                  ) : (
                    <>{renderAiText(m.text, !!m.streaming)}{m.streaming && <span className="stream-cursor">▍</span>}</>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="quick-grid">
        <div className="quick-block">
          <div className="quick-label">快捷问答</div>
          <div className="quick-row">{QUICK.map(q => <button key={q} className="quick-chip quick-ask" onClick={() => send(q)}>{q}</button>)}</div>
        </div>
      </div>

      {renewal && (
        <div className="agent-renewal" role="status">
          <div className="agent-renewal-copy">
            <strong>{renewal.reason === 'topic_expired' ? '这段咨询已到期' : '这段咨询已完成 8 次具体问题解读'}</strong>
            <span>续问仍沿用这段对话与命盘上下文。</span>
          </div>
          <button type="button" onClick={continueTopic}>继续本话题 · 5 点</button>
        </div>
      )}

      <div className="chat-input-bar">
        <textarea className="chat-input" rows={1} placeholder="问三门先生任何问题…" value={input}
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px' }}
          onKeyDown={handleKey} style={{ maxHeight: 110 }} />
        <div className="input-status-wrap">
          <button type="button" className="input-status-dot on" onClick={() => setPickerOpen(v => !v)} title="切换模型" aria-label="切换模型" />
          {pickerOpen && (
            <div className="model-picker" onClick={e => e.stopPropagation()}>
              <div className="model-picker-title">切换模型（新会话生效）</div>
              {models.routes.map(r => (
                <button key={r.key} type="button" className={`model-picker-item ${r.key === (route || models.default) ? 'active' : ''}`} onClick={() => pickRoute(r.key)}>
                  <span className={`model-picker-dot ${r.key === (route || models.default) ? 'on' : ''}`} />
                  <span className="model-picker-name">{r.label}</span>
                  <span className="model-picker-model">{r.hint || r.model}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* 生成中把发送键换成停止键：此前一旦模型开始长篇输出就只能干等，没有任何出口 */}
        {typing ? (
          <button className="send-btn" onClick={stopGenerating} title="停止生成" aria-label="停止生成">
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
