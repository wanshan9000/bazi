import { useEffect, useState, useMemo } from 'react'
import { analyzeFengshui, FENG_SHUI_META } from '../engine/fengshui.js'
import { buildChart } from '../engine/bazi.js'
import { getLunarMonths, getLunarDayCount, tryLunarToSolar } from '../utils/lunar.js'
import ReportAgentFooter, { buildReportAgentPrompt } from './ReportAgentFooter.jsx'

const DIRS = FENG_SHUI_META.DIRECTIONS.map(d => d.code)

export default function FengshuiPage({ chart, onBack, onChart, onAskAgent, user, onReportReady }) {
  const [layout, setLayout] = useState({
    living: '东',
    master: '南',
    kitchen: '西',
    study: '北',
    door: '南',
    bedDir: '东南',
    deskDir: '东',
    seatBack: 'wall',
    seatFront: 'open',
    seatLeft: 'solid',
    seatRight: 'open',
    seatHazard: 'none',
  })
  const [baziChart, setBaziChart] = useState(chart)
  const [editingBirth, setEditingBirth] = useState(!chart)
  const [hasConfigured, setHasConfigured] = useState(false)
  const [archiveId, setArchiveId] = useState(null)

  const result = useMemo(() => {
    if (!baziChart) return null
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

  const update = (key, value) => {
    setHasConfigured(true)
    setArchiveId(null)
    setLayout(prev => ({ ...prev, [key]: value }))
  }

  const generateChart = (vals) => {
    const c = buildChart(vals.year, vals.month, vals.day, vals.hour, vals.gender)
    setBaziChart(c)
    setHasConfigured(true)
    setArchiveId(null)
    setEditingBirth(false)
    onChart && onChart(c)
  }
  useEffect(() => {
    if (editingBirth || !baziChart || !result || !user?.id || !hasConfigured || !onReportReady) return
    let alive = true
    onReportReady({
      type: 'fengshui',
      clientKey: `fengshui:${JSON.stringify(layout)}:${baziChart.year}-${baziChart.month}-${baziChart.day}-${baziChart.hour}-${baziChart.gender}`,
      title: '家居与座位风水 · 布局分析',
      summary: result.summary?.[0] || `综合评分 ${result.overallScore}/100`,
      result: {
        ...result,
        markdown: [
          '# 家居与座位风水 · 布局分析',
          `综合评分：${result.overallScore}/100\n门向：${result.door.dir}（${result.door.wuxing}）\n喜：${result.favorable.join('、')} · 忌：${result.avoid.join('、')}`,
          `## 书桌 / 座位风水\n评分：${result.desk.score}/100 · ${result.desk.verdict}\n朝向：${result.desk.dir}（${result.desk.wuxing}）\n${result.desk.tips.map(item => `- ${item}`).join('\n')}`,
          `## 整体建议\n${result.summary.map(item => `- ${item}`).join('\n')}`,
          `## 房间详解\n${result.rooms.map(room => `### ${room.name}\n${room.tips.join('；')}`).join('\n\n')}`,
        ].join('\n\n'),
      },
      chart: baziChart,
      facts: [
        `户型门向：${result.door.dir}（${result.door.wuxing}）`,
        `综合评分：${result.overallScore}/100`,
        `喜忌：喜 ${result.favorable.join('、')} · 忌 ${result.avoid.join('、')}`,
        `书桌 / 座位：${result.desk.dir}向 · ${result.desk.score}/100 · ${result.desk.verdict}`,
      ],
    }).then(id => { if (alive && id) setArchiveId(id) }).catch(() => {})
    return () => { alive = false }
  }, [baziChart, editingBirth, hasConfigured, layout, onReportReady, result, user?.id])
  const handleAskAgent = () => {
    if (!baziChart || !result) return
    onAskAgent?.({
    chart: baziChart,
    reportId: archiveId,
    prompt: buildReportAgentPrompt({
      reportName: '家居与座位风水',
      facts: [
        `户型门向：${result.door.dir}（${result.door.wuxing}）`,
        `综合评分：${result.overallScore}/100`,
        `喜忌：喜 ${result.favorable.join('、')} · 忌 ${result.avoid.join('、')}`,
        `吉位：${result.lucky.生方}（生气）· ${result.lucky.天医}（天医）· ${result.lucky.延年}（延年）`,
        `书桌 / 座位：${result.desk.dir}向（${result.desk.wuxing}）· ${result.desk.score}/100 · ${result.desk.verdict}`,
      ],
      report: { markdown: `# 家居与座位风水布局\n\n## 书桌 / 座位风水\n- 评分：${result.desk.score}/100 · ${result.desk.verdict}\n- 朝向：${result.desk.dir}（${result.desk.wuxing}）\n${result.desk.tips.map(item => `- ${item}`).join('\n')}\n\n## 整体建议\n${result.summary.map(item => `- ${item}`).join('\n')}\n\n${result.rooms.map(room => `### ${room.name}\n${room.tips.join('；')}`).join('\n\n')}` },
    }),
    })
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>
        <h1 className="page-title bazi-page-title fs-page-title rise rise-1">
          <span>风水分析</span>
          {baziChart && !editingBirth && (
            <button
              className="title-chart-change"
              onClick={() => { setEditingBirth(true); setArchiveId(null); window.scrollTo?.(0, 0) }}
              title="更换生辰"
              aria-label="更换生辰"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 3v5h5" />
              </svg>
              <span>更换生辰</span>
            </button>
          )}
        </h1>
        <p className="page-sub rise rise-2">户型方位 · 五行调和 · 八宅明局</p>

        {editingBirth || !baziChart ? (
          <section className="card fs-bazi-required rise rise-2">
            <span className="fs-bazi-kicker">PERSONAL BAZI REQUIRED</span>
            <h3 className="n-h">风水需结合个人八字</h3>
            <p>录入出生信息后，系统会依据你的喜用、忌神与命卦，计算户型、座位、方位和配色建议。</p>
            <BaziMiniForm onGenerate={generateChart} />
          </section>
        ) : (<>
        <section className="fs-analysis-block fs-home-analysis rise rise-2">
        <div className="card fs-form">
          <h3 className="n-h">请选择户型朝向</h3>
          <div className="fs-chart">
            <span>已结合个人八字 · 喜<em>{baziChart.favorable.join('、')}</em> · 忌<em>{baziChart.avoid.join('、')}</em></span>
          </div>
          <div className="fs-form-grid">
            <Field label="大门朝向" fieldKey="door" value={layout.door} onChange={v => update('door', v)} />
            <Field label="客厅方位" fieldKey="living" value={layout.living} onChange={v => update('living', v)} />
            <Field label="主卧方位" fieldKey="master" value={layout.master} onChange={v => update('master', v)} />
            <Field label="厨房方位" fieldKey="kitchen" value={layout.kitchen} onChange={v => update('kitchen', v)} />
            <Field label="书房方位" fieldKey="study" value={layout.study} onChange={v => update('study', v)} />
            <Field label="床头朝向" fieldKey="bedDir" value={layout.bedDir} onChange={v => update('bedDir', v)} />
          </div>
        </div>

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
        </section>

        <section className="fs-analysis-block fs-desk-analysis rise rise-3">
          <div className="fs-desk-panel">
            <div className="fs-desk-heading">
              <div><span className="fs-desk-kicker">FOCUS SEAT</span><h4>书桌 / 座位风水</h4></div>
              <p>先看背后是否有靠、前方是否开阔，再结合朝向取用。</p>
            </div>
            <div className="fs-desk-grid">
              <Field label="书桌面向" fieldKey="deskDir" value={layout.deskDir} onChange={v => update('deskDir', v)} />
              <ChoiceField label="背后环境" fieldKey="seatBack" value={layout.seatBack} onChange={v => update('seatBack', v)} options={SEAT_OPTIONS.back} />
              <ChoiceField label="前方视野" fieldKey="seatFront" value={layout.seatFront} onChange={v => update('seatFront', v)} options={SEAT_OPTIONS.front} />
              <ChoiceField label="左侧环境" fieldKey="seatLeft" value={layout.seatLeft} onChange={v => update('seatLeft', v)} options={SEAT_OPTIONS.side} />
              <ChoiceField label="右侧环境" fieldKey="seatRight" value={layout.seatRight} onChange={v => update('seatRight', v)} options={SEAT_OPTIONS.side} />
              <ChoiceField label="横梁 / 尖角" fieldKey="seatHazard" value={layout.seatHazard} onChange={v => update('seatHazard', v)} options={SEAT_OPTIONS.hazard} />
            </div>
          </div>
        <section className={`fs-desk-result ${result.desk.verdict === '宜用' ? 'good' : 'adjust'}`}>
          <div className="ov-card fs-desk-score-card">
            <div className="ov-label">座位评分</div>
            <div className="ov-score">{result.desk.score}</div>
            <div className="ov-bar"><span style={{ width: `${result.desk.score}%` }} /></div>
            <em className="fs-desk-verdict">{result.desk.verdict}</em>
          </div>
          <div className="fs-desk-reading">
            <div className="fs-desk-meta"><span>当前朝向</span><b>{result.desk.dir}（{result.desk.wuxing}）</b><span>优先方向</span><b>{result.desk.preferredDir}</b></div>
            <ul>{result.desk.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul>
          </div>
        </section>
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
        <ReportAgentFooter onAskAgent={handleAskAgent} onBack={onBack} />
        </>)}
      </div>
    </div>
  )
}

const SEAT_OPTIONS = {
  back: [['wall', '实墙 / 高靠'], ['door', '门 / 走道'], ['window', '窗']],
  front: [['open', '开阔'], ['door', '门'], ['window', '窗'], ['wall', '实墙']],
  side: [['solid', '有靠 / 矮柜'], ['open', '开阔'], ['window', '窗'], ['tall', '高柜 / 高物']],
  hazard: [['none', '无'], ['beam', '横梁'], ['corner', '尖角直冲']],
}

function Field({ label, fieldKey, value, onChange }) {
  return (
    <label className="fs-field">
      <span>{label}</span>
      <select data-fengshui-field={fieldKey} value={value} onChange={e => onChange(e.target.value)}>
        {DIRS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </label>
  )
}

function ChoiceField({ label, fieldKey, value, onChange, options }) {
  return (
    <label className="fs-field">
      <span>{label}</span>
      <select data-fengshui-field={fieldKey} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
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
    <section className="fs-bazi-entry" aria-label="个人八字信息">
      <div className="fs-bazi-date-bar">
        <span className="fs-bazi-date-label">出生日期<i>*</i></span>
        <div className="cal-switch">
          <span className={`cal-chip ${calendar === 'solar' ? 'active' : ''}`} onClick={() => { setCalendar('solar'); setLunarLeap(false) }}>阳历</span>
          <span className={`cal-chip ${calendar === 'lunar' ? 'active' : ''}`} onClick={() => setCalendar('lunar')}>农历</span>
        </div>
      </div>
      <div className="fs-bazi-form-grid">
        <label className="fs-bazi-control fs-bazi-control-year"><span>年</span><input type="number" value={year} onChange={e => setYear(+e.target.value)} /></label>
        <label className="fs-bazi-control"><span>月</span>
          <select value={calendar === 'lunar' ? (lunarLeap ? `闰${month}` : `${month}`) : month} onChange={e => {
            if (calendar === 'lunar') { const v = e.target.value; setMonthSafe(+v.replace('闰', ''), v.startsWith('闰')) }
            else setMonthSafe(+e.target.value)
          }}>
            {calendar === 'lunar'
              ? lunarMonths.map(mm => <option key={mm.key} value={mm.key}>{mm.label}</option>)
              : Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 月</option>)}
          </select>
        </label>
        <label className="fs-bazi-control"><span>日</span>
          <select value={day} onChange={e => setDay(+e.target.value)}>
            {Array.from({ length: maxDay }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 日</option>)}
          </select>
        </label>
        <label className="fs-bazi-control"><span>时</span><input type="number" min="0" max="23" value={hour} onChange={e => setHour(+e.target.value)} /></label>
        <label className="fs-bazi-control"><span>性别</span>
          <select value={gender} onChange={e => setGender(e.target.value)}>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </label>
      </div>
      <button className="btn fs-bazi-submit" onClick={submit}>✦ 排定命盘</button>
      {calendar === 'lunar' && <p className="fs-bazi-calendar-hint">农历输入将自动换算为公历排盘</p>}
    </section>
  )
}
