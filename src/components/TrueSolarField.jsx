import { useEffect, useMemo, useState } from 'react'
import { PROVINCES, DEFAULT_PLACE, findCity } from '../data/cities.js'
import { trueSolarToShichen } from '../utils/solarTime.js'

const pad = (n) => String(n).padStart(2, '0')
const fmtSigned = (v) => `${v >= 0 ? '+' : '-'}${Math.round(Math.abs(v))} 分`

/**
 * 太阳真时换算字段（出生地选择 + 真太阳时 → 时辰）
 *
 * Props:
 *  - year / month / day: 公历出生日期
 *  - hour: 钟表时辰 hour 编码（0-23，时辰中点，与 ShichenPicker 一致）
 *  - useTrueSolar: 是否启用太阳真时校正
 *  - onChange({ useTrueSolar, province, city, trueSolarHour, placeLabel }):
 *      开关/出生地/日期/时辰变化时回调。useTrueSolar=true 时 trueSolarHour 为换算后的时辰 hour 编码
 */
export default function TrueSolarField({ year, month, day, hour, useTrueSolar, onChange }) {
  const [province, setProvince] = useState(DEFAULT_PLACE.province)
  const [city, setCity] = useState(DEFAULT_PLACE.city)

  const cities = useMemo(
    () => PROVINCES.find((p) => p.name === province)?.cities || [],
    [province]
  )
  const place = useMemo(() => findCity(province, city) || cities[0] || null, [province, city, cities])

  // 换算结果（hour 为时辰中点，代表该时辰的钟表时间）
  const calc = useMemo(() => {
    if (!place) return null
    return trueSolarToShichen(year, month, day, hour, 0, place.lon)
  }, [year, month, day, hour, place])

  // 启用期间，日期/时辰/出生地变化时把最新换算结果上报父组件
  useEffect(() => {
    if (useTrueSolar && place && calc) {
      onChange({
        useTrueSolar: true,
        province,
        city,
        trueSolarHour: calc.hourCode,
        placeLabel: `${province} · ${city}`,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day, hour, province, city])

  const toggle = (v) => {
    if (v) {
      onChange({
        useTrueSolar: true,
        province,
        city,
        trueSolarHour: calc ? calc.hourCode : null,
        placeLabel: `${province} · ${city}`,
      })
    } else {
      onChange({ useTrueSolar: false, province, city, trueSolarHour: null, placeLabel: '' })
    }
  }

  const changeProvince = (name) => {
    setProvince(name)
    const p = PROVINCES.find((x) => x.name === name)
    const first = p?.cities?.[0]
    setCity(first ? first.name : '')
  }

  return (
    <div className="tsf-wrap">
      <label className="tsf-title">
        出生地 · 太阳真时
        <span className="tsf-title-hint">（可选）换算精确时辰</span>
      </label>
      <div className="tsf-places">
        <div className="select-wrap">
          <select value={province} onChange={(e) => changeProvince(e.target.value)}>
            {PROVINCES.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="select-wrap">
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`tsf-toggle ${useTrueSolar ? 'on' : ''}`} onClick={() => toggle(!useTrueSolar)} role="switch" aria-checked={!!useTrueSolar}>
        <span className="tsf-toggle-track"><i /></span>
        <span className="tsf-toggle-label">用太阳真时校正出生时辰</span>
      </div>

      {useTrueSolar && calc && place && (
        <div className="tsf-calc">
          <div className="tsf-calc-chain">
            <span>钟表 {pad(hour)}:00</span>
            <b className="tsf-arrow">→</b>
            <span>经度 {fmtSigned(calc.solar.lonAdjust)}</span>
            <b className="tsf-arrow">→</b>
            <span>均时差 {fmtSigned(calc.solar.eot)}</span>
            <b className="tsf-arrow">→</b>
            <span>真太阳时 <em>{pad(calc.solar.hour)}:{pad(calc.solar.minute)}</em></span>
          </div>
          <div className="tsf-calc-result">
            换算时辰：<b>{calc.label}</b>
            <span className="tsf-calc-note">排盘将按此时辰起盘（以时辰中点为代表换算）</span>
          </div>
        </div>
      )}
      {useTrueSolar && !calc && (
        <p className="field-hint">请选择出生地后使用太阳真时</p>
      )}
    </div>
  )
}
