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
  // 兼容模型偶发写出的 `---## 标题`：分隔符不是面向用户的内容，
  // 去掉后仍按标题呈现，避免把 Markdown 残留直接显示在聊天里。
  const source = String(line || '').trim().replace(/^(?:[-—─]{3,}\s*)+(?=#{1,3}\s*\S)/, '')
  const m = /^(#{1,3})\s*(\S(?:.*\S)?)\s*$/.exec(source)
  return m ? { level: m[1].length, text: m[2] } : null
}

// Agent 的统一文案规范使用独占一行的 **短标题**，而不是 # 标题。
// 将这类短标题交给同一套标题样式，保留 **字段**：内容 的行内强调语义。
function boldHeadingOf(line) {
  const m = /^\*\*([^*\n]{1,24})\*\*$/.exec(String(line || '').trim())
  if (!m) return null
  const text = m[1].trim()
  if (!text || /[：:。！？!?]$/.test(text)) return null
  return { level: 3, text }
}

// 某些流式网关会把模型 Markdown 的换行压成空串。此时原本的
// `**标题**\n- **字段**：内容` 会变成一整段，浏览器无法恢复列表层级。
// 标题与条目可能在同一段的不同位置粘连，逐处修复，不因前面已有换行而放弃后文。
function restoreCollapsedAgentLayout(text) {
  let source = String(text || '').replace(/\r\n?/g, '\n')
  source = source
    .replace(/([^\n])\s*(?:---+|\*\*\*+|___+)\s*(?=#{1,3}\s+\S)/g, '$1\n\n')
    .replace(/([^\n])\s*(#{2,3}\s+\S)/g, '$1\n\n$2')
    // 结论、建议等是完整信息组，不应粘在盘面核对或最后一条依据之后。
    // 仅处理前方已有句末标点的情形，四柱、日主、当前大运等行内字段保持紧凑。
    .replace(/([。！？])\s*\*\*(结论|建议|行动建议|风险提示|提醒)\*\*[：:]\s*/g, '$1\n\n**$2**\n')
    // 有些回复虽然另起了行，却仍把“建议”写成一个列表项或标题后紧跟正文；
    // 统一还原为独占标题，保证建议内容从下一行开始。
    .replace(/(^|\n)\s*(?:[-*•]\s+)?\*\*(结论|建议|行动建议|风险提示|提醒)\*\*[：:]\s*/g, '$1**$2**\n')
    // 资料收集经常被模型压成“请告诉我：- 字段 - 字段”。恢复为真正的列表；
    // 括号、句末后紧接的下一字段同样属于新条目。
    .replace(/([：:])\s*-\s*(?=\*\*[^*\n]{1,24}\*\*)/g, '$1\n- ')
    .replace(/([）)】。；！？])\s*-\s*(?=\*\*[^*\n]{1,24}\*\*)/g, '$1\n- ')
    // “**性别**有了这两项”里的说明不属于字段本身，应从清单后另起段落。
    .replace(/(\*\*[^*\n]{1,24}\*\*)(?=(?:有了这|提供这些|补充这些|以上资料))/g, '$1\n\n')
    // 没有换行的自然咨询按逻辑转折分成短段，保留对话感而不制造标题。
    .replace(/([。！？])(?=(?:不过|但是|然而|请(?:告诉|补充|提供|确认)|若|如果|有了|另外|同时|也可以|也可))/g, '$1\n\n')

  // 紧接在上一段结尾的无冒号短加粗词，是下一组的独占标题。
  source = source.replace(/([^\n])(\*\*[^*：:\n]{1,24}\*\*)(?=-)/g, '$1\n\n$2')
  // 每个独占标题之后先断行；随后将 `-**字段**：` 恢复为标准列表项。
  source = source.replace(/(\*\*[^*\n]{1,160}\*\*)(?=-)/g, '$1\n')
  source = source.replace(/-(?=\*\*[^*\n]{1,24}\*\*[：:])/g, '\n- ')
  // 无加粗字段的建议条目同样经常被压在上一个句号后。
  source = source.replace(/([。；！？])-(?=[\u4e00-\u9fff])/g, '$1\n- ')
  source = source.replace(/(^|\n)-(?=[^\s])/g, '$1- ')
  return source
}

/**
 * 解析 markdown 文本为 React 元素数组
 * @param {string} text
 * @returns {Array<{type:string, ...props}>}
 *   type: 'table' | 'list' | 'p' | 'h' | 'hr' | 'blank'
 */
export function parseMarkdown(text) {
  const lines = restoreCollapsedAgentLayout(text).split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 空行：跳过，作为段落分隔
    if (!trimmed) { i += 1; continue }

    // 分隔线：长回复用它切开“解释”和“方案/建议”，避免信息一直堆在同一段里。
    if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

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

    // 无序列表（- 或 * 或 • 开头）
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

    // 新版 Agent 回复以 **短标题** 建立信息组。若当作普通段落处理，
    // 标题和其后的要点会挤在同一个文本块内，阅读层级会丢失。
    const boldHeading = boldHeadingOf(trimmed)
    if (boldHeading) {
      blocks.push({ type: 'h', ...boldHeading })
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
      if (boldHeadingOf(ts)) break
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
  if (b.type === 'hr') return <hr className="md-divider" key={`md-${i}`} />
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
