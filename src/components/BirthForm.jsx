import { useState } from 'react'
import ShichenPicker from './ShichenPicker.jsx'
import TrueSolarField from './TrueSolarField.jsx'
import { getLunarMonths, getLunarDayCount, lunarToSolar } from '../utils/lunar.js'

const SHICHEN = [
  { label: '子时', range: '23:00 - 01:00' },
  { label: '丑时', range: '01:00 - 03:00' },
  { label: '寅时', range: '03:00 - 05:00' },
  { label: '卯时', range: '05:00 - 07:00' },
  { label: '辰时', range: '07:00 - 09:00' },
  { label: '巳时', range: '09:00 - 11:00' },
  { label: '午时', range: '11:00 - 13:00' },
  { label: '未时', range: '13:00 - 15:00' },
  { label: '申时', range: '15:00 - 17:00' },
  { label: '酉时', range: '17:00 - 19:00' },
  { label: '戌时', range: '19:00 - 21:00' },
  { label: '亥时', range: '21:00 - 23:00' }
]

const SHICHEN_HOUR = {
  子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10,
  午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22
}

export default function BirthForm({ onBack, onGenerate }) {
  const now = new Date()
  const [calendar, setCalendar] = useState('solar') // solar 阳历 | lunar 农历
  const [year, setYear] = useState(1995)
  const [month, setMonth] = useState(6)
  const [day, setDay] = useState(15)
  const [lunarLeap, setLunarLeap] = useState(false) // 农历闰月
  const [hour, setHour] = useState(12)
  const [timeKnown, setTimeKnown] = useState(true)
  const [gender, setGender] = useState('男')
  const [name, setName] = useState('')
  // 太阳真时校正：useTrueSolar 开启后，排盘时辰用换算后的 trueSolarHour
  const [useTrueSolar, setUseTrueSolar] = useState(false)
  const [trueSolarHour, setTrueSolarHour] = useState(null)
  const [placeLabel, setPlaceLabel] = useState('')

  const daysInMonth = (y, m) => new Date(y, m, 0).getDate()

  const yearOptions = []
  for (let y = now.getFullYear(); y >= 1926; y--) yearOptions.push(y)

  // 农历模式下的月/闰月列表（含闰月），月份下拉据此渲染
  const lunarMonths = calendar === 'lunar' ? getLunarMonths(year) : []
  const lunarMaxDay = calendar === 'lunar' ? getLunarDayCount(year, month, lunarLeap) : daysInMonth(year, month)

  const handleDayChange = (d) => {
    const max = calendar === 'lunar' ? getLunarDayCount(year, month, lunarLeap) : daysInMonth(year, month)
    setDay(Math.min(d, max))
  }
  const handleMonthChange = (m, leap) => {
    setMonth(m)
    setLunarLeap(!!leap)
    if (calendar === 'lunar') {
      setDay(prev => Math.min(prev, getLunarDayCount(year, m, !!leap)))
    } else {
      setDay(prev => Math.min(prev, daysInMonth(year, m)))
    }
  }
  const handleYearChange = (y) => {
    setYear(y)
    if (calendar === 'lunar') {
      // 切换农历年后，重设月/日为合法值
      const months = getLunarMonths(y)
      if (months.length) {
        const m0 = months[0]
        setMonth(m0.num)
        setLunarLeap(m0.leap)
        setDay(Math.min(day, getLunarDayCount(y, m0.num, m0.leap)))
      }
    } else {
      setDay(prev => Math.min(prev, daysInMonth(y, month)))
    }
  }

  const submit = () => {
    let outYear = year, outMonth = month, outDay = day
    if (calendar === 'lunar') {
      // 农历日期 → 阳历，再走原有阳历排盘流程
      const sol = lunarToSolar(year, month, day, lunarLeap)
      outYear = sol.year; outMonth = sol.month; outDay = sol.day
    }
    // 太阳真时开启且换算成功 → 排盘用换算后的时辰
    const finalHour = timeKnown ? (useTrueSolar && trueSolarHour != null ? trueSolarHour : hour) : 12
    onGenerate({
      year: outYear, month: outMonth, day: outDay,
      hour: finalHour,
      gender, name,
      sourceCalendar: calendar,
      useTrueSolar, trueSolarHour, placeLabel
    })
  }

  return (
    <div className="form-wrap">
      <div className="container" style={{ maxWidth: 500 }}>
        <button className="back-btn rise" onClick={onBack}>← 返回首页</button>
        <h1 className="form-title rise rise-1">生辰排盘</h1>
        <p className="form-sub rise rise-2">输入出生信息，灵枢为你排定命盘</p>

        <div className="card rise rise-3">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />

          <div className="field">
            <label className="date-label-row">
              <span>出生日期<span className="req">*</span></span>
              <span className="cal-switch">
                <span
                  className={`cal-chip ${calendar === 'solar' ? 'active' : ''}`}
                  onClick={() => { setCalendar('solar'); setLunarLeap(false) }}
                >阳历</span>
                <span
                  className={`cal-chip ${calendar === 'lunar' ? 'active' : ''}`}
                  onClick={() => setCalendar('lunar')}
                >农历</span>
              </span>
            </label>
            <div className="date-row">
              <div className="select-wrap">
                <select value={year} onChange={e => handleYearChange(+e.target.value)}>
                  {yearOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
                </select>
              </div>
              <div className="select-wrap">
                <select
                  value={calendar === 'lunar' ? (lunarLeap ? `闰${month}` : `${month}`) : month}
                  onChange={e => {
                    if (calendar === 'lunar') {
                      const v = e.target.value
                      const isLeap = v.startsWith('闰')
                      handleMonthChange(+v.replace('闰', ''), isLeap)
                    } else {
                      handleMonthChange(+e.target.value)
                    }
                  }}
                >
                  {calendar === 'lunar'
                    ? lunarMonths.map(m => <option key={m.key} value={m.key}>{m.label}</option>)
                    : Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 月</option>)}
                </select>
              </div>
              <div className="select-wrap">
                <select value={day} onChange={e => handleDayChange(+e.target.value)}>
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

          <div className="field">
            <label>性别</label>
            <div className="gender-row">
              <div className={`gender-chip ${gender === '男' ? 'active' : ''}`} onClick={() => setGender('男')}>乾造 · 男</div>
              <div className={`gender-chip ${gender === '女' ? 'active' : ''}`} onClick={() => setGender('女')}>坤造 · 女</div>
            </div>
          </div>

          <div className="field">
            <label>称呼（可选）</label>
            <input
              type="text"
              placeholder="怎么称呼你？"
              value={name}
              maxLength={12}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button className="btn" onClick={submit} style={{ width: '100%' }}>
              ✦ 排定命盘
            </button>
            <p className="form-note">
              灵枢将基于你的生辰推算四柱八字与五行命局<br />
              仅供娱乐与自我探索参考 · 隐私仅存于本机
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
