// /api/agent/*：把 dsh 子进程的会话事件以 SSE 转给前端。
//
// 身份（R2 M1 已落地）：登录用户凭 Authorization: Bearer <jwt>，游客凭自报的
// anon:* 标识。**不再接受自报的账号 uid** —— 以前 `X-Genki-Uid: u123` 就能读、
// 删 u123 的全部会话。
import { Router } from 'express'
import { ROUTES, DEFAULT_ROUTE, sharedPool } from '../dsh/pool.js'
import { sharedStore } from '../dsh/agentStore.js'
import { sharedAccounts } from '../accounts.js'
import { sharedGuestQuota } from '../guestQuota.js'
import { TOOL_NAME_CN } from '../dsh/events.js'
import { identify } from './auth.js'
import { config } from '../config.js'

const MAX_TEXT = 2000
const RATE_LIMIT = 20 // 次/分钟/uid+IP
// uid 是客户端自报的（X-Genki-Uid），换一个就能把上面那个桶清零，所以必须再有一层
// 只按来源 IP 计数的闸门，否则轮换 uid 即可无限调用付费模型。
// 生效前提：server/index.js 设了 trust proxy，否则经 Caddy 后 req.ip 恒为 127.0.0.1。
const IP_RATE_LIMIT = 60 // 次/分钟/IP（不分 uid）
// 游客额度更紧：游客标识仍是自报的，换一个就是一个新桶，只有把单桶压低
// 才能让 IP 桶真正成为主闸门。登录用户有服务端身份，可以放宽。
const GUEST_RATE_LIMIT = 10

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

