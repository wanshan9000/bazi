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
  constructor({ createClient = defaultCreateClient } = {}) {
    this.createClient = createClient
    this.clients = new Map()   // routeKey → { client, ready: Promise }
    this.busy = new Set()      // sessionId
    this.closeWaiters = new Set() // 每个进行中的 run() 注册的 resolve()：close() 时唤醒它们，避免等到 120s 超时
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

  async run({ routeKey, sessionId, text, onEvent, signal }) {
    if (this.busy.has(sessionId)) { const e = new Error('BUSY: 该会话正在回复中'); e.code = 'BUSY'; throw e }
    this.busy.add(sessionId)
    let sub = null
    // 单个定时器，覆盖整轮；在 finally 清理，避免每次通知都开一个新定时器导致泄漏。
    let timer = null
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { const e = new Error('TIMEOUT: 回复超时'); e.code = 'TIMEOUT'; reject(e) }, TURN_TIMEOUT_MS)
    })
    // close() 唤醒信号：不依赖子进程/订阅自己解除阻塞（fake client 在测试里就做不到），
    // 池整体关闭时应立刻放行所有仍在等待通知的 run()，而不是干等到 120s 超时。
    const CLOSED = Symbol('dsh-pool-closed')
    let resolveClosed
    const closedSignal = new Promise(resolve => { resolveClosed = () => resolve(CLOSED) })
    this.closeWaiters.add(resolveClosed)
    try {
      const client = await this.client(routeKey)
      sub = client.subscribeSessionTree(sessionId)
      await client.prompt(sessionId, [{ type: 'text', text }])
      let finalText = ''
      let usage = null
      let title = null
      while (true) {
        if (signal && signal.aborted) break
        const n = await Promise.race([sub.next(), deadline, closedSignal])
        if (n === CLOSED) break
        if (isIdle(n, sessionId)) break
        const e = normalize(n)
        if (!e) continue
        if (e.type === 'message') { finalText = e.text || finalText; if (e.usage) usage = e.usage }
        if (e.type === 'title') title = e.title
        onEvent(e)
      }
      return { finalText, usage, title }
    } catch (err) {
      // 子进程死亡或超时：丢弃该路由客户端，下次请求重启
      if (err && (err.name === 'TransportClosedError' || err.code === 'TIMEOUT')) this.clients.delete(routeKey)
      throw err
    } finally {
      clearTimeout(timer)
      this.closeWaiters.delete(resolveClosed)
      if (sub) sub.close()
      this.busy.delete(sessionId)
    }
  }

  async close() {
    for (const resolve of this.closeWaiters) resolve()
    const all = [...this.clients.values()]
    this.clients.clear()
    await Promise.allSettled(all.map(async e => { try { const c = await e.ready; await c.close() } catch { /* 忽略 */ } }))
  }
}

let shared = null
export function sharedPool() { if (!shared) shared = new DshPool(); return shared }
