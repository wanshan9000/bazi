import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { renderMarkdown } from '../../utils/markdown.jsx'

export function isNearScrollBottom(element, threshold = 32) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
}

// ── 反馈按钮（👍有用 / 👎不对）→ 技能进化信号源。仅用于测算报告 / 测算论断 ──
export function FeedbackBar({ msgId, fb, on, report }) {
  return (
    <div className={`msg-feedback ${report ? 'msg-fb-report' : ''}`}>
      <button
        className={`fb-btn ${fb[msgId] === 'up' ? 'on' : ''}`}
        title="论断有用"
        onClick={() => on(msgId, 'up')}
      >👍</button>
      <button
        className={`fb-btn ${fb[msgId] === 'down' ? 'on' : ''}`}
        title="论断不对 / 没解决"
        onClick={() => on(msgId, 'down')}
      >👎</button>
    </div>
  )
}

// ── 复制按钮：一键复制关键测试结果 / 测算论断全文 ──
export function CopyButton({ text, title = '复制结果' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    const content = String(text || '')
    try {
      await navigator.clipboard.writeText(content)
    } catch (e) {
      // 兼容非安全上下文：回退到临时 textarea
      const ta = document.createElement('textarea')
      ta.value = content
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch (_) {}
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} title={title} onClick={handleCopy}>
      {copied ? '✓ 已复制' : '⧉'}
    </button>
  )
}

