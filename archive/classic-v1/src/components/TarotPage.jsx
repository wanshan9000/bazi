import { useState } from 'react'
import { SPREADS } from '../data/tarot.js'

function SpreadPreview({ spread, drawn = 0 }) {
  const cells = spread.layout === 'cross'
    ? [
        { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 },
        { r: 2, c: 1 }, { r: 0, c: 0 }, { r: 0, c: 2 },
        { r: 2, c: 0 }, { r: 2, c: 2 }, { r: 3, c: 1 }
      ]
    : spread.layout === 'fan'
      ? spread.positions.map((_, i) => ({ r: 0, c: i }))
      : spread.layout === 'grid'
        ? [
            { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 },
            { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }
          ].slice(0, spread.count)
        : spread.positions.map((_, i) => ({ r: 0, c: i }))
  const cols = spread.layout === 'cross' ? 3 : spread.layout === 'grid' ? 4 : spread.count
  return (
    <div className="spread-preview" style={{ '--cols': cols }}>
      {cells.map((cell, i) => (
        <span
          key={i}
          className={`sp-cell ${i < drawn ? 'drawn' : ''}`}
          style={{ gridRow: cell.r + 1, gridColumn: cell.c + 1 }}
        >
          {i < drawn ? (i + 1) : '?'}
        </span>
      ))}
    </div>
  )
}

export default function TarotPage({ onBack, onStart, history }) {
  const [diff, setDiff] = useState('all')
  const list = SPREADS.filter(s => diff === 'all' || s.diff === diff)

  return (
    <div className="page-wrap tarot-page">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>← 返回首页</button>
          {history.length > 0 && (
            <span className="page-meta">已抽过 {history.length} 卦</span>
          )}
        </div>
        <h1 className="page-title rise rise-1">塔罗门</h1>
        <p className="page-sub rise rise-2">七十八张阿卡那 · 九种经典牌阵 · 一抽即明</p>

        {/* 难度筛选 */}
        <div className="cat-row rise rise-2">
          {[
            { k: 'all', l: '全部' },
            { k: '入门', l: '入门 · 1-3 张' },
            { k: '进阶', l: '进阶 · 5-10 张' }
          ].map(c => (
            <button
              key={c.k}
              className={`cat-chip ${diff === c.k ? 'active' : ''}`}
              onClick={() => setDiff(c.k)}
            >
              <span className="cl">{c.l}</span>
            </button>
          ))}
        </div>

        {/* 牌阵卡片网格 */}
        <div className="spread-grid rise rise-3">
          {list.map((s, i) => (
            <article
              key={s.id}
              className="spread-card"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="sc-top">
                <span className={`sc-diff ${s.diff === '入门' ? 'easy' : 'hard'}`}>
                  {s.diff}
                </span>
                <span className="sc-count">{s.count} 张</span>
              </div>
              <SpreadPreview spread={s} />
              <h3 className="sc-name">{s.name}</h3>
              <p className="sc-en">{s.nameEn}</p>
              <p className="sc-short">{s.short}</p>
              <p className="sc-desc">{s.desc}</p>
              <div className="sc-positions">
                {s.positions.map((p, i) => (
                  <span key={i} className="sc-pill">
                    <b>{i + 1}</b> {p.name}
                  </span>
                ))}
              </div>
              <button className="btn small sc-go" onClick={() => onStart(s.id)}>
                抽这组牌 →
              </button>
            </article>
          ))}
        </div>

        {list.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 40 }}>
            该难度暂无牌阵
          </p>
        )}
      </div>
    </div>
  )
}
