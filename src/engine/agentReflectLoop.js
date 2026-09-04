/**
 * Agent LLM 自动反思循环（深化 agent）
 *
 * 借鉴 ReAct 反思（Self-Correction）最佳实践：LLM 输出后自动自检，
 * 若命中 SAFE 红线（宿命断言 / 医疗越界 / 祛灾敛财 / 绝对化断言），
 * 自动构造「修正指令」让 LLM 重写，最多重试 N 次，直到输出通过。
 *
 * 能力：
 *  - chatLLMReflective()：带反思循环的非流式 LLM 对话
 *  - reflectOnce()       ：单次"输出→自检→(越界则重写)"循环
 *  - buildRewriteMsg()   ：构造修正指令消息
 *
 * 与本地反思层（agentReflect.js）互补：
 *  - agentReflect.js：本地规则，回答后追加温和 banner（不重写）
 *  - 本模块         ：LLM 模式，越界时让模型自行重写（更彻底）
 */
import { scanRedLine, sanitize } from './safeGuard.js'
import { chatLLM } from './llm.js'

const REDLINE_REWRITE_PROMPT = `你刚才的回答中，出现了不符合命理测算规范的内容：{labels}。

请严格遵守以下红线后重写你的回答（保留原有实质内容，只修正措辞）：
1. 不输出"注定 / 短命 / 克夫克妻 / 必死"等宿命恐吓，改为"命理上倾向 / 趋势上倾向于"；
2. 不进行医疗诊断，健康内容改为"建议以正规体检为准"；
3. 不推销任何"付费改命 / 消灾"服务；
4. 不用"百分之百 / 必定 / 绝对"等绝对化断言，保留变数空间。
请直接输出重写后的完整回答，不要任何额外说明。`

/**
 * 构造修正指令消息（追加到 messages）
 */
export function buildRewriteMsg(hits) {
  const labels = hits.map(h => `「${h.label}」`).join('、')
  return { role: 'user', content: REDLINE_REWRITE_PROMPT.replace('{labels}', labels) }
}

/**
 * 单次反思循环：调用 chatLLM → 自检 → 越界则重写
 * @param {object} opts { cfg, messages, signal, maxRetries }
 * @returns {Promise<{text, hits, retried, sanitized}>}
 */
export async function chatLLMReflective({ cfg, messages, signal, maxRetries = 2 }) {
  let msgs = messages.map(m => ({ ...m }))
  let retried = 0
  let lastHits = []

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const text = await chatLLM({ cfg, messages: msgs, signal })
    lastHits = scanRedLine(text)

    if (lastHits.length === 0) {
      // 通过：返回（若存在已 sanitize 的痕迹则说明重写过）
      return { text, hits: [], retried, sanitized: false }
    }

    // 命中红线：记录并追加修正指令
    if (attempt < maxRetries) {
      msgs = [...msgs, { role: 'assistant', content: text }, buildRewriteMsg(lastHits)]
      retried++
      continue
    }
  }

  // 达到重试上限仍未通过：降级为 sanitize 硬净化，保证输出安全
  const fallback = sanitize(msgs[msgs.length - 1].content || '')
  return { text: fallback, hits: lastHits, retried, sanitized: true }
}

/**
 * 纯检查辅助：返回文本命中的红线（供 UI 展示）
 */
export function reflectLLMCheck(text) {
  return scanRedLine(text)
}
