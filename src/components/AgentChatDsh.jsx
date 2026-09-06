// 元气 AI · dsh 基座版：只做渲染与流式接管，编排/工具/记忆全在服务端 dsh
import { useEffect, useRef, useState } from 'react'
import { createAgentApi } from '../api/agent.js'
import { buildChart } from '../engine/bazi.js'
import { listCollection, saveToCollection, removeFromCollection } from '../engine/chartCollection.js'
import { refreshSession } from '../data/users.js'
import { canAfford } from '../engine/membership.js'
import { loadQuota, addAgentTokens, tokensToCredits, isAgentOverQuota } from '../engine/freeQuota.js'
import { renderMarkdown } from '../utils/markdown.jsx'
import { ThinkBlock, ToolCallsBlock, CopyButton, renderAiText, timeNow, fmtSessionTime, QUICK } from './agent/ChatParts.jsx'

const api = createAgentApi()
const ROUTE_KEY = 'genki-agent-route'
const OPENING = ['我是「司命」。八字、紫微、六爻、奇门、黄历、塔罗、取名、风水，心有所问，尽管开口。', '把出生年月日时和性别告诉我，我先为你排盘；也可以直接问今年运势、事业、姻缘。']

// hour 缺失表示「时辰未知」，不能悄悄补成 12 点：服务端会把它当成确定的午时写进
// 命盘行，模型据此排出的时柱是编的，用户却看不出来。原样传 null，由服务端与人设
// 决定怎么向用户说明。
function chartMeta(c) { return c ? { year: c.year, month: c.month, day: c.day, hour: c.hour ?? null, gender: c.gender } : null }
function chartLabel(c) { return `${c.gender === '女' ? '坤造' : '乾造'} · ${c.year}年${c.month}月${c.day}日${c.hour ? ` ${c.hour}时` : ''}` }

export default function AgentChatDsh({ chart: chartProp, seedQuery, user, onRequireLogin, onUpgrade, onUserChange }) {
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

  // 计费：登录用户的每轮扣分**已经在服务端 /api/agent/chat 里完成**
  // （客户端扣分意味着改 localStorage 就能白嫖，且没产出时无法自动退还）。
  // 这里只负责把服务端的最新余额同步到界面。游客仍按 token 估算走本地免费配额。
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'ai' || last.streaming || last._counted || !last.text) return
    if (last._failed) {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, _counted: true } : m))
      return
    }
    if (user) {
      refreshSession().then(u => { if (u) onUserChange && onUserChange(u) })
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
    // 额度必须在发请求之前拦。此前是「先聊完再扣、扣不动只弹个可关闭的窗」，
    // 游客关掉弹窗就能接着无限聊，登录用户余额为 0 也照样能把请求打到付费模型上。
    if (user) {
      if (!canAfford(user, 'agent.chat')) { onUpgrade && onUpgrade(user.plan === 'earth' ? 'heaven' : 'oracle'); return }
    } else if (isAgentOverQuota(agentTokens)) {
      setQuotaDismissed(false)
      return
    }
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
      if (err && (err.reason === 'insufficient' || err.status === 402)) {
        // 这一轮根本没发生：把刚插进去的「提问 + 空回复」两条一起撤掉，
        // 并把问题放回输入框，用户升级完可以直接再发一次，不用重打。
        setMessages(prev => prev.slice(0, -2))
        setInput(q)
        refreshSession().then(u => { if (u) onUserChange && onUserChange(u) })
        onUpgrade && onUpgrade(user && user.plan === 'earth' ? 'heaven' : 'oracle')
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
      setMessages((r.messages || []).map((m, i) => m.kind === 'report'
        ? { id: `h-${i}`, role: 'ai', kind: 'report', report: { title: (m.text.match(/^# (.+)$/m) || [])[1] || '测算报告', markdown: m.text }, time: m.time, _counted: true }
        : { id: `h-${i}`, role: m.role, text: m.text, time: m.time, _counted: true }))
      setSessionId(s.id)
      if (s.chartKey) { const [y, mo, d, h, g] = s.chartKey.split('-'); try { setActiveChart(buildChart(+y, +mo, +d, +h, g)) } catch { /* 命盘键格式异常：不影响正文恢复 */ } }
      setShowHistory(false)
    } catch (e) {
      // 会话在服务端已不存在（被淘汰/删除）→ 从列表里摘掉，不要让用户反复点一个死条目
      setSessions(prev => prev.filter(x => x.id !== s.id))
      setHistoryErr('该会话已不存在或加载失败')
    }
  }

  const del = async (id) => {
    setHistoryErr('')
    try {
      await api.deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (sessionId === id) newChat()
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
    try { setActiveChart(buildChart(it.year, it.month, it.day, it.hour, it.gender)); setSessionId(null); setShowCollection(false) } catch { /* 忽略 */ }
  }
  // 换模型 = 换一个服务端会话。此前只把 sessionId 置空却保留了聊天记录：
  // 界面上还挂着上文，服务端却是一张白纸，模型完全不知道前面聊过什么，
  // 用户以为它「突然失忆」。直接开一段新对话，语义才是一致的。
  const pickRoute = (key) => {
    setRoute(key)
    try { localStorage.setItem(ROUTE_KEY, key) } catch { /* 忽略 */ }
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
            {historyErr && (
              <div className="session-empty" style={{ color: 'var(--danger, #c0392b)' }}>{historyErr}</div>
            )}
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
