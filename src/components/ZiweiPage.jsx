import { useEffect, useMemo, useRef, useState } from 'react'
import { buildZiweiReport } from '../engine/reports.js'
import ReportView from './ReportView.jsx'
import ReportLock from './ReportLock.jsx'
import UpgradePrompt from './UpgradePrompt.jsx'
import ShichenPicker from './ShichenPicker.jsx'
import TrueSolarField from './TrueSolarField.jsx'
import { getLunarMonths, getLunarDayCount, tryLunarToSolar } from '../utils/lunar.js'
import { shiftDate } from '../utils/solarTime.js'
import { consumeCredit } from '../data/users.js'
import { hasPaid, markPaid } from '../engine/entitlements.js'
import { FEATURE_COSTS, getMonthlyCredits, planByKey, nextPlanKey, requiredPlanForFeature } from '../engine/membership.js'
import ReportAgentFooter, { buildReportAgentPrompt } from './ReportAgentFooter.jsx'

const SHICHEN = [
  { zhi: '子时', range: '23-01', hour: 0 },
  { zhi: '丑时', range: '01-03', hour: 2 },
  { zhi: '寅时', range: '03-05', hour: 4 },
  { zhi: '卯时', range: '05-07', hour: 6 },
  { zhi: '辰时', range: '07-09', hour: 8 },
  { zhi: '巳时', range: '09-11', hour: 10 },
  { zhi: '午时', range: '11-13', hour: 12 },
  { zhi: '未时', range: '13-15', hour: 14 },
  { zhi: '申时', range: '15-17', hour: 16 },
  { zhi: '酉时', range: '17-19', hour: 18 },
  { zhi: '戌时', range: '19-21', hour: 20 },
  { zhi: '亥时', range: '21-23', hour: 22 }
]

function getShichenByHour(hour) {
  const h = Number(hour)
  for (const s of SHICHEN) {
    if (s.hour === 0) {
      if (h >= 23 || h < 1) return s.zhi
    } else if (h >= s.hour && h < s.hour + 2) {
      return s.zhi
    }
  }
  return SHICHEN[0].zhi
}

const WX_STAR = {
  木: { lord: '天机 · 文曲', color: '青', tone: '灵动多变，思维敏捷' },
  火: { lord: '太阳 · 廉贞', color: '赤', tone: '光明显达，热情外放' },
  土: { lord: '天府 · 紫微', color: '黄', tone: '厚重沉稳，承载八方' },
  金: { lord: '武曲 · 七杀', color: '白', tone: '刚毅果决，雷厉风行' },
  水: { lord: '天同 · 破军', color: '玄', tone: '圆融善变，智谋深远' }
}

export default function ZiweiPage({ chart, onBack, onChart, user, onRequireLogin, onUpgrade, onUserChange, onAskAgent, onReportReady }) {
  const [editing, setEditing] = useState(false)
  const hasChart = !!chart
  const [paid, setPaid] = useState(false)
  const [reason, setReason] = useState(null)

  useEffect(() => {
    if (!chart || !user) return
    // 一份报告 = 一次消费：同一用户、同一张盘、同一功能只在首次生成时扣分。
    // 此前用 useRef 记「已扣过」，而 ref 随组件挂载重置，返回首页再进来就重复扣 8 分。
    if (hasPaid(user.id, 'ziwei.full', chart)) { setPaid(true); setReason(null); return }
    // 扣分走服务端 → 异步。effect 卸载后不要再 setState（换盘/返回首页很容易触发）。
    let alive = true
    consumeCredit(user.id, 'ziwei.full').then(res => {
      if (!alive) return
      if (res.ok) {
        markPaid(user.id, 'ziwei.full', chart)
        setPaid(true)
        setReason(null)
        // 扣分后把最新的用户对象抛回 App，否则顶栏/个人中心的积分余额一直是旧值
        if (res.user) onUserChange && onUserChange(res.user)
      } else if (res.reason === 'insufficient' || res.reason === 'plan_required') {
        setPaid(false)
        setReason(res.reason)
      }
    })
    return () => { alive = false }
  }, [chart, user, onUserChange])

  return (
    <div className="page-wrap ziwei-page">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>
        <h1 className="page-title bazi-page-title rise rise-1">
          <span>紫微门</span>
          {chart && !editing && (
            <button className="title-chart-change" onClick={() => { setEditing(true); window.scrollTo(0, 0) }} title="更换生辰" aria-label="更换生辰">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 3v5h5" />
              </svg>
              <span>更换生辰</span>
            </button>
          )}
        </h1>
        <p className="page-sub rise rise-2">览十二宫 · 观星曜 · 一览人生星光地图</p>

        {!hasChart || editing ? (
          <ZiweiBirthForm
            onDone={(data) => {
              onChart(data)
              setEditing(false)
            }}
          />
        ) : (
          <ZiweiBoard
            chart={chart}
            user={user}
            paid={paid}
            reason={reason}
            onRequireLogin={onRequireLogin}
            onUpgrade={onUpgrade}
            onAskAgent={onAskAgent}
            onReportReady={onReportReady}
            onBack={onBack}
          />
        )}
      </div>
    </div>
  )
}

