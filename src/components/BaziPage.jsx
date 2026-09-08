import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TIAN_GAN, DI_ZHI, GAN_WUXING, GAN_YINYANG, ZHI_WUXING, ZHI_CANGGAN,
  SHENGXIAO, WUXING_COLOR, WUXING_ICON, WUXING_SHENG
} from '../data/ganzhi.js'
import { currentYearGanzhi } from '../engine/bazi.js'
import { buildBaziReport } from '../engine/baziReport.js'
import { buildMangpaiReport } from '../engine/reports.js'
import { analyzeMangpai } from '../engine/mangpai.js'
import { buildBaziFromSolar } from 'cantian-tymext'
import ReportView from './ReportView.jsx'
import ReportLock from './ReportLock.jsx'
import UpgradePrompt from './UpgradePrompt.jsx'
import ShichenPicker from './ShichenPicker.jsx'
import TrueSolarField from './TrueSolarField.jsx'
import { getLunarMonths, getLunarDayCount, tryLunarToSolar } from '../utils/lunar.js'
import { shiftDate } from '../utils/solarTime.js'
import { consumeCredit } from '../data/users.js'
import { hasPaid, markPaid } from '../engine/entitlements.js'
import { getMonthlyCredits, planByKey, nextPlanKey } from '../engine/membership.js'

const SHICHEN = [
  ['子时', '23-01'], ['丑时', '01-03'], ['寅时', '03-05'], ['卯时', '05-07'],
  ['辰时', '07-09'], ['巳时', '09-11'], ['午时', '11-13'], ['未时', '13-15'],
  ['申时', '15-17'], ['酉时', '17-19'], ['戌时', '19-21'], ['亥时', '21-23']
]
const SHICHEN_HOUR = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 }
const WX_LABEL = { 木: '木 · 仁', 火: '火 · 礼', 土: '土 · 信', 金: '金 · 义', 水: '水 · 智' }

export default function BaziPage({ chart, user, onBack, onChart, onRequireLogin, onUpgrade, onUserChange }) {
  const [editing, setEditing] = useState(!chart)
  const [tab, setTab] = useState('mangpai')
  // 命书扣减状态：paid=true 表示本次会话已成功扣分；reason=null 表示无错误；
  // reason='insufficient' 表示积分不足（展示升级卡）
  const [paid, setPaid] = useState(false)
  const [reason, setReason] = useState(null)

  useEffect(() => {
    if (!chart || !user) return
    // 一份报告 = 一次消费：同一用户、同一张盘、同一功能只在首次生成时扣分。
    // 此前用 useRef 记「已扣过」，而 ref 随组件挂载重置，返回首页再进来就重复扣 8 分。
    if (hasPaid(user.id, 'bazi.full', chart)) { setPaid(true); setReason(null); return }
    // 扣分走服务端 → 异步。effect 卸载后不要再 setState（换盘/返回首页很容易触发）。
    let alive = true
    consumeCredit(user.id, 'bazi.full').then(res => {
      if (!alive) return
      if (res.ok) {
        markPaid(user.id, 'bazi.full', chart)
        setPaid(true)
        setReason(null)
        // 扣分后把最新的用户对象抛回 App，否则顶栏/个人中心的积分余额一直是旧值
        if (res.user) onUserChange && onUserChange(res.user)
      } else if (res.reason === 'insufficient') {
        setPaid(false)
        setReason('insufficient')
      }
    })
    return () => { alive = false }
  }, [chart, user, onUserChange])

  return (
    <div className="page-wrap bazi-page">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>
        <h1 className="page-title bazi-page-title rise rise-1">
          <span>八字门</span>
          {chart && !editing && (
            <button className="title-chart-change" onClick={() => { setEditing(true); setTab('mangpai'); window.scrollTo(0, 0) }} title="更换生辰" aria-label="更换生辰">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 3v5h5" />
              </svg>
              <span>更换生辰</span>
            </button>
          )}
        </h1>
        <p className="page-sub rise rise-2">排四柱 · 看五行 · 找到你的出厂设置</p>

        {editing || !chart ? (
          <BirthFormComp
            onDone={(data) => {
              onChart(data)
              // 游客可直接排盘：盘面/五行等基础分析免费展示；完整命书按下方登录态 + 积分扣减
              setEditing(false)
              setTab('mangpai')
              window.scrollTo(0, 0)
            }}
          />
        ) : (
          <ChartResult
            chart={chart}
            tab={tab}
            setTab={setTab}
            user={user}
            paid={paid}
            reason={reason}
            onRequireLogin={onRequireLogin}
            onUpgrade={onUpgrade}
          />
        )}
      </div>
    </div>
  )
}

