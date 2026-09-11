import { useEffect, useMemo, useState } from 'react'
import { reportApi } from '../api/reports.js'
import ArchivedReportView, { hasNativeArchiveView } from './ArchivedReportView.jsx'
import { buildReportAgentPrompt } from './ReportAgentFooter.jsx'
import ReportDeleteConfirm from './ReportDeleteConfirm.jsx'

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'chart', label: '命盘' },
  { key: 'tarot', label: '塔罗' },
  { key: 'huangli', label: '黄历' },
  { key: 'other', label: '其他' },
]

const TYPE_META = {
  bazi: { label: '八字', icon: '☷' }, ziwei: { label: '紫微', icon: '✦' }, qimen: { label: '奇门', icon: '☯' },
  huangli: { label: '黄历', icon: '☀' }, tarot: { label: '塔罗', icon: '♢' }, chenggu: { label: '称骨', icon: '⌁' },
  name: { label: '姓名', icon: '名' }, fengshui: { label: '风水', icon: '宅' }, horoscope: { label: '星座', icon: '☆' }, chart: { label: '命盘', icon: '盘' },
}

const CHART_TYPES = new Set(['bazi', 'ziwei', 'qimen', 'chenggu', 'chart'])
const OTHER_TYPES = new Set(['name', 'fengshui', 'horoscope'])

function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', year: 'numeric' })
}

function visibleByFilter(item, filter) {
  if (filter === 'all') return true
  if (filter === 'chart') return CHART_TYPES.has(item.type)
  if (filter === 'other') return OTHER_TYPES.has(item.type)
  return item.type === filter
}

function typeMeta(type) {
  return TYPE_META[type] || { label: '报告', icon: '◌' }
}

export default function MyReportsPage({ user, onBack, onOpenReport }) {
  const [filter, setFilter] = useState('all')
  const [data, setData] = useState({ reports: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    reportApi.list().then(result => {
      if (!alive) return
      if (!result.ok) { setError(result.msg || '报告加载失败，请稍后重试'); setData({ reports: [], counts: {} }); return }
      setData({ reports: result.reports || [], counts: result.counts || {} })
      setError('')
    }).catch(() => {
      if (alive) { setError('报告加载失败，请稍后重试'); setData({ reports: [], counts: {} }) }
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user?.id])

  const reports = useMemo(
    () => data.reports.filter(item => item.isComplete !== false && visibleByFilter(item, filter)),
    [data.reports, filter],
  )

  const removeReport = async () => {
    if (!confirmingId) return
    setDeletingId(confirmingId)
    setDeleteError('')
    const result = await reportApi.remove(confirmingId)
    setDeletingId(null)
    if (!result.ok) { setDeleteError(result.msg || '删除失败，请稍后重试'); return }
    setData(prev => ({ ...prev, reports: prev.reports.filter(item => item.id !== confirmingId) }))
    setConfirmingId(null)
  }

  return (
    <section className="my-reports-page profile-page">
      <div className="profile-head">
        <button className="page-back" onClick={onBack} aria-label="返回个人中心">‹ 返回</button>
        <h1 className="page-title">我的<span className="zhushi">报告</span><span className="page-subtitle">所有完成的测算，都会长期保存在这里</span></h1>
      </div>
      <div className="my-reports-filter" role="tablist" aria-label="报告类型筛选">
        {FILTERS.map(item => (
          <button key={item.key} className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)} role="tab" aria-selected={filter === item.key}>
            {item.label}{item.key === 'all' && data.reports.length ? <em>{data.reports.length}</em> : null}
          </button>
        ))}
      </div>
      {loading ? <div className="my-reports-state">正在整理你的报告…</div> : null}
      {!loading && error ? <div className="my-reports-state error">{error}</div> : null}
      {!loading && !error && reports.length === 0 ? (
        <div className="my-reports-empty"><span>✦</span><h2>这里还没有报告</h2><p>完成一次测算后，报告会自动保存在这里。</p></div>
      ) : null}
      {!loading && !error && reports.length ? (
        <div className="my-reports-list">
          {reports.map(item => {
            const meta = typeMeta(item.type)
            return (
              <article key={item.id} className="my-report-card">
                <button type="button" className="my-report-open" onClick={() => onOpenReport?.({ id: item.id, type: item.type })}>
                  <span className="my-report-icon" aria-hidden="true">{meta.icon}</span>
                  <span className="my-report-main">
                    <span className="my-report-top"><i>{meta.label}</i><b>{item.title}</b></span>
                    {item.summary ? <span className="my-report-summary">{item.summary}</span> : <span className="my-report-summary muted">已保存完整报告</span>}
                    <span className="my-report-meta"><time>{formatTime(item.updatedAt || item.createdAt)}</time>{item.sessionCount ? <em>{item.sessionCount} 段咨询</em> : null}</span>
                  </span>
                </button>
                <button type="button" className="my-report-delete" onClick={() => { setDeleteError(''); setConfirmingId(item.id) }}>删除</button>
                <button type="button" className="my-report-arrow" aria-label={`打开${item.title}`} onClick={() => onOpenReport?.({ id: item.id, type: item.type })}>›</button>
              </article>
            )
          })}
        </div>
      ) : null}
      <ReportDeleteConfirm open={Boolean(confirmingId)} deleting={Boolean(deletingId)} error={deleteError} onCancel={() => setConfirmingId(null)} onConfirm={removeReport} />
    </section>
  )
}