/* ============ 紫微起盘台：八字信息输入（与奇门起盘台同构 · 星紫主题） ============ */
function ZiweiBirthForm({ onDone }) {
  // 紫微斗数排盘，必须依本人「生辰八字」——不可用当前时间代替出生时间
  const [form, setForm] = useState(() => ({
    year: 1990,
    month: 6,
    day: 30,
    hour: 12,
    timeKnown: true,
    gender: '男',
    name: ''
  }))
  const [calendar, setCalendar] = useState('solar') // solar 阳历 | lunar 农历
  const [lunarLeap, setLunarLeap] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 太阳真时校正：开启后，排盘时辰用换算后的 trueSolarHour
  const [useTrueSolar, setUseTrueSolar] = useState(false)
  const [trueSolarHour, setTrueSolarHour] = useState(null)
  const [trueSolarOffset, setTrueSolarOffset] = useState(0)
  const [placeLabel, setPlaceLabel] = useState('')

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // 真太阳时换算需公历日期：农历输入先换算一次，供 TrueSolarField 使用
  const solarBase = (() => {
    const y = Number(form.year) || 1990, m = Number(form.month) || 1, d = Number(form.day) || 1
    if (calendar === 'lunar') {
      const sol = tryLunarToSolar(y, m, d, lunarLeap)
      // 真太阳时预览用；换算失败就回落到原值，submit 那里会拦住并给出提示
      if (sol) return { year: sol.year, month: sol.month, day: sol.day }
    }
    return { year: y, month: m, day: d }
  })()
  const daysInMonth = (yy, mm) => new Date(yy, mm, 0).getDate()
  const lunarMonths = calendar === 'lunar' ? getLunarMonths(Number(form.year) || 1990) : []
  const maxDay = calendar === 'lunar'
    ? getLunarDayCount(Number(form.year) || 1990, Number(form.month) || 1, lunarLeap)
    : daysInMonth(Number(form.year) || 1990, Number(form.month) || 1)

  const setLunarMonth = (m, leap) => {
    setForm(prev => ({ ...prev, month: m }))
    setLunarLeap(!!leap)
    setForm(prev => ({ ...prev, day: Math.min(Number(prev.day) || 1, getLunarDayCount(Number(form.year) || 1990, m, !!leap)) }))
  }
  const handleYearChange = (v) => {
    update('year', v)
    if (calendar === 'lunar') {
      const yy = Number(v)
      if (yy) {
        const ms = getLunarMonths(yy)
        if (ms.length) {
          const m0 = ms[0]
          setForm(prev => ({ ...prev, month: m0.num }))
          setLunarLeap(m0.leap)
          setForm(prev => ({ ...prev, day: Math.min(Number(prev.day) || 1, getLunarDayCount(yy, m0.num, m0.leap)) }))
        }
      }
    }
  }

  const submit = (e) => {
    e?.preventDefault()
    setError('')
    const y = Number(form.year)
    const m = Number(form.month)
    const d = Number(form.day)
    if (!form.year || !form.month || !form.day) {
      setError('请填写您本人的生辰八字（出生年、月、日）')
      return
    }
    if (!y || !m || !d) {
      setError('请填写您本人的生辰八字（出生年、月、日）')
      return
    }
    if (calendar === 'lunar') {
      if (d < 1 || d > getLunarDayCount(y, m, lunarLeap)) {
        setError('请检查农历日期是否有效')
        return
      }
    } else if (m < 1 || m > 12 || d < 1 || d > 31) {
      setError('请检查出生日期是否有效（月 1-12 · 日 1-31）')
      return
    }
    // 防止用户误填当前年（如 2026）— 仅作软提示，不强约束
    const currentYear = new Date().getFullYear()
    if (y >= currentYear) {
      setError('出生年份似乎有误（紫微依生辰八字排盘，请输入您本人出生年）')
      return
    }
    setLoading(true)
    setTimeout(() => {
      let outYear = y, outMonth = m, outDay = d
      if (calendar === 'lunar') {
        const sol = tryLunarToSolar(y, m, d, lunarLeap)
        // 换算不出来说明这个农历日期不存在。绝不能原样当公历排盘 ——
        // 那会排出一张四柱俱全、用户看不出任何问题的错盘。
        if (!sol) { setLoading(false); setError('该农历日期不存在，请重新选择'); return }
        outYear = sol.year; outMonth = sol.month; outDay = sol.day
      }
      // 真太阳时跨午夜 → 日期同步平移，否则日柱与时柱各按一天，排出来是错盘
      const useTS = form.timeKnown && useTrueSolar && trueSolarHour != null
      if (useTS && trueSolarOffset) {
        const sd = shiftDate(outYear, outMonth, outDay, trueSolarOffset)
        outYear = sd.year; outMonth = sd.month; outDay = sd.day
      }
      onDone({
        year: outYear,
        month: outMonth,
        day: outDay,
        // 太阳真时开启且换算成功 → 排盘用换算后的时辰
        hour: useTS ? trueSolarHour : (form.timeKnown ? form.hour : 12),
        gender: form.gender,
        name: form.name.trim(),
        timeKnown: form.timeKnown,
        sourceCalendar: calendar,
        useTrueSolar, trueSolarHour, placeLabel
      })
    }, 420)
  }

  return (
    <div className="zw-board rise rise-3 ziwei-entry-form">
      <header className="zwb-header">
        <h3 className="zwb-title">
          <span className="zwb-icon" aria-hidden>✦</span>
          <span>起紫微命盘</span>
        </h3>
        <p className="zwb-sub">请输入您本人的生辰八字（公历或农历皆可）</p>
      </header>

      <form className="zwb-form" onSubmit={submit}>
        <div className="zwb-row zwb-split">
          <div className="zwb-col">
            <label className="zwb-label">性别</label>
            <div className="zwb-field">
              <select className="zwb-input" value={form.gender} onChange={e => update('gender', e.target.value)}>
                <option value="男">乾造 · 男</option>
                <option value="女">坤造 · 女</option>
              </select>
            </div>
          </div>
          <div className="zwb-col">
            <label className="zwb-label">称呼（可选）</label>
            <input
              className="zwb-input"
              type="text"
              placeholder="怎么称呼你？"
              maxLength={12}
              value={form.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>
        </div>

        <div className="zwb-row">
          <div className="zwb-col">
            <label className="zwb-label zwb-label-row">
              <span>出生年 / 月 / 日</span>
              <span className="cal-switch">
                <span className={`cal-chip ${calendar === 'solar' ? 'active' : ''}`} onClick={() => { setCalendar('solar'); setLunarLeap(false) }}>阳历</span>
                <span className={`cal-chip ${calendar === 'lunar' ? 'active' : ''}`} onClick={() => setCalendar('lunar')}>农历</span>
              </span>
            </label>
            <div className="zwb-grid zwb-grid-3">
              <div className="zwb-field">
                <input
                  className="zwb-input"
                  type="number" min="1900" max="2100"
                  placeholder="如 1995"
                  value={form.year}
                  onChange={e => handleYearChange(e.target.value)}
                />
                <span className="zwb-unit">年</span>
              </div>
              <div className="zwb-field">
                <select
                  className="zwb-input"
                  value={calendar === 'lunar' ? (lunarLeap ? `闰${form.month}` : `${form.month}`) : form.month}
                  onChange={e => {
                    if (calendar === 'lunar') {
                      const v = e.target.value
                      setLunarMonth(+v.replace('闰', ''), v.startsWith('闰'))
                    } else {
                      setForm(prev => ({ ...prev, month: +e.target.value }))
                      setForm(prev => ({ ...prev, day: Math.min(Number(prev.day) || 1, daysInMonth(Number(form.year) || 1990, +e.target.value)) }))
                    }
                  }}
                >
                  {calendar === 'lunar'
                    ? lunarMonths.map(mm => <option key={mm.key} value={mm.key}>{mm.label}</option>)
                    : Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 月</option>)}
                </select>
                <span className="zwb-unit">月</span>
              </div>
              <div className="zwb-field">
                <select
                  className="zwb-input"
                  value={form.day}
                  onChange={e => setForm(prev => ({ ...prev, day: +e.target.value }))}
                >
                  {Array.from({ length: maxDay }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 日</option>)}
                </select>
                <span className="zwb-unit">日</span>
              </div>
            </div>
            {calendar === 'lunar' && <p className="zwb-hint zwb-hint-block">农历输入会自动换算为公历排盘</p>}
          </div>
        </div>

        <div className="zwb-row">
          <div className="zwb-col">
            <label className="zwb-label">出生时辰</label>
            <ShichenPicker
              tone="purple"
              value={form.hour}
              timeKnown={form.timeKnown}
              onChange={({ hour, timeKnown }) => {
                // 手动指定时辰后，退出太阳真时校正，以手选为准
                if (timeKnown) { setUseTrueSolar(false); setTrueSolarHour(null) }
                setForm(prev => ({ ...prev, hour, timeKnown }))
              }}
            />
          </div>
        </div>

        <div className="zwb-row">
          <div className="zwb-col">
            <TrueSolarField
              year={solarBase.year}
              month={solarBase.month}
              day={solarBase.day}
              hour={form.hour}
              useTrueSolar={useTrueSolar}
              onChange={({ useTrueSolar: u, trueSolarHour: ts, trueSolarDayOffset: off, placeLabel: pl }) => {
                setTrueSolarOffset(off || 0)
                setUseTrueSolar(u)
                setTrueSolarHour(ts)
                setPlaceLabel(pl)
              }}
            />
          </div>
        </div>

        {error && <div className="zwb-error">{error}</div>}

        <button type="submit" className="zwb-launch" disabled={loading}>
          <span className="zwb-launch-icon" aria-hidden>✦</span>
          <span>{loading ? '正在起盘…' : '起紫微命盘'}</span>
        </button>

        <p className="zwb-note">生辰信息仅用于本次排盘 · 紫微斗数依此起十二宫 · 仅供自我探索参考</p>
      </form>
    </div>
  )
}

