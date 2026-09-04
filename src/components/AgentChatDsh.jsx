// 元气 AI · dsh 基座版：只做渲染与流式接管，编排/工具/记忆全在服务端 dsh
import { useEffect, useRef, useState } from 'react'
import { createAgentApi } from '../api/agent.js'
import { currentUid } from '../engine/userScope.js'
import { buildChart } from '../engine/bazi.js'
import { listCollection, saveToCollection, removeFromCollection } from '../engine/chartCollection.js'
import { consumeCredit } from '../data/users.js'
import { loadQuota, addAgentTokens, tokensToCredits, isAgentOverQuota } from '../engine/freeQuota.js'
import { renderMarkdown } from '../utils/markdown.jsx'
import { ThinkBlock, ToolCallsBlock, CopyButton, renderAiText, timeNow, fmtSessionTime, QUICK } from './agent/ChatParts.jsx'

const api = createAgentApi(currentUid)
const ROUTE_KEY = 'genki-agent-route'
const OPENING = ['我是「司命」。八字、紫微、六爻、奇门、黄历、塔罗、取名、风水，心有所问，尽管开口。', '把出生年月日时和性别告诉我，我先为你排盘；也可以直接问今年运势、事业、姻缘。']

function chartMeta(c) { return c ? { year: c.year, month: c.month, day: c.day, hour: c.hour ?? 12, gender: c.gender } : null }
function chartLabel(c) { return `${c.gender === '女' ? '坤造' : '乾造'} · ${c.year}年${c.month}月${c.day}日${c.hour ? ` ${c.hour}时` : ''}` }

