// 大模型客户端：OpenAI 兼容协议，支持多家服务商。
//
// ⚠ 仅供 legacy 回退路径（VITE_AGENT_BACKEND=legacy）使用。
// 这条路是**浏览器直连模型服务商**，API Key 明文存在 localStorage：
//   · 任何能在该浏览器执行脚本的人（含第三方扩展）都能读走这个 key；
//   · key 会随每次请求从用户设备发出，无法审计、无法限额、无法吊销单个用户。
// 因此它只适合本机开发与自带 key 的管理员调试，绝不要给普通用户配置。
// 默认路径（VITE_AGENT_BACKEND=dsh）走服务端 /api/agent/*，密钥只存在服务器上。
// 彻底下掉这里的密钥是 R2 方案 M2 的内容，见
// docs/Agent记忆与账号服务端隔离R2改造方案.md。
//
// 配置存于 localStorage（genki-agent-config）

export const PROVIDERS = {
  minimax: {
    name: 'MiniMax',
    base: 'https://api.minimaxi.com/v1',
    model: 'MiniMax-M2.7',
    tip: '2026 旗舰 M2.7，百万级上下文，Agent 与工具调用表现强'
  },
  deepseek: {
    name: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    tip: '开源性价比之选，中文命理问答表现稳定'
  },
  qwen: {
    name: '通义千问',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    tip: '阿里云出品，兼容 OpenAI 协议，中文能力强'
  },
  moonshot: {
    name: 'Kimi',
    base: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    tip: '长上下文友好，善于总结与推演'
  },
  openai: {
    name: 'OpenAI',
    base: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    tip: '通用旗舰，需要境外网络'
  },
  zhipu: {
    name: '智谱 GLM',
    base: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    tip: '清华系出品，GLM-4-Flash 有免费额度'
  },
  custom: {
    name: '自定义',
    base: '',
    model: '',
    tip: '填写兼容 OpenAI 协议的 Base URL 与模型名'
  }
}

const LS_KEY = 'genki-agent-config'

export const DEFAULT_CONFIG = {
  provider: 'minimax',
  apiKey: '',
  baseUrl: 'https://api.minimaxi.com/v1',
  model: 'MiniMax-M2.7',
  // ⚠ 必须与 src/data/skills.js 的 BUILTIN_SKILLS 全集对齐。此前漏了
  // yixue-taishan / mangpai / wuyunliuqi / modern_huangli / qimen 五个 ——
  // 服务端 dsh 是把 skills/ 下的 SKILL.md 全量加载的，legacy 却默认少五个技能，
  // 同一个问题在两条路径上得到的能力范围不一样。
  enabledSkills: [
    'bazi', 'bazi-router', 'yixue-taishan', 'mangpai', 'wuyunliuqi', 'liuyao', 'tarot',
    'huangli', 'modern_huangli', 'ziwei', 'qimen', 'love', 'wealth',
    'health', 'fengshui', 'name',
  ],
  useLLM: false
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(cfg) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
  } catch { /* ignore */ }
}

// 根据服务商选择更新 baseUrl/model（用户也可手动改）
export function providerDefaults(provider) {
  const p = PROVIDERS[provider] || PROVIDERS.custom
  return { baseUrl: p.base, model: p.model }
}

// 列出所有可用的服务商 id（用于输入框旁的快速切换菜单）
export function listProviders() {
  return Object.keys(PROVIDERS)
}

export function isConfigured(cfg) {
  return !!(cfg && cfg.apiKey && cfg.baseUrl && cfg.model && cfg.useLLM)
}

// 调用 chat/completions（OpenAI 兼容）；maxWaitMs 超过则中止，避免网络/模型卡死
// maxTokens：输出上限，完整报告类需要 4000+ 才能写完，普通导语/短答 1200 足够
export async function chatLLM({ cfg, messages, signal, maxWaitMs = 60000, maxTokens = 1200 }) {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
  const combined = await withTimeout(signal, maxWaitMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.85,
        max_tokens: maxTokens,
        stream: false
      }),
      signal: combined.signal
    })
    if (!res.ok) {
      let detail = ''
      try {
        const j = await res.json()
        detail = j?.error?.message || JSON.stringify(j).slice(0, 160)
      } catch { /* ignore */ }
      throw new Error(`请求失败（${res.status}）${detail ? '：' + detail : ''}`)
    }
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('模型未返回内容')
    return text.trim()
  } finally {
    combined.cleanup()
  }
}

