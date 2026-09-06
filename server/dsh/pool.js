// DshPool：每个模型路由常驻一个 dsh 子进程（HarnessClient），负责初始化、跑一轮、异常重启。
//
// HarnessClient API 核对自：
//   node_modules/@deepseek-ai/dsh-sdk-client/lib/types/client.d.ts
//   node_modules/@deepseek-ai/dsh-sdk-client/lib/types/types.d.ts
// - constructor(options?: HarnessClientOptions)；start(): void（同步，非 Promise，await 无害）
// - initialize(params: InitializeParams): Promise<InitializeResult>
// - prompt(sessionId, contentBlocks): Promise<string>
// - subscribeSessionTree(sessionId): NotificationSubscription
//     { next(): Promise<HarnessNotification>, tryNext(), close() }，AsyncIterable
// - close(): Promise<void>
// - 错误类：TransportClosedError（.name === 'TransportClosedError'）、RequestTimeoutError、JsonRpcResponseError
//
// close() 语义核对自 lib/index.js：subscription.close() 会调用 fail(new
// TransportClosedError(...))，fail() 会 reject 所有挂起的 next() 等待者——也就是
// 说，关闭订阅会让正在等待的 run() 立刻收到一个 TransportClosedError 拒绝，而不是
// 停在原地直到超时。
import fs from 'node:fs'
import { HarnessClient } from '@deepseek-ai/dsh-sdk-client'
import { normalize, isIdle, isInboxReceipt } from './events.js'
import { DSH_HOME, PROFILE_DIR, SKILLS_DIR, ENGINES_FILE, PERSONA_FILE } from './setup.mjs'