export default function AgentChatDsh({ chart: chartProp, seedQuery, user, onRequireLogin, onUpgrade }) {
  const [messages, setMessages] = useState(() => OPENING.map((text, i) => ({ id: `boot-${i}`, role: 'ai', text, time: timeNow(), _counted: true })))
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [activeChart, setActiveChart] = useState(() => chartProp || null)
  const [sessionId, setSessionId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [collection, setCollection] = useState(() => listCollection())
  const [showCollection, setShowCollection] = useState(false)
  const [models, setModels] = useState({ routes: [], default: null })
  const [route, setRoute] = useState(() => { try { return localStorage.getItem(ROUTE_KEY) || null } catch { return null } })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [agentTokens, setAgentTokens] = useState(0)
  const [quotaDismissed, setQuotaDismissed] = useState(false)
  const scrollRef = useRef(null)
  const abortRef = useRef(null)
  const booted = useRef(false)

  useEffect(() => { setAgentTokens(loadQuota().agentTokens || 0) }, [])
  useEffect(() => { api.listModels().then(m => setModels({ routes: m.routes || [], default: m.default })).catch(() => {}) }, [])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages, typing])
  useEffect(() => {
    if (!pickerOpen) return
    const close = () => setPickerOpen(false)
    const t = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', close) }
  }, [pickerOpen])

  // 计费：每条完成的 AI 回复扣 1 积分（登录）或累加 token 估算（游客），与旧组件口径一致
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'ai' || last.streaming || last._counted || !last.text) return
    if (user) {
      const res = consumeCredit(user.id, 'agent.chat')
      if (!res.ok && res.reason === 'insufficient' && onUpgrade) onUpgrade()
    } else {
      const n = addAgentTokens(Math.ceil(last.text.length / 3))
      setAgentTokens(n)
      if (isAgentOverQuota(n)) setQuotaDismissed(false)
    }
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

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || typing) return
    setInput('')
    setTyping(true)
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q, time: timeNow() }, { id: `a-${Date.now()}`, role: 'ai', text: '', reasoning: '', tools: [], streaming: true, time: timeNow() }])
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await api.streamChat({
        sessionId, text: q, chart: chartMeta(activeChart), route: route || models.default || undefined, signal: ac.signal,
        onEvent: e => {
          switch (e.type) {
            case 'session': if (!sessionId) setSessionId(e.sessionId); break
            case 'text': patchLast(m => ({ ...m, text: m.text + e.delta })); break
            case 'reasoning': patchLast(m => ({ ...m, reasoning: (m.reasoning || '') + e.delta })); break
            case 'tool_call': patchLast(m => ({ ...m, tools: [...m.tools, e.name] })); break
            case 'tool_result':
              if (e.kind === 'report') {
                // 报告卡片插在流式气泡之前
                setMessages(prev => { const last = prev[prev.length - 1]; return [...prev.slice(0, -1), { id: `r-${Date.now()}`, role: 'ai', kind: 'report', report: { title: (e.text.match(/^# (.+)$/m) || [])[1] || '测算报告', markdown: e.text }, time: timeNow(), _counted: true }, last] })
              }
              break
            case 'error': patchLast(m => ({ ...m, text: m.text || `⚠️ ${e.message}`, streaming: false })); break
            case 'done': patchLast(m => ({ ...m, streaming: false })); break
            default: break
          }
        },
      })
    } catch (err) {
      patchLast(m => ({ ...m, text: m.text || `⚠️ ${err.message || '网络异常'}`, streaming: false }))
    } finally {
      patchLast(m => ({ ...m, streaming: false }))
      setTyping(false)
      abortRef.current = null
    }
  }

  const newChat = () => {
    if (abortRef.current) abortRef.current.abort()
    setSessionId(null)
    setActiveChart(null)
    setShowHistory(false)
    setInput('')
    setMessages(OPENING.map((text, i) => ({ id: `boot-${Date.now()}-${i}`, role: 'ai', text, time: timeNow(), _counted: true })))
  }

  const openHistory = async () => {
    try { const r = await api.listSessions(); setSessions(r.sessions || []) } catch { setSessions([]) }
    setShowHistory(true)
  }

  const restore = async (s) => {
    try {
      const r = await api.loadMessages(s.id)
      setMessages((r.messages || []).map((m, i) => m.kind === 'report'
        ? { id: `h-${i}`, role: 'ai', kind: 'report', report: { title: (m.text.match(/^# (.+)$/m) || [])[1] || '测算报告', markdown: m.text }, time: m.time, _counted: true }
        : { id: `h-${i}`, role: m.role, text: m.text, time: m.time, _counted: true }))
      setSessionId(s.id)
      if (s.chartKey) { const [y, mo, d, h, g] = s.chartKey.split('-'); try { setActiveChart(buildChart(+y, +mo, +d, +h, g)) } catch { /* 忽略 */ } }
    } catch { /* 忽略 */ }
    setShowHistory(false)
  }

  const del = async (id) => {
    try { await api.deleteSession(id) } catch { /* 忽略 */ }
    setSessions(prev => prev.filter(s => s.id !== id))
    if (sessionId === id) newChat()
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
    try { setActiveChart(buildChart(it.year, it.month, it.day, it.hour, it.gender)); setSessionId(null); setShowCollection(false) } catch { /* 忽略 */ }
  }
  const pickRoute = (key) => { setRoute(key); try { localStorage.setItem(ROUTE_KEY, key) } catch { /* 忽略 */ } setPickerOpen(false); setSessionId(null) }
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const routeLabel = (models.routes.find(r => r.key === (route || models.default)) || {}).label || '司命'

  return (
    <div className="agent-page-inner">
      <div className="agent-head">
        <div className="agent-avatar">司</div>
        <div className="agent-head-main">
          <div className="agent-head-top">
            {activeChart ? <div className="current-chart-chip"><span className="current-chart-txt">{chartLabel(activeChart)}</span></div> : <div className="name">司命 Agent</div>}
          </div>
        </div>
        <div className="agent-head-actions">
          <button className="agent-btn" onClick={newChat} title="新会话" aria-label="新会话">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button className="agent-btn" onClick={openHistory} title="会话历史" aria-label="会话历史">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 3" /></svg>
          </button>
          <button className="agent-btn" onClick={() => { refreshCollection(); setShowCollection(true) }} title="我的命盘" aria-label="我的命盘">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 7 1-5.1 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9L2 9.3l7-1L12 2z" /></svg>
            {collection.length > 0 && <span className="agent-btn-badge">{collection.length}</span>}
          </button>
        </div>

        {showHistory && (
          <div className="session-drawer">
            <div className="session-drawer-head">
              <div className="session-drawer-titles"><span className="session-drawer-title">会话历史</span><span className="session-drawer-sub">共 {sessions.length} 次 · 点击恢复</span></div>
              <div className="session-drawer-ops"><button className="session-close-btn" onClick={() => setShowHistory(false)}>关闭</button></div>
            </div>
            <div className="session-list">
              {sessions.length === 0 ? <div className="session-empty">暂无历史会话，聊两句就会自动记录。</div> : sessions.map(s => (
                <div key={s.id} className={`session-item ${s.id === sessionId ? 'active' : ''}`} onClick={() => restore(s)}>
                  <div className="session-item-body">
                    <div className="session-item-title">{s.title}</div>
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

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="avatar">{m.role === 'ai' ? '司' : m.role === 'tool' ? '🔧' : '我'}</div>
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
                  {m.reasoning ? <ThinkBlock content={m.reasoning} streaming={!!m.streaming && !m.text} /> : null}
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

      <div className="chat-input-bar">
        <textarea className="chat-input" rows={1} placeholder={`问司命任何问题…（${routeLabel}）`} value={input}
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
                  <span className="model-picker-model">{r.model}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="send-btn" onClick={() => send()} disabled={typing || !input.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" /></svg>
        </button>
      </div>

      {!user && isAgentOverQuota(agentTokens) && !quotaDismissed && (
        <div className="quota-modal-mask" onClick={() => setQuotaDismissed(true)}>
          <div className="quota-modal" onClick={e => e.stopPropagation()}>
            <div className="qm-icon">💎</div>
            <h3>积分已用完 · 订阅会员继续对话</h3>
            <p>游客已累计消耗 <b>{tokensToCredits(agentTokens).toFixed(1)}</b> / 100 积分。注册/登录成为会员，即可继续对话。</p>
            <div className="qm-actions">
              <button className="qm-btn primary" onClick={() => onRequireLogin && onRequireLogin('agent')}>立即订阅会员</button>
              <button className="qm-btn ghost" onClick={() => setQuotaDismissed(true)}>我知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
