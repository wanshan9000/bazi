import { useState, useMemo, useEffect } from 'react'
import { horoscope, ALL_SIGNS, findSign } from '../engine/horoscope.js'

export default function HoroscopePage({ onBack }) {
  const [date] = useState(new Date())
  const [sign, setSign] = useState(() => findSign(date).name)
  const [pickerOpen, setPickerOpen] = useState(false)
  const current = ALL_SIGNS.find(z => z.name === sign)

  const r = useMemo(() => horoscope(sign, date), [sign, date.getTime()])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [sign])

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>← 返回首页</button>
          <button className="btn ghost small" onClick={() => setPickerOpen(!pickerOpen)}>
            {pickerOpen ? '收起选择' : '切换星座'}
          </button>
        </div>
        <h1 className="page-title rise rise-1">星座运势 ✦</h1>
        <p className="page-sub rise rise-2">今日 {date.getMonth() + 1}.{date.getDate()} · 行星行运速览</p>

        {pickerOpen && (
          <div className="hs-picker rise rise-2">
            {ALL_SIGNS.map(z => (
              <button
                key={z.name}
                className={`hs-pick-item ${sign === z.name ? 'active' : ''}`}
                onClick={() => { setSign(z.name); setPickerOpen(false) }}
              >
                <span className="hs-pick-icon">{z.icon}</span>
                <span className="hs-pick-name">{z.name}</span>
                <span className="hs-pick-date">{z.dateRange}</span>
              </button>
            ))}
          </div>
        )}

        <div className="hs-head rise rise-2">
          <div className="hs-sign-card">
            <div className="hs-sign-icon">{r.sign.icon}</div>
            <div className="hs-sign-meta">
              <div className="hs-sign-name">{r.sign.name}</div>
              <div className="hs-sign-en">{r.sign.en}</div>
              <div className="hs-sign-ruler">守护星 · {r.sign.ruler}</div>
              <div className="hs-sign-tags">
                <span>{r.sign.wx}象</span>
                <span>{r.sign.color}</span>
                <span>{r.sign.dateRange}</span>
              </div>
            </div>
            <div className="hs-sign-rating">
              <div className="hs-sign-overall">{r.today.overall}</div>
              <div className="hs-sign-star">{'★'.repeat(Math.round(r.today.overall))}{'☆'.repeat(5 - Math.round(r.today.overall))}</div>
            </div>
          </div>
        </div>

        <div className="hs-today rise rise-3">
          <div className="hs-tone">
            <span className="hs-tone-tag">{r.today.tone}</span>
            <p>{r.today.toneDesc}</p>
          </div>
          <div className="hs-scores">
            {r.today.scores.map(d => (
              <div key={d.key} className="hs-dim">
                <div className="hs-dim-name">{d.label}<small> · {d.en}</small></div>
                <div className="hs-dim-bar">
                  <span className="hs-dim-fill" style={{ width: `${(d.score / 5) * 100}%` }} />
                </div>
                <div className="hs-dim-score">{d.score}<small>/5</small></div>
              </div>
            ))}
          </div>
          <div className="hs-lucky">
            <div className="hs-lucky-item"><span>幸运色</span><em>{r.today.luckyColor}</em></div>
            <div className="hs-lucky-item"><span>幸运数</span><em>{r.today.luckyNum}</em></div>
            <div className="hs-lucky-item"><span>方位</span><em>{r.today.luckyDir}</em></div>
          </div>
          <div className="hs-yiji">
            <div className="yi">
              <h4>宜</h4>
              <p>{r.today.yi.join(' · ')}</p>
            </div>
            <div className="ji">
              <h4>忌</h4>
              <p>{r.today.ji.join(' · ')}</p>
            </div>
          </div>
        </div>

        <div className="hs-tomorrow rise rise-3">
          <h3 className="n-h">明日速览</h3>
          <div className="hs-t-card">
            <div className="hs-t-rating">{r.tomorrow.overall}</div>
            <div className="hs-t-text">
              <div className="hs-t-tone">{r.tomorrow.tone}</div>
              <p>{r.tomorrow.text}</p>
            </div>
          </div>
        </div>

        <div className="hs-week rise rise-3">
          <h3 className="n-h">本周走势</h3>
          <div className="hs-week-grid">
            {r.week.map((d, i) => (
              <div key={i} className={`hs-day ${i === 0 ? 'today' : ''}`}>
                <div className="hs-day-w">周{d.weekday}</div>
                <div className="hs-day-d">{d.date.getMonth() + 1}/{d.date.getDate()}</div>
                <div className="hs-day-score">{d.score}</div>
                <div className="hs-day-bar"><span style={{ width: `${(d.score / 5) * 100}%` }} /></div>
                <div className="hs-day-tone">{d.tone}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hs-foot rise">
          行星行运 · 仅作日常参考，不替代理性思考。
        </div>
      </div>
    </div>
  )
}