// 紫微免费章节（盘面/星曜信息层）—— 游客可直接阅读；以下「详批/运程」章节需登录解锁
const ZW_FREE_SECTIONS = ['info', 'gege', 'starOverview', 'quickPalaces', 'palaces', 'minggong', 'decadal', 'wuxingju']

// 调用方传了 paid / reason / onUpgrade，这里此前没有解构：
//  · `reason` 在下方渲染分支被直接读 → 已登录用户打开紫微页即 ReferenceError 白屏；
//  · `paid` 被忽略 → 扣分失败（积分不足）时照样把完整报告全文展示出去。
function ZiweiBoard({ chart, user, paid, reason, onRequireLogin, onUpgrade, onAskAgent, onReportReady, onBack }) {
  const star = WX_STAR[chart.dayMasterWx]
  const reportRef = useRef(null)
  const handleShare = () => reportRef.current?.share?.()
  const requiredPlan = requiredPlanForFeature('ziwei.full')

  // 完整报告生成后：登录用户看全部；游客只读「盘面/宫位/星曜」免费章节，详批章节显示解锁引导
  // ⚠ 组件每次渲染（滚动、按钮点击、任何 state 变化）都会重跑一遍完整排盘与报告生成。
  // 紫微完整报告要跑十二宫 + 四化 + 大限流年，是几十毫秒到上百毫秒的同步计算，
  // 放在渲染路径上会让页面交互明显发顿。命盘不变则结果不变，用 useMemo 锁住。
  const fullReport = useMemo(() => buildZiweiReport(chart), [chart])
  const freeSections = fullReport.sections.filter(s => ZW_FREE_SECTIONS.includes(s.key))
  const lockedCount = fullReport.sections.length - freeSections.length
  // 完整章节只在「已登录且本次确实扣到分」时展开。此前只判 user，积分不足的用户
  // 一样能看到全文，扣费形同虚设。
  const unlocked = !!user && paid
  const shownReport = unlocked ? fullReport : { ...fullReport, sections: freeSections }
  const [archiveId, setArchiveId] = useState(null)
  useEffect(() => {
    if (!user?.id || !unlocked || !onReportReady) return
    let alive = true
    onReportReady({
      type: 'ziwei',
      clientKey: `ziwei:${chart.year}-${chart.month}-${chart.day}-${chart.hour ?? 12}-${chart.gender}`,
      title: `紫微命盘 · ${chart.dayMaster || '命局'}日主`,
      summary: fullReport.sub || fullReport.title || '紫微斗数完整报告',
      result: fullReport,
      chart,
      facts: [
        `生辰：${chart.year}-${chart.month}-${chart.day} ${chart.hour ?? 12} 时`,
        `日主：${chart.dayMaster || '待查'} · 生肖：${chart.shengxiao || '待查'}`,
        `命主星曜：${star.lord}`,
      ],
    }).then(id => { if (alive && id) setArchiveId(id) }).catch(() => {})
    return () => { alive = false }
  }, [chart, fullReport, onReportReady, star.lord, unlocked, user?.id])
  const handleAskAgent = () => onAskAgent?.({
    chart,
    reportId: archiveId,
    prompt: buildReportAgentPrompt({
      reportName: '紫微斗数',
      facts: [
        `生辰：${chart.year}-${chart.month}-${chart.day} ${chart.hour ?? 12} 时`,
        `日主：${chart.dayMaster || '待查'} · 生肖：${chart.shengxiao || '待查'}`,
        `命主星曜：${star.lord}`,
      ],
      report: shownReport,
    }),
  })

  return (
    <div className="rise">
      <div className={`zw-head zw-report-head${user ? '' : ' zw-head--plain'}`}>
        {user && (
          <div className="zw-head-actions">
            <button className="zw-head-btn" onClick={handleShare} title="分享到社交" aria-label="分享到社交">↗</button>
          </div>
        )}
        <div className="chart-head">
          <div className="name" style={{ fontSize: 19 }}>{chart.dayMaster}日主 · 紫微完整报告</div>
          <div className="sub">命主星曜：{star.lord} · {chart.shengxiao}肖 {chart.gender === '男' ? '乾造' : '坤造'}</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ReportView ref={reportRef} report={shownReport} hideLead />
      </div>

      {!user ? (
        <div style={{ marginTop: 20 }}>
          <ReportLock
            user={user}
            onRequireLogin={onRequireLogin}
            backView="ziwei"
            icon="🌟"
            eyebrow="紫微斗数 · 详批全章节"
            title="命宫三方四正 · 逐宫详批 · 大限流年"
            desc="上方十二宫盘面、星曜概览已为你免费排定；命宫解析、三方四正、十二宫逐宫详批与当下大限流年开放给玄者及以上会员。"
            lockedCount={lockedCount}
          />
        </div>
      ) : (reason === 'insufficient' || reason === 'plan_required') ? (
        <UpgradePrompt
          featureName="紫微完整报告"
          cost={FEATURE_COSTS['ziwei.full']}
          remaining={getMonthlyCredits(user)}
          planLabel={planByKey(user.plan).name}
          lockedByPlan={reason === 'plan_required'}
          requiredPlanLabel={planByKey(requiredPlan).name}
          onUpgrade={onUpgrade ? () => onUpgrade(reason === 'plan_required' ? requiredPlan : nextPlanKey(user.plan)) : null}
        />
      ) : null}

      <ReportAgentFooter onAskAgent={handleAskAgent} onBack={onBack} />
    </div>
  )
}
