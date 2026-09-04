// 轻量 Markdown 解析器（仅支持：表格、列表、粗体、段落、换行）
// 用于在聊天气泡 / 报告卡片里把 AI 输出的 markdown 文本转成结构化块，
// 让" 方向 | 为何适合你 | 关键行动 "这种 markdown 表格渲染成真正的 HTML 表格。

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 行内：把 **xxx** 渲染为 <strong>xxx</strong>，并保留其它文本
function inline(text) {
  const safe = escapeHtml(text)
  // **粗体**
  return safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

// 检测一行是否是 markdown 表格分隔行（|---|---| 或 |:---:| 等）
function isTableSep(line) {
  const t = line.trim()
  if (!/^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(t)) return false
  // 必须有至少 1 个 | ，且全是 - 和 :
  return /\|/.test(t)
}

// 拆分一行成单元格（首尾的 | 允许省略）
function splitCells(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map(c => c.trim())
}

/**
 * 解析 markdown 文本为 React 元素数组
 * @param {string} text
 * @returns {Array<{type:string, ...props}>}
 *   type: 'table' | 'list' | 'p' | 'h' | 'blank'
 */
export function parseMarkdown(text) {
  const lines = String(text || '').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 空行：跳过，作为段落分隔
    if (!trimmed) { i += 1; continue }

    // 表格：表头 | 分隔行 | 数据行
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = splitCells(line)
      i += 2 // 跳过分隔行
      const rows = []
      while (i < lines.length) {
        const r = lines[i]
        if (!r.includes('|') || !r.trim()) break
        rows.push(splitCells(r))
        i += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    // 列表（- 或 * 或 • 开头）
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = []
      while (i < lines.length) {
        const t = lines[i].trim()
        if (!/^[-*•]\s+/.test(t)) break
        items.push(t.replace(/^[-*•]\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'list', items })
      continue
    }

    // 标题（# / ## / ###）
    const hMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (hMatch) {
      blocks.push({ type: 'h', level: hMatch[1].length, text: hMatch[2] })
      i += 1
      continue
    }

    // 段落：合并连续非空行
    const paraLines = []
    while (i < lines.length) {
      const t = lines[i]
      const ts = t.trim()
      if (!ts) break
      if (ts.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) break
      if (/^[-*•]\s+/.test(ts)) break
      if (/^#{1,3}\s+/.test(ts)) break
      paraLines.push(t)
      i += 1
    }
    blocks.push({ type: 'p', text: paraLines.join('\n') })
  }
  return blocks
}

// 把 parseMarkdown 结果渲染成 React 元素数组（不引入额外依赖）
// 必须从 React 文件调用以获取 JSX
import React from 'react'
export function renderMarkdown(text) {
  const blocks = parseMarkdown(text)
  return blocks.map((b, i) => {
    if (b.type === 'table') {
      return (
        <div className="md-table-wrap" key={`md-${i}`}>
          <table className="md-table">
            <thead>
              <tr>{b.headers.map((h, j) => <th key={j} dangerouslySetInnerHTML={{ __html: inline(h) }} />)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} dangerouslySetInnerHTML={{ __html: inline(c) }} />)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    if (b.type === 'list') {
      return (
        <ul className="md-list" key={`md-${i}`}>
          {b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inline(it) }} />)}
        </ul>
      )
    }
    if (b.type === 'h') {
      const Tag = `h${Math.min(b.level + 2, 4)}` // 报告里 H3 起，避免过大
      return <Tag key={`md-${i}`} className="md-h" dangerouslySetInnerHTML={{ __html: inline(b.text) }} />
    }
    // paragraph：把换行保留
    return <p key={`md-${i}`} className="md-p" dangerouslySetInnerHTML={{ __html: inline(b.text).replace(/\n/g, '<br/>') }} />
  })
}
