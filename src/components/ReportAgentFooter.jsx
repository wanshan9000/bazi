// /api/agent/chat 的服务端上限是 2000 字。报告页要带足够的关键信息进入对话，
// 也不能因一份长报告让用户一点击就收到报错；预留 100 字给后续协议字段。
export const REPORT_AGENT_PROMPT_LIMIT = 1900

function normalText(value) {
  return String(value || '').replace(/\n{3,}/g, '\n\n').trim()
}

function compactText(value, limit) {
  const text = normalText(value)
  if (text.length <= limit) return text
  const marker = '\n\n……（报告较长，已保留开头与结论；可继续指定模块追问）……\n\n'
  const available = Math.max(0, limit - marker.length)
  const headLength = Math.ceil(available * 0.68)
  const tailLength = available - headLength
  return `${text.slice(0, headLength).trimEnd()}${marker}${text.slice(-tailLength).trimStart()}`
}

export function buildReportAgentPrompt({ reportName, facts = [], report = null }) {
  const name = compactText(normalText(reportName) || '当前', 32)
  const header = [
    `报告咨询：${name}`,
    `我正在阅读${name}报告。请只围绕以下当前报告资料回答我的后续问题；若资料中没有，请先说明并向我确认，不要把推测当作页面结论。`,
  ].join('\n')
  const factsText = compactText(facts.filter(Boolean).map(item => `- ${normalText(item)}`).join('\n'), 520)
  const factsBlock = factsText ? `已知资料：\n${factsText}` : ''
  const reportHeading = '当前报告摘要：\n'
  const reportBudget = Math.max(260, REPORT_AGENT_PROMPT_LIMIT - header.length - (factsBlock ? factsBlock.length + 2 : 0) - reportHeading.length - 2)
  const reportText = compactText(report?.markdown, reportBudget)
  const reportBlock = reportText ? `${reportHeading}${reportText}` : ''

  return [header, factsBlock, reportBlock].filter(Boolean).join('\n\n').slice(0, REPORT_AGENT_PROMPT_LIMIT)
}

export default function ReportAgentFooter({ onAskAgent, onBack, backLabel = '回到首页' }) {
  return (
    <div className="report-agent-footer-zone">
      <section className="report-agent-footer" aria-label="报告页操作">
        <button type="button" className="report-agent-ask" onClick={onAskAgent}>
          ✦ 咨询元气 AI
        </button>
        <button type="button" className="report-agent-home" onClick={onBack}>
          {backLabel}
        </button>
      </section>
    </div>
  )
}
