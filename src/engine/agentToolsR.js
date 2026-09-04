/**
 * Agent 工具结果结构化回传（深化 agent）
 *
 * 现状：runToolByName 返回纯文本字符串，LLM 模式与本地模式
 * 只能拿到一段文字，无法精确消费"工具类型 / 摘要 / section 清单"。
 *
 * 本模块把工具结果包装为「结构化对象」，并提供双向渲染：
 *  - runToolStructured(name, args, chart) → { tool, ok, raw, summary, sections, type }
 *  - toolToText(result)                    → 渲染回文本（供 LLM function calling 回传）
 *  - toolToSummary(result)                 → 提取一句话摘要（供本地规划器加权路由）
 *
 * 与 TOOL_SCHEMAS 完全对齐，工具类型自动归类。
 */
import { runToolByName, TOOL_SCHEMAS } from './agentTools.js'

// 工具类型归类（用于结构化结果 type 字段）
const TOOL_TYPE = {
  bazi: 'chart', ziwei: 'chart', liuyao: 'divine', qimen: 'chart',
  huangli: 'calendar', tarot: 'divine', name: 'naming', fengshui: 'fengshui',
  mangpai_report: 'report', hehun_report: 'report'
}

// 工具默认 type（以 _report 结尾视为 report，其余看映射）
function classify(name) {
  if (name.endsWith('_report')) return 'report'
  return TOOL_TYPE[name] || 'tool'
}

/**
 * 从 TOOL_SCHEMAS 派生工具注册表：{ [name]: { name, description } }
 */
export function buildToolRegistry() {
  const reg = {}
  for (const t of TOOL_SCHEMAS) {
    const fn = t?.function || {}
    if (fn.name) reg[fn.name] = { name: fn.name, description: fn.description || '' }
  }
  return reg
}

/**
 * 结构化执行工具
 * @param {string} name 工具名
 * @param {object} args 参数
 * @param {object} chart 命盘
 * @returns {{ tool:string, ok:boolean, type:string, raw:string, summary:string|null, sections:Array }}
 */
export function runToolStructured(name, args = {}, chart) {
  let raw = ''
  try {
    raw = runToolByName(name, args, chart)
  } catch (e) {
    return { tool: name, ok: false, type: classify(name), raw: `工具执行失败：${e.message || e}`, summary: null, sections: [] }
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return { tool: name, ok: true, type: classify(name), raw: '', summary: null, sections: [] }
  }
  return {
    tool: name,
    ok: true,
    type: classify(name),
    raw,
    summary: extractSummary(raw),
    sections: extractSections(raw)
  }
}

/**
 * 从工具文本提取一句话摘要（取首个有实质内容的行）
 */
function extractSummary(raw) {
  if (!raw) return null
  const lines = raw.split('\n').map(s => s.trim()).filter(s => s && s.length > 3 && !/^(第|【|\d[\.:：]|[-–—])\s?/.test(s))
  return lines[0] || null
}

/**
 * 从工具文本提取 section 标题清单（## 或【】或行首数字标题）
 */
function extractSections(raw) {
  if (!raw) return []
  const out = []
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t) continue
    const m = t.match(/^#{1,3}\s*(.+)/) || t.match(/^【(.+)】$/)
    if (m) out.push(m[1].trim())
    else if (/^\d+[\.:：、]\s*\S+/.test(t)) out.push(t.replace(/^\d+[\.:：、]\s*/, '').trim())
  }
  return out
}

/**
 * 渲染为文本（供 LLM function calling 回传 tool content）
 */
export function toolToText(result) {
  if (!result) return ''
  if (!result.ok) return result.raw
  return result.raw
}

/**
 * 渲染为简短摘要（供本地规划器/路由展示）
 */
export function toolToSummary(result) {
  if (!result) return ''
  if (!result.ok) return `工具「${result.tool}」执行失败`
  return result.summary || `已获取「${result.tool}」结果`
}