function detailText(report) {
  const full = report?.report
  if (!full) return report?.summary || ''
  if (typeof full.markdown === 'string') return full.markdown
  return [full.summaryText, full.summary, full.narrative, full.suggestion].filter(value => typeof value === 'string' && value.trim()).join('\n\n') || report?.summary || ''
}

export function ReportArchiveDetail({ reportId, onBack, onAskAgent, onOpenSession, onDeleted }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    reportApi.get(reportId).then(result => {
      if (!alive) return
      if (!result.ok) { setError(result.msg || '报告不存在'); return }
      setReport(result.report)
      setError('')
    }).catch(() => { if (alive) setError('报告加载失败，请稍后重试') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reportId])

  const askAgent = () => {
    if (!report) return
    onAskAgent?.({
      chart: report.chart,
      reportId: report.id,
      prompt: buildReportAgentPrompt({ reportName: report.title, facts: report.facts || [], report: { markdown: detailText(report) } }),
    })
  }
  const remove = async () => {
    setDeleting(true)
    const result = await reportApi.remove(reportId)
    setDeleting(false)
    if (!result.ok) { setError(result.msg || '删除失败，请稍后重试'); setConfirming(false); return }
    onDeleted?.(reportId)
  }

  if (loading) return <section className="profile-page"><div className="my-reports-state">正在打开报告…</div></section>
  if (error || !report) return <section className="profile-page"><button className="page-back" onClick={onBack}>‹ 返回</button><div className="my-reports-state error">{error || '报告不存在'}</div></section>
  const meta = typeMeta(report.type)
  const native = hasNativeArchiveView(report)
  if (!native) {
    return <section className="saved-report-page profile-page"><button className="page-back" onClick={onBack}>‹ 我的报告</button><div className="my-reports-state">该记录没有完整报告结果，已不再展示。</div></section>
  }
  return (
    <section className="saved-report-page profile-page">
      <div className="saved-report-head">
        <button className="page-back" onClick={onBack}>‹ 我的报告</button>
        <span className="saved-report-type">{meta.icon} {meta.label}</span>
        <h1>{report.title}</h1>
        {report.summary ? <p>{report.summary}</p> : null}
      </div>
      <ArchivedReportView report={report} />
      <section className="saved-report-actions" aria-label="报告操作">
        <button className="saved-report-ask" onClick={askAgent}>✦ 咨询元气 AI</button>
        {report.agentSessionIds?.length ? <button className="saved-report-session" onClick={() => onOpenSession?.(report.agentSessionIds[0])}>查看关联咨询 · {report.agentSessionIds.length}</button> : null}
        <button className="saved-report-delete" onClick={() => setConfirming(true)}>删除报告</button>
      </section>
      <ReportDeleteConfirm open={confirming} deleting={deleting} onCancel={() => setConfirming(false)} onConfirm={remove} />
    </section>
  )
}
