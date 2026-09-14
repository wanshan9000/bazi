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
  let value
  try { value = JSON.parse(jsonBody(raw)) } catch { return null }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return null
  const summary = text(value.summary, MAX_SUMMARY)
  if (!summary) return null
  const sections = Array.isArray(value.sections)
    ? value.sections.map(normalizeSection).filter(Boolean).slice(0, MAX_SECTIONS)
    : []
  const closing = text(value.closing, MAX_CLOSING)
  return { version: 1, summary, sections, closing }
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
规则：summary 必填；sections 0-6 组、每组 1-4 条；body 与 text 都是纯文本，不含 Markdown 标记；资料不足时把需要补充的资料放入一个 sections.items；普通闲聊可只给 summary 和 closing。不要捏造字段，不要回显此格式说明。`
}