function chartSessionTitle(chart) {
  if (!chart) return null
  const shiChen = chart.hour === null || chart.hour === undefined
    ? '时辰未知'
    : `${['子', '丑', '丑', '寅', '寅', '卯', '卯', '辰', '辰', '巳', '巳', '午', '午', '未', '未', '申', '申', '酉', '酉', '戌', '戌', '亥', '亥', '子'][chart.hour]}时`
  return `${chart.gender === '女' ? '坤造' : '乾造'} · ${chart.year}年${chart.month}月${chart.day}日 · ${shiChen}`
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

export function createAgentRouter({ pool = sharedPool(), store = sharedStore(), accounts = sharedAccounts(), guestQuota = sharedGuestQuota() } = {}) {
  const r = Router()
  const hits = new Map() // `${uid}|${ip}` → { count, resetAt }
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
    res.json({ ok: true, default: DEFAULT_ROUTE, routes: Object.entries(ROUTES).map(([key, v]) => ({ key, label: v.label, model: v.model })) })
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

    // 同一用户可以开多个会话，但不能借此并发占满模型池。这里在扣积分前挡住，
    // 被拒绝的请求不会扣额度；finally 必须释放，避免任何异常把用户永久锁住。
    if (!acquireRun(req.uid, req.ip)) {
      return res.status(429).json({ ok: false, msg: '当前对话请求过多，请等待上一轮回复完成' })
    }

    // 额度在服务端把关。两条路：
    //   · 已登录 → 按账号扣积分（以前是前端改 localStorage，改回去就能白嫖）。
    //   · 游客   → 按**来源 IP** 记 token（以前只在浏览器里记，清一次站点数据就重置，
    //             换个 anon 标识连限流桶都是新的，等于完全没有闸门）。
    // 都是先扣后跑：跑完再扣的话，用户中途断开就等于免费用了一轮。
    let charged = false
    let guestCharged = false
    if (req.authed) {
      const paid = accounts.consumeCredit(req.uid, 'agent.chat')
      if (!paid.ok) {
        if (paid.reason === 'insufficient') {
          return res.status(402).json({ ok: false, reason: 'insufficient', msg: '本月积分不足，升级档位可继续对话', ...paid })
        }
        return res.status(400).json({ ok: false, msg: '扣减积分失败' })
      }
      charged = paid.cost > 0
    } else {
      const gate = guestQuota.begin(req.ip)
      if (!gate.ok) {
        return res.status(402).json({
          ok: false,
          reason: 'guest_quota',
          msg: '今日免费体验额度已用完，注册后可继续对话',
          resetAt: gate.resetAt,
        })
      }
      guestCharged = true
    }

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
    // 这一轮是否产出了任何可交付的内容（正文或测算报告卡片）。决定失败时退不退积分。
    let producedOutput = false
    // 本轮真实 token 用量，用于结算游客额度；拿不到就按 0 结（等于把预扣退回去）
    let usedTokens = 0
    // 用 res 而非 req 的 'close'：req 在请求体读完（express.json 已消费）就会触发
    // 'close'，与客户端是否断开无关；res 的 'close' 只在底层 socket 关闭时触发，
    // writableFinished 为 true 说明是我们自己 res.end() 收尾的，不是真实断开。
    res.on('close', () => { if (!res.writableFinished) ac.abort() })
    const tools = []
    // 用户也可直接在对话中报出生信息，由 bazi 工具排盘。这种会话没有前端传入的
    // chart，因此需要从成功的工具调用中补齐会话命盘，历史标题才不会仍是提问摘要。
    let baziToolChart = null
    let inferredChart = null
    let sawError = false
    try {
      // session 帧与用户消息落库都放进 try：appendMessage 抛错时（磁盘满、
      // 目录只读）原先会把 beat 定时器和这条响应一起晾在那儿，连接永远不收尾。
      send({ type: 'session', sessionId: session.id, route: session.route })
      store.appendMessage(req.uid, session.id, { role: 'user', text: q, time: timeNow() })
      const result = await pool.run({
        routeKey: session.route, sessionId: session.id, text: prompt, signal: ac.signal,
        onEvent: e => {
          if (e.type === 'text' && e.delta) { streamed += e.delta; producedOutput = true }
          if (e.type === 'tool_call') {
            tools.push(TOOL_NAME_CN[e.name] || e.name)
            if (e.name === 'bazi') baziToolChart = normalizeChart(e.args)
          }
          // e.ok === false 表示工具执行失败，e.text 是错误信息而不是报告正文。
          // 此前不看 ok，把「排盘失败：出生信息无效」也当成一张测算报告卡片持久化。
          if (e.type === 'tool_result' && e.name === 'bazi' && e.ok !== false && baziToolChart) inferredChart = baziToolChart
          if (e.type === 'tool_result' && e.kind === 'report' && e.ok !== false) { producedOutput = true; store.appendMessage(req.uid, session.id, { role: 'ai', kind: 'report', name: e.name, text: e.text, time: timeNow() }) }
          if (e.type === 'title' && session.title.length <= 14) store.updateSession(req.uid, session.id, { title: e.title })
          if (e.type === 'error') sawError = true
          if (e.type !== 'message' && e.type !== 'done') send(e) // done 由下方统一发（带 usage）；若已见 error 则不再发 done
        },
      })
      if (tools.length) store.appendMessage(req.uid, session.id, { role: 'tool', text: tools.join('、'), time: timeNow() })
      const finalText = result.finalText || streamed
      if (finalText) producedOutput = true
      // 游客额度按真实 token 结算（预扣的估计值在 finally 里被它替换掉）
      if (result.usage && result.usage.totalTokens) usedTokens = result.usage.totalTokens
      if (finalText) store.appendMessage(req.uid, session.id, { role: 'ai', text: finalText, time: timeNow() })
      streamed = ''
      // 命盘是这段会话最稳定、最容易辨认的身份。排盘成功后用其覆盖提问摘要，
      // 让历史列表直接显示「乾造/坤造 · 出生日期 · 时辰」。
      const sessionChart = inferredChart || (chartChanged ? safeChart : null)
      if (sessionChart) store.updateSession(req.uid, session.id, { chartKey: chartKeyOf(sessionChart), title: chartSessionTitle(sessionChart) })
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
      releaseRun(req.uid, req.ip)
      clearInterval(beat)
      // 扣了积分却一个字都没产出（模型立刻报错、路由不存在等）→ 退还。
      // 只看「有没有正文」，不看是否 abort：用户主动停止时前面已经生成了内容，
      // 那一轮算数，不该退。
      if (charged && !producedOutput) {
        try { accounts.refundCredit(req.uid, 'agent.chat') }
        catch (e) { console.error('[agent/chat] 退还积分失败', e) }
      }
      // 游客：把预扣的估计值换成真实用量。没产出时按 0 结算，预扣自动退回。
      if (guestCharged) {
        try { guestQuota.settle(req.ip, producedOutput ? usedTokens : 0) }
        catch (e) { console.error('[agent/chat] 游客额度结算失败', e) }
      }
      if (!res.writableEnded) res.end()
    }
  })

  return r
}

export default createAgentRouter
