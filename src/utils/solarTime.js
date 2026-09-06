/**
 * 太阳真时（真太阳时 / Apparent Solar Time）计算
 *
 * 换算链：
 *   钟表时间（中国标准时 CST，中央经线 120°E）
 *   → 当地平太阳时（经度校正：每偏离中央经线 1° 差 4 分钟）
 *   → 真太阳时（均时差校正：地球公转椭圆 + 黄赤交角致太阳视运动不均，全年 ±约 16 分钟）
 *   → 时辰（按真太阳时划分十二时辰）
 *
 * 参考口径：
 * - 经度校正：东经 120° 以东出生，当地太阳走得快（时辰提前）；以西则推迟
 * - 均时差：NOAA 近似公式（精度 ±1 分钟内，命理换算足够）
 */

// 均时差（Equation of Time，分钟）
// 正 = 太阳超前，真太阳时 > 平太阳时；负 = 太阳滞后
// N 为一年中的第几天（1 月 1 日 = 1）
export function equationOfTime(year, month, day) {
  const start = Date.UTC(year, 0, 1)
  const cur = Date.UTC(year, month - 1, day)
  const N = Math.floor((cur - start) / 86400000) + 1
  const B = (2 * Math.PI * (N - 81)) / 364
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
}

/**
 * 真太阳时
 * @param {number} year 公历年
 * @param {number} month 公历月 1-12
 * @param {number} day 公历日
 * @param {number} hour 钟表小时 0-23
 * @param {number} minute 钟表分钟 0-59
 * @param {number} longitude 出生地东经（度，如广州 113.26）
 * @returns {{
 *   totalMinutes: number, // 真太阳时距当天 0 点的总分钟数（0-1439，已归一化）
 *   hour: number,         // 真太阳时小时
 *   minute: number,       // 真太阳时分钟
 *   lonAdjust: number,    // 经度校正量（分钟）
 *   eot: number           // 均时差（分钟）
 * }}
 */
export function calcTrueSolar(year, month, day, hour, minute, longitude) {
  const clockMinutes = hour * 60 + minute
  const lonAdjust = (longitude - 120) * 4 // 中央经线 120°E，东 1° 快 4 分钟
  const eot = equationOfTime(year, month, day)
  const raw = clockMinutes + lonAdjust + eot
  const total = ((raw % 1440) + 1440) % 1440
  // ⚠ 归一化会把跨午夜的情况悄悄绕回同一天。中国最西端（喀什 ~75.99°E）与中央
  // 经线差近 45°，经度校正接近 -3 小时：钟表 01:00 出生的人，真太阳时其实是
  // **前一天** 22:00 出头。只返回 hour 而不返回日期偏移，日柱和时柱就会整整错一天。
  // dayOffset：-1 表示真太阳时落在前一天，+1 表示落在次日，调用方须据此调整日期。
  const dayOffset = Math.floor(raw / 1440)
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  return {
    totalMinutes: total,
    hour: h,
    minute: m === 60 ? 0 : m,
    dayOffset,
    lonAdjust,
    eot,
  }
}

/** 把日期按 dayOffset 平移，返回 { year, month, day }（月末/年末自动进位） */
export function shiftDate(year, month, day, dayOffset) {
  if (!dayOffset) return { year, month, day }
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + dayOffset)
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

// 时辰 hour 编码（与 ShichenPicker 一致）：晚子时 23 / 早子时 0 / 丑 2 / 寅 4 / … / 亥 22
// 时段划分：早子 00-01(0)、丑 01-03(2)、寅 03-05(4)、…、亥 21-23(22)、晚子 23-24(23)
export function trueSolarToShichenHour(hour, minute) {
  const t = hour * 60 + minute
  if (t >= 23 * 60) return 23 // 23:00-24:00 晚子时（按次日子时起干）
  if (t < 60) return 0        // 00:00-01:00 早子时
  // 01:00-23:00：时段起点为奇数小时（1,3,5,…,21），hourCode = 起点 + 1
  const h = Math.floor(t / 60)
  const odd = h % 2 === 1 ? h : h - 1
  return odd + 1 // 丑=2, 寅=4, …, 亥=22
}

// 时辰名称（含时段），用于换算结果展示
export function shichenName(hourCode) {
  const map = {
    23: '子时 · 晚子时 23:00-24:00',
    0: '子时 · 早子时 00:00-01:00',
    2: '丑时 · 01:00-03:00',
    4: '寅时 · 03:00-05:00',
    6: '卯时 · 05:00-07:00',
    8: '辰时 · 07:00-09:00',
    10: '巳时 · 09:00-11:00',
    12: '午时 · 11:00-13:00',
    14: '未时 · 13:00-15:00',
    16: '申时 · 15:00-17:00',
    18: '酉时 · 17:00-19:00',
    20: '戌时 · 19:00-21:00',
    22: '亥时 · 21:00-23:00',
  }
  return map[hourCode] || map[12]
}

/**
 * 一站式换算：钟表时间 + 出生地经度 → 真太阳时时辰编码
 * @returns {{ hourCode: number, label: string, solar: object }} 或 null（无经度）
 */
export function trueSolarToShichen(year, month, day, clockHour, clockMinute, longitude) {
  if (longitude == null) return null
  const solar = calcTrueSolar(year, month, day, clockHour, clockMinute, longitude)
  const hourCode = trueSolarToShichenHour(solar.hour, solar.minute)
  // dayOffset 一并透出：真太阳时跨了午夜时，排盘用的日期必须跟着平移，
  // 否则日柱按原日期排、时柱按新时辰排，两者对不上。
  const shifted = shiftDate(year, month, day, solar.dayOffset)
  return {
    hourCode,
    label: shichenName(hourCode),
    dayOffset: solar.dayOffset,
    date: shifted,
    solar,
  }
}
