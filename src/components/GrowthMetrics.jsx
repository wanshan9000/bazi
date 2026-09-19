import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'

const METRICS = [
  ['page_view', '访问'],
  ['bazi_calculator_opened', '进入排盘'],
  ['bazi_chart_created', '完成排盘'],
  ['agent_consult_opened', '开启咨询'],
  ['chart_summary_share_completed', '完成分享'],
  ['chart_summary_link_copied', '复制分享'],
  ['agent_summary_share_completed', 'AI 小结分享'],
  ['agent_summary_link_copied', 'AI 小结复制'],
]

const total = (value, keys) => keys.reduce((sum, key) => sum + Number(value?.[key] || 0), 0)

export default function GrowthMetrics({ token }) {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    api.analyticsSummary(token, days)
      .then(result => { if (alive) setData(result.data) })
      .catch(() => { if (alive) setError('增长数据暂时无法读取') })
    return () => { alive = false }
  }, [days, token])

  const sourceRows = useMemo(() => Object.entries(data?.sources || {})
    .map(([source, events]) => ({
      source,
      views: Number(events.page_view || 0),
      charts: Number(events.bazi_chart_created || 0),
      shares: total(events, ['chart_summary_share_completed', 'chart_summary_link_copied', 'agent_summary_share_completed', 'agent_summary_link_copied']),
    }))
    .sort((a, b) => b.views - a.views || b.charts - a.charts), [data])

  const chartRate = data?.totals?.bazi_calculator_opened
    ? Math.round((Number(data.totals.bazi_chart_created || 0) / Number(data.totals.bazi_calculator_opened)) * 100)
    : 0

  return (
    <section className="growth-metrics" aria-label="增长数据">
      <div className="growth-metrics-head">
        <div>
          <span>推广归因</span>
          <p>只统计匿名聚合事件，不记录生辰、命盘、账号或对话内容。</p>
        </div>
        <div className="growth-period" role="group" aria-label="统计周期">
          {[7, 30].map(value => <button type="button" key={value} className={days === value ? 'active' : ''} onClick={() => setDays(value)}>{value} 天</button>)}
        </div>
      </div>
      {error && <div className="admin-empty">{error}</div>}
      {!error && !data && <div className="admin-empty">正在汇总增长数据…</div>}
      {data && <>
        <div className="growth-metric-grid">
          {METRICS.map(([key, label]) => <div className="growth-metric" key={key}><b>{Number(data.totals?.[key] || 0)}</b><span>{label}</span></div>)}
        <div className="growth-metric growth-metric-rate"><b>{chartRate}%</b><span>进入排盘至完成</span></div>
        </div>
        <div className="growth-source-table" role="table" aria-label="来源表现">
          <div className="growth-source-row growth-source-head" role="row"><span>来源</span><span>访问</span><span>排盘</span><span>分享</span></div>
          {sourceRows.length ? sourceRows.map(row => <div className="growth-source-row" role="row" key={row.source}><b>{row.source}</b><span>{row.views}</span><span>{row.charts}</span><span>{row.shares}</span></div>) : <div className="growth-source-empty">尚未收到推广事件。用带 `utm_source` 的链接发布内容后，数据会显示在这里。</div>}
        </div>
      </>}
    </section>
  )
}
