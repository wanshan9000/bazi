import { useEffect, useRef, useState } from 'react'
import { generateReply, openingLine, openingNoChart } from '../engine/chat.js'

const QUICK = [
  '今年运势如何？',
  '我适合做什么工作？',
  '看看我的财运',
  '正缘什么时候出现？',
  '摇一卦试试',
  '最近注意健康吗？'
]

function timeNow() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function AgentChat({ chart }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef(null)
  const booted = useRef(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const lines = chart ? openingLine(chart) : openingNoChart()
    setMessages(lines.map((text, i) => ({ id: `boot-${i}`, role: 'ai', text, time: timeNow() })))
  }, [chart])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  const pushAi = async (texts) => {
    setTyping(true)
    await new Promise(r => setTimeout(r, 480 + Math.random() * 650))
    setTyping(false)
    setMessages(prev => [...prev, ...texts.map((t, i) => ({
      id: `${Date.now()}-${i}`,
      role: 'ai',
      text: t,
      time: timeNow()
    }))])
  }

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || typing) return
    setInput('')
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: q, time: timeNow() }])
    const replies = generateReply(chart, q)
    await pushAi(replies)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div>
      <div className="agent-head">
        <div className="agent-avatar">司</div>
        <div>
          <div className="name">司命 Agent</div>
          <div className="status"><span className="dot" /> 在线 · 八字 · 紫微 · 六爻 三门通晓</div>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="avatar">{m.role === 'ai' ? '司' : '我'}</div>
            <div style={{ maxWidth: '100%' }}>
              <div className="bubble">
                {m.text.split('\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>
          </div>
        ))}
        {typing && (
          <div className="msg ai">
            <div className="avatar">司</div>
            <div className="bubble typing"><i /><i /><i /></div>
          </div>
        )}
      </div>

      <div className="quick-row">
        {QUICK.map(q => (
          <button key={q} className="quick-chip" onClick={() => send(q)}>{q}</button>
        ))}
      </div>

      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          rows={1}
          placeholder="问司命任何问题…"
          value={input}
          onChange={e => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
          }}
          onKeyDown={handleKey}
          style={{ maxHeight: 110 }}
        />
        <button className="send-btn" onClick={() => send()} disabled={typing || !input.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
