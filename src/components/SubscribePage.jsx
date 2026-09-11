import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildChart } from '../engine/bazi.js'
import { buildWeek, buildDaily, chartProfile } from '../engine/huangli.js'
import { generateHuangli, inferScenario, calcAge, sceneName } from '../engine/cantian.js'
import { WUXING_COLOR, WUXING_ICON } from '../data/ganzhi.js'
import { dayElement } from '../data/huangli.js'
import ShichenPicker from './ShichenPicker.jsx'
import TrueSolarField from './TrueSolarField.jsx'
import FusedHuangliCard from './FusedHuangliCard.jsx'
import ReportLock from './ReportLock.jsx'
import { api } from '../api/client.js'
import { getLunarMonths, getLunarDayCount, tryLunarToSolar } from '../utils/lunar.js'
import ReportAgentFooter, { buildReportAgentPrompt } from './ReportAgentFooter.jsx'
import { canUseHuangliReminder } from '../engine/membership.js'

const IDENTITY_OPTIONS = [
  { key: 'worker', name: '打工人', emoji: '💼' },
  { key: 'student', name: '学生党', emoji: '📚' },
  { key: 'free', name: '自由族', emoji: '🌿' },
  { key: 'enjoy', name: '享受族（退休人士）', emoji: '🍵' },
]

const LS_SUB = 'genki-huangli-sub'
const SHICHEN = [
  ['子时', '23-01'], ['丑时', '01-03'], ['寅时', '03-05'], ['卯时', '05-07'],
  ['辰时', '07-09'], ['巳时', '09-11'], ['午时', '11-13'], ['未时', '13-15'],
  ['申时', '15-17'], ['酉时', '17-19'], ['戌时', '19-21'], ['亥时', '21-23']
]
const SHICHEN_HOUR = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 }
const splitHuangliItems = value => String(value || '').split(/[、,，]/).map(item => item.trim()).filter(Boolean)

function loadSub() {
  try { return JSON.parse(localStorage.getItem(LS_SUB)) || null } catch { return null }
}

