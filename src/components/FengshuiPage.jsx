import { useState, useMemo } from 'react'
import { analyzeFengshui, FENG_SHUI_META } from '../engine/fengshui.js'
import { buildChart } from '../engine/bazi.js'
import { getLunarMonths, getLunarDayCount, tryLunarToSolar } from '../utils/lunar.js'

const DIRS = FENG_SHUI_META.DIRECTIONS.map(d => d.code)

export default function FengshuiPage({ chart, onBack, onChart }) {
  const [layout, setLayout] = useState({
    living: '东',
    master: '南',
    kitchen: '西',
    study: '北',
    door: '南',
    bedDir: '东南'
  })
  const [baziChart, setBaziChart] = useState(chart)
  const [showBazi, setShowBazi] = useState(false)

  const result = useMemo(() => {
    // ⚠ 这里原本写的是 `baziChart.pillars?.[0]?.ganzhi?.year || 1990` —— pillars[0] 的形状是
    // { label, gan, zhi, year, shiShen }，根本没有 ganzhi 这一层，取值恒为 undefined，
    // 于是页面宣称的「已结合八字」其实一律用 1990-01-01 12:00 男 这套假出生信息算喜忌。
    // 命盘顶层就带着真实的出生要素，直接用它。
    return analyzeFengshui({
      layout,
      birthInfo: baziChart
        ? {
          year: baziChart.year,
          month: baziChart.month,
          day: baziChart.day,
          hour: baziChart.hour,
          gender: baziChart.gender,
        }
        : null,
    })
  }, [layout, baziChart])

  const update = (key, value) => setLayout(prev => ({ ...prev, [key]: value }))

  const generateChart = (vals) => {
    const c = buildChart(vals.year, vals.month, vals.day, vals.hour, vals.gender)
    setBaziChart(c)
    onChart && onChart(c)
    setShowBazi(false)
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>
        <h1 className="page-title rise rise-1">风水分析 ⛩︎</h1>
        <p className="page-sub rise rise-2">户型方位 · 五行调和 · 八宅明局</p>

        <section className="card fs-form rise rise-2">
          <h3 className="n-h">请选择户型朝向</h3>
          {!baziChart && (
            <p className="fs-tip">提示：未结合八字将只做通用五行调和；推荐先排八字以获喜忌建议
              <button className="link-btn" onClick={() => setShowBazi(!showBazi)}>{showBazi ? '收起' : '排八字'}</button>
            </p>
          )}
          {showBazi && <BaziMiniForm onGenerate={generateChart} />}
          {baziChart && (
            <div className="fs-chart">
              <span>已结合八字 · 喜<em>{baziChart.favorable.join('、')}</em> · 忌<em>{baziChart.avoid.join('、')}</em></span>
            </div>
          )}
          <div className="fs-form-grid">
            <Field label="大门朝向" value={layout.door} onChange={v => update('door', v)} />
            <Field label="客厅方位" value={layout.living} onChange={v => update('living', v)} />
            <Field label="主卧方位" value={layout.master} onChange={v => update('master', v)} />
            <Field label="厨房方位" value={layout.kitchen} onChange={v => update('kitchen', v)} />
            <Field label="书房方位" value={layout.study} onChange={v => update('study', v)} />
            <Field label="床头朝向" value={layout.bedDir} onChange={v => update('bedDir', v)} />
          </div>
        </section>

        <section className="fs-overview rise rise-3">
          <div className="ov-card">
            <div className="ov-label">综合评分</div>
            <div className="ov-score">{result.overallScore}</div>
            <div className="ov-bar"><span style={{ width: `${result.overallScore}%` }} /></div>
          </div>
          <div className="ov-info">
            <div className="ov-row"><span>门向</span><em>{result.door.dir}（{result.door.wuxing}）</em></div>
            <div className="ov-row"><span>喜忌</span><em>喜 {result.favorable.join('、')} · 忌 {result.avoid.join('、')}</em></div>
            <div className="ov-row"><span>吉位</span><em>{result.lucky.生方}（生气） · {result.lucky.天医}（天医） · {result.lucky.延年}（延年）</em></div>
            <div className="ov-row"><span>主调色</span><em>{FENG_SHUI_META.COLOR_PALETTE[result.favorable[0]].join(' · ')}</em></div>
          </div>
        </section>

        <section className="fs-summary rise rise-3">
          <h3 className="n-h">整体建议</h3>
          <ul className="fs-list">
            {result.summary.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </section>

        <section className="fs-rooms rise rise-3">
          <h3 className="n-h">房间详解</h3>
          <div className="fs-rooms-grid">
            {result.rooms.map(r => (
              <div key={r.key} className={`fs-room-card ${r.score >= 80 ? 'good' : r.score >= 60 ? 'mid' : 'bad'}`}>
                <div className="fr-head">
                  <span className="fr-name">{r.name}</span>
                  <span className="fr-dir">{r.dir}宫 · 五行属 <em>{r.wuxing}</em></span>
                </div>
                <div className="fr-score">
                  <span>{r.score}</span> / 100
                </div>
                <p className="fr-role">{r.role}</p>
                <p className="fr-ideal">要点：{r.ideal}</p>
                <div className="fr-tips">
                  <h5>重点建议</h5>
                  <ul>
                    {r.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
                <div className="fr-colors">
                  <h5>推荐颜色</h5>
                  <div className="fr-color-list">
                    {r.colorList.map(c => <span key={c} className="fr-color">{c}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="fs-door rise rise-3">
          <h3 className="n-h">门向与床头</h3>
          <div className="fs-door-row">
            <div className="fs-door-card">
              <h4>大门朝向 · {result.door.dir}</h4>
              <p>{result.door.match}</p>
            </div>
            <div className={`fs-bed-card ${result.bed.verdict === '凶' ? 'bad' : 'good'}`}>
              <h4>床头朝向 · {result.bed.dir} <span className="verdict">{result.bed.verdict}</span></h4>
              <p>{result.bed.desc}</p>
            </div>
          </div>
        </section>

        <p className="fs-foot">风水讲求「藏风聚气」，本盘以八宅派简化算法出具，仅供布局参考；合理布置、勤于打扫，光线充足、空气流通，是任何户型的关键所在。</p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className="fs-field">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {DIRS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </label>
  )
}

function BaziMiniForm({ onGenerate }) {
  const [calendar, setCalendar] = useState('solar')
  const [year, setYear] = useState(1990)
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [lunarLeap, setLunarLeap] = useState(false)
  const [hour, setHour] = useState(12)
  const [gender, setGender] = useState('男')
  const daysInMonth = (yy, mm) => new Date(yy, mm, 0).getDate()
  const lunarMonths = calendar === 'lunar' ? getLunarMonths(year) : []
  const maxDay = calendar === 'lunar' ? getLunarDayCount(year, month, lunarLeap) : daysInMonth(year, month)

  const setMonthSafe = (m, leap) => {
    setMonth(m)
    setLunarLeap(!!leap)
    setDay(prev => Math.min(prev, calendar === 'lunar' ? getLunarDayCount(year, m, !!leap) : daysInMonth(year, m)))
  }

  const submit = () => {
    let outMonth = month, outDay = day
    if (calendar === 'lunar') {
      const sol = tryLunarToSolar(year, month, day, lunarLeap)
      // 农历下拉已按年份/闰月约束过取值，这里只是防御：换算不出来就不要提交，
      // 绝不能把无效农历原样当公历排盘（那会排出一张看不出问题的错盘）。
      if (!sol) return
      outMonth = sol.month; outDay = sol.day
    }
    onGenerate({ year, month: outMonth, day: outDay, hour, gender, sourceCalendar: calendar })
  }

  return (
    <div className="bazi-mini-form">
      <div className="bmf-cal">
        <span className={`cal-chip ${calendar === 'solar' ? 'active' : ''}`} onClick={() => { setCalendar('solar'); setLunarLeap(false) }}>阳历</span>
        <span className={`cal-chip ${calendar === 'lunar' ? 'active' : ''}`} onClick={() => setCalendar('lunar')}>农历</span>
        {calendar === 'lunar' && <em className="bmf-cal-hint">自动换算公历</em>}
      </div>
      <div className="bmf-row">
        <label><span>年</span><input type="number" value={year} onChange={e => setYear(+e.target.value)} /></label>
        <label><span>月</span>
          <select value={calendar === 'lunar' ? (lunarLeap ? `闰${month}` : `${month}`) : month} onChange={e => {
            if (calendar === 'lunar') { const v = e.target.value; setMonthSafe(+v.replace('闰', ''), v.startsWith('闰')) }
            else setMonthSafe(+e.target.value)
          }}>
            {calendar === 'lunar'
              ? lunarMonths.map(mm => <option key={mm.key} value={mm.key}>{mm.label}</option>)
              : Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 月</option>)}
          </select>
        </label>
        <label><span>日</span>
          <select value={day} onChange={e => setDay(+e.target.value)}>
            {Array.from({ length: maxDay }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 日</option>)}
          </select>
        </label>
        <label><span>时</span><input type="number" min="0" max="23" value={hour} onChange={e => setHour(+e.target.value)} /></label>
        <label><span>性别</span>
          <select value={gender} onChange={e => setGender(e.target.value)}>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </label>
        <button className="btn small" onClick={submit}>排盘</button>
      </div>
    </div>
  )
}