// ── AI 解读进度：回复中的 <think>…</think> 默认收起为一行（点击展开看阶段记录） ────
// 还没有正文时可暂时展开显示进度；正文一开始流式出现就立刻收起，把首屏留给答案。
export function ThinkBlock({ content, streaming = false, collapseWhenStreamingText = false }) {
  // 流式中默认展开；开始出正文或结束时收起，让结论成为视觉焦点。
  const [open, setOpen] = useState(streaming)
  const [elapsed, setElapsed] = useState(0)
  const bodyRef = useRef(null)
  const startedAtRef = useRef(streaming ? Date.now() : null)
  const wasStreamingRef = useRef(streaming)
  useEffect(() => {
    if (!streaming) {
      if (startedAtRef.current) setElapsed(Math.max(1, Math.ceil((Date.now() - startedAtRef.current) / 1000)))
      return undefined
    }
    if (!startedAtRef.current) startedAtRef.current = Date.now()
    const updateElapsed = () => setElapsed(Math.max(1, Math.ceil((Date.now() - startedAtRef.current) / 1000)))
    updateElapsed()
    const timer = setInterval(updateElapsed, 1000)
    return () => clearInterval(timer)
  }, [streaming])
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [content, open])
  useEffect(() => {
    if (!streaming && wasStreamingRef.current) setOpen(false)
    wasStreamingRef.current = streaming
  }, [streaming])
  // layout effect 保证正文首次出现的同一帧就折叠，不会先闪出一帧大块思考内容。
  // 依赖只在 false → true 时变化，之后用户手动展开不会被每个 SSE chunk 强行收回。
  useLayoutEffect(() => {
    if (collapseWhenStreamingText) setOpen(false)
  }, [collapseWhenStreamingText])
  const label = streaming ? `解读中 · ${Math.max(1, elapsed)} 秒` : elapsed ? `解读完成 · ${elapsed} 秒` : '解读进度'
  const steps = String(content || '').split('\n').map(item => item.trim()).filter(Boolean)
  return (
    <div className={`think-block ${open ? 'open' : ''} ${streaming ? 'think-streaming' : ''}`}>
      <button className="think-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="think-arrow" aria-hidden="true">›</span>
        <span className="think-icon" aria-hidden="true">✦</span>
        <span className="think-label">{label}</span>
        {streaming && <span className="think-status" aria-label="正在思考" />}
      </button>
      {open && (
        <div className="think-body" ref={bodyRef}>
          {steps.length ? (
            <ol className="think-steps">
              {steps.map((step, index) => (
                <li key={`${index}-${step}`} className={streaming && index === steps.length - 1 ? 'is-current' : ''}>
                  <span className="think-step-index">{index + 1}</span><span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (streaming ? <span className="think-placeholder">正在准备解读…</span> : '')}
        </div>
      )}
    </div>
  )
}

// 模型正文里的 <think> 不是面向用户的解释：历史中已经出现过 Skill、工具调用和
// 内部工作流。无论来自旧会话还是新流，都只呈现稳定、可理解的进度语，正文结论不受影响。
const PUBLIC_THINK_CONTENT = '已完成命盘与要点核对。'
const AGENT_REPORT_HEADINGS = /(^|\n)##\s*(?:盘面核对|做功主线|根基与关系|当前大运|事业与关系|行动建议|格局法|用神法|结构与应期|主题判断|综合建议)(?=\s|$)/m

function publicThinkContent(content) {
  return String(content || '').trim() ? PUBLIC_THINK_CONTENT : ''
}

// 工具英文名 → 中文名。必须与 server/dsh/events.js 的 TOOL_NAME_CN 保持一致：
// 服务端在写入镜像时会把名字转成中文，而 SSE 的 tool_call 事件带的是英文原名。
// 前端不做同样的转换的话，实时对话里显示 "bazi"、刷新恢复历史后显示"八字排盘"，
// 同一件事两个样子。
export const TOOL_NAME_CN = {
  bazi: '八字排盘', ziwei: '紫微排盘', liuyao: '六爻起卦', qimen: '奇门排盘', huangli: '黄历查询',
  tarot: '塔罗抽牌', name: '姓名分析', fengshui: '风水分析', wuyunliuqi: '五运六气',
  report: '测算报告', skill: '加载技能',
}

// 工具调用：可折叠块，列出本次会话实际触发的工具（中文名 + 数量）
export function ToolCallsBlock({ names }) {
  const [open, setOpen] = useState(false)
  const list = String(names || '').split(/[、,，\s]+/).filter(Boolean)
  if (!list.length) return null
  return (
    <div className={`tool-block ${open ? 'open' : ''}`}>
      <button className="tool-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="tool-arrow" aria-hidden="true">›</span>
        <span className="tool-icon" aria-hidden="true">⚒</span>
        <span className="tool-label">调用了 {list.length} 个工具</span>
        <span className="tool-status" aria-label="调用完成" />
      </button>
      {open && (
        <div className="tool-body">
          {list.map((n, i) => (
            <div className="tool-item" key={`t${i}`}>
              <span className="tool-item-dot" />
              <span className="tool-item-name">{TOOL_NAME_CN[n] || n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 将 AI 文本按 <think>…</think> 拆分为普通段落与可折叠思考块
// 普通文本走 markdown 解析器（自动把  |列1|列2|  表格转成 HTML 表格）
// streaming=true：流式过程中默认展开思考块、自动跟随；并兼容未闭合的 <think>…（流式中常见）
export function renderAiText(text, streaming = false, { suppressThinkBlocks = false } = {}) {
  // 剥离模型流式返回时包裹的 <output>…</output> 标签（保留内容），避免 "&lt;output&gt;" 显示在页面上
  let raw = String(text || '')
  raw = raw.replace(/<\/?output[^>]*>/gi, '')
  // 有些模型会把 think 标签作为转义文本输出（&lt;think&gt;），或在标签内混入空格。
  // 统一还原为标准标签，确保它们都能复用同一种 ThinkBlock，而不是泄漏到正文里。
  raw = raw
    .replace(/&lt;\s*(\/?)\s*think\s*&gt;/gi, '<$1think>')
    .replace(/<\s*(\/?)\s*think\s*>/gi, '<$1think>')

  // 未闭合 think 不只会出现在流式中：少数模型在结束时漏掉 </think>。
  // 无论是否结束，都把最近的 <think> 到末尾归入折叠思考条，避免正文直接显示标签和推演。
  const lastOpen = raw.lastIndexOf('<think>')
  const lastClose = raw.lastIndexOf('</think>')
  if (lastOpen > lastClose) {
    const before = raw.slice(0, lastOpen)
    const thinkOpen = raw.slice(lastOpen + '<think>'.length)
    // key 与下方 split 分支保持一致，流式结束时不会因重挂而闪烁。
    const closedCount = (before.match(/<\/think>/g) || []).length
    const streamKey = `t${closedCount * 2 + 1}`
    return (
      <>
        {before && <div className="md-block">{renderMarkdown(before, { variant: AGENT_REPORT_HEADINGS.test(before) ? 'agent-report' : 'default' })}</div>}
        {!suppressThinkBlocks && <ThinkBlock key={streamKey} content={publicThinkContent(thinkOpen)} streaming={streaming} />}
      </>
    )
  }

  // 按 <think>…</think> 切分：思考块与结果正文分别渲染（思考块在固定高度窗口，正文在其下方）
  const parts = raw.split(/<think>([\s\S]*?)<\/think>/g)
  const nodes = []
  let prevThink = null
  let renderedThink = false
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // 防御：跳过与前一个思考块内容完全相同的块（部分模型会重复输出同一段推演，
      // 或收尾边界导致同文块出现两次），避免渲染出"两个一样的深度思考"
      if (prevThink !== null && String(part).trim() === String(prevThink).trim()) return
      prevThink = part
      // 一轮回复只应有一个解读过程。多段 <think> 常来自不同模型的边界切分；
      // 对用户而言它们仍是同一轮处理，重复渲染会变成一串没有信息增量的折叠条。
      if (!suppressThinkBlocks && !renderedThink) {
        renderedThink = true
        nodes.push(<ThinkBlock key={`t${i}`} content={publicThinkContent(part)} streaming={streaming} />)
      }
      return
    }
    // 剥离段落中残留的孤立 <think> / </think> 标签（模型可能输出残缺标签），避免显示在正文里
    const clean = part.replace(/<\/?think>/gi, '')
    // 跳过空段落：split 在文本开头/结尾或连续 <think>…</think> 处会产生空串，
    // 直接渲染会多出"啥都没有"的空框
    if (!clean.trim()) return
    nodes.push(<div key={`p${i}`} className="md-block">{renderMarkdown(clean, { variant: AGENT_REPORT_HEADINGS.test(clean) ? 'agent-report' : 'default' })}</div>)
  })
  // 防御：流式已结束但正文"只有标题没有内容"——通常是 token 截断 / 网络中断导致只输出了
  // ### 一、xxx 之类的章节标题，没有正文。这种情况下视觉上是一个"几乎空"的框，
  // 追加一行小提示，引导用户重发，避免误判为"啥都没有"。
  if (!streaming) {
    // ⚠ 这里原先用 `String(n.props.children)` 判断 —— children 多数是 React 元素
    // 数组，String() 出来是 "[object Object]" 之类，正则永远不匹配，
    // 这条兜底提示实际上从来没有触发过。改为从渲染后的纯文本判断。
    const plain = String(text || '').trim()
    const lines = plain.split('\n').map(l => l.trim()).filter(Boolean)
    const onlyTitles = lines.length > 0 && lines.every(l => /^#{1,4}\s+\S/.test(l))
      && plain.replace(/^#{1,4}\s+/gm, '').replace(/\s/g, '').length < 40
    if (onlyTitles) {
      nodes.push(
        <div key="incomplete" className="md-block" style={{ color: '#a07a8c', fontSize: 12, marginTop: 8, opacity: 0.85 }}>
          ✦ 看起来这次只输出了章节标题，正文未生成完整（可能是网络或 token 截断）。换一句话再问一次试试。
        </div>
      )
    }
  }
  return nodes
}

// 快捷问答（常规对话，不出报告）
export const QUICK = [
  '今年运势',
  '合适的工作',
  '正缘何时来',
  '抽张塔罗',
  '盲派报告',
  '子平报告',
  '健康',
  '事业',
  '财运',
  '人际关系',
  '感情',
]


export function timeNow() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function fmtSessionTime(ts) {
  try {
    const d = new Date(ts)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (sameDay) return `今天 ${hm}`
    const md = `${d.getMonth() + 1}月${d.getDate()}日`
    if (d.getFullYear() === now.getFullYear()) return `${md} ${hm}`
    return `${d.getFullYear()}年${md} ${hm}`
  } catch {
    return ''
  }
}