export default function SubscribePage({ chart: extChart, onBack, user, onRequireLogin, onUpgrade, onAskAgent, onReportReady }) {
  const saved = useMemo(loadSub, [])
  const [chart, setChart] = useState(extChart || saved?.chart || null)
  const [pref, setPref] = useState(saved?.pref || { time: 'morning', notify: false, enabled: true, role: '', favZodiac: [] })
  const [subToken, setSubToken] = useState(saved?.subToken || '')
  const [serverOk, setServerOk] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [today] = useState(() => new Date())
  // 整页"当前查看日期"（默认今天），本周速览 / 30 天选择器 / 今日黄历卡片都以此同步
  const [viewDate, setViewDate] = useState(() => new Date(today))

  // 若外部八字变化，同步（App 里排完盘再来订阅）
  useEffect(() => { if (extChart) setChart(extChart) }, [extChart])

  // 启动时探测后端是否可用，并记下短信/微信通道的真实状态。
  // 「开发降级模式」这类文案只有在通道确实处于 mock 时才该出现 —— 此前是硬编码，
  // 生产上配好了真实通道也照样显示，用户以为订阅只在本机生效。
  const [channels, setChannels] = useState({ sms: null, wechat: null })
  useEffect(() => {
    api.health().then(h => {
      // 订阅只依赖短信/微信通道，与元氣 AI 是否就绪无关。
      // 用 reachable 而不是 ok：否则没配 AI 密钥时，订阅页会谎称后端不可用。
      setServerOk(Boolean(h.reachable))
      setChannels({ sms: h.sms || null, wechat: h.wechat || null })
    }).catch(() => setServerOk(false))
  }, [])

  // 订阅持久化
  useEffect(() => {
    try { localStorage.setItem(LS_SUB, JSON.stringify({ chart, pref, subToken })) } catch { /* ignore */ }
  }, [chart, pref, subToken])

  const week = useMemo(() => buildWeek(today, chart), [chart, today])
  const profile = chart ? chartProfile(chart) : null

  // 根据订阅人的「年纪 + 性别 + 身份」自动推断黄历场景
  const age = useMemo(() => (chart ? calcAge(chart.year, chart.month, chart.day) : 0), [chart])
  const sceneKey = useMemo(() => inferScenario(age, pref.role, chart?.gender), [age, pref.role, chart?.gender])
  const reportData = useMemo(() => generateHuangli({
    chart,
    date: viewDate,
    scenario: sceneKey,
    mode: chart ? 'personalized' : 'standard',
    tone: 'practical',
  }), [chart, viewDate, sceneKey])
  const [archiveId, setArchiveId] = useState(null)
  useEffect(() => {
    if (!user?.id || !onReportReady || showForm) return
    let alive = true
    const birthKey = chart ? `${chart.year}-${chart.month}-${chart.day}-${chart.hour ?? 12}-${chart.gender}` : 'standard'
    const facts = [
      `日期：${reportData.date}（${reportData.lunar}，${reportData.ganzhi}）`,
      `宜：${splitHuangliItems(reportData.real?.yi).slice(0, 6).join('、') || '待查'}`,
      `忌：${splitHuangliItems(reportData.real?.ji).slice(0, 6).join('、') || '待查'}`,
      chart ? `场景：${reportData.scene.personaTitle || reportData.scene.persona || '个人安排'}` : '通用黄历',
    ]
    onReportReady({
      type: 'huangli',
      clientKey: `huangli:${reportData.date}:${birthKey}:${sceneKey}`,
      title: `${reportData.date} · ${chart ? '个性化黄历' : '黄历'}`,
      summary: reportData.daily?.relation || reportData.scene?.guidance?.[0]?.body || '今日黄历安排',
      result: {
        ...reportData,
        archive: {
          version: 1,
          mode: 'native',
          sourceType: 'huangli',
          input: { date: reportData.date, personalized: Boolean(chart) },
          ui: { scenario: sceneKey },
        },
        markdown: [
          `# ${reportData.date} 黄历报告`,
          reportData.real?.yi ? `宜：${reportData.real.yi}` : '',
          reportData.real?.ji ? `忌：${reportData.real.ji}` : '',
          reportData.daily?.relation ? `个人日气：${reportData.daily.relation}` : '',
          reportData.scene?.guidance?.map(item => `## ${item.title}\n${item.body}`).join('\n\n') || '',
        ].filter(Boolean).join('\n\n'),
      },
      chart,
      facts,
    }).then(id => { if (alive && id) setArchiveId(id) }).catch(() => {})
    return () => { alive = false }
  }, [chart, onReportReady, reportData, sceneKey, showForm, user?.id])
  const openHuangliAgent = () => {
    const facts = [
      `日期：${reportData.date}（${reportData.lunar}，${reportData.ganzhi}）`,
      `建除：${reportData.calendar?.jianchu || '待查'}`,
      `宜：${splitHuangliItems(reportData.real?.yi).slice(0, 6).join('、') || '待查'}`,
      `忌：${splitHuangliItems(reportData.real?.ji).slice(0, 6).join('、') || '待查'}`,
      chart
        ? `个人日气：${reportData.daily?.relation || '平'}；场景提示：${reportData.scene.personaTitle || reportData.scene.persona || '无'}`
        : '当前为通用黄历，未输入生辰八字。',
    ]
    onAskAgent?.({
      chart,
      reportId: archiveId,
      prompt: buildReportAgentPrompt({
        reportName: `${reportData.date} 黄历`,
        facts,
        report: { markdown: [
          `# ${reportData.date} 黄历报告`,
          reportData.real?.yi ? `宜：${reportData.real.yi}` : '',
          reportData.real?.ji ? `忌：${reportData.real.ji}` : '',
          reportData.scene?.guidance?.map(item => `${item.title}：${item.body}`).join('\n') || '',
        ].filter(Boolean).join('\n\n') },
      }),
    })
  }

  return (
    <div className="page-wrap hl-page">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>

        {/* 黄历 · 品牌主标题 */}
        <div className="hl-hero rise rise-1">
          <div className="hl-hero-title">
            <span className="hl-hero-main">
              <span>黄历</span>
              {!showForm && (
                <button className="title-chart-change" onClick={() => setShowForm(true)} title={chart ? '更换生辰' : '输入生辰'} aria-label={chart ? '更换生辰' : '输入生辰'}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 3v5h5" />
                  </svg>
                  <span>{chart ? '更换生辰' : '输入生辰'}</span>
                </button>
              )}
            </span>
          </div>
          <div className="hl-hero-sub">先读今日传统规则 · 再结合生辰看自己的安排</div>
        </div>

        {showForm ? (
          <BirthForm onDone={(c, role) => {
            setChart(c)
            // 空值代表“不手动指定”：清除旧选择，改由生辰年龄与性别自动判定场景。
            setPref(prev => ({ ...prev, role }))
            setShowForm(false)
          }} onCancel={() => setShowForm(false)} />
        ) : (
          <>
            {profile && <ProfileBar profile={profile} />}
            {!chart && <PersonalizePrompt onStart={() => setShowForm(true)} />}

            {/* 今日融合黄历（订阅设置 + 融合卡片） */}
            <div className="card hl-report-card rise rise-4">
              {chart && <div className="hl-report-head">
                <SubscribeBar
                  pref={pref}
                  setPref={setPref}
                  chart={chart}
                  subToken={subToken}
                  onSubscribed={token => setSubToken(token)}
                  serverOk={serverOk}
                  channels={channels}
                  user={user}
                  onRequireLogin={onRequireLogin}
                  onUpgrade={onUpgrade}
                />
              </div>}
              <FusedHuangliCard
                chart={chart}
                date={viewDate}
                onChangeDate={setViewDate}
                defaultScenario={sceneKey}
                myZodiac={profile?.shengxiao}
                favZodiac={pref.favZodiac || []}
              />
            </div>

            <WeekStrip week={week} personalized={Boolean(chart)} viewDate={viewDate} onSelectDate={setViewDate} />

            {chart && <MonthCurve chart={chart} today={today} />}

            <p className="form-note" style={{ marginTop: 14, textAlign: 'center' }}>
              {chart ? '已结合你的命局与当天日气生成提示 · 用作安排参考，主动选择始终在你' : '当前展示传统黄历信息 · 输入生辰后，可获得更贴近你的节奏与安排提示'}
            </p>

            <ReportAgentFooter onAskAgent={openHuangliAgent} onBack={onBack} />
          </>
        )}
      </div>
    </div>
  )
}