export const ROUTES = {
  'deepseek-flash': { provider: 'deepseek-official', model: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  'deepseek-pro': { provider: 'deepseek-official', model: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  'minimax': { provider: 'minimax', model: 'MiniMax-M2.7', label: 'MiniMax M2.7' },
}
export const DEFAULT_ROUTE = process.env.AGENT_DEFAULT_ROUTE || 'deepseek-flash'
const MAX_TOKENS = 8192
// ⚠ 这是**静默超时**，不是整轮上限：只要子进程还在往外吐通知（文本增量、工具调用），
// 计时就会重置。原先是一个覆盖整轮的硬上限 120s —— 生成一份长报告本来就可能超过
// 两分钟，被判超时后前端报错，子进程却还在继续烧 token 把这一轮跑完。
// 取值需小于 Caddy 的 response_header_timeout / read_timeout（300s）。
const TURN_TIMEOUT_MS = 120000
// 单条 JSON-RPC 请求（initialize / prompt）的上限：没有它，SDK 默认不超时，
// 子进程卡在握手或 prompt 上会让这一轮永远挂着。
const REQUEST_TIMEOUT_MS = 30000

// 子进程环境变量白名单：显式列举，绝不整份透传 process.env（里面可能有别的服务密钥）。
export function buildChildEnv(env = process.env) {
  const persona = fs.existsSync(PERSONA_FILE) ? fs.readFileSync(PERSONA_FILE, 'utf8') : ''
  return {
    PATH: env.PATH,
    HOME: env.HOME,
    DSH_HOME,
    DSH_TELEMETRY_DISABLED: '1',
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY || '',
    MINIMAX_API_KEY: env.MINIMAX_API_KEY || '',
    LINGSHU_SKILLS_DIR: SKILLS_DIR,
    LINGSHU_ENGINES: ENGINES_FILE,
    LINGSHU_PERSONA: persona,
  }
}

function defaultCreateClient() {
  return new HarnessClient({
    profile: 'lingshu', dshHome: DSH_HOME, processCwd: PROFILE_DIR, env: buildChildEnv(),
    initializeTimeoutMs: 20000, requestTimeoutMs: REQUEST_TIMEOUT_MS,
  })
}

export class DshPool {
  constructor({ createClient = defaultCreateClient, turnTimeoutMs = TURN_TIMEOUT_MS } = {}) {
    this.createClient = createClient
    this.turnTimeoutMs = turnTimeoutMs
    this.clients = new Map()   // routeKey → { client, ready: Promise }
    this.busy = new Set()      // sessionId
    this.openSubs = new Set()  // 所有仍在被 run() 等待的订阅句柄：close() 时逐个关闭，令其 next() 拒绝
    this.closed = false        // close() 之后为 true；用于把由此触发的 next() 拒绝识别为 CLOSED，而非子进程意外死亡
  }

  isBusy(sessionId) { return this.busy.has(sessionId) }

  async client(routeKey) {
    const route = ROUTES[routeKey]
    if (!route) { const e = new Error(`UNKNOWN_ROUTE: 未知模型路由 ${routeKey}`); e.code = 'UNKNOWN_ROUTE'; throw e }
    let entry = this.clients.get(routeKey)
    if (!entry) {
      const client = this.createClient(routeKey)
      const ready = (async () => {
        await client.start()
        await client.initialize({ cwd: PROFILE_DIR, provider: route.provider, model: route.model, maxTokens: MAX_TOKENS })
        return client
      })()
      entry = { client, ready }
      this.clients.set(routeKey, entry)
      // ⚠ 握手失败时只从 map 删除是不够的：start() 很可能已经把子进程拉起来了，
      // 不 close() 它就会一直挂着。重试几次之后机器上会堆一串孤儿 dsh 进程。
      ready.catch(() => {
        this.clients.delete(routeKey)
        try { Promise.resolve(client.close()).catch(() => {}) } catch { /* 尚未启动 */ }
      })
    }
    return entry.ready
  }

  // 丢弃某路由的常驻客户端并关闭其子进程（fire-and-forget：调用方无需等待子进程退出）。
  dropClient(routeKey) {
    const entry = this.clients.get(routeKey)
    if (!entry) return
    this.clients.delete(routeKey)
    entry.ready.then(c => c.close()).catch(() => { /* 初始化本就失败的子进程无需再关闭 */ })
  }

  // 调用方已放弃这一轮（中止 / 超时），但子进程仍在为该会话生成：不要立刻释放
  // busy，否则下一条消息会被塞进一个仍在跑的会话里，两轮输出互相串扰。保留订阅在
  // 后台读到该会话 idle（或订阅被拒绝 / 池关闭）为止，再关闭订阅并释放 busy。
  // 子进程彻底卡死时靠 turnTimeoutMs 的兜底定时器强制收尾，避免会话永久 busy。
  drainToIdle(sessionId, sub, { received, messageId, inflight = null }) {
    // 没拿到 messageId（prompt 本身就超时了）时无从校验收据，只能接受该会话的下一个 idle。
    let seen = received || !messageId
    const cap = setTimeout(() => { try { sub.close() } catch { /* 已关闭 */ } }, this.turnTimeoutMs)
    if (cap.unref) cap.unref()
    ;(async () => {
      try {
        // ⚠ inflight 是 run() 里那次 Promise.race 输给 deadline 的 sub.next()。
        // 它稍后仍会兑现，若不在这里接住就被永久丢弃 —— 而丢掉的很可能正是本轮的
        // idle 通知，于是这里会白等下一个永远不来的 idle，会话多 busy 一个超时周期。
        let first = inflight
        while (true) {
          const n = first ? await first : await sub.next()
          first = null
          if (!seen) { if (isInboxReceipt(n, sessionId, messageId)) seen = true; continue }
          if (isIdle(n, sessionId)) break
        }
      } catch { /* 订阅关闭或传输断开：无需再等 */ }
      clearTimeout(cap)
      this.openSubs.delete(sub)
      try { sub.close() } catch { /* 已关闭 */ }
      this.busy.delete(sessionId)
    })()
  }

  async run({ routeKey, sessionId, text, onEvent, signal }) {
    if (this.busy.has(sessionId)) { const e = new Error('BUSY: 该会话正在回复中'); e.code = 'BUSY'; throw e }
    this.busy.add(sessionId)
    let sub = null
    // 单个定时器，覆盖整轮；在 finally 清理，避免每次通知都开一个新定时器导致泄漏。
    let timer = null
    let messageId = null
    let received = false
    let drained = false // 已交给 drainToIdle 善后：finally 不再动 sub / busy
    let inflight = null // 正在等待的 sub.next()：超时时要交给 drainToIdle，不能丢
    // 静默超时：每收到一条通知就重置计时。只要子进程还在输出，这一轮就不算卡住。
    let rejectDeadline = null
    const armDeadline = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const e = new Error('TIMEOUT: 回复超时')
        e.code = 'TIMEOUT'
        rejectDeadline && rejectDeadline(e)
      }, this.turnTimeoutMs)
    }
    const deadline = new Promise((_, reject) => { rejectDeadline = reject })
    armDeadline()
    // 必须立刻挂一个 handler：deadline 早在进入下面的 Promise.race 之前就可能被
    // reject（await this.client() / client.prompt() 期间定时器就会到点），那时它还
    // 没有任何 handler，Node 会以 unhandledRejection 直接终止整个服务进程。
    // race 里仍会再挂 handler，拒绝照常传播给调用方。
    deadline.catch(() => { /* 见上：仅用于消除 unhandledRejection */ })
    try {
      // 中止信号在发出 prompt 之前就已置位：不占用子进程配额，直接返回空结果。
      if (signal && signal.aborted) return { finalText: '', usage: null, title: null }
      // 启动握手与 prompt 也要受整轮 deadline 约束：否则子进程卡在这两步时
      // 这一轮会永远挂着（deadline 的拒绝要到进入下面的 race 才会被消费）。
      const client = await Promise.race([this.client(routeKey), deadline])
      sub = client.subscribeSessionTree(sessionId)
      this.openSubs.add(sub)
      messageId = await Promise.race([client.prompt(sessionId, [{ type: 'text', text }]), deadline])
      // 客户端没有返回 messageId 时无从校验收据，只能退化为"立即开始收事件"。
      received = !messageId
      let finalText = ''
      let usage = null
      let title = null
      while (true) {
        if (signal && signal.aborted) { drained = true; this.drainToIdle(sessionId, sub, { received, messageId, inflight }); inflight = null; break }
        let n
        try {
          if (!inflight) inflight = sub.next()
          n = await Promise.race([inflight, deadline])
          inflight = null
          armDeadline() // 收到通知 → 续期，长报告不会被中途判超时
        } catch (err) {
          // close() 关闭了这条订阅：真实 SDK 里这会让挂起的 next() 以
          // TransportClosedError 拒绝；翻译成调用方能识别的 CLOSED，而不是当作
          // 子进程意外死亡处理（那样会误触发下面的 dropClient）。
          if (this.closed) { const e = new Error('服务正在关闭'); e.code = 'CLOSED'; throw e }
          throw err
        }
        // 收据门：本轮 prompt 的 messageId 被 agent/inbox/spliced 确认之前，一切
        // 通知（含上一轮残留的 session.status: idle）都不属于这一轮，全部忽略。
        if (!received) { if (isInboxReceipt(n, sessionId, messageId)) received = true; continue }
        if (isIdle(n, sessionId)) break
        const e = normalize(n)
        if (!e) continue
        if (e.type === 'message') { finalText = e.text || finalText; if (e.usage) usage = e.usage }
        if (e.type === 'title') title = e.title
        onEvent(e)
      }
      return { finalText, usage, title }
    } catch (err) {
      // 只有传输真的断了（子进程死亡）才丢弃常驻客户端；超时不代表子进程坏了，
      // 丢掉它反而会打断其它会话，改由 drainToIdle 在后台等这一轮自然结束。
      if (!this.closed && err && (err.name === 'TransportClosedError' || err.code === 'CLOSED')) this.dropClient(routeKey)
      else if (err && err.code === 'TIMEOUT' && sub) { drained = true; this.drainToIdle(sessionId, sub, { received, messageId, inflight }); inflight = null }
      throw err
    } finally {
      clearTimeout(timer)
      if (!drained) {
        if (sub) { this.openSubs.delete(sub); sub.close() }
        this.busy.delete(sessionId)
      }
    }
  }

  async close() {
    this.closed = true
    // 先关闭所有仍在等待的订阅：真实 SDK 的 close() 会让挂起的 next() 立即以
    // TransportClosedError 拒绝，从而让对应的 run() 尽快退出，而不是干等到超时。
    for (const sub of this.openSubs) sub.close()
    const all = [...this.clients.values()]
    this.clients.clear()
    await Promise.allSettled(all.map(async e => { try { const c = await e.ready; await c.close() } catch { /* 忽略 */ } }))
  }
}

let shared = null
export function sharedPool() { if (!shared) shared = new DshPool(); return shared }
