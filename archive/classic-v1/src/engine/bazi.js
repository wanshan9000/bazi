// 八字排盘引擎：根据公历生日推算四柱、五行、生肖、十神等

import {
  TIAN_GAN, DI_ZHI, GAN_WUXING, GAN_YINYANG, ZHI_WUXING,
  ZHI_CANGGAN, SHENGXIAO, WUXING_SHENG, WUXING_KE
} from '../data/ganzhi.js'

// 近似节气分界（公历日期），用于定月柱
// 小寒(1/6)→丑月，立春(2/4)→寅月……大雪(12/7)→子月
const JIEQI = [
  { month: 1, day: 6, zhi: 1 },   // 小寒 → 丑月
  { month: 2, day: 4, zhi: 2 },   // 立春 → 寅月
  { month: 3, day: 6, zhi: 3 },   // 惊蛰 → 卯月
  { month: 4, day: 5, zhi: 4 },   // 清明 → 辰月
  { month: 5, day: 6, zhi: 5 },   // 立夏 → 巳月
  { month: 6, day: 6, zhi: 6 },   // 芒种 → 午月
  { month: 7, day: 7, zhi: 7 },   // 小暑 → 未月
  { month: 8, day: 8, zhi: 8 },   // 立秋 → 申月
  { month: 9, day: 8, zhi: 9 },   // 白露 → 酉月
  { month: 10, day: 8, zhi: 10 }, // 寒露 → 戌月
  { month: 11, day: 7, zhi: 11 }, // 立冬 → 亥月
  { month: 12, day: 7, zhi: 0 }   // 大雪 → 子月
]

// 日柱：以 1900-01-01（甲戌日，干支序号 10）为基准
const BASE_DATE = Date.UTC(1900, 0, 1)
const BASE_INDEX = 10

function daysBetween(date) {
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((target - BASE_DATE) / 86400000)
}

function ganIndexFromSexagenary(n) {
  return ((n % 10) + 10) % 10
}
function zhiIndexFromSexagenary(n) {
  return ((n % 12) + 12) % 12
}

// 年柱（以立春 2/4 为界）
export function yearPillar(date) {
  let y = date.getFullYear()
  const beforeLichun = date.getMonth() < 1 || (date.getMonth() === 1 && date.getDate() < 4)
  if (beforeLichun) y -= 1
  const idx = ((y - 1900 + 36) % 60 + 60) % 60
  return {
    gan: TIAN_GAN[ganIndexFromSexagenary(idx)],
    zhi: DI_ZHI[zhiIndexFromSexagenary(idx)],
    year: y
  }
}

// 月柱（按节气近似定月支，五虎遁起月干）
export function monthPillar(date, yearGanIndex) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  let zhi = 0 // 小寒(1/6)前默认子月（上一节气大雪至小寒之间）
  for (const jq of JIEQI) {
    if (m > jq.month || (m === jq.month && d >= jq.day)) zhi = jq.zhi
  }
  // 五虎遁：甲己之年丙作首 …
  const gan = (yearGanIndex % 5) * 2 + zhi
  return { gan: TIAN_GAN[gan % 10], zhi: DI_ZHI[zhi] }
}

// 日柱（公历直算，基准法）
export function dayPillar(date) {
  const idx = (BASE_INDEX + daysBetween(date)) % 60
  return { gan: TIAN_GAN[ganIndexFromSexagenary(idx)], zhi: DI_ZHI[zhiIndexFromSexagenary(idx)] }
}

// 时柱（五鼠遁起时干）
export function hourPillar(hour, dayGanIndex) {
  const zhi = Math.floor(((hour + 1) % 24) / 2)
  const gan = (dayGanIndex % 5) * 2 + zhi
  return { gan: TIAN_GAN[gan % 10], zhi: DI_ZHI[zhi] }
}

// 十神：以日干为「我」
export function shiShen(dayGan, otherGan) {
  const selfWx = GAN_WUXING[TIAN_GAN.indexOf(dayGan)]
  const selfYy = GAN_YINYANG[TIAN_GAN.indexOf(dayGan)]
  const otherWx = GAN_WUXING[TIAN_GAN.indexOf(otherGan)]
  const otherYy = GAN_YINYANG[TIAN_GAN.indexOf(otherGan)]
  const sameYang = selfYy === otherYy

  if (otherWx === selfWx) return sameYang ? '比肩' : '劫财'
  if (WUXING_SHENG[selfWx] === otherWx) return sameYang ? '食神' : '伤官'
  if (WUXING_KE[selfWx] === otherWx) return sameYang ? '偏财' : '正财'
  if (WUXING_KE[otherWx] === selfWx) return sameYang ? '七杀' : '正官'
  if (WUXING_SHENG[otherWx] === selfWx) return sameYang ? '偏印' : '正印'
  return '比肩'
}

