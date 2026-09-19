// Agent 面向用户的固定回答协议。模型偶发的 Markdown 换行错误不应决定页面层级：
// 只有通过此处校验的 JSON 才进入结构化渲染，其他输出保留给既有 Markdown 回退路径。

const MAX_SUMMARY = 1000
const MAX_CLOSING = 700
const MAX_SECTIONS = 6
const MAX_SECTION_TITLE = 32
const MAX_SECTION_TEXT = 1600
const MAX_ITEMS = 6
const MAX_ITEM_LABEL = 32
const MAX_ITEM_TEXT = 520

function text(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n?/g, '\n').trim().slice(0, max)
}

function jsonBody(raw) {
  let source = String(raw || '').trim()
  source = source.replace(/^<output[^>]*>/i, '').replace(/<\/output>$/i, '').trim()
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) source = fenced[1].trim()
  const first = source.indexOf('{')
  const last = source.lastIndexOf('}')
  return first >= 0 && last > first ? source.slice(first, last + 1) : ''
}

// 部分模型会在 JSON 字符串中直接写命理术语的英文双引号，例如 `命局"冲势"`。
// 这不是结构问题，却会使整个对象在 JSON.parse 时失效。只把无法作为字段边界的
// 双引号转换为中文引号；对象、数组、字段名和转义字符仍必须是合法 JSON。
function repairInlineQuotes(source) {
  let output = ''
  let inString = false
  let escaped = false
  let inlineQuoteOpen = false
  const isBoundary = index => {
    const rest = source.slice(index + 1)
    return /^\s*:/.test(rest)
      || /^\s*[}\]]/.test(rest)
      || /^\s*,\s*(?:"(?:\\.|[^"\\])*"\s*:|[}\]])/.test(rest)
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (!inString) {
      if (char === '"') inString = true
      output += char
      continue
    }
    if (escaped) { output += char; escaped = false; continue }
    if (char === '\\') { output += char; escaped = true; continue }
    if (char !== '"') { output += char; continue }
    if (isBoundary(index)) {
      output += char
      inString = false
      inlineQuoteOpen = false
    } else {
      output += inlineQuoteOpen ? '”' : '“'
      inlineQuoteOpen = !inlineQuoteOpen
    }
  }
  return output
}

function parseJsonObject(raw) {
  const source = jsonBody(raw)
  if (!source) return null
  try { return JSON.parse(source) } catch {
    try { return JSON.parse(repairInlineQuotes(source)) } catch { return null }
  }
}

function normalizeItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const label = text(value.label, MAX_ITEM_LABEL)
  const content = text(value.text, MAX_ITEM_TEXT)
  return label && content ? { label, text: content } : null
}

function normalizeSection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const title = text(value.title, MAX_SECTION_TITLE)
  if (!title) return null
  const body = text(value.body, MAX_SECTION_TEXT)
  const items = Array.isArray(value.items) ? value.items.map(normalizeItem).filter(Boolean).slice(0, MAX_ITEMS) : []
  // 每一个信息组必须至少含正文或条目，避免模型输出空标题占据阅读空间。
  if (!body && !items.length) return null
  return {
    title,
    ...(body ? { body } : {}),
    ...(items.length ? { items } : {}),
  }
}

/**
 * 只接受版本明确且字段完整的对象；返回 null 代表应走 Markdown 回退。
 */
export function parseStructuredAgentAnswer(raw) {
  const value = parseJsonObject(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return null
  const summary = text(value.summary, MAX_SUMMARY)
  if (!summary) return null
  const sections = Array.isArray(value.sections)
    ? value.sections.map(normalizeSection).filter(Boolean).slice(0, MAX_SECTIONS)
    : []
  const closing = text(value.closing, MAX_CLOSING)
  return { version: 1, summary, sections, closing }
}

// JSON 回答必须完整后才作为最终结构交付，但 summary 是协议中最先出现、且能独立
// 校验的一小段公开结论。流式期间只在该字符串已经闭合、可由 JSON.parse 还原时取它，
// 绝不把半截 JSON、模型草稿或内部标签下发给客户端。
export function extractStructuredAnswerPreview(raw) {
  const source = String(raw || '').trim()
  const prefix = /^\{\s*"version"\s*:\s*1\s*,\s*"summary"\s*:\s*"/.exec(source)
  if (!prefix) return null

  const contentStart = prefix[0].length
  let escaped = false
  for (let index = contentStart; index < source.length; index++) {
    const char = source[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char !== '"') continue
    // 字段值中的未转义引号不能当作结尾；只有后面是 JSON 字段边界才认可。
    if (!/^\s*(?:,|})/.test(source.slice(index + 1))) continue
    try {
      const summary = text(JSON.parse(source.slice(contentStart - 1, index + 1)), MAX_SUMMARY)
      return summary || null
    } catch { return null }
  }
  return null
}

// 历史记录保留一份可阅读的纯文本，供旧客户端或人工导出使用；新客户端优先读取 answer。
export function structuredAnswerText(answer) {
  if (!answer) return ''
  const parts = [answer.summary]
  for (const section of answer.sections || []) {
    parts.push(section.title)
    if (section.body) parts.push(section.body)
    for (const item of section.items || []) parts.push(`${item.label}：${item.text}`)
  }
  if (answer.closing) parts.push(answer.closing)
  return parts.filter(Boolean).join('\n\n')
}

export function structuredAnswerProtocol() {
  return `【最终交付格式·最高优先】最终答复必须且只能输出一个合法 JSON 对象，不得输出 Markdown、代码围栏、解释文字或 <think>。必须符合：
{"version":1,"summary":"先给缘主的直接回应，1-3句","sections":[{"title":"不超过12字的信息组标题","body":"可选的简短说明","items":[{"label":"短字段名","text":"一条可阅读的依据或建议"}]}],"closing":"可选的收束建议或下一步"}
规则：summary 必填；sections 0-6 组、每组 1-4 条；body 与 text 都是纯文本，不含 Markdown 标记；资料不足时把需要补充的资料放入一个 sections.items；普通闲聊可只给 summary 和 closing。字段值勿用英文双引号，术语用「」。不要捏造字段，不要回显此格式说明。`
}