function BirthFormComp({ onDone }) {
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
  // 太阳真时校正：开启后，排盘时辰用换算后的 trueSolarHour
  const [useTrueSolar, setUseTrueSolar] = useState(false)
  const [trueSolarHour, setTrueSolarHour] = useState(null)
  // 真太阳时跨午夜时排盘日期要平移（-1 / +1），见 utils/solarTime.js 的 dayOffset
  const [trueSolarOffset, setTrueSolarOffset] = useState(0)
  const [placeLabel, setPlaceLabel] = useState('')

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
    // 太阳真时开启且换算成功 → 排盘用换算后的时辰
    const useTS = timeKnown && useTrueSolar && trueSolarHour != null
    const finalHour = useTS ? trueSolarHour : (timeKnown ? hour : 12)
    // 换算跨了午夜就把日期一起挪过去，否则日柱按旧日期、时柱按新时辰，两者打架
    if (useTS && trueSolarOffset) {
      const d = shiftDate(outYear, outMonth, outDay, trueSolarOffset)
      outYear = d.year; outMonth = d.month; outDay = d.day
    }
    onDone({ year: outYear, month: outMonth, day: outDay, hour: finalHour, gender, name, timeKnown, sourceCalendar: calendar, useTrueSolar, trueSolarHour, placeLabel })
  }

  return (
    <div className="card rise rise-3 bazi-entry-form">
      <div className="form-head">✦ 获取出厂说明书 ✦</div>
      <p className="form-sub">输入生辰 · 排出你的四柱八字与五行命局</p>

      <div className="field-pair">
        <div className="field">
          <label>性别</label>
          <div className="select-wrap">
            <select value={gender} onChange={e => setGender(e.target.value)}>
              <option value="男">乾造 · 男</option>
              <option value="女">坤造 · 女</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>称呼（可选）</label>
          <input type="text" placeholder="怎么称呼你？" value={name} maxLength={12} onChange={e => setName(e.target.value)} />
        </div>
      </div>

      <div className="field">
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
            // 手动指定时辰后，退出太阳真时校正，以手选为准
            if (tk) { setUseTrueSolar(false); setTrueSolarHour(null) }
          }}
        />
      </div>

      <div className="field">
        <TrueSolarField
          year={year}
          month={month}
          day={day}
          hour={hour}
          useTrueSolar={useTrueSolar}
          onChange={({ useTrueSolar: u, trueSolarHour: ts, trueSolarDayOffset: off, placeLabel: pl }) => {
            setTrueSolarOffset(off || 0)
            setUseTrueSolar(u)
            setTrueSolarHour(ts)
            setPlaceLabel(pl)
          }}
        />
      </div>

      <div className="form-actions">
        <button className="btn" style={{ width: '100%' }} onClick={submit}>
          ✦ 排定命盘
        </button>
        <p className="form-note">基于你的生辰推算四柱八字与五行命局 · 仅供自我探索参考</p>
      </div>
    </div>
  )
}

const HOUR_LABEL = (h) => {
  const hour = h ?? 12
  const idx = Math.min(11, Math.floor(((hour + 1) % 24) / 2))
  const label = SHICHEN[idx][0]
  const range = SHICHEN[idx][1]
  return { label, range }
}

