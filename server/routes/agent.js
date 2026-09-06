// /api/agent/*：把 dsh 子进程的会话事件以 SSE 转给前端；uid 来自 X-Genki-Uid（R2 M1 上 JWT 后替换 getUid）
import { Router } from 'express'
import { ROUTES, DEFAULT_ROUTE, sharedPool } from '../dsh/pool.js'
import { sharedStore } from '../dsh/agentStore.js'
import { TOOL_NAME_CN } from '../dsh/events.js'

const MAX_TEXT = 2000
const RATE_LIMIT = 20 // 次/分钟/uid+IP
// uid 是客户端自报的（X-Genki-Uid），换一个就能把上面那个桶清零，所以必须再有一层
// 只按来源 IP 计数的闸门，否则轮换 uid 即可无限调用付费模型。
// 生效前提：server/index.js 设了 trust proxy，否则经 Caddy 后 req.ip 恒为 127.0.0.1。
const IP_RATE_LIMIT = 60 // 次/分钟/IP（不分 uid）

function getUid(req) {
  const uid = String(req.get('x-genki-uid') || '').trim()
  return uid && uid.length <= 80 ? uid : null
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

function timeNow() { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }

export function createAgentRouter({ pool = sharedPool(), store = sharedStore() } = {}) {
  const r = Router()
  const hits = new Map() // `${uid}|${ip}` → { count, resetAt }

  function bump(key, limit, now) {
    const h = hits.get(key)
    if (!h || h.resetAt < now) { hits.set(key, { count: 1, resetAt: now + 60000 }); return false }
    h.count++
    return h.count > limit
  }

  function rateLimited(uid, ip) {
    const now = Date.now()
    // 每次写入顺手清掉过期窗口：否则 hits 会随 uid+IP 组合无界增长（长跑进程的内存泄漏）
    for (const [key, h] of hits) if (h.resetAt < now) hits.delete(key)
    // 两个闸门都要过。先各自计数再取或，不能短路——否则前一个桶满了之后
    // 后一个桶就不再累加，攻击者只要触发前者即可让后者永远清白。
    const overUid = bump(`u|${uid}|${ip}`, RATE_LIMIT, now)
    const overIp = bump(`i|${ip}`, IP_RATE_LIMIT, now)
    return overUid || overIp
  }

  // 鉴别 uid + 限流：规格 §10 要求覆盖整个 /api/agent/*，不只是 /chat
  // （列表/删除同样能被刷）。/models 是无 uid 的静态路由表，放行。
  r.use('/agent', (req, res, next) => {
    if (req.path === '/models') return next()
    const uid = getUid(req)
    if (!uid) return res.status(400).json({ ok: false, msg: '缺少用户标识' })
    if (rateLimited(uid, req.ip)) return res.status(429).json({ ok: false, msg: '请求太频繁，请稍后再试' })
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

    let session = sessionId ? store.getSession(req.uid, sessionId) : null
    if (sessionId && !session) return res.status(404).json({ ok: false, msg: '会话不存在' })
    if (!session) {
      // ⚠ 必须用 hasOwnProperty：`ROUTES['constructor']` / `ROUTES['__proto__']`
      // 都是真值，直接判 `ROUTES[route]` 会让这些原型链上的键被当成合法路由存进
      // 会话，池子随后为它们各拉起一个 dsh 子进程。
      const routeKey = Object.prototype.hasOwnProperty.call(ROUTES, route) ? route : DEFAULT_ROUTE
      session = store.createSession(req.uid, { route: routeKey, title: q.slice(0, 14) })
    }
    if (pool.isBusy(session.id)) return res.status(409).json({ ok: false, msg: '正在回复中，请稍候' })

    // 命盘变化时把命盘行拼到用户消息前。
    // chartKey 要等这一轮真的跑完再落库：此前在 pool.run 之前就写，本轮一旦失败，
    // 用户重试时 ck 已等于 session.chartKey，命盘行不再拼进去，模型永远不知道命盘。
    const safeChart = normalizeChart(chart)
    const ck = chartKeyOf(safeChart)
    let prompt = q
    const chartChanged = !!ck && ck !== session.chartKey
    if (chartChanged) prompt = `${chartLine(safeChart)}\n${q}`

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
    // 用 res 而非 req 的 'close'：req 在请求体读完（express.json 已消费）就会触发
    // 'close'，与客户端是否断开无关；res 的 'close' 只在底层 socket 关闭时触发，
    // writableFinished 为 true 说明是我们自己 res.end() 收尾的，不是真实断开。
    res.on('close', () => { if (!res.writableFinished) ac.abort() })
    const tools = []
    let sawError = false
    try {
      // session 帧与用户消息落库都放进 try：appendMessage 抛错时（磁盘满、
      // 目录只读）原先会把 beat 定时器和这条响应一起晾在那儿，连接永远不收尾。
      send({ type: 'session', sessionId: session.id, route: session.route })
      store.appendMessage(req.uid, session.id, { role: 'user', text: q, time: timeNow() })
      const result = await pool.run({
        routeKey: session.route, sessionId: session.id, text: prompt, signal: ac.signal,
        onEvent: e => {
          if (e.type === 'text' && e.delta) streamed += e.delta
          if (e.type === 'tool_call') tools.push(TOOL_NAME_CN[e.name] || e.name)
          // e.ok === false 表示工具执行失败，e.text 是错误信息而不是报告正文。
          // 此前不看 ok，把「排盘失败：出生信息无效」也当成一张测算报告卡片持久化。
          if (e.type === 'tool_result' && e.kind === 'report' && e.ok !== false) store.appendMessage(req.uid, session.id, { role: 'ai', kind: 'report', name: e.name, text: e.text, time: timeNow() })
          if (e.type === 'title' && session.title.length <= 14) store.updateSession(req.uid, session.id, { title: e.title })
          if (e.type === 'error') sawError = true
          if (e.type !== 'message' && e.type !== 'done') send(e) // done 由下方统一发（带 usage）；若已见 error 则不再发 done
        },
      })
      if (tools.length) store.appendMessage(req.uid, session.id, { role: 'tool', text: tools.join('、'), time: timeNow() })
      const finalText = result.finalText || streamed
      if (finalText) store.appendMessage(req.uid, session.id, { role: 'ai', text: finalText, time: timeNow() })
      streamed = ''
      if (chartChanged) store.updateSession(req.uid, session.id, { chartKey: ck })
      if (!sawError) send({ type: 'done', reason: 'completed', usage: result.usage || undefined })
    } catch (err) {
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
      clearInterval(beat)
      if (!res.writableEnded) res.end()
    }
  })

  return r
}

export default createAgentRouter