// ---- 生辰表单（与八字门一致） ----
function BirthForm({ onDone, onCancel }) {
  const now = new Date()
  const [calendar, setCalendar] = useState('solar')
  const [year, setYear] = useState(1995)
  const [month, setMonth] = useState(6)
  const [day, setDay] = useState(15)
  const [lunarLeap, setLunarLeap] = useState(false)
  const [hour, setHour] = useState(12)
  const [timeKnown, setTimeKnown] = useState(true)
  const [gender, setGender] = useState('男')
  const [role, setRole] = useState('')
  // 太阳真时校正：开启后，排盘时辰用换算后的 trueSolarHour
  const [useTrueSolar, setUseTrueSolar] = useState(false)
  const [trueSolarHour, setTrueSolarHour] = useState(null)
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
    const finalHour = timeKnown ? (useTrueSolar && trueSolarHour != null ? trueSolarHour : hour) : 12
    onDone(buildChart(outYear, outMonth, outDay, finalHour, gender), role)
  }

  return (
    <div className="card rise rise-3 huangli-entry-form">
      <div className="hl-form-head">
        <span className="hl-form-spark" aria-hidden="true">✦</span>
        <span>用你的八字看每日安排</span>
        <span className="hl-form-spark" aria-hidden="true">✦</span>
      </div>
      <p className="hl-form-sub">填入出生信息，查看命局与当天日气的关系，以及更贴近生活的安排建议</p>

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
          <label>你的日常场景</label>
          <div className="select-wrap">
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="">暂不选择（按生辰年龄与性别自动判断）</option>
              {IDENTITY_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.emoji} {o.name}</option>
              ))}
            </select>
          </div>
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
          onChange={({ useTrueSolar: u, trueSolarHour: ts, placeLabel: pl }) => {
            setUseTrueSolar(u)
            setTrueSolarHour(ts)
            setPlaceLabel(pl)
          }}
        />
      </div>

      <div className="form-actions">
        <button className="btn" style={{ width: '100%' }} onClick={submit}>
          ✦ 查看我的今日参考
        </button>
        <button type="button" className="hl-form-cancel" onClick={onCancel}>先看今日传统黄历</button>
      </div>
    </div>
  )
}