function ChartResult({ chart, tab, setTab, user, paid, reason, onRequireLogin, onUpgrade }) {
  // 同上：完整命书是重计算，不能挂在渲染路径上每次重跑。
  // 依赖只有命盘与流派，两者不变则复用。
  const report = useMemo(
    () => (tab === 'ziping' ? buildBaziReport(chart) : buildMangpaiReport(chart)),
    [chart, tab],
  )
  const school = tab === 'ziping' ? '子平派' : '盲派'
  const reportRef = useRef(null)
  const handleMd = () => reportRef.current?.exportMd?.()
  const handleCopy = () => reportRef.current?.copy?.()
  const handleShare = () => reportRef.current?.share?.()

  // 复制/分享导出的是完整命书文本 → 登录后可用
  const actionsEl = user ? (
    <div className="br-actions">
      <button className="br-btn" onClick={handleCopy} data-tip="复制" title="复制报告" aria-label="复制报告">
        <span className="br-btn-icon">⧉</span>
      </button>
      <button className="br-btn" onClick={handleShare} data-tip="分享" title="分享报告" aria-label="分享报告">
        <span className="br-btn-icon">↗</span>
      </button>
    </div>
  ) : null

  return (
    <div className="rise bz-unified">
      {/* 命盘主体 */}
      <div className="rise">
        <ChartBoard chart={chart} school={school} onSchoolChange={setTab} actionsEl={actionsEl} />
      </div>

      {/* 报告正文（不含头部与 actions，由 ref 暴露导出/复制能力）
          · 未登录 → 引导注册
          · 已登录 + 积分够 → 解锁完整命书
          · 已登录 + 积分不足 → 升级提示 */}
      <div className="rise bz-report-body">
        {!user ? (
          <ReportLock
            user={user}
            onRequireLogin={onRequireLogin}
            backView="bazi"
            eyebrow={school === '盲派' ? '盲派 · 口诀捷径实战' : '子平派 · 正统清源法理'}
            title={`${school}完整命书 · 登录后解锁全文`}
            desc="上方的四柱盘面、五行能量与喜用忌神已为你免费排定；完整命书的逐项详解、大运流年精批，注册登录后即可展开阅读。"
          />
        ) : paid ? (
          <ReportView ref={reportRef} report={report} hideLead />
        ) : (
          <UpgradePrompt
            featureName={`${school}完整命书`}
            cost={8}
            remaining={getMonthlyCredits(user)}
            planLabel={planByKey(user.plan).name}
            onUpgrade={onUpgrade ? () => onUpgrade(nextPlanKey(user.plan)) : null}
          />
        )}
      </div>
    </div>
  )
}

