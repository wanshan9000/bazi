import { useEffect, useMemo, useState } from 'react'
import { CITY_COUNT, PROVINCES, DEFAULT_PLACE, findCity } from '../data/cities.js'
import { trueSolarToShichen } from '../utils/solarTime.js'
import { localize, useLocale } from '../i18n.jsx'

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
  const { locale } = useLocale()
  const l = (zh, en, tw) => localize(locale, zh, en, tw)
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
        // 跨午夜时排盘日期要跟着平移，父组件据此调整年月日
        trueSolarDate: calc.date,
        trueSolarDayOffset: calc.dayOffset,
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
        trueSolarDate: calc ? calc.date : null,
        trueSolarDayOffset: calc ? calc.dayOffset : 0,
        placeLabel: `${province} · ${city}`,
      })
    } else {
      onChange({ useTrueSolar: false, province, city, trueSolarHour: null, trueSolarDate: null, trueSolarDayOffset: 0, placeLabel: '' })
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
        {l('出生地 · 太阳真时', 'Birthplace · True solar time')}
        <span className="tsf-title-hint">{l('（可选）换算精确时辰', '(optional)')}</span>
      </label>
      <p className="tsf-place-note">{locale === 'en' ? `Correct with the city-center longitude. ${CITY_COUNT} locations included.` : `按出生地城市中心经度换算 · 已补足 ${CITY_COUNT} 个地级市／自治州／地区`}</p>
      <div className="tsf-places">
        <div className="select-wrap">
          <select aria-label={l('出生省级地区', 'Province or region')} value={province} onChange={(e) => changeProvince(e.target.value)}>
            {PROVINCES.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="select-wrap">
          <select aria-label={l('出生地级市或地区', 'City or district')} value={city} onChange={(e) => setCity(e.target.value)}>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`tsf-toggle ${useTrueSolar ? 'on' : ''}`} onClick={() => toggle(!useTrueSolar)} role="switch" aria-checked={!!useTrueSolar}>
        <span className="tsf-toggle-track"><i /></span>
        <span className="tsf-toggle-label">{l('用太阳真时校正出生时辰', 'Correct with true solar time')}</span>
      </div>

      {useTrueSolar && calc && place && (
        <div className="tsf-calc">
          <div className="tsf-calc-chain">
            <span>{l('钟表', 'Clock')} {pad(hour)}:00</span>
            <b className="tsf-arrow">→</b>
            <span>{province} · {city} · {l('经度', 'longitude')} {fmtSigned(calc.solar.lonAdjust)}</span>
            <b className="tsf-arrow">→</b>
            <span>{l('均时差', 'equation of time')} {fmtSigned(calc.solar.eot)}</span>
            <b className="tsf-arrow">→</b>
            <span>{l('真太阳时', 'True solar time')} <em>{pad(calc.solar.hour)}:{pad(calc.solar.minute)}</em></span>
          </div>
          <div className="tsf-calc-result">
            {l('换算时辰：', 'Adjusted time:')}<b>{calc.label}</b>
            <span className="tsf-calc-note">{l('排盘将按此时辰起盘（以时辰中点为代表换算）', 'Your chart uses this adjusted time.')}</span>
          </div>
        </div>
      )}
      {useTrueSolar && !calc && (
        <p className="field-hint">{l('请选择出生地后使用太阳真时', 'Choose a birthplace to use true solar time.')}</p>
      )}
    </div>
  )
}
