import { useState } from 'react'
import ChartView from './ChartView.jsx'
import Report from './Report.jsx'
import Chat from './Chat.jsx'

const TABS = [
  { key: 'chart', label: '命盘' },
  { key: 'report', label: '报告' },
  { key: 'chat', label: '咨询' }
]

export default function ResultView({ chart, onBack, onRechart }) {
  const [tab, setTab] = useState('chart')

  return (
    <div className="result-wrap">
      <header className="topbar">
        <div className="brand" onClick={onBack}>
          <div className="brand-mark">灵</div>
          <div>
            <span className="brand-name">灵<em>枢</em></span>
            <span className="brand-sub">LINGSHU·随身玄学助手</span>
          </div>
        </div>
        <button className="btn ghost small" onClick={onRechart}>重新排盘</button>
      </header>

      <div className="container">
        {/* 命主信息条 */}
        <div className="card chart-card" style={{ marginBottom: 0, padding: '18px 14px' }}>
          <div className="corner tl" /><div className="corner br" />
          <div className="chart-head" style={{ marginBottom: 0 }}>
            <div className="name" style={{ fontSize: 22 }}>
              {chart.dayMaster}日主 · {chart.shengxiao}肖
            </div>
            <div className="sub">
              {chart.year}年{chart.month}月{chart.day}日 · {chart.gender === '男' ? '乾造' : '坤造'}
              {chart.pillars.map(p => ` · ${p.gan}${p.zhi}`).join('')}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'chart' && <ChartView chart={chart} />}
        {tab === 'report' && <Report chart={chart} />}
        {tab === 'chat' && <Chat chart={chart} />}

        <footer className="footer">
          <p>灵枢 · LINGSHU</p>
          <p><span className="latin">The Mystic Companion</span><span className="sep">✦</span>玄学内容仅供参考</p>
        </footer>
      </div>
    </div>
  )
}
