import { useEffect, useRef, useState } from 'react'
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

// ── AI 思考块：回复中的 <think>…</think> 默认收起为一行（点击展开看推演过程） ────
// 思考过程与结果正文分别输出：流式中自动展开以便用户实时看到推演；结论到达时自动收起，
// 用户仍可按需展开查看完整推演。结果正文渲染在思考块下方，二者清晰分离。
export function ThinkBlock({ content, streaming = false }) {
  // 流式中默认展开；结束时收起，让结论成为视觉焦点。
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
  const label = streaming ? `思考中 · ${Math.max(1, elapsed)} 秒` : elapsed ? `已思考 ${elapsed} 秒` : '思考过程'
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
          {String(content || '').trim() || (streaming ? <span className="think-placeholder">正在推演…</span> : '')}
        </div>
      )}
    </div>
  )
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
export function renderAiText(text, streaming = false) {
  // 剥离模型流式返回时包裹的 <output>…</output> 标签（保留内容），避免 "&lt;output&gt;" 显示在页面上
  let raw = String(text || '')
  raw = raw.replace(/<\/?output[^>]*>/gi, '')

  // 处理未闭合的 <think>…（流式过程中末尾出现 <think> 但尚未到 </think> 也视为思考块）
  // 思路：把流式中"从最近的 <think> 起到末尾"的内容也当作思考块，与结果正文分别输出
  if (streaming) {
    const lastOpen = raw.lastIndexOf('<think>')
    const lastClose = raw.lastIndexOf('</think>')
    if (lastOpen > lastClose) {
      // 流式末尾存在未闭合的 <think>，把这段切出作为思考块
      const before = raw.slice(0, lastOpen)
      const thinkOpen = raw.slice(lastOpen + '<think>'.length)
      // key 必须与下方 split 分支保持一致，否则流式结束（streaming:true→false）时
      // React 因 key 变化（think-stream → t1）卸载旧 ThinkBlock、重挂新 ThinkBlock，
      // 内部 open/streaming 状态被重置，视觉上"思考块闪一下、收起、又重启"。
      // 未闭合 think 是第 (before 中已闭合 think 数 + 1) 个，split 分支里第 N 个 think 的
      // key 为 t(N*2-1)。
      const closedCount = (before.match(/<\/think>/g) || []).length
      const streamKey = `t${closedCount * 2 + 1}`
      return (
        <>
          {before && <div className="md-block">{renderMarkdown(before)}</div>}
          <ThinkBlock key={streamKey} content={thinkOpen} streaming={true} />
        </>
      )
    }
  }

  // 按 <think>…</think> 切分：思考块与结果正文分别渲染（思考块在固定高度窗口，正文在其下方）
  const parts = raw.split(/<think>([\s\S]*?)<\/think>/g)
  const nodes = []
  let prevThink = null
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // 防御：跳过与前一个思考块内容完全相同的块（部分模型会重复输出同一段推演，
      // 或收尾边界导致同文块出现两次），避免渲染出"两个一样的深度思考"
      if (prevThink !== null && String(part).trim() === String(prevThink).trim()) return
      prevThink = part
      nodes.push(<ThinkBlock key={`t${i}`} content={part} streaming={streaming} />)
      return
    }
    // 剥离段落中残留的孤立 <think> / </think> 标签（模型可能输出残缺标签），避免显示在正文里
    const clean = part.replace(/<\/?think>/gi, '')
    // 跳过空段落：split 在文本开头/结尾或连续 <think>…</think> 处会产生空串，
    // 直接渲染会多出"啥都没有"的空框
    if (!clean.trim()) return
    nodes.push(<div key={`p${i}`} className="md-block">{renderMarkdown(clean)}</div>)
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