// 组合外部 signal 与超时 AbortController，返回统一的 signal 与清理函数
async function withTimeout(signal, maxWaitMs) {
  if (typeof AbortController === 'undefined') return { signal, cleanup: () => {} }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), maxWaitMs || 60000)
  const useAny = typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function'
  const combined = useAny
    ? AbortSignal.any([...(signal ? [signal] : []), ctrl.signal])
    : (signal || ctrl.signal)
  return { signal: combined, cleanup: () => clearTimeout(timer) }
}

// 流式对话：OpenAI 兼容 SSE，逐字回调 onDelta(deltaText)，返回完整文本
// maxTokens：输出上限，完整报告类需要 4000+ 才能写完
export async function chatLLMStream({ cfg, messages, signal, onDelta, maxTokens = 1200, idleTimeoutMs = 60000 }) {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
  // ⚠ 这里原先直接把外部 signal 交给 fetch，没有任何超时：上游一旦挂起不返回，
  // 这个 Promise 永远不 settle，调用方的 typing 状态解不掉，输入框被永久禁用，
  // 用户只能刷新页面。改为「静默超时」——只要还在吐字就续期，卡住才中断。
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timer = null
  const arm = () => {
    if (!ctrl) return
    clearTimeout(timer)
    timer = setTimeout(() => ctrl.abort(), idleTimeoutMs)
  }
  const disarm = () => clearTimeout(timer)
  const useAny = ctrl && typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function'
  const combinedSignal = ctrl
    ? (useAny ? AbortSignal.any([...(signal ? [signal] : []), ctrl.signal]) : (signal || ctrl.signal))
    : signal
  arm()

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.85,
        max_tokens: maxTokens,
        stream: true
      }),
      signal: combinedSignal
    })
  } catch (e) {
    disarm()
    if (ctrl && ctrl.signal.aborted && !(signal && signal.aborted)) {
      throw new Error(`模型 ${Math.round(idleTimeoutMs / 1000)} 秒无响应，已中断`)
    }
    throw e
  }
  if (!res.ok || !res.body) {
    disarm()
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message || JSON.stringify(j).slice(0, 160)
    } catch { /* ignore */ }
    throw new Error(`请求失败（${res.status}）${detail ? '：' + detail : ''}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  let full = ''
  try {
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    arm() // 收到数据 → 续期
    buf += decoder.decode(value, { stream: true })
    // 按 SSE 事件块切分
    const blocks = buf.split('\n\n')
    buf = blocks.pop()
    for (const block of blocks) {
      const line = block.split('\n').find(l => l.startsWith('data:'))
      if (!line) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let json
      try { json = JSON.parse(payload) } catch { continue }
      const delta = json?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) {
        full += delta
        if (onDelta) onDelta(delta)
      }
    }
  }
  } catch (e) {
    if (ctrl && ctrl.signal.aborted && !(signal && signal.aborted)) {
      // 已经吐了一半再卡住：把已有内容交回去，好过整段丢弃
      if (full.trim()) return full.trim()
      throw new Error(`模型 ${Math.round(idleTimeoutMs / 1000)} 秒无响应，已中断`)
    }
    throw e
  } finally {
    disarm()
  }
  if (!full.trim()) throw new Error('模型未返回内容')
  return full.trim()
}

// 带工具调用（function calling）的 Agent 版对话
// runTool(name, args) 需返回工具结果字符串；返回 { text, toolCalls }
// onDelta(deltaText)：可选，流式输出最终回答文本（仅纯文本轮次触发，工具调用轮不触发）。
// stream：可选，默认 true（流式，用户可即时看到回复）；设为 false 则非流式。
// onToolCall：可选，仅在工具调用轮触发，签名 () => void —— SSE 首个 tool_calls 出现时回调，
//             用于让调用方清空"调用工具前的客套话"流式气泡（避免与最终答案气泡重复出现两个思考块）
export async function chatLLMTools({ cfg, messages, tools, runTool, signal, maxRounds = 3, onDelta, onToolCall, stream = true, maxWaitMs = 90000, maxTokens = 1000 }) {
  if (!runTool) throw new Error('缺少 runTool 回调')
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
  const msgs = messages.map(m => ({ ...m }))
  const toolCallsLog = []

  // 请求超时：避免模型/网络卡死导致用户无限等待
  const timeoutSignal = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timer = null
  if (timeoutSignal) {
    timer = setTimeout(() => timeoutSignal.abort(), maxWaitMs)
  }
  const combinedSignal = (signal || timeoutSignal) && typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([...(signal ? [signal] : []), ...(timeoutSignal ? [timeoutSignal.signal] : [])])
    : (signal || (timeoutSignal ? timeoutSignal.signal : undefined))
  const cleanup = () => { if (timer) { clearTimeout(timer); timer = null } }

  try {
    for (let round = 0; round < maxRounds; round++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: msgs,
          tools,
          temperature: 0.85,
          max_tokens: maxTokens,
          stream: !!onDelta && stream
        }),
        signal: combinedSignal
      })
      if (!res.ok) {
        let detail = ''
        try {
          const j = await res.json()
          detail = j?.error?.message || JSON.stringify(j).slice(0, 160)
        } catch { /* ignore */ }
        throw new Error(`请求失败（${res.status}）${detail ? '：' + detail : ''}`)
      }

      let msg
      if (onDelta && stream) {
        msg = await streamReadMessage(res, onDelta, onToolCall)
      } else {
        const data = await res.json()
        msg = data?.choices?.[0]?.message
      }
      if (!msg) throw new Error('模型未返回内容')

      const calls = msg.tool_calls || []
      if (!calls.length) {
        const text = (msg.content || '').trim()
        if (!text) throw new Error('模型未返回内容')
        return { text, toolCalls: toolCallsLog }
      }

      // 工具调用轮：把 assistant 消息回传（含累积的 tool_calls），并逐条执行
      msgs.push(msg)
      for (const call of calls) {
        let name = '', args = {}
        try {
          const fn = call.function || {}
          name = fn.name || ''
          args = fn.arguments ? JSON.parse(fn.arguments) : {}
        } catch { args = {} }
        let result
        try {
          result = await runTool(name, args)
        } catch (e) {
          result = `工具执行失败：${e.message || e}`
        }
        toolCallsLog.push({ name, args })
        msgs.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    }
    throw new Error(`工具调用超过 ${maxRounds} 轮仍未完成`)
  } finally {
    cleanup()
  }
}

// 流式读取一条 assistant 消息：累积 content 与 tool_calls（SSE 分片）
// 仅返回最终无 tool_calls 轮次的 content 会通过 onDelta 输出；工具调用轮的 content 不触发 onDelta
// onToolCall 钩子：SSE 中首个 tool_calls delta 出现时一次性回调，用于让调用方清空"前置话术"流式气泡
async function streamReadMessage(res, onDelta, onToolCall) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  let content = ''
  let toolCalls = [] // 累积的分片
  let toolCallSignaled = false // 是否已触发过 onToolCall
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const blocks = buf.split('\n\n')
    buf = blocks.pop()
    for (const block of blocks) {
      const line = block.split('\n').find(l => l.startsWith('data:'))
      if (!line) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let json
      try { json = JSON.parse(payload) } catch { continue }
      const delta = json?.choices?.[0]?.delta
      if (!delta) continue
      if (typeof delta.content === 'string' && delta.content) {
        content += delta.content
        // 仅在尚未出现工具调用时输出文本流（工具轮的前置话语不当作最终答案展示）
        if (!toolCalls.length) onDelta(delta.content)
      }
      if (Array.isArray(delta.tool_calls) && delta.tool_calls.length) {
        if (!toolCallSignaled) {
          toolCallSignaled = true
          // 触发钩子，让调用方清空已推送的"前置话术"流式气泡
          try { onToolCall && onToolCall() } catch (e) { /* 不影响主流程 */ }
        }
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          const fn = tc.function || {}
          toolCalls[idx] = toolCalls[idx] || { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } }
          if (fn.name) toolCalls[idx].function.name += fn.name
          if (fn.arguments) toolCalls[idx].function.arguments += fn.arguments
        }
      }
    }
  }
  // ⚠ 必须带 role。这个对象会被原样 push 回 msgs 作为下一轮请求的历史，
  // OpenAI 兼容接口要求每条消息都有 role —— 缺了它，凡是走「流式 + 工具调用」
  // 的第二轮请求一律被服务端拒绝（非流式分支从 API 拿到的 message 自带 role，
  // 所以这个 bug 只在开了流式时出现）。
  return { role: 'assistant', content, tool_calls: toolCalls.filter(Boolean) }
}

// 测试连接
export async function testLLM(cfg) {
  const started = Date.now()
  const text = await chatLLM({
    cfg,
    messages: [
      { role: 'system', content: '你是一个玄学助手，用一句话自我介绍即可。' },
      { role: 'user', content: '你好，请回复"连接成功"。' }
    ]
  })
  return { ok: true, ms: Date.now() - started, preview: text.slice(0, 80) }
}
