import { useEffect, useState } from 'react'
import { analyzeName, recommendName } from '../engine/nameAnalysis.js'
import { buildChart } from '../engine/bazi.js'
import { getLunarMonths, getLunarDayCount, tryLunarToSolar } from '../utils/lunar.js'
import ReportAgentFooter, { buildReportAgentPrompt } from './ReportAgentFooter.jsx'

export default function NamePage({ chart, onBack, onChart, onAskAgent, user, onReportReady }) {
  const [fullName, setFullName] = useState('')
  const [surname, setSurname] = useState('')
  const [result, setResult] = useState(null)
  const [recs, setRecs] = useState(null)
  const [baziChart, setBaziChart] = useState(chart)
  const [showBaziForm, setShowBaziForm] = useState(false)
  const [archiveId, setArchiveId] = useState(null)

  const handleAnalyze = () => {
    if (!fullName.trim()) return
    const name = fullName.trim()
    try {
      const r = analyzeName({ fullName: name, surname: surname.trim(), chart: baziChart })
      setResult(r)
    } catch (e) { alert(e.message) }
  }

  const handleRecommend = () => {
    if (!fullName.trim()) return
    if (!baziChart) {
      setShowBaziForm(true)
      return
    }
    const r = recommendName(baziChart, fullName.trim())
    setRecs(r)
  }

  const generateChart = (vals) => {
    const c = buildChart(vals.year, vals.month, vals.day, vals.hour, vals.gender)
    setBaziChart(c)
    onChart && onChart(c)
    setShowBaziForm(false)
  }
  useEffect(() => {
    if (!user?.id || (!result && !recs?.length) || !onReportReady) return
    const name = result ? `${result.input.surname || ''}${result.input.given}` : fullName.trim()
    const summary = result?.summaryText || (recs?.length ? `已生成 ${recs.length} 个结合喜用的备选名字` : '')
    let alive = true
    onReportReady({
      type: 'name',
      clientKey: `name:${name}:${baziChart ? `${baziChart.year}-${baziChart.month}-${baziChart.day}-${baziChart.hour}-${baziChart.gender}` : 'general'}`,
      title: `姓名测算 · ${name || '取名建议'}`,
      summary,
      result: {
        analysis: result,
        recommendations: recs,
        markdown: [
          result ? `# 姓名测算 · ${name}\n\n综合得分：${result.score}/100 · ${result.grade}\n\n${result.summaryText}\n\n三才：${result.sancai.tian} → ${result.sancai.ren} → ${result.sancai.di}（${result.sancai.verdict}）` : '',
          recs?.length ? `## 推荐好名\n${recs.map(item => `- ${item.input.surname || ''}${item.input.given}：${item.score}分 · ${item.grade} · ${item.summaryText}`).join('\n')}` : '',
        ].filter(Boolean).join('\n\n'),
      },
      chart: baziChart,
      facts: [
        name ? `姓名：${name}` : '',
        result ? `综合得分：${result.score}/100 · ${result.grade}` : '',
        baziChart ? `已结合喜用：${baziChart.favorable?.join('、') || '待查'}` : '通用五格与三才分析',
      ].filter(Boolean),
    }).then(id => { if (alive && id) setArchiveId(id) }).catch(() => {})
    return () => { alive = false }
  }, [baziChart, fullName, onReportReady, recs, result, user?.id])
  const handleAskAgent = () => {
    const recommended = recs?.map(item => `${item.input.surname || ''}${item.input.given}（${item.score}分，${item.grade}）`).join('、')
    const reportText = [
      result ? `姓名：${result.input.surname || ''}${result.input.given}\n综合得分：${result.score}/100 · ${result.grade}\n${result.summaryText}\n三才：${result.sancai.tian} → ${result.sancai.ren} → ${result.sancai.di}（${result.sancai.verdict}）` : '',
      recommended ? `推荐结果：${recommended}` : '',
    ].filter(Boolean).join('\n\n')
    onAskAgent?.({
      chart: baziChart,
      reportId: archiveId,
      prompt: buildReportAgentPrompt({
        reportName: '姓名测算',
        facts: [
          `当前姓名：${result ? `${result.input.surname || ''}${result.input.given}` : fullName.trim() || '待查'}`,
          baziChart ? `已结合八字喜用：${baziChart.favorable?.join('、') || '待查'}` : '当前为五格与三才通用分析，未输入八字。',
        ],
        report: { markdown: reportText },
      }),
    })
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>
        <h1 className="page-title rise rise-1">姓名测算 ✒︎</h1>
        <p className="page-sub rise rise-2">五格剖象 · 三才配置 · 八字喜忌</p>

        {/* 输入区 */}
        <section className="card name-input rise rise-2">
          <h3 className="n-h">输入姓名</h3>
          <div className="name-input-row">
            <label>
              <span>姓</span>
              <input value={surname} onChange={e => setSurname(e.target.value)} placeholder="可选，例如：王" />
            </label>
            <label>
              <span>名</span>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="必填，例如：梓萱" />
            </label>
          </div>
          {!baziChart && (
            <p className="name-input-hint">提示：未填八字时，将只做五格数理解读；想结合喜用神改名，可先排八字 ↓</p>
          )}
          {baziChart && (
            <div className="name-chart-info">
              <span className="nci-tag">已结合八字喜用神 ·</span>
              <span>喜<em>{baziChart.favorable.join('、')}</em> · 忌<em>{baziChart.avoid.join('、')}</em></span>
              <button className="link-btn" onClick={() => setShowBaziForm(!showBaziForm)}>{showBaziForm ? '收起' : '重新排盘'}</button>
            </div>
          )}
          {showBaziForm && (
            <div className="name-bazi-form">
              <BaziMiniForm onGenerate={generateChart} />
            </div>
          )}

          <div className="name-actions">
            <button className="btn" onClick={handleAnalyze}>分析姓名</button>
            <button className="btn ghost" onClick={handleRecommend}>推荐好名</button>
          </div>
        </section>

        {/* 分析结果 */}
        {result && (
          <section className="name-result rise rise-3">
            <div className="nr-summary">
              <div className="nr-score-wrap">
                <div className="nr-score">
                  <span className="nr-score-num">{result.score}</span>
                  <span className="nr-score-of">/100</span>
                </div>
                <div className="nr-grade">
                  <span className="nr-grade-name">{result.grade}</span>
                  <span className="nr-grade-desc">{result.summaryText}</span>
                </div>
              </div>
              <div className="nr-input-echo">
                <span>姓名：</span>
                <em>{result.input.surname || ''}<b>{result.input.given}</b></em>
              </div>
            </div>

            <div className="nr-grids">
              {result.grid.map(g => (
                <div key={g.name} className={`nr-grid ${g.luck.吉 ? 'good' : 'bad'}`}>
                  <div className="nr-grid-top">
                    <span className="nr-grid-name">{g.name}</span>
                    <span className="nr-grid-num">{g.value}画</span>
                  </div>
                  <div className="nr-grid-wx">{g.wuxing}</div>
                  <div className="nr-grid-cat">{g.luck.category}</div>
                  <p className="nr-grid-desc">{g.desc}</p>
                </div>
              ))}
            </div>

            <div className="nr-sancai">
              <h3>三才配置</h3>
              <div className="nr-sancai-row">
                <div className="nr-sancai-pill">{result.sancai.tian}（天）</div>
                <span className="arrow">→</span>
                <div className="nr-sancai-pill">{result.sancai.ren}（人）</div>
                <span className="arrow">→</span>
                <div className="nr-sancai-pill">{result.sancai.di}（地）</div>
              </div>
              <p className="nr-sancai-verdict">
                配置判定：<b className={result.sancai.verdict === '吉' ? 'good' : result.sancai.verdict === '凶' ? 'bad' : 'mid'}>{result.sancai.verdict}</b>
              </p>
            </div>

            <div className="nr-chars">
              <h3>字义拆解</h3>
              <div className="nr-chars-row">
                {(result.input.surname + result.input.given).split('').map((c, i) => (
                  <div key={i} className="nr-char">
                    <div className="nr-char-word">{c}</div>
                    <div className="nr-char-meta">{strokesOf(c) || '-'} 画</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 推荐好名 */}
        {recs && recs.length > 0 && (
          <section className="name-recs rise rise-3">
            <h3 className="recs-h">
              <span className="deco">Recommended</span>
              结合您的八字喜<em>{baziChart.favorable[0]}</em>，推荐如下好名
            </h3>
            <div className="recs-grid">
              {recs.map((r, i) => (
                <div key={i} className="rec-card">
                  <div className="rec-name">{r.input.surname}<b>{r.input.given}</b></div>
                  <div className="rec-meta">
                    <span>综合得分 <em>{r.score}</em> · {r.grade}</span>
                  </div>
                  <div className="rec-grids">
                    {r.grid.filter(x => x.name === '人格' || x.name === '总格').map(g => (
                      <span key={g.name} className={`rec-grid ${g.luck.吉 ? 'good' : 'bad'}`}>
                        {g.name}·{g.value} · {g.luck.category}
                      </span>
                    ))}
                  </div>
                  <p className="rec-text">{r.summaryText}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(result || recs?.length) && <ReportAgentFooter onAskAgent={handleAskAgent} onBack={onBack} />}
      </div>
    </div>
  )
}

function strokesOf(ch) {
  const map = { 一: 1, 二: 2, 三: 3, 四: 5, 五: 4, 六: 4, 七: 2, 八: 2, 九: 2, 十: 2, 王: 4, 林: 8, 梓: 11, 萱: 14, 木: 4, 梓萱: 17, 王梓萱: 13 }
  return map[ch] || null
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
