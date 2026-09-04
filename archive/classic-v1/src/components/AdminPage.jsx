import { useState, useEffect, useMemo } from 'react'
import { SHENGXIAO } from '../data/ganzhi.js'

const ADMIN_PWD = 'sanmen2026'
const ADMIN_AUTH_KEY = 'sanmen-admin-auth'
const HISTORY_KEY = 'sanmen-history'
const TAROT_KEY = 'sanmen-tarot-history'

function loadCharts() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadTarot() {
  try {
    const raw = localStorage.getItem(TAROT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const fmtDate = (ts) => {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const wxColors = {
  '金': '#b08d4f', '木': '#3f7d6b', '水': '#2d4a6b', '火': '#a8472a', '土': '#8a7849'
}

export default function AdminPage({ onBack }) {
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_AUTH_KEY) === '1' } catch { return false }
  })
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [charts, setCharts] = useState([])
  const [tarots, setTarots] = useState([])
  const [tab, setTab] = useState('charts') // charts | tarot
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (authed) {
      setCharts(loadCharts())
      setTarots(loadTarot())
    }
  }, [authed])

  const handleLogin = (e) => {
    e.preventDefault()
    if (pwd === ADMIN_PWD) {
      try { sessionStorage.setItem(ADMIN_AUTH_KEY, '1') } catch {}
      setAuthed(true)
      setErr('')
    } else {
      setErr('口令错误')
    }
  }

  const logout = () => {
    try { sessionStorage.removeItem(ADMIN_AUTH_KEY) } catch {}
    setAuthed(false)
    setPwd('')
  }

  const deleteChart = (id) => {
    if (!confirm('确认删除该条命盘记录？')) return
    const next = charts.filter(c => c.id !== id)
    setCharts(next)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
    if (selected?.id === id) setSelected(null)
  }

  const deleteTarot = (id) => {
    if (!confirm('确认删除该条塔罗记录？')) return
    const next = tarots.filter(c => c.id !== id)
    setTarots(next)
    try { localStorage.setItem(TAROT_KEY, JSON.stringify(next)) } catch {}
  }

  const clearAll = () => {
    if (!confirm(`确认清空全部${tab === 'charts' ? '命盘' : '塔罗'}记录？此操作不可恢复。`)) return
    if (tab === 'charts') {
      setCharts([])
      try { localStorage.removeItem(HISTORY_KEY) } catch {}
    } else {
      setTarots([])
      try { localStorage.removeItem(TAROT_KEY) } catch {}
    }
    setSelected(null)
  }

  const exportData = () => {
    const data = tab === 'charts' ? charts : tarots
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sanmen-${tab}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (tab === 'charts') {
      return charts.filter(c => {
        if (!kw) return true
        return `${c.year}${c.month}${c.day}${c.gender}${c.name || ''}`.toLowerCase().includes(kw)
      })
    }
    return tarots.filter(c => {
      if (!kw) return true
      return (c.question || '').toLowerCase().includes(kw) || (c.spreadName || '').toLowerCase().includes(kw)
    })
  }, [charts, tarots, tab, search])

  // 统计
  const stats = useMemo(() => {
    const wxCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 }
    let male = 0, female = 0
    charts.forEach(c => {
      if (c.gender === '男') male++; else female++
      const wx = c.dayMasterWx
      if (wx && wxCount[wx] !== undefined) wxCount[wx]++
    })
    return { total: charts.length, male, female, wxCount }
  }, [charts])

  // 登录页
  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <div className="alc-deco">三</div>
          <h2 className="alc-title">管理控制台</h2>
          <p className="alc-sub">三门命理 · Admin Console</p>
          <form onSubmit={handleLogin} className="alc-form">
            <input
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="请输入管理口令"
              autoFocus
              autoComplete="current-password"
            />
            {err && <div className="alc-err">{err}</div>}
            <button type="submit" className="alc-btn">登 入</button>
          </form>
          <button className="alc-back" onClick={onBack}>← 返回首页</button>
          <p className="alc-tip">仅管理员可访问 · 会话内有效</p>
        </div>
      </div>
    )
  }

  // 管理后台
  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div>
          <p className="ah-deco">Sanmen · Admin Console</p>
          <h1 className="ah-title">管理控制台</h1>
        </div>
        <div className="ah-actions">
          <button className="ah-btn ghost" onClick={exportData}>导出 {tab === 'charts' ? '命盘' : '塔罗'} JSON</button>
          <button className="ah-btn ghost warn" onClick={clearAll}>清空 {tab === 'charts' ? '命盘' : '塔罗'}</button>
          <button className="ah-btn ghost" onClick={logout}>退出</button>
          <button className="ah-btn" onClick={onBack}>回到首页</button>
        </div>
      </div>

      {/* 概览统计 */}
      <div className="admin-stats">
        <div className="as-card">
          <div className="as-num">{stats.total}</div>
          <div className="as-label">命盘总数</div>
        </div>
        <div className="as-card">
          <div className="as-num">{stats.male} / {stats.female}</div>
          <div className="as-label">乾造 / 坤造</div>
        </div>
        <div className="as-card">
          <div className="as-wx">
            {Object.entries(stats.wxCount).map(([wx, n]) => (
              <span key={wx} className="wx-pill" style={{ background: wxColors[wx] + '22', color: wxColors[wx], borderColor: wxColors[wx] + '55' }}>
                <b>{wx}</b> {n}
              </span>
            ))}
          </div>
          <div className="as-label">五行分布（依日主）</div>
        </div>
        <div className="as-card">
          <div className="as-num">{tarots.length}</div>
          <div className="as-label">塔罗占卜</div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="admin-tabs">
        <button
          className={`atab ${tab === 'charts' ? 'on' : ''}`}
          onClick={() => { setTab('charts'); setSelected(null); }}
        >
          命盘档案 ({charts.length})
        </button>
        <button
          className={`atab ${tab === 'tarot' ? 'on' : ''}`}
          onClick={() => { setTab('tarot'); setSelected(null); }}
        >
          塔罗记录 ({tarots.length})
        </button>
      </div>

      {/* 搜索 */}
      <div className="admin-tools">
        <input
          type="text"
          className="at-input"
          placeholder={tab === 'charts' ? '搜索：年/月/日/性别/姓名' : '搜索：问题/牌阵'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="at-count">匹配 {filtered.length} 条</span>
      </div>

      {/* 命盘列表 */}
      {tab === 'charts' && (
        <div className="admin-grid">
          {filtered.length === 0 ? (
            <div className="admin-empty">暂无命盘记录</div>
          ) : filtered.map(c => {
            const sxIndex = ((c.year - 4) % 12 + 12) % 12
            const sx = SHENGXIAO[sxIndex]
            const dm = c.pillars?.[2]
            const dmWx = c.dayMasterWx
            const wxColor = wxColors[dmWx] || '#b08d4f'
            return (
              <div key={c.id} className={`ad-row ${selected?.id === c.id ? 'on' : ''}`}>
                <div className="adr-zodiac" style={{ color: wxColor }}>{sx}</div>
                <div className="adr-main">
                  <div className="adr-line1">
                    <span className="adr-date">{c.year}年{c.month}月{c.day}日 · {c.hour ?? '?'}时</span>
                    <span className="adr-tag">{c.gender === '男' ? '乾造' : '坤造'}</span>
                  </div>
                  <div className="adr-line2">
                    {dm && <span className="adr-tag gold" style={{ background: wxColor + '15', borderColor: wxColor + '55', color: wxColor }}>{dm.gan}{dm.zhi}日主 · {dmWx}</span>}
                    <span className="adr-tag">{sx}肖</span>
                    {c.name && <span className="adr-tag">{c.name}</span>}
                  </div>
                </div>
                <div className="adr-time">{fmtDate(c.id)}</div>
                <div className="adr-actions">
                  <button className="adr-btn" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                    {selected?.id === c.id ? '收起' : '查看'}
                  </button>
                  <button className="adr-btn warn" onClick={() => deleteChart(c.id)}>删除</button>
                </div>
                {selected?.id === c.id && (
                  <div className="adr-detail">
                    <div className="add-block">
                      <div className="add-label">四柱</div>
                      <div className="add-pillars">
                        {c.pillars?.map((p, i) => (
                          <div key={i} className="add-pillar">
                            <div className="adp-pos">{['年柱', '月柱', '日柱', '时柱'][i]}</div>
                            <div className="adp-chars">
                              <span>{p.gan}</span>
                              <span>{p.zhi}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {c.dayMaster && (
                      <div className="add-block">
                        <div className="add-label">日主</div>
                        <div className="add-text">{c.dayMaster} ({c.dayMasterWx})</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 塔罗列表 */}
      {tab === 'tarot' && (
        <div className="admin-grid">
          {filtered.length === 0 ? (
            <div className="admin-empty">暂无塔罗记录</div>
          ) : filtered.map(t => (
            <div key={t.id} className="ad-row tall">
              <div className="adr-zodiac" style={{ color: '#a8472a' }}>☥</div>
              <div className="adr-main">
                <div className="adr-line1">
                  <span className="adr-date">{t.spreadName || t.spreadId || '—'}</span>
                  <span className="adr-tag">{t.cards?.length || 0} 张</span>
                </div>
                <div className="adr-line2 q">
                  {(t.question || '(无问题)').slice(0, 80)}{(t.question?.length || 0) > 80 ? '...' : ''}
                </div>
              </div>
              <div className="adr-time">{fmtDate(t.id)}</div>
              <div className="adr-actions">
                <button className="adr-btn warn" onClick={() => deleteTarot(t.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
