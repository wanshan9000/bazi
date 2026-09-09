import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

const fmt = timestamp => timestamp ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : '--'
const remaining = timestamp => {
  const ms = Math.max(0, timestamp - Date.now())
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.ceil((ms % 3600000) / 60000)
  return hours ? `${hours}小时${minutes}分` : `${minutes}分`
}

export default function SecurityManagement({ token }) {
  const [data, setData] = useState({ overview: {}, blocks: [], events: [] })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [activeDetail, setActiveDetail] = useState('events')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.adminSecurity(token)
      setData(result.data || { overview: {}, blocks: [], events: [] })
    } catch (error) {
      setMessage(error.message || '风控数据加载失败')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { refresh() }, [refresh])

  const block = async (event) => {
    const reason = window.prompt('封禁原因：', event.reason || '异常请求频繁')
    if (reason === null) return
    const minutes = window.prompt('封禁时长（分钟，最长 10080）：', '1440')
    if (minutes === null) return
    try {
      await api.blockSource(event.fingerprint, { minutes: Number(minutes), reason }, token)
      setMessage('来源已临时封禁')
      refresh()
    } catch (error) { setMessage(error.message || '封禁失败') }
  }

  const unblock = async (fingerprint) => {
    if (!window.confirm('确认解除该来源的临时封禁？')) return
    try {
      await api.unblockSource(fingerprint, token)
      setMessage('已解除封禁')
      refresh()
    } catch (error) { setMessage(error.message || '解除失败') }
  }

  const since = Date.now() - 24 * 60 * 60 * 1000
  const riskEvents = data.events.filter(event => event.type === 'risk' && event.at >= since)
  const autoBlocks = data.events.filter(event => event.type === 'auto_block' && event.at >= since)
  const detail = activeDetail === 'blocks'
    ? { title: '生效中的限制', count: data.blocks.length, items: data.blocks }
    : activeDetail === 'autoBlocks'
      ? { title: '24 小时自动封禁明细', count: autoBlocks.length, items: autoBlocks }
      : { title: '24 小时风险事件明细', count: riskEvents.length, items: riskEvents }

  const renderEvent = event => <article className="security-event" key={event.id}>
    <div className="security-event-main"><b>{event.action}</b><span>{event.reason}</span><small>{fmt(event.at)} · <code>{event.fingerprint}</code></small></div>
    <div className="security-event-actions"><em className={event.status >= 429 ? 'high' : ''}>{event.status}</em>{event.type === 'risk' && <button className="ask-btn ghost" onClick={() => block(event)}>封禁</button>}</div>
  </article>

  return <section className="security-admin">
    <div className="security-head">
      <div><h2>安全风控</h2><p>来源以不可逆指纹显示；自动封禁只针对持续异常请求。</p></div>
      <button className="ask-btn ghost" onClick={refresh} disabled={loading}>刷新</button>
    </div>
    {message && <div className="ask-msg">{message}</div>}
    <div className="security-kpis">
      <button type="button" className={activeDetail === 'blocks' ? 'is-active' : ''} onClick={() => setActiveDetail('blocks')} aria-pressed={activeDetail === 'blocks'}><b>{data.overview.blocked || 0}</b><span>当前封禁</span></button>
      <button type="button" className={activeDetail === 'events' ? 'is-active' : ''} onClick={() => setActiveDetail('events')} aria-pressed={activeDetail === 'events'}><b>{data.overview.riskEvents24h || 0}</b><span>24 小时风险事件</span></button>
      <button type="button" className={activeDetail === 'autoBlocks' ? 'is-active' : ''} onClick={() => setActiveDetail('autoBlocks')} aria-pressed={activeDetail === 'autoBlocks'}><b>{data.overview.autoBlocks24h || 0}</b><span>24 小时自动封禁</span></button>
    </div>
    <div className="security-grid">
      <section className="security-panel">
        <div className="security-panel-head"><h3>{detail.title}</h3><span>{activeDetail === 'blocks' ? detail.count : `最近 24 小时 · ${detail.count} 条`}</span></div>
        {!loading && !detail.items.length && <p className="security-empty">{activeDetail === 'blocks' ? '暂无限制中的来源' : '暂无异常记录'}</p>}
        {activeDetail === 'blocks'
          ? detail.items.map(item => <article className="security-block" key={item.fingerprint}>
            <div><code>{item.fingerprint}</code><p>{item.reason}</p><small>{item.manual ? '人工处置' : '自动保护'} · 剩余 {remaining(item.expiresAt)}</small></div>
            <button className="ask-btn ghost" onClick={() => unblock(item.fingerprint)}>解除</button>
          </article>)
          : <div className="security-events">{detail.items.map(renderEvent)}</div>}
      </section>
    </div>
  </section>
}
