import { useEffect, useRef, useState } from 'react'
import { generateReply, openingLine } from '../engine/chat.js'

const QUICK = ['今年运势如何？', '我适合做什么工作？', '看看我的财运', '我的正缘什么时候出现？', '最近需要注意健康吗？', '帮我选个吉日']

function timeNow() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function Chat({ chart }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef(null)
  const booted = useRef(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const lines = openingLine(chart)
    const msgs = []
    lines.forEach((line, i) => {
      msgs.push({ id: `boot-${i}`, role: 'ai', text: line, time: timeNow() })
    })
    setMessages(msgs)
  }, [chart])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  const pushAi = async (texts) => {
    setTyping(true)
    await new Promise(r => setTimeout(r, 500 + Math.random() * 700))
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
    <div className="chat-wrap">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && !typing && (
          <div className="empty-state">
            <span className="mark">☯</span>
            <p>问你想问的，灵枢为你答疑<br />事业 · 财运 · 感情 · 健康 · 流年</p>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="avatar">{m.role === 'ai' ? '枢' : '我'}</div>
            <div style={{ maxWidth: '100%' }}>
              <div className="bubble">
                {m.text.split('\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <div className="time">{m.time}</div>
            </div>
          </div>
        ))}

        {typing && (
          <div className="msg ai">
            <div className="avatar">枢</div>
            <div className="bubble typing">
              <i /><i /><i />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px' }}>
        <div className="quick-row">
          {QUICK.map(q => (
            <button key={q} className="quick-chip" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      </div>

      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          rows={1}
          placeholder="问灵枢任何问题…"
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