function PersonalizePrompt({ onStart }) {
  return (
    <aside className="hl-personalize-prompt rise rise-3">
      <div className="hl-personalize-mark" aria-hidden="true">✦</div>
      <div className="hl-personalize-copy">
        <b>先从今天的传统信息开始</b>
        <p>这里有每日宜忌、冲煞和日神方位。补充生辰后，页面会再给出命局与当天日气的关系，以及个人安排提示。</p>
      </div>
      <button type="button" className="btn small" onClick={onStart}>补充生辰</button>
    </aside>
  )
}

// ---- 命局概要条 ----
function ProfileBar({ profile }) {
  return (
    <div className="hl-profile rise rise-3">
      <div className="hl-profile-info">
        <div className="hl-profile-line">
          <span className="hl-profile-title">
            命盘摘要 · {profile.dayMaster}日主 · <em>{profile.dayMasterWx}</em>命 · {profile.shengxiao}肖
          </span>
          <span className={`hl-profile-strength ${profile.strength === '旺' ? 'strong' : 'weak'}`}>
            {profile.strength === '旺' ? '身旺' : '身弱'}
          </span>
        </div>
        <div className="hl-profile-tags">
          <span className="hl-tag good">偏好五行 {profile.favorable.join('·')}</span>
          <span className="hl-tag bad">留意五行 {profile.avoid.join('·')}</span>
          <span className="hl-tag wx">{profile.gender === '男' ? '乾造' : '坤造'}</span>
        </div>
      </div>
    </div>
  )
}

// ---- 订阅面板（短信 + 微信扫码，真实后端） ----
const TIMES = [
  { k: 'morning', label: '晨起', sub: '07:00', icon: '🌅' },
  { k: 'noon', label: '午间', sub: '12:00', icon: '☀️' },
  { k: 'evening', label: '晚归', sub: '21:00', icon: '🌙' }
]
const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

// 从 chart 提取生日信息（用于后端生成推送内容）
function birthFromChart(chart) {
  if (!chart) return null
  return {
    year: chart.year, month: chart.month, day: chart.day,
    hour: chart.hour ?? 12, gender: chart.gender === '男' ? 'm' : 'f',
  }
}

