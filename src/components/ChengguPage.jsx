import { useState } from 'react'
import { weighBones } from '../engine/chenggu.js'
import ShichenPicker from './ShichenPicker.jsx'
import { getLunarMonths, getLunarDayCount, tryLunarToSolar } from '../utils/lunar.js'

const SHICHEN = [
  ['子时', '23-01'], ['丑时', '01-03'], ['寅时', '03-05'], ['卯时', '05-07'],
  ['辰时', '07-09'], ['巳时', '09-11'], ['午时', '11-13'], ['未时', '13-15'],
  ['申时', '15-17'], ['酉时', '17-19'], ['戌时', '19-21'], ['亥时', '21-23']
]
const SHICHEN_HOUR = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 }

export default function ChengguPage({ onBack }) {
  const [result, setResult] = useState(null)
  const [editing, setEditing] = useState(true)

  const handleGenerate = ({ year, month, day, hour, gender }) => {
    const d = new Date(year, month - 1, day)
    if (hour !== undefined && hour !== null) d.setHours(hour)
    setResult(weighBones(d, gender))
    setEditing(false)
    window.scrollTo(0, 0)
  }

  const handleReset = () => {
    setResult(null)
    setEditing(true)
  }

  return (
    <div className="page-wrap chenggu-page">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>
        <h1 className="page-title bazi-page-title rise rise-1">
          <span>称骨论命</span>
          {result && !editing && (
            <button
              className="title-chart-change"
              onClick={handleReset}
              title="更换生辰"
              aria-label="更换生辰"
            >
              <span>更换生辰</span>
            </button>
          )}
        </h1>
        <p className="page-sub rise rise-2">袁天罡称骨算命法 · 量骨重，鉴命格</p>

        {editing || !result ? (
          <ChengguForm onDone={handleGenerate} />
        ) : (
          <div className="chenggu-result rise rise-3">
            <section className="cg-summary">
              <div className="cg-total">
                <span className="cg-total-num">{result.summary.total}</span>
                <span className="cg-total-unit">两</span>
              </div>
              <div className="cg-grade">
                <span className="cg-grade-name">{result.summary.grade}</span>
                <span className="cg-grade-tone">{result.summary.tone}</span>
              </div>
              <div className="cg-summary-meta">
                {result.summary.lunarYear} 年 · {result.summary.lunarMonth} · {result.summary.lunarDay} · {result.summary.shiChen}时 · {result.summary.gender === '女' ? '女' : '男'}
              </div>
              <p className="cg-summary-desc">{result.verdict.desc}</p>
              <p className="cg-summary-plain">{result.verdict.plain}</p>
            </section>

            <section className="cg-bones">
              <h3 className="cg-h3">骨重明细</h3>
              <div className="cg-bone-grid">
                {result.breakdown.map((b) => (
                  <div key={b.name} className="cg-bone-card">
                    <div className="cg-bone-name">{b.name}</div>
                    <div className="cg-bone-value">{b.value}<span> 两</span></div>
                    <div className="cg-bone-detail">{b.detail}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="cg-classic">
              <h3 className="cg-h3">称骨常规解读</h3>
              <div className="cg-classic-card">
                <div className="cg-classic-head">
                  <span>称骨歌诀</span>
                  <b>{result.classic.title}</b>
                </div>
                <p className="cg-classic-rule">{result.classic.rule}</p>
                <p className="cg-classic-text">{result.classic.text}</p>
                <p className="cg-classic-plain">{result.classic.plain}</p>
              </div>
            </section>

            <section className="cg-lines">
              <h3 className="cg-h3">称骨与八字解读</h3>
              <p className="cg-analysis-note">称骨以 {result.summary.total} 两与{result.summary.gender === '女' ? '女' : '男'}命定主断；下列五行提示结合你的实际四柱动态生成。</p>
              <div className="cg-bazi-basis" aria-label="八字解读依据">
                <div><span>四柱</span><b>{result.bazi.pillars.join(' · ')}</b></div>
                <div><span>日主</span><b>{result.bazi.dayMaster} · {result.bazi.strength}</b></div>
                <div><span>调和倾向</span><b>{result.bazi.favorable.join('、')}</b></div>
              </div>
              <div className="cg-line-list">
                {result.lines.map((l) => (
                  <div key={l.key} className="cg-line">
                    <span className="cg-line-label">{l.label}</span>
                    <div className="cg-line-body">
                      <span className="cg-line-text">{l.text}</span>
                      {l.plain && <span className="cg-line-plain">{l.plain}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <p className="cg-foot">「称骨歌诀」流传千古，权作参考。命由我作，福自己求。</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ChengguForm({ onDone }) {
  const now = new Date()
  const [calendar, setCalendar] = useState('solar')
  const [year, setYear] = useState(1995)
  const [month, setMonth] = useState(6)
  const [day, setDay] = useState(15)
  const [lunarLeap, setLunarLeap] = useState(false)
  const [hour, setHour] = useState(12)
  const [timeKnown, setTimeKnown] = useState(true)
  const [gender, setGender] = useState('男')
  const [name, setName] = useState('')

  const daysInMonth = (y, m) => new Date(y, m, 0).getDate()
  const years = []
  for (let y = now.getFullYear(); y >= 1926; y--) years.push(y)

  const lunarMonths = calendar === 'lunar' ? getLunarMonths(year) : []
  const lunarMaxDay = calendar === 'lunar' ? getLunarDayCount(year, month, lunarLeap) : daysInMonth(year, month)

  const adjustDay = (d) => setDay(Math.min(d, calendar === 'lunar' ? getLunarDayCount(year, month, lunarLeap) : daysInMonth(year, month)))
  const setM = (m, leap) => { setMonth(m); setLunarLeap(!!leap); setDay(prev => Math.min(prev, calendar === 'lunar' ? getLunarDayCount(year, m, !!leap) : daysInMonth(year, m))) }
  const setY = (y) => {
    setYear(y)
    if (calendar === 'lunar') {
      const ms = getLunarMonths(y)
      if (ms.length) { const m0 = ms[0]; setMonth(m0.num); setLunarLeap(m0.leap); setDay(Math.min(day, getLunarDayCount(y, m0.num, m0.leap))) }
    } else setDay(prev => Math.min(prev, daysInMonth(y, month)))
  }

  const submit = () => {
    let outYear = year, outMonth = month, outDay = day
    if (calendar === 'lunar') {
      const sol = tryLunarToSolar(year, month, day, lunarLeap)
      // 农历下拉已按年份/闰月约束过取值，这里只是防御：换算不出来就不要提交，
      // 绝不能把无效农历原样当公历排盘（那会排出一张看不出问题的错盘）。
      if (!sol) return
      outYear = sol.year; outMonth = sol.month; outDay = sol.day
    }
    onDone({ year: outYear, month: outMonth, day: outDay, hour: timeKnown ? hour : 12, gender, name, sourceCalendar: calendar })
  }

  return (
    <div className="card rise rise-3 chenggu-entry-form">
      <div className="form-head">✦ 获取称骨命书 ✦</div>
      <p className="form-sub">输入生辰 · 称出你的骨重与命格</p>

      <div className="field chenggu-date-field">
        <label className="date-label-row">
          <span>出生日期<span className="req">*</span></span>
          <span className="cal-switch">
            <span className={`cal-chip ${calendar === 'solar' ? 'active' : ''}`} onClick={() => { setCalendar('solar'); setLunarLeap(false) }}>阳历</span>
            <span className={`cal-chip ${calendar === 'lunar' ? 'active' : ''}`} onClick={() => setCalendar('lunar')}>农历</span>
          </span>
        </label>
        <div className="date-row">
          <div className="select-wrap">
            <select value={year} onChange={e => setY(+e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y} 年</option>)}
            </select>
          </div>
          <div className="select-wrap">
            <select value={calendar === 'lunar' ? (lunarLeap ? `闰${month}` : `${month}`) : month} onChange={e => {
              if (calendar === 'lunar') { const v = e.target.value; setM(+v.replace('闰', ''), v.startsWith('闰')) }
              else setM(+e.target.value)
            }}>
              {calendar === 'lunar'
                ? lunarMonths.map(m => <option key={m.key} value={m.key}>{m.label}</option>)
                : Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 月</option>)}
            </select>
          </div>
          <div className="select-wrap">
            <select value={day} onChange={e => adjustDay(+e.target.value)}>
              {Array.from({ length: lunarMaxDay }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 日</option>)}
            </select>
          </div>
        </div>
        {calendar === 'lunar' && <p className="field-hint">农历输入会自动换算为公历排盘</p>}
      </div>

      <div className="field">
        <label>出生时辰</label>
        <ShichenPicker
          value={hour}
          timeKnown={timeKnown}
          onChange={({ hour: h, timeKnown: tk }) => {
            setHour(h)
            setTimeKnown(tk)
          }}
        />
      </div>

      <div className="field">
        <label>性别</label>
        <div className="select-wrap">
          <select value={gender} onChange={e => setGender(e.target.value)}>
            <option value="男">乾造 · 男</option>
            <option value="女">坤造 · 女</option>
          </select>
        </div>
      </div>

      <div className="field chenggu-name-field">
        <label>称呼（可选）</label>
        <input type="text" placeholder="怎么称呼你？" value={name} maxLength={12} onChange={e => setName(e.target.value)} />
      </div>

      <div className="form-actions">
        <button className="btn" style={{ width: '100%' }} onClick={submit}>
          ✦ 称骨论命
        </button>
        <p className="form-note">基于你的生辰推算骨重与命格 · 仅供自我探索参考</p>
      </div>
    </div>
  )
}
