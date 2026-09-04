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
import { normalize, isIdle } from './events.js'
import { DSH_HOME, PROFILE_DIR, SKILLS_DIR, ENGINES_FILE, PERSONA_FILE } from './setup.mjs'

export const ROUTES = {
  'deepseek-flash': { provider: 'deepseek-official', model: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  'deepseek-pro': { provider: 'deepseek-official', model: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  'minimax': { provider: 'minimax', model: 'MiniMax-M2.7', label: 'MiniMax M2.7' },
}
export const DEFAULT_ROUTE = process.env.AGENT_DEFAULT_ROUTE || 'deepseek-flash'
const MAX_TOKENS = 8192
const TURN_TIMEOUT_MS = 120000

function childEnv() {
  const persona = fs.existsSync(PERSONA_FILE) ? fs.readFileSync(PERSONA_FILE, 'utf8') : ''
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DSH_HOME,
    DSH_TELEMETRY_DISABLED: '1',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || '',
    LINGSHU_SKILLS_DIR: SKILLS_DIR,
    LINGSHU_ENGINES: ENGINES_FILE,
    LINGSHU_PERSONA: persona,
  }
}

function defaultCreateClient() {
  return new HarnessClient({ profile: 'lingshu', dshHome: DSH_HOME, processCwd: PROFILE_DIR, env: childEnv(), initializeTimeoutMs: 20000 })
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
      ready.catch(() => this.clients.delete(routeKey))
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

  async run({ routeKey, sessionId, text, onEvent, signal }) {
    if (this.busy.has(sessionId)) { const e = new Error('BUSY: 该会话正在回复中'); e.code = 'BUSY'; throw e }
    this.busy.add(sessionId)
    let sub = null
    // 单个定时器，覆盖整轮；在 finally 清理，避免每次通知都开一个新定时器导致泄漏。
    let timer = null
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { const e = new Error('TIMEOUT: 回复超时'); e.code = 'TIMEOUT'; reject(e) }, this.turnTimeoutMs)
    })
    try {
      // 中止信号在发出 prompt 之前就已置位：不占用子进程配额，直接返回空结果。
      if (signal && signal.aborted) return { finalText: '', usage: null, title: null }
      const client = await this.client(routeKey)
      sub = client.subscribeSessionTree(sessionId)
      this.openSubs.add(sub)
      await client.prompt(sessionId, [{ type: 'text', text }])
      let finalText = ''
      let usage = null
      let title = null
      while (true) {
        if (signal && signal.aborted) break
        let n
        try {
          n = await Promise.race([sub.next(), deadline])
        } catch (err) {
          // close() 关闭了这条订阅：真实 SDK 里这会让挂起的 next() 以
          // TransportClosedError 拒绝；翻译成调用方能识别的 CLOSED，而不是当作
          // 子进程意外死亡处理（那样会误触发下面的 dropClient）。
          if (this.closed) { const e = new Error('服务正在关闭'); e.code = 'CLOSED'; throw e }
          throw err
        }
        if (isIdle(n, sessionId)) break
        const e = normalize(n)
        if (!e) continue
        if (e.type === 'message') { finalText = e.text || finalText; if (e.usage) usage = e.usage }
        if (e.type === 'title') title = e.title
        onEvent(e)
      }
      return { finalText, usage, title }
    } catch (err) {
      // 子进程死亡或超时：丢弃该路由客户端并关闭它，下次请求会重新启动一个
      if (err && (err.name === 'TransportClosedError' || err.code === 'TIMEOUT')) this.dropClient(routeKey)
      throw err
    } finally {
      clearTimeout(timer)
      if (sub) { this.openSubs.delete(sub); sub.close() }
      this.busy.delete(sessionId)
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