// 五行力量统计（天干 2 分，地支主气 1.6 分，藏干其余 0.4 分）
export function wuxingCount(pillars) {
  const count = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  const add = (wx, v) => { count[wx] = (count[wx] || 0) + v }
  for (const p of pillars) {
    add(GAN_WUXING[TIAN_GAN.indexOf(p.gan)], 2)
    const cg = ZHI_CANGGAN[DI_ZHI.indexOf(p.zhi)]
    add(ZHI_WUXING[DI_ZHI.indexOf(p.zhi)], 1.6)
    cg.slice(1).forEach(g => add(GAN_WUXING[TIAN_GAN.indexOf(g)], 0.4))
  }
  return count
}

// 日主强弱判断
export function judgeStrength(dayWx, count) {
  const shengWx = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dayWx) // 生我者
  const strength = count[dayWx] + (count[shengWx] || 0) * 0.8
  const total = Object.values(count).reduce((a, b) => a + b, 0) || 1
  const ratio = strength / total
  return {
    ratio,
    strong: ratio >= 0.55,
    weak: ratio <= 0.42
  }
}

// 喜用神（简化推断：身强喜克泄耗，身弱喜生扶）
export function favorableElements(dayWx, strength) {
  const cycle = ['木', '火', '土', '金', '水']
  const i = cycle.indexOf(dayWx)
  const shengMe = cycle[(i + 3) % 5] // 生我
  const woSheng = cycle[(i + 1) % 5] // 我生
  const keWo = cycle[(i + 2) % 5]    // 克我
  const woKe = cycle[(i + 4) % 5]    // 我克
  if (strength.strong) return { favorable: [woSheng, woKe, keWo], avoid: [dayWx, shengMe] }
  return { favorable: [shengMe, dayWx], avoid: [woSheng, keWo] }
}

// 生成完整命盘
export function buildChart(year, month, day, hour, gender) {
  const date = new Date(year, month - 1, day)
  const yp = yearPillar(date)
  const mp = monthPillar(date, TIAN_GAN.indexOf(yp.gan))
  const dp = dayPillar(date)
  const hp = hourPillar(hour ?? 12, TIAN_GAN.indexOf(dp.gan))

  const pillars = [
    { label: '年柱', ...yp, shiShen: shiShen(dp.gan, yp.gan) },
    { label: '月柱', ...mp, shiShen: shiShen(dp.gan, mp.gan) },
    { label: '日柱', ...dp, shiShen: '日主' },
    { label: '时柱', ...hp, shiShen: shiShen(dp.gan, hp.gan) }
  ]

  const count = wuxingCount(pillars)
  const strength = judgeStrength(GAN_WUXING[TIAN_GAN.indexOf(dp.gan)], count)
  const fav = favorableElements(GAN_WUXING[TIAN_GAN.indexOf(dp.gan)], strength)
  const shengxiao = SHENGXIAO[DI_ZHI.indexOf(yp.zhi)]

  // 五行排序（从多到少）
  const wuxingRank = Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)

  return {
    year, month, day, hour, gender,
    pillars,
    dayMaster: dp.gan,
    dayMasterWx: GAN_WUXING[TIAN_GAN.indexOf(dp.gan)],
    shengxiao,
    wuxing: count,
    wuxingRank,
    strength,
    favorable: fav.favorable,
    avoid: fav.avoid,
    sheng: WUXING_SHENG,
    ke: WUXING_KE
  }
}

// 当前流年干支
export function currentYearGanzhi() {
  const now = new Date()
  const y = now.getFullYear()
  const idx = ((y - 1900 + 36) % 60 + 60) % 60
  return {
    year: y,
    gan: TIAN_GAN[ganIndexFromSexagenary(idx)],
    zhi: DI_ZHI[zhiIndexFromSexagenary(idx)]
  }
}