// ---- 命盘盘面（融入子平派 / 盲派两大报告的开篇） ----
function ChartBoard({ chart, school = '子平派', onSchoolChange, actionsEl = null }) {
  const now = currentYearGanzhi()
  const total = Object.values(chart.wuxing).reduce((a, b) => a + b, 0)
  const isMangpai = school === '盲派'
  // 盲派专属：算一次 mangpaiResult，给「关键信息」三张盲派卡片用
  let mp = null
  if (isMangpai) {
    try {
      const pad2 = n => String(n).padStart(2, '0')
      const bazi = buildBaziFromSolar({
        solarTime: `${chart.year}-${pad2(chart.month)}-${pad2(chart.day)} ${pad2(chart.hour ?? 12)}:00`,
        gender: chart.gender === '女' ? 0 : 1,
        sect: 2,
      })
      mp = analyzeMangpai(bazi)
    } catch (e) { mp = null }
  }
  const strengthTxt = chart.strength.strong ? '身强' : chart.strength.weak ? '身弱' : '中和'
  const shichen = HOUR_LABEL(chart.hour)
  const weakestWx = chart.wuxingRank[chart.wuxingRank.length - 1]
  const weakestZero = chart.wuxing[weakestWx] === 0

  // 五行能量环分段（conic-gradient）
  const segs = []
  let acc = 0
  chart.wuxingRank.forEach((wx, i) => {
    const pct = (chart.wuxing[wx] / total) * 100
    const end = acc + pct
    if (i < chart.wuxingRank.length - 1) {
      segs.push(`${WUXING_COLOR[wx]} ${acc}% ${end - 1.5}%, transparent ${end - 1.5}% ${end}%`)
    } else {
      segs.push(`${WUXING_COLOR[wx]} ${acc}% ${end}%`)
    }
    acc = end
  })

  const strengthDesc =
    strengthTxt === '身强' ? '气势充沛，可任财官' :
    strengthTxt === '身弱' ? '贵在借力，宜守成深耕' : '外圆内方，动静相宜'

  return (
    <div className="zb-lead">
        {/* 横排署名：乾造/坤造 · 称呼（无称呼时占位同学），姓名+徽章居中，按钮组靠右 */}
        <div className="bazi-line">
          <div className="bazi-line-center">
            <span className="name-text">
              {`${chart.gender === '女' ? '坤造' : '乾造'} · ${chart.name || '同学'}`}
            </span>
            <span className="bazi-school-switch" role="group" aria-label="命书流派">
              <button
                className={`bazi-school-tag is-special ${!isMangpai ? 'active' : ''}`}
                onClick={() => onSchoolChange && onSchoolChange('ziping')}
              >
                子平命书
              </button>
              <button
                className={`bazi-school-tag is-special ${isMangpai ? 'active' : ''}`}
                onClick={() => onSchoolChange && onSchoolChange('mangpai')}
              >
                盲派命书
              </button>
            </span>
          </div>
          {/* 复制 / 分享按钮紧跟"命书"徽章后，与徽章同行靠右显示 */}
          {actionsEl}
        </div>
        <div className="bazi-info">
          {chart.year} 年 {chart.month} 月 {chart.day} 日 · {shichen.label} {shichen.range} · {chart.shengxiao}肖
        </div>

        <div className="chart-divider">✦ ✦ ✦</div>

        {/* 四柱大卡：紧凑贯通表格 */}
        <div className="pillars">
          {chart.pillars.map(p => {
            const gwx = GAN_WUXING[TIAN_GAN.indexOf(p.gan)]
            const zwx = ZHI_WUXING[DI_ZHI.indexOf(p.zhi)]
            const isDay = p.label === '日柱'
            const cang = ZHI_CANGGAN[DI_ZHI.indexOf(p.zhi)]
            const yy = GAN_YINYANG[TIAN_GAN.indexOf(p.gan)]
            return (
              <div key={p.label} className={`pillar ${isDay ? 'day' : ''}`} style={{ ['--pc']: WUXING_COLOR[gwx], ['--yyc']: WUXING_COLOR[gwx] }}>
                <div className="p-top">
                  <span className="lab">{p.label}</span>
                  <span className={`p-yy ${yy === '阳' ? 'yang' : 'yin'}`} style={{ ['--yyc']: WUXING_COLOR[gwx] }} />
                  {isDay && <span className="p-tag">日主</span>}
                </div>
                <div className="p-mid">
                  <div className="gan" style={{ color: WUXING_COLOR[gwx] }}>{p.gan}</div>
                  <div className="zhi" style={{ color: WUXING_COLOR[zwx] }}>{p.zhi}</div>
                </div>
                <div className="p-bot">
                  <div className="p-ss">
                    <span className="p-ss-label">十神</span>
                    <span className="p-ss-name">{p.shiShen}</span>
                  </div>
                  <div className="p-cang">
                    {cang.map(g => <span key={g} className="cang-chip">{g}</span>)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 五行能量 —— 糖果仪表盘版 */}
        <section className="wx-panel">
          <header className="wx-head">
            <div className="wx-title">
              五行能量
              {!isMangpai && <span className="wx-sub">日主强弱一览</span>}
              {isMangpai && <span className="wx-sub">命主用神分布</span>}
            </div>
          </header>
          <div className="wx-body">
            <div className="wx-ring-wrap">
              <div className="wx-ring-glow" />
              <div className="wx-ring" style={{ background: `conic-gradient(${segs.join(', ')})` }} />
              <div className="wx-ring-inner">
                <div className="wx-master" style={{ color: WUXING_COLOR[chart.dayMasterWx] }}>{chart.dayMaster}</div>
                <div className="wx-pct" style={{ color: WUXING_COLOR[chart.wuxingRank[0]] }}>
                  {Math.round((chart.wuxing[chart.wuxingRank[0]] / total) * 100)}<i>%</i>
                </div>
                <div className="wx-master-label">{chart.dayMasterWx}日主 · 最旺{chart.wuxingRank[0]}</div>
              </div>
            </div>
            <ul className="wx-list">
              {chart.wuxingRank.map(wx => {
                const pct = Math.round((chart.wuxing[wx] / total) * 100)
                return (
                  <li key={wx} className="wx-item" style={{ ['--wx-c']: WUXING_COLOR[wx] }}>
                    <span className="wx-dot" />
                    <span className="wx-num">{WUXING_ICON[wx]}</span>
                    <span className="wx-name">{WX_LABEL[wx]}</span>
                    <span className="wx-bar"><i style={{ width: `${pct}%` }} /></span>
                    <span className="wx-val">{pct}<i>%</i></span>
                  </li>
                )
              })}
            </ul>
          </div>
          <footer className="wx-foot">
            <span className="wx-chip wx-chip-strong" style={{ ['--wx-c']: WUXING_COLOR[chart.wuxingRank[0]] }}>
              <b>最旺</b>{chart.wuxingRank[0]} {Math.round((chart.wuxing[chart.wuxingRank[0]] / total) * 100)}%
            </span>
            <span className="wx-chip" style={{ ['--wx-c']: WUXING_COLOR[weakestWx] }}>
              <b>最弱</b>{weakestWx} {Math.round((chart.wuxing[weakestWx] / total) * 100)}%
            </span>
            {weakestZero && (
              <span className="wx-chip wx-chip-warn">
                命中缺 {weakestWx}
              </span>
            )}
            <span className="wx-tail">
              五行齐布，命运自如 ↗
            </span>
          </footer>
        </section>

        {/* 关键信息 */}
        <div className={`meta-grid ${isMangpai ? 'meta-grid-3' : 'meta-grid-4'}`}>
          {!isMangpai && (
            <div className="meta">
              <div className="k">☯ 日主强弱</div>
              <div className="v gold">{strengthTxt}</div>
              <div className="d">{strengthDesc}</div>
            </div>
          )}
          {isMangpai && mp ? (
            <>
              <div className="meta">
                <div className="k">◎ 太极点</div>
                <div className="v gold">{mp.zuo?.xiaoLv?.grade || '—'}级效率</div>
                <div className="d">{mp.pre?.conclusion || '原局平静，待岁运引动'}</div>
              </div>
              <div className="meta">
                <div className="k">⚖ 根基五维</div>
                <div className="v gold">{mp.genji?.total ?? 0} 分</div>
                <div className="d">{mp.genji?.level || '—'} · {mp.genji?.kongPenalty ? `空亡扣${mp.genji.kongPenalty}分` : '日柱不落空亡'}</div>
              </div>
              <div className="meta">
                <div className="k">⚙ 做功主体</div>
                <div className="v gold">{mp.ty?.tiIsStrong ? '体强用弱' : mp.ty?.yongCount > 0 ? '用强体弱' : '体用并存'}</div>
                <div className="d">{mp.ty?.tiIsStrong ? '自己扛事，单干创业之命' : '借人成事，靠才艺手艺吃饭之命'}</div>
              </div>
            </>
          ) : (
            <>
              <div className="meta">
                <div className="k">✦ 喜用神</div>
                <div className="v gold">{chart.favorable.join('、')}</div>
                <div className="d">宜亲近 · 补命局之不足</div>
              </div>
              <div className="meta">
                <div className="k">✕ 忌神</div>
                <div className="v">{chart.avoid.join('、')}</div>
                <div className="d">宜规避 · 泄命局之有余</div>
              </div>
              <div className="meta">
                <div className="k">◉ 当前流年</div>
                <div className="v gold">{now.gan}{now.zhi}</div>
                <div className="d">{now.year} 年 · {GAN_WUXING[TIAN_GAN.indexOf(now.gan)]}气流年</div>
              </div>
            </>
          )}
        </div>
    </div>
  )
}