function SubscribeBar({ pref, setPref, chart, subToken, onSubscribed, serverOk, channels = {}, user, onRequireLogin, onUpgrade }) {
  // 短信在本地可降级联调；公众号模板消息必须完成公众号二维码、回调和模板配置，
  // 否则不能把普通网页登录扫码或 mock 当作可送达的微信提醒。
  const smsMock = channels.sms === 'local(mock)'
  const wechatReady = channels.wechat === 'official-template-ready'
  const reminderMember = canUseHuangliReminder(user)
  const fav = pref.favZodiac || []
  const birthZodiac = chart?.shengxiao || ''
  const [tab, setTab] = useState('sms') // sms | wechat
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [devCode, setDevCode] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [officialQrUrl, setOfficialQrUrl] = useState('')

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const toggleZodiac = (z) => {
    const next = fav.includes(z) ? fav.filter(x => x !== z) : [...fav, z]
    setPref(prev => ({ ...prev, favZodiac: next }))
    if (subToken) api.update(subToken, { favZodiac: next }).catch(() => {})
  }
  const pickTime = (k) => {
    setPref(prev => ({ ...prev, time: k }))
    if (subToken) api.update(subToken, { time: k }).catch(() => {})
  }

  const flash = (type, text) => {
    setMsg({ type, text })
    if (type !== '') setTimeout(() => setMsg({ type: '', text: '' }), 6000)
  }

  // 发送验证码
  const handleSendCode = async () => {
    if (!/^1\d{10}$/.test(phone)) return flash('err', '请输入正确的 11 位手机号')
    setBusy(true)
    try {
      const r = await api.sendCode(phone)
      setDevCode(r.devCode || '')
      setCountdown(60)
      flash('ok', r.msg || '验证码已发送')
    } catch (e) { flash('err', e.message) }
    setBusy(false)
  }

  // 短信订阅
  const handleSmsSubscribe = async () => {
    if (!/^1\d{10}$/.test(phone)) return flash('err', '请输入正确的 11 位手机号')
    if (!code) return flash('err', '请输入验证码')
    setBusy(true)
    try {
      const r = await api.smsSubscribe({ phone, code, birth: birthFromChart(chart), time: pref.time, favZodiac: fav })
      if (r.token) onSubscribed(r.token)
      flash('ok', r.msg || '订阅成功 🍀')
    } catch (e) { flash('err', e.message) }
    setBusy(false)
  }

  // 公众号关注：仅请求公众号通道信息，绝不沿用开放平台网页登录扫码的 openid。
  const handleWechat = async () => {
    if (!wechatReady) return flash('err', '公众号模板消息通道尚未完成配置')
    setBusy(true)
    try {
      const r = await api.officialWechatQr({ birth: birthFromChart(chart), time: pref.time, favZodiac: fav })
      if (!r.ready || !r.qrUrl) throw new Error('公众号关注二维码暂不可用')
      setOfficialQrUrl(r.qrUrl)
    } catch (e) { flash('err', e.message) }
    setBusy(false)
  }

  // 关注/扫码事件由公众号服务器异步回调；二维码显示期间每三秒查询一次绑定结果。
  useEffect(() => {
    if (!officialQrUrl) return
    let active = true
    const check = async () => {
      try {
        const r = await api.officialWechatStatus()
        if (active && r.bound && r.token) {
          onSubscribed(r.token)
          setOfficialQrUrl('')
          setShowModal(false)
          flash('ok', '公众号已绑定，模板消息提醒已开启')
        }
      } catch { /* 网络波动时继续等待，二维码本身仍有效 */ }
    }
    check()
    const timer = window.setInterval(check, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [officialQrUrl])

  // 已订阅态：显示订阅信息 + 取消
  const handleUnsubscribe = async () => {
    if (!subToken) return
    try { await api.unsubscribe(subToken) } catch { /* ignore */ }
    onSubscribed('')
    setPhone(''); setCode('')
    flash('ok', '已取消订阅')
  }

  // 开关点击：开通订阅属于会员权益 → 未登录先去注册/登录（成功后自动返回本页）
  const requireReminderMember = () => {
    if (!user) { onRequireLogin?.(); return true }
    if (!reminderMember) { onUpgrade?.(); return true }
    return false
  }

  // 开关点击：已订阅则关闭；未订阅则弹出"选择提醒方式"弹层
  const handleSwitchClick = () => {
    if (requireReminderMember()) return
    const isOn = !!subToken
    if (isOn) {
      if (subToken) handleUnsubscribe()
      setShowModal(false)
      flash('ok', '已关闭每日提醒')
      return
    }
    setShowModal(true)
  }

  return (
    <div className="hl-sub">
      {/* 未登录：订阅属会员权益，先注册/登录（成功后自动返回本页继续开通） */}
      {!user && (
        <div className="hl-sub-login">
          <span className="hl-sub-login-ic" aria-hidden>🔒</span>
          <span className="hl-sub-login-txt">注册或登录后，可绑定手机号或关注公众号，按所选时段接收每日黄历</span>
          <button className="hl-sub-login-btn" onClick={() => onRequireLogin && onRequireLogin()}>注册 / 登录</button>
        </div>
      )}

      {/* 顶部：订阅开关 */}
      <div className="hl-sub-head">
        <div className="hl-sub-head-l">
          <span className="hl-sub-ic">🔔</span>
          <span className="hl-sub-title">每日黄历提醒</span>
          <span className="hl-sub-tip">
            {!user
              ? '注册或登录后可开通凡者会员'
              : (!reminderMember
                ? '凡者会员起可用'
              : (serverOk
                ? (subToken ? '已开启 · 按所选时段推送' : '绑定手机号或关注公众号 · 按时段推送')
                : '提醒服务暂不可用'))}
          </span>
        </div>
        <button
          className={`hl-switch ${subToken ? 'on' : ''}`}
          onClick={handleSwitchClick}
          aria-pressed={!!subToken}
          title={subToken ? '点击关闭每日提醒' : '点击开通每日提醒'}
        >
          <span className="hl-switch-knob" />
        </button>
      </div>

      {/* 已订阅且连接后端：显示偏好管理 */}
      {reminderMember && serverOk && subToken ? (
        <>
          <div className="hl-sub-ok">
            <span className="hl-sub-ok-ic">✅</span>
            <span className="hl-sub-ok-txt">提醒已开启，将在所选时段发送当日黄历</span>
            <button className="hl-sub-ok-cancel" onClick={handleUnsubscribe}>关闭提醒</button>
          </div>

          {/* 时段三选 */}
          <div className="hl-sub-times-row">
            {TIMES.map(t => (
              <button key={t.k} className={`hl-sub-time ${pref.time === t.k ? 'active' : ''}`} onClick={() => pickTime(t.k)}>
                <span className="hl-sub-time-ic">{t.icon}</span>
                <span className="hl-sub-time-lbl">{t.label}</span>
                <small>{t.sub}</small>
              </button>
            ))}
          </div>
        </>
      ) : !user ? null : !reminderMember ? (
        <div className="hl-sub-prompt hl-sub-member-gate">
          <div className="hl-sub-prompt-txt">
            <div className="hl-sub-prompt-h">凡者会员专享每日黄历提醒</div>
            <div className="hl-sub-prompt-s">开通凡者及以上会员后，可选择手机短信或公众号模板消息接收。</div>
          </div>
          <button className="hl-sub-prompt-btn" onClick={() => onUpgrade?.()}>
            ✦ 开通凡者会员
          </button>
        </div>
      ) : serverOk ? (
        <>
          {/* 未订阅：简短提示 + 触发弹层 */}
          <div className="hl-sub-prompt">
            <div className="hl-sub-prompt-txt">
              <div className="hl-sub-prompt-h">把每日黄历送到你手边</div>
              <div className="hl-sub-prompt-s">绑定手机号接收短信，或关注公众号接收模板消息</div>
            </div>
            <button className="hl-sub-prompt-btn" onClick={() => { if (requireReminderMember()) return; setShowModal(true) }}>
              ✦ 设置提醒
            </button>
          </div>
        </>
      ) : (
        <div className="hl-sub-unavailable">提醒服务暂不可用，请稍后重试。</div>
      )}

      {/* 关注生肖 */}
      <div className="hl-sub-fav">
        <div className="hl-sub-fav-head">
          <span className="hl-sub-ic">🐾</span>
          <span className="hl-sub-title">标记关注生肖</span>
          <span className="hl-sub-tip">{birthZodiac ? `已按生辰标记${birthZodiac} · 可继续多选关注` : '可多选 · 展开生肖参考时会优先标出'}</span>
        </div>
        <div className="hl-zodiac-grid">
          {ZODIACS.map(z => {
            const isBirthZodiac = z === birthZodiac
            const isFollowed = fav.includes(z)
            return (
              <button
                key={z}
                data-zodiac={z}
                className={`hl-zodiac-chip ${isFollowed ? 'active' : ''} ${isBirthZodiac ? 'mine' : ''}`}
                onClick={() => toggleZodiac(z)}
                aria-pressed={isFollowed || isBirthZodiac}
                aria-label={isBirthZodiac ? `${z}，本命生肖${isFollowed ? '，已额外关注' : ''}` : `${isFollowed ? '取消关注' : '关注'}${z}`}
                title={isBirthZodiac ? `${z}是你的本命生肖${isFollowed ? '；已额外关注' : '；点击可额外关注'}` : (isFollowed ? `取消关注${z}` : `关注${z}`)}
              >
                {z}
                {isBirthZodiac && <span className="hl-zodiac-mine-mark" aria-hidden="true">我</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* 提示消息 */}
      {msg.text && (
        <div className={`hl-sub-msg ${msg.type}`}>{msg.text}</div>
      )}

      {/* 选择提醒方式 弹层：createPortal 跳出页面嵌套，fixed 遮罩相对视口铺满全屏 */}
      {showModal && createPortal(
        <div className="hl-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hl-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="hl-modal-title">
            <div className="hl-modal-head">
              <div id="hl-modal-title" className="hl-modal-title">✦ 设置每日提醒</div>
              <button className="hl-modal-close" onClick={() => setShowModal(false)} aria-label="关闭">×</button>
            </div>

            <p className="hl-sub-modal-intro">凡者及以上会员可开通提醒。选择一种接收方式，再设定方便查看的时段。</p>
            {smsMock && (
              <div className="hl-modal-dev-note">
                <span className="hl-modal-dev-ic">🛠️</span>
                <span>
                  <b>当前为本地短信联调：</b>验证码仅用于开发测试，正式上线需接入真实短信服务。
                </span>
              </div>
            )}
            <div className="hl-sub-methods">
              <button className={`hl-sub-method ${tab === 'sms' ? 'active' : ''}`} onClick={() => setTab('sms')}>📱 绑定手机号</button>
              <button className={`hl-sub-method ${tab === 'wechat' ? 'active' : ''}`} onClick={() => setTab('wechat')}>💬 关注公众号</button>
            </div>

            {tab === 'sms' ? (
              <div className="hl-sub-sms">
                <div className="hl-wechat-tip">绑定后，黄历将以短信发送到该手机号。</div>
                <div className="hl-sub-row">
                  <input className="hl-input" inputMode="numeric" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
                </div>
                <div className="hl-sub-row">
                  <input className="hl-input" inputMode="numeric" placeholder="验证码" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                  <button className="hl-code-btn" onClick={handleSendCode} disabled={countdown > 0 || busy}>
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
                {devCode && (
                  <div className="hl-dev-code">本地降级模式验证码：<b>{devCode}</b></div>
                )}
                <button className="hl-sub-btn" onClick={handleSmsSubscribe} disabled={busy}>
                  {busy ? '绑定中…' : '✦ 绑定并开启提醒'}
                </button>
              </div>
            ) : (
              <div className="hl-sub-wechat">
                {officialQrUrl ? (
                  <>
                    <img className="hl-official-qr" src={officialQrUrl} alt="微信公众号关注二维码" />
                    <div className="hl-wechat-tip">请使用微信扫码关注公众号，并在公众号内完成账号绑定；绑定成功后，将按所选时段收到黄历模板消息。</div>
                  </>
                ) : (
                  <div className="hl-wechat-tip">
                    {wechatReady
                      ? '使用微信扫码关注公众号，关注后在公众号内完成账号绑定，即可接收每日黄历模板消息。'
                      : '公众号模板消息正在接入中。需配置公众号二维码、消息模板和公网回调后才能开通。'}
                  </div>
                )}
                <button className="hl-sub-btn wx" onClick={handleWechat} disabled={busy || !wechatReady}>
                  {busy ? '加载中…' : officialQrUrl ? '💬 重新显示关注二维码' : '💬 扫码关注公众号'}
                </button>
              </div>
            )}

            <div className="hl-modal-foot">
                <button className="hl-modal-cancel" onClick={() => setShowModal(false)}>暂不设置</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ---- 一周预览 ----
function WeekStrip({ week, personalized, viewDate, onSelectDate }) {
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  const selKey = viewDate ? fmt(viewDate) : null
  const parseDate = (s) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return (
    <div className="card hl-week rise rise-5">
      <div className="hl-sec-head">
        <div className="hl-sec-title">✦ 接下来七天</div>
        <span className="hl-sec-sub">{personalized ? '命局与日气的节奏参考' : '传统宜忌速览 · 点击查看当天'}</span>
      </div>
      <div className="hl-week-grid">
        {week.map(d => {
          const isSel = d.date === selKey
          const isToday = d.isToday
          return (
            <button
              type="button"
              key={d.date}
              className={`hl-week-item ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''}`}
              onClick={() => onSelectDate && onSelectDate(parseDate(d.date))}
              aria-pressed={isSel}
              title={isToday ? '今日' : `查看 ${d.date} 的黄历`}
            >
              {isToday && <span className="hl-week-flag">今日</span>}
              {isSel && !isToday && <span className="hl-week-flag sel">已选</span>}
              <div className="hl-week-day">{d.date.slice(8)}<small>{d.week}</small></div>
              <div className="hl-week-gz">{d.dayGanzhi}</div>
              <div className={`hl-week-mode hl-mode-${d.relation}`}>{d.action.mode}</div>
              <div className="hl-week-yi">{d.yi.slice(0, 2).join('·')}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- 月度每日运势曲线 ----
function MonthCurve({ chart, today }) {
  const data = useMemo(() => {
    if (!chart) return []
    const y = today.getFullYear()
    const m = today.getMonth()
    const n = new Date(y, m + 1, 0).getDate()
    const rows = []
    for (let d = 1; d <= n; d++) {
      const date = new Date(y, m, d)
      rows.push({ date, el: dayElement(date) })
    }
    return rows
  }, [chart, today])

  const points = useMemo(() => {
    const self = chart?.dayMasterWx
    if (!self) return []
    const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
    const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
    return data.map(({ date, el }) => {
      // 与 buildDaily 一致的生克评分
      let score = 0
      for (const wx of [el.ganWx, el.zhiWx]) {
        if (wx === self) score += 2
        else if (SHENG[wx] === self) score += 1
        else if (SHENG[self] === wx) score += 1
        else if (KE[wx] === self) score -= 1
        else if (KE[self] === wx) score -= 1
      }
      const relation = score >= 3 ? '顺' : score <= 0 ? '慎' : '平'
      return {
        date,
        day: date.getDate(),
        score,
        relation,
        isToday: date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      }
    })
  }, [data, chart, today])

  if (!chart || points.length === 0) return null

  const W = 560
  const H = 190
  const PL = 34
  const PR = 14
  const PT = 22
  const PB = 26
  const iw = W - PL - PR
  const ih = H - PT - PB
  const minScore = -2
  const maxScore = 4
  const n = points.length
  const x = i => PL + (n === 1 ? iw / 2 : (iw * i) / (n - 1))
  const y = s => PT + ih - ((s - minScore) / (maxScore - minScore)) * ih

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ')

  // 5 日均线（平滑观察趋势）
  const avg = points.map((_, i) => {
    let s = 0, c = 0
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { s += points[j].score; c++ }
    return s / c
  })
  const avgLine = avg.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const yLabels = [4, 2, 0, -2]
  const relationColor = { 顺: 'var(--jade)', 平: 'var(--gold)', 慎: 'var(--cinnabar)' }

  // 月份刻度：每 5 天一个
  const ticks = points.filter(p => p.day === 1 || p.day % 5 === 0)

  return (
    <div className="card hl-month rise rise-6">
      <div className="hl-sec-head">
        <div className="hl-sec-title">✦ 本月节奏</div>
        <span className="hl-sec-sub">{today.getFullYear()}年{today.getMonth() + 1}月 · 命局与日气关系的相对变化</span>
      </div>

      <div className="hl-month-chart">
        <svg viewBox={`0 0 ${W} ${H}`} className="hl-month-svg" preserveAspectRatio="none">
          {/* 网格线 */}
          {yLabels.map(s => (
            <g key={s}>
              <line x1={PL} x2={W - PR} y1={y(s)} y2={y(s)} className="hl-m-grid" />
              <text x={PL - 6} y={y(s) + 4} className="hl-m-ylbl">{s > 0 ? `+${s}` : s}</text>
            </g>
          ))}

          {/* 周末底色 */}
          {points.map((p, i) => p.isWeekend && (
            <rect key={i} x={x(i) - iw / (n * 2)} y={PT} width={iw / n} height={ih} className="hl-m-weekend" />
          ))}

          {/* 今日竖线 */}
          {points.find(p => p.isToday) && (
            <line x1={x(points.findIndex(p => p.isToday))} x2={x(points.findIndex(p => p.isToday))} y1={PT} y2={PT + ih} className="hl-m-today" />
          )}

          {/* 面积渐变 */}
          <defs>
            <linearGradient id="hlMArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cinnabar)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--cinnabar)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="hlMLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--lavender)" />
              <stop offset="50%" stopColor="var(--cinnabar)" />
              <stop offset="100%" stopColor="var(--gold)" />
            </linearGradient>
          </defs>
          <path d={`${line} L${x(n - 1).toFixed(1)},${y(minScore)} L${x(0).toFixed(1)},${y(minScore)} Z`} fill="url(#hlMArea)" />
          <path d={avgLine} fill="none" className="hl-m-avg" />
          <path d={line} fill="none" className="hl-m-line" />

          {/* 数据点 */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.score)} r={p.isToday ? 5 : 3.2} className="hl-m-dot" fill={relationColor[p.relation] || 'var(--gold)'} opacity={p.isToday ? 1 : 0.85} />
              {p.isToday && (
                <text x={x(i)} y={y(p.score) - 9} textAnchor="middle" className="hl-m-today-lbl">今日</text>
              )}
            </g>
          ))}
        </svg>

        {/* X 轴日期刻度 */}
        <div className="hl-m-xaxis">
          {ticks.map((p, i) => (
            <span key={i} className={`hl-m-xitem ${p.isToday ? 'on' : ''}`}>{p.day}</span>
          ))}
        </div>
      </div>

      {/* 图例 */}
      <div className="hl-month-legend">
        <span className="hl-m-lg"><i style={{ background: 'var(--jade)' }} />顺 · 较易借力</span>
        <span className="hl-m-lg"><i style={{ background: 'var(--gold)' }} />平 · 保持节奏</span>
        <span className="hl-m-lg"><i style={{ background: 'var(--cinnabar)' }} />慎 · 宜放慢确认</span>
        <span className="hl-m-lg avg"><i />近 5 日趋势</span>
      </div>
    </div>
  )
}
