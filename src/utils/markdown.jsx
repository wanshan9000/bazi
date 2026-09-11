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

// 模型偶尔会把两行表格粘成 `... || **下一项** | ...`。
// 这不是空单元格：下一项以加粗标签重新起头，按行恢复后才不会把内容挤进一格。
function splitTableRows(line, width) {
  const repaired = String(line || '').replace(/\|\|\s*(?=\*\*[^*]+\*\*)/g, '|\n|')
  const rows = []
  for (const source of repaired.split('\n')) {
    const cells = splitCells(source)
    // 兜底：表格列数异常时按表头宽度分段，宁可多一行，也不把长内容压成竖排。
    for (let start = 0; start < cells.length; start += width) {
      const row = cells.slice(start, start + width)
      while (row.length < width) row.push('')
      rows.push(row)
    }
  }
  return rows
}

function headingOf(line) {
  const m = /^(#{1,3})\s*(\S(?:.*\S)?)\s*$/.exec(String(line || '').trim())
  return m ? { level: m[1].length, text: m[2] } : null
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

    // 模型有时把「## 二、标题」和表头写在同一行：
    // `## 二、标题 | 项目 | 状态 | 说明 |`。先拆出标题，再按其余单元格建表，
    // 让既有历史会话也能正常阅读。
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const cells = splitCells(line)
      const heading = headingOf(cells[0])
      if (heading && cells.length > 1) {
        blocks.push({ type: 'h', ...heading })
        const headers = cells.slice(1)
        i += 2
        const rows = []
        while (i < lines.length) {
          const r = lines[i]
          if (!r.includes('|') || !r.trim()) break
          rows.push(...splitTableRows(r, headers.length))
          i += 1
        }
        blocks.push({ type: 'table', headers, rows })
        continue
      }
    }

    // 表格：表头 | 分隔行 | 数据行
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = splitCells(line)
      i += 2 // 跳过分隔行
      const rows = []
      while (i < lines.length) {
        const r = lines[i]
        if (!r.includes('|') || !r.trim()) break
        rows.push(...splitTableRows(r, headers.length))
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
    const heading = headingOf(trimmed)
    if (heading) {
      blocks.push({ type: 'h', ...heading })
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
      if (headingOf(ts)) break
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
function renderMarkdownBlock(b, i) {
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
}

export function renderMarkdown(text, { variant = 'default' } = {}) {
  const blocks = parseMarkdown(text)
  if (variant !== 'agent-report') return blocks.map(renderMarkdownBlock)

  const nodes = []
  for (let i = 0; i < blocks.length;) {
    const block = blocks[i]
    if (block.type !== 'h' || block.level !== 2) {
      nodes.push(renderMarkdownBlock(block, i))
      i += 1
      continue
    }
    const content = []
    let j = i + 1
    while (j < blocks.length && !(blocks[j].type === 'h' && blocks[j].level <= 2)) {
      content.push(renderMarkdownBlock(blocks[j], j))
      j += 1
    }
    nodes.push(
      <section className="agent-report-section" key={`section-${i}`}>
        <div className="agent-report-section-head">
          <span className="agent-report-section-index">命书 · {String(nodes.filter(node => node?.type === 'section').length + 1).padStart(2, '0')}</span>
          <h4 className="agent-report-section-title" dangerouslySetInnerHTML={{ __html: inline(block.text) }} />
        </div>
        <div className="agent-report-section-body">{content}</div>
      </section>
    )
    i = j
  }
  return nodes
}
