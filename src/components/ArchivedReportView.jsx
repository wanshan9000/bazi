import ReportView from './ReportView.jsx'
import FusedHuangliCard from './FusedHuangliCard.jsx'
import { TarotArchiveReading } from './TarotReading.jsx'

function isSchemaReport(report) {
  return Array.isArray(report?.report?.sections)
}

function hasHuangliSnapshot(report) {
  const data = report?.report
  return report?.type === 'huangli' && Boolean(data?.date && data?.real && data?.scene)
}

function hasTarotSnapshot(report) {
  const data = report?.report
  return report?.type === 'tarot' && Boolean(data?.spread && Array.isArray(data.cards) && data.cards.length && data?.interpretation)
}

function splitVerseLines(value) {
  return String(value || '').match(/[^。！？]+[。！？]?/g)?.map(item => item.trim()).filter(Boolean) || []
}

function ArchivedChengguView({ data }) {
  return (
    <div className="archived-chenggu-view chenggu-result">
      <section className="cg-summary">
        <div className="cg-total"><span className="cg-total-num">{data.summary.total}</span><span className="cg-total-unit">两</span></div>
        <div className="cg-grade"><span className="cg-grade-name">传统档位</span><span className="cg-grade-tone">{data.summary.tone}</span></div>
        <div className="cg-summary-meta">{[data.summary.lunarYear, data.summary.lunarMonth, data.summary.lunarDay, data.summary.shiChen ? `${data.summary.shiChen}时` : '', data.summary.gender].filter(Boolean).join(' · ')}</div>
        {data.verdict?.plain ? <p className="cg-summary-plain">{data.verdict.plain}</p> : null}
      </section>
      {Array.isArray(data.breakdown) && data.breakdown.length ? <section className="cg-bones"><h3 className="cg-h3">骨重明细</h3><div className="cg-bone-grid">{data.breakdown.map(item => <div key={item.name} className="cg-bone-card"><div className="cg-bone-name">{item.name}</div><div className="cg-bone-value">{item.value}<span> 两</span></div><div className="cg-bone-detail">{item.detail}</div></div>)}</div></section> : null}
      {data.classic?.sourceVerse ? <section className="cg-classic"><h3 className="cg-h3">传统歌诀</h3><div className="cg-classic-card"><div className="cg-classic-head"><span>歌诀原文</span><b>{data.classic.title}</b></div><p className="cg-classic-text">{splitVerseLines(data.classic.sourceVerse).map((line, index) => <span key={index}>{line}</span>)}</p></div></section> : null}
      {Array.isArray(data.lines) && data.lines.length ? <section className="cg-lines"><h3 className="cg-h3">结合八字的日常建议</h3>{data.bazi ? <div className="cg-bazi-basis"><div><span>四柱</span><b>{data.bazi.pillars?.join(' · ')}</b></div><div><span>日主</span><b>{data.bazi.dayMaster} · {data.bazi.strength}</b></div><div><span>调和倾向</span><b>{data.bazi.favorable?.join('、')}</b></div></div> : null}<div className="cg-line-list">{data.lines.map(item => <div key={item.key || item.label} className="cg-line"><span className="cg-line-label">{item.label}</span><div className="cg-line-body"><span className="cg-line-text">{item.text}</span>{item.plain ? <span className="cg-line-plain">{item.plain}</span> : null}</div></div>)}</div></section> : null}
    </div>
  )
}

function ArchivedNameView({ data }) {
  const result = data.analysis
  const recs = Array.isArray(data.recommendations) ? data.recommendations : []
  return (
    <div className="archived-name-view">
      {result ? <section className="name-result"><div className="nr-summary"><div className="nr-score-wrap"><div className="nr-score"><span className="nr-score-num">{result.score}</span><span className="nr-score-of">/100</span></div><div className="nr-grade"><span className="nr-grade-name">{result.grade}</span><span className="nr-grade-desc">{result.summaryText}</span></div></div><div className="nr-input-echo"><span>姓名：</span><em>{result.input?.surname || ''}<b>{result.input?.given}</b></em></div></div>{Array.isArray(result.grid) && result.grid.length ? <div className="nr-grids">{result.grid.map(item => <div key={item.name} className={`nr-grid ${item.luck?.吉 ? 'good' : 'bad'}`}><div className="nr-grid-top"><span className="nr-grid-name">{item.name}</span><span className="nr-grid-num">{item.value}画</span></div><div className="nr-grid-wx">{item.wuxing}</div><div className="nr-grid-cat">{item.luck?.category}</div><p className="nr-grid-desc">{item.desc}</p></div>)}</div> : null}{result.sancai ? <div className="nr-sancai"><h3>三才配置</h3><div className="nr-sancai-row"><div className="nr-sancai-pill">{result.sancai.tian}（天）</div><span className="arrow">→</span><div className="nr-sancai-pill">{result.sancai.ren}（人）</div><span className="arrow">→</span><div className="nr-sancai-pill">{result.sancai.di}（地）</div></div><p className="nr-sancai-verdict">配置判定：<b>{result.sancai.verdict}</b></p></div> : null}</section> : null}
      {recs.length ? <section className="name-recs"><h3 className="recs-h"><span className="deco">Recommended</span>推荐好名</h3><div className="recs-grid">{recs.map((item, index) => <div key={`${item.input?.surname}-${item.input?.given}-${index}`} className="rec-card"><div className="rec-name">{item.input?.surname}<b>{item.input?.given}</b></div><div className="rec-meta"><span>综合得分 <em>{item.score}</em> · {item.grade}</span></div><p className="rec-text">{item.summaryText}</p></div>)}</div></section> : null}
    </div>
  )
}

