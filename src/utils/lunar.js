// 农历工具：供各出生表单在「农历」输入模式下使用
// - 生成农历年的月份/闰月列表
// - 计算农历月天数
// - 农历日期 → 阳历日期（用于最终传入 buildChart 等阳历引擎）
import { Lunar, LunarYear } from 'lunar-typescript'

/**
 * 取指定农历年份内的月列表（正月~腊月，含闰月）
 * @param {number} year 农历年份
 * @returns {Array<{num:number, leap:boolean, key:string, label:string, dayCount:number}>}
 *   num 为月份号（1-12），leap 标记是否闰月，dayCount 为该月天数
 */
export function getLunarMonths(year) {
  const out = []
  const months = LunarYear.fromYear(year).getMonths()
  for (const m of months) {
    // 只保留属于该农历年（含闰月，跨年前后月份剔除）
    if (m.getYear() !== year) continue
    const num = Math.abs(m.getMonth())
    const leap = m.isLeap()
    out.push({
      num,
      leap,
      key: leap ? `闰${num}` : `${num}`,
      label: leap ? `闰${num}月` : `${num}月`,
      dayCount: m.getDayCount(),
    })
  }
  // 无闰月的年份 getMonths 可能不含闰月；按 num 排序
  out.sort((a, b) => (a.num - b.num) || (a.leap ? 1 : -1) - (b.leap ? 1 : -1))
  return out
}

/**
 * 农历某年某月（含闰月）的天数
 * @param {number} year 农历年
 * @param {number} month 农历月号（1-12）
 * @param {boolean} leap 是否闰月
 */
export function getLunarDayCount(year, month, leap) {
  const list = getLunarMonths(year)
  const found = list.find(m => m.num === month && m.leap === leap)
  return found ? found.dayCount : 30
}

/**
 * 农历日期 → 阳历日期
 * @param {number} year 农历年
 * @param {number} month 农历月号（1-12）
 * @param {number} day 农历日（1-当月天数）
 * @param {boolean} leap 是否闰月
 * @returns {{year:number, month:number, day:number}} 阳历
 */
export function lunarToSolar(year, month, day, leap) {
  try {
    const lunar = Lunar.fromYmd(year, leap ? -month : month, day)
    const solar = lunar.getSolar()
    return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() }
  } catch (e) {
    // 极少数无效农历日期兜底：返回原值
    return { year, month, day }
  }
}

/** 阳历 → 农历显示（可选的辅助，展示用户输入对应的农历） */
export function solarToLunar(year, month, day) {
  try {
    const solar = Lunar.fromDate(new Date(year, month - 1, day))
    return { year: solar.getYear(), month: Math.abs(solar.getMonth()), day: solar.getDay(), leap: solar.getMonth() < 0 }
  } catch (e) {
    return { year, month, day, leap: false }
  }
}
