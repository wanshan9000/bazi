// /api/agent/*：把 dsh 子进程的会话事件以 SSE 转给前端；uid 来自 X-Genki-Uid（R2 M1 上 JWT 后替换 getUid）
import { Router } from 'express'
import { ROUTES, DEFAULT_ROUTE, sharedPool } from '../dsh/pool.js'
import { sharedStore } from '../dsh/agentStore.js'
import { TOOL_NAME_CN } from '../dsh/events.js'

const MAX_TEXT = 2000
const RATE_LIMIT = 20 // 次/分钟/uid+IP

function getUid(req) {
  const uid = String(req.get('x-genki-uid') || '').trim()
  return uid && uid.length <= 80 ? uid : null
}

function chartKeyOf(chart) {
  if (!chart || !chart.year || !chart.month || !chart.day || !chart.gender) return null
  return `${chart.year}-${chart.month}-${chart.day}-${chart.hour ?? 12}-${chart.gender}`
}

function chartLine(chart) {
  return `【当前缘主命盘】${chart.year}年${chart.month}月${chart.day}日 ${chart.hour ?? 12}时 ${chart.gender}（公历）`
}

function timeNow() { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }

export function createAgentRouter({ pool = sharedPool(), store = sharedStore() } = {}) {
  const r = Router()
  const hits = new Map() // `${uid}|${ip}` → { count, resetAt }

  function rateLimited(uid, ip) {
    const k = `${uid}|${ip}`
    const now = Date.now()
    const h = hits.get(k)
    if (!h || h.resetAt < now) { hits.set(k, { count: 1, resetAt: now + 60000 }); return false }
    h.count++
    return h.count > RATE_LIMIT
  }

  r.use('/agent', (req, res, next) => {
    if (req.path === '/models') return next()
    const uid = getUid(req)
    if (!uid) return res.status(400).json({ ok: false, msg: '缺少用户标识' })
    req.uid = uid
    next()
  })

  r.get('/agent/models', (_req, res) => {
    res.json({ ok: true, default: DEFAULT_ROUTE, routes: Object.entries(ROUTES).map(([key, v]) => ({ key, label: v.label, model: v.model })) })
  })

  r.get('/agent/sessions', (req, res) => {
    res.json({ ok: true, sessions: store.listSessions(req.uid) })
  })

  r.get('/agent/sessions/:id/messages', (req, res) => {
    const s = store.getSession(req.uid, req.params.id)
    if (!s) return res.status(404).json({ ok: false, msg: '会话不存在' })
    res.json({ ok: true, session: s, messages: store.listMessages(req.uid, s.id) })
  })

  r.delete('/agent/sessions/:id', (req, res) => {
    res.json({ ok: store.deleteSession(req.uid, req.params.id) })
  })

  r.post('/agent/chat', async (req, res) => {
    const { sessionId, text, chart, route } = req.body || {}
    const q = String(text || '').trim()
    if (!q) return res.status(400).json({ ok: false, msg: '内容为空' })
    if (q.length > MAX_TEXT) return res.status(400).json({ ok: false, msg: `内容过长（≤${MAX_TEXT} 字）` })
    if (rateLimited(req.uid, req.ip)) return res.status(429).json({ ok: false, msg: '请求太频繁，请稍后再试' })

    let session = sessionId ? store.getSession(req.uid, sessionId) : null
    if (sessionId && !session) return res.status(404).json({ ok: false, msg: '会话不存在' })
    if (!session) {
      const routeKey = ROUTES[route] ? route : DEFAULT_ROUTE
      session = store.createSession(req.uid, { route: routeKey, title: q.slice(0, 14) })
    }
    if (pool.isBusy(session.id)) return res.status(409).json({ ok: false, msg: '正在回复中，请稍候' })

    // 命盘变化时把命盘行拼到用户消息前
    const ck = chartKeyOf(chart)
    let prompt = q
    if (ck && ck !== session.chartKey) { prompt = `${chartLine(chart)}\n${q}`; store.updateSession(req.uid, session.id, { chartKey: ck }) }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    const send = e => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`) }
    send({ type: 'session', sessionId: session.id, route: session.route })

    store.appendMessage(req.uid, session.id, { role: 'user', text: q, time: timeNow() })
    const ac = new AbortController()
    req.on('close', () => ac.abort())
    const tools = []
    let sawError = false
    try {
      const result = await pool.run({
        routeKey: session.route, sessionId: session.id, text: prompt, signal: ac.signal,
        onEvent: e => {
          if (e.type === 'tool_call') tools.push(TOOL_NAME_CN[e.name] || e.name)
          if (e.type === 'tool_result' && e.kind === 'report') store.appendMessage(req.uid, session.id, { role: 'ai', kind: 'report', name: e.name, text: e.text, time: timeNow() })
          if (e.type === 'title' && session.title.length <= 14) store.updateSession(req.uid, session.id, { title: e.title })
          if (e.type === 'error') sawError = true
          if (e.type !== 'message' && e.type !== 'done') send(e) // done 由下方统一发（带 usage）；若已见 error 则不再发 done
        },
      })
      if (tools.length) store.appendMessage(req.uid, session.id, { role: 'tool', text: tools.join('、'), time: timeNow() })
      if (result.finalText) store.appendMessage(req.uid, session.id, { role: 'ai', text: result.finalText, time: timeNow() })
      if (!sawError) send({ type: 'done', reason: 'completed', usage: result.usage || undefined })
    } catch (err) {
      const code = err?.code || err?.name || 'ERROR'
      const message = code === 'BUSY' ? '正在回复中，请稍候'
        : code === 'TIMEOUT' ? '回复超时，请重试'
        : (code === 'CLOSED' || err?.name === 'TransportClosedError') ? '命理助手暂不可用，请稍后重试'
        : code === 'UNKNOWN_ROUTE' ? '模型路由不存在'
        : (err?.message || '服务异常')
      send({ type: 'error', code, message })
    } finally {
      res.end()
    }
  })

  return r
}

export default createAgentRouter