function ArchivedFengshuiView({ data }) {
  return (
    <div className="archived-fengshui-view">
      <section className="fs-overview"><div className="ov-card"><div className="ov-label">综合评分</div><div className="ov-score">{data.overallScore}</div><div className="ov-bar"><span style={{ width: `${data.overallScore}%` }} /></div></div><div className="ov-info"><div className="ov-row"><span>门向</span><em>{data.door?.dir}（{data.door?.wuxing}）</em></div><div className="ov-row"><span>喜忌</span><em>喜 {data.favorable?.join('、')} · 忌 {data.avoid?.join('、')}</em></div><div className="ov-row"><span>吉位</span><em>{data.lucky?.生方}（生气） · {data.lucky?.天医}（天医） · {data.lucky?.延年}（延年）</em></div></div></section>
      {Array.isArray(data.summary) && data.summary.length ? <section className="fs-summary"><h3 className="n-h">整体建议</h3><ul className="fs-list">{data.summary.map((item, index) => <li key={index}>{item}</li>)}</ul></section> : null}
      {Array.isArray(data.rooms) && data.rooms.length ? <section className="fs-rooms"><h3 className="n-h">房间详解</h3><div className="fs-rooms-grid">{data.rooms.map(room => <div key={room.key || room.name} className={`fs-room-card ${room.score >= 80 ? 'good' : room.score >= 60 ? 'mid' : 'bad'}`}><div className="fr-head"><span className="fr-name">{room.name}</span><span className="fr-dir">{room.dir}宫 · 五行属 <em>{room.wuxing}</em></span></div><div className="fr-score"><span>{room.score}</span> / 100</div><p className="fr-role">{room.role}</p><p className="fr-ideal">要点：{room.ideal}</p>{room.tips?.length ? <div className="fr-tips"><h5>重点建议</h5><ul>{room.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul></div> : null}{room.colorList?.length ? <div className="fr-colors"><h5>推荐颜色</h5><div className="fr-color-list">{room.colorList.map(color => <span key={color} className="fr-color">{color}</span>)}</div></div> : null}</div>)}</div></section> : null}
      {data.desk ? <section className={`fs-desk-result ${data.desk.verdict === '宜用' ? 'good' : 'adjust'}`}><div className="fs-desk-score-wrap"><span className="fs-desk-kicker">DESK &amp; SEAT</span><h3>书桌 / 座位风水</h3><div className="fs-desk-score"><b>{data.desk.score}</b><span>/ 100</span></div><em>{data.desk.verdict}</em></div><div className="fs-desk-reading"><div className="fs-desk-meta"><span>当前朝向</span><b>{data.desk.dir}（{data.desk.wuxing}）</b><span>优先方向</span><b>{data.desk.preferredDir}</b></div>{data.desk.tips?.length ? <ul>{data.desk.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul> : null}</div></section> : null}
      {data.door?.match || data.bed?.desc ? <section className="fs-door"><h3 className="n-h">门向与床头</h3><div className="fs-door-row">{data.door?.match ? <div className="fs-door-card"><h4>大门朝向 · {data.door.dir}</h4><p>{data.door.match}</p></div> : null}{data.bed?.desc ? <div className={`fs-bed-card ${data.bed.verdict === '凶' ? 'bad' : 'good'}`}><h4>床头朝向 · {data.bed.dir} <span className="verdict">{data.bed.verdict}</span></h4><p>{data.bed.desc}</p></div> : null}</div></section> : null}
    </div>
  )
}

function dateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}/${date.getDate()}`
}

function ArchivedHoroscopeView({ data }) {
  return (
    <div className="archived-horoscope-view">
      <div className="hs-head"><div className="hs-sign-card"><div className="hs-sign-icon">{data.sign.icon}</div><div className="hs-sign-meta"><div className="hs-sign-name">{data.sign.name}</div><div className="hs-sign-en">{data.sign.en}</div><div className="hs-sign-ruler">守护星 · {data.sign.ruler}</div><div className="hs-sign-tags"><span>{data.sign.wx}象</span><span>{data.sign.color}</span><span>{data.sign.dateRange}</span></div></div><div className="hs-sign-rating"><div className="hs-sign-overall">{data.today.overall}</div><div className="hs-sign-star">{'★'.repeat(Math.round(data.today.overall))}{'☆'.repeat(5 - Math.round(data.today.overall))}</div></div></div></div>
      <div className="hs-today"><div className="hs-tone"><span className="hs-tone-tag">{data.today.tone}</span><p>{data.today.toneDesc}</p></div>{Array.isArray(data.today.scores) && data.today.scores.length ? <div className="hs-scores">{data.today.scores.map(item => <div key={item.key} className="hs-dim"><div className="hs-dim-name">{item.label}<small> · {item.en}</small></div><div className="hs-dim-bar"><span className="hs-dim-fill" style={{ width: `${(item.score / 5) * 100}%` }} /></div><div className="hs-dim-score">{item.score}<small>/5</small></div></div>)}</div> : null}<div className="hs-lucky"><div className="hs-lucky-item"><span>幸运色</span><em>{data.today.luckyColor}</em></div><div className="hs-lucky-item"><span>幸运数</span><em>{data.today.luckyNum}</em></div><div className="hs-lucky-item"><span>方位</span><em>{data.today.luckyDir}</em></div></div><div className="hs-yiji"><div className="yi"><h4>宜</h4><p>{data.today.yi?.join(' · ')}</p></div><div className="ji"><h4>忌</h4><p>{data.today.ji?.join(' · ')}</p></div></div></div>
      {data.tomorrow ? <div className="hs-tomorrow"><h3 className="n-h">明日速览</h3><div className="hs-t-card"><div className="hs-t-rating">{data.tomorrow.overall}</div><div className="hs-t-text"><div className="hs-t-tone">{data.tomorrow.tone}</div><p>{data.tomorrow.text}</p></div></div></div> : null}
      {Array.isArray(data.week) && data.week.length ? <div className="hs-week"><h3 className="n-h">本周走势</h3><div className="hs-week-grid">{data.week.map((item, index) => <div key={index} className={`hs-day ${index === 0 ? 'today' : ''}`}><div className="hs-day-w">周{item.weekday}</div><div className="hs-day-d">{dateLabel(item.date)}</div><div className="hs-day-score">{item.score}</div><div className="hs-day-bar"><span style={{ width: `${(item.score / 5) * 100}%` }} /></div><div className="hs-day-tone">{item.tone}</div></div>)}</div></div> : null}
    </div>
  )
}

function hasChengguSnapshot(report) {
  const data = report?.report
  return report?.type === 'chenggu' && Boolean(data?.summary && data?.classic && Array.isArray(data?.lines))
}

function hasNameSnapshot(report) {
  const data = report?.report
  return report?.type === 'name' && Boolean(data?.analysis || (Array.isArray(data?.recommendations) && data.recommendations.length))
}

function hasFengshuiSnapshot(report) {
  const data = report?.report
  return report?.type === 'fengshui' && Boolean(data?.door && Array.isArray(data?.rooms))
}

function hasHoroscopeSnapshot(report) {
  const data = report?.report
  return report?.type === 'horoscope' && Boolean(data?.sign && data?.today)
}

/** 归档阅读协调器：完整快照保持本门类的阅读体验；不完整旧记录由调用方显示档案兜底。 */
export default function ArchivedReportView({ report }) {
  if (isSchemaReport(report)) return <ReportView report={report.report} readonly hideLead />
  if (hasHuangliSnapshot(report)) {
    return <div className="card hl-report-card rise rise-4 archived-huangli-view"><FusedHuangliCard chart={report.chart} snapshot={report.report} historyMode defaultScenario={report.report.archive?.ui?.scenario || 'worker'} /></div>
  }
  if (hasTarotSnapshot(report)) return <TarotArchiveReading reading={report.report} />
  if (hasChengguSnapshot(report)) return <ArchivedChengguView data={report.report} />
  if (hasNameSnapshot(report)) return <ArchivedNameView data={report.report} />
  if (hasFengshuiSnapshot(report)) return <ArchivedFengshuiView data={report.report} />
  if (hasHoroscopeSnapshot(report)) return <ArchivedHoroscopeView data={report.report} />
  return null
}

export function hasNativeArchiveView(report) {
  return isSchemaReport(report) || hasHuangliSnapshot(report) || hasTarotSnapshot(report)
    || hasChengguSnapshot(report) || hasNameSnapshot(report) || hasFengshuiSnapshot(report) || hasHoroscopeSnapshot(report)
}
