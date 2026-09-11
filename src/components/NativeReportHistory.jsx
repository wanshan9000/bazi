import { useEffect, useState } from 'react'
import { reportApi } from '../api/reports.js'
import { historyTypeForView } from '../engine/reportHistoryRoute.js'
import ArchivedReportView, { hasNativeArchiveView } from './ArchivedReportView.jsx'
import ReportAgentFooter, { buildReportAgentPrompt } from './ReportAgentFooter.jsx'
import ReportDeleteConfirm from './ReportDeleteConfirm.jsx'

const PAGE_META = {
  bazi: { wrap: 'bazi-page', title: '八字门', sub: '排四柱 · 看五行 · 找到你的出厂设置' },
  ziwei: { wrap: 'ziwei-page', title: '紫微门', sub: '览十二宫 · 观星曜 · 一览人生星光地图' },
  qimen: { wrap: 'qimen-page', title: '奇门遁甲', sub: '问事起局 · 洞察时机 · 找到你的行动方向' },
  huangli: { wrap: 'hl-page', title: '黄历', sub: '先读今日传统规则 · 再结合生辰看自己的安排', huangli: true },
  'tarot-reading': { wrap: 'tarot-reading-page', title: '塔罗', sub: '牌阵已经落定，重阅当时的答案' },
  chenggu: { wrap: 'chenggu-page', title: '称骨论命', sub: '重阅当时生成的骨重、歌诀与解读' },
  name: { wrap: '', title: '姓名测算 ✒︎', sub: '五格剖象 · 三才配置 · 八字喜忌' },
  fengshui: { wrap: '', title: '风水分析 ⛩︎', sub: '户型方位 · 五行调和 · 八宅明局' },
  astro: { wrap: '', title: '星座运势', sub: '重阅当日生成的星盘提示' },
}

function reportPrompt(report) {
  const body = typeof report?.report?.markdown === 'string' && report.report.markdown.trim()
    ? report.report.markdown
    : [report?.summary, ...(report?.facts || [])].filter(Boolean).join('\n')
  return buildReportAgentPrompt({
    reportName: report?.title || '历史报告',
    facts: report?.facts || [],
    report: { markdown: body },
  })
}

/**
 * 原报告路由的只读历史入口。它只消费服务端快照：不计算、不计费、不触发保存。
 */
export default function NativeReportHistory({ view, reportId, onBack, onAskAgent, onOpenSession, onDeleted }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const expectedType = historyTypeForView(view)
  const meta = PAGE_META[view] || PAGE_META.bazi

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    reportApi.get(reportId).then(result => {
      if (!alive) return
      if (!result.ok || !result.report) { setError(result.msg || '报告不存在'); return }
      if (result.report.type !== expectedType || !hasNativeArchiveView(result.report)) {
        setError('该记录没有完整报告结果，已不再展示。')
        return
      }
      setReport(result.report)
    }).catch(() => {
      if (alive) setError('报告加载失败，请稍后重试')
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [expectedType, reportId])

  const remove = async () => {
    setDeleting(true)
    const result = await reportApi.remove(reportId)
    setDeleting(false)
    if (!result.ok) { setError(result.msg || '删除失败，请稍后重试'); setConfirming(false); return }
    onDeleted?.(reportId)
  }

  const head = meta.huangli ? (
    <div className="hl-hero rise rise-1"><div className="hl-hero-title"><span className="hl-hero-main"><span>{meta.title}</span></span></div><div className="hl-hero-sub">{meta.sub}</div></div>
  ) : (
    <><h1 className="page-title rise rise-1">{meta.title}</h1><p className="page-sub rise rise-2">{meta.sub}</p></>
  )

  return (
    <div className={`page-wrap ${meta.wrap} report-history-mode`} data-history-mode="true">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回我的报告</button>
          <span className="report-history-state">历史报告</span>
        </div>
        {head}
        {loading ? <div className="my-reports-state">正在恢复报告…</div> : null}
        {!loading && error ? <div className="my-reports-state error">{error}</div> : null}
        {!loading && report ? <>
          <ArchivedReportView report={report} />
          <ReportAgentFooter
            onAskAgent={() => onAskAgent?.({ chart: report.chart, reportId: report.id, prompt: reportPrompt(report) })}
            onBack={onBack}
            backLabel="返回我的报告"
          />
          {report.agentSessionIds?.length ? <button className="history-report-sessions" onClick={() => onOpenSession?.(report.agentSessionIds[0])}>查看关联咨询 · {report.agentSessionIds.length}</button> : null}
          <button className="history-report-delete" onClick={() => setConfirming(true)}>删除这份报告</button>
        </> : null}
      </div>
      <ReportDeleteConfirm open={confirming} deleting={deleting} onCancel={() => setConfirming(false)} onConfirm={remove} />
    </div>
  )
}
