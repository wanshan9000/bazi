import { useState } from 'react'

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
  const [year, setYear] = useState(1995)
  const [month, setMonth] = useState(6)
  const [day, setDay] = useState(15)
  const [hour, setHour] = useState(12)
  const [timeKnown, setTimeKnown] = useState(true)
  const [gender, setGender] = useState('男')
  const [name, setName] = useState('')

  const daysInMonth = (y, m) => new Date(y, m, 0).getDate()

  const yearOptions = []
  for (let y = now.getFullYear(); y >= 1926; y--) yearOptions.push(y)

  const handleDayChange = (d) => {
    const max = daysInMonth(year, month)
    setDay(Math.min(d, max))
  }
  const handleMonthChange = (m) => {
    setMonth(m)
    setDay(prev => Math.min(prev, daysInMonth(year, m)))
  }
  const handleYearChange = (y) => {
    setYear(y)
    setDay(prev => Math.min(prev, daysInMonth(y, month)))
  }

  const submit = () => {
    onGenerate({
      year, month, day,
      hour: timeKnown ? hour : 12,
      gender, name
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
            <label>出生日期<span className="req">*</span></label>
            <div className="date-row">
              <div className="select-wrap">
                <select value={year} onChange={e => handleYearChange(+e.target.value)}>
                  {yearOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
                </select>
              </div>
              <div className="select-wrap">
                <select value={month} onChange={e => handleMonthChange(+e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 月</option>)}
                </select>
              </div>
              <div className="select-wrap">
                <select value={day} onChange={e => handleDayChange(+e.target.value)}>
                  {Array.from({ length: daysInMonth(year, month) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 日</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="field">
            <label>出生时辰</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button
                className={`gender-chip ${timeKnown ? 'active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setTimeKnown(true)}
              >知道时辰</button>
              <button
                className={`gender-chip ${!timeKnown ? 'active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setTimeKnown(false)}
              >时辰不确定</button>
            </div>
            {timeKnown && (
              <div className="time-grid">
                {SHICHEN.map(sc => (
                  <div
                    key={sc.label}
                    className={`time-chip ${hour === SHICHEN_HOUR[sc.label[0]] ? 'active' : ''}`}
                    onClick={() => setHour(SHICHEN_HOUR[sc.label[0]])}
                  >
                    {sc.label}<small>{sc.range}</small>
                  </div>
                ))}
              </div>
            )}
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
