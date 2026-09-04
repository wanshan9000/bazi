/**
 * 人生K线可视化引擎（优先级9 · life-kline）
 *
 * 基于八字大运 / 流年干支五行与「用神 / 忌神」的生克关系，
 * 生成逐大运的运势评分序列，供前端 SVG 折线图渲染。
 *
 * 评分模型（0-100，经验性、仅供趋势参考）：
 *  - 大运干支五行 = 用神 → 高位（75~95）
 *  - 大运干支五行 = 忌神 → 低位（25~45）
 *  - 大运干支五行 = 比劫同旺（同五行）→ 中性偏上（50~65）
 *  - 平 / 无关 → 中位（45~60）
 *  - 当前所在大运做体验式抬升
 *
 * 本模块只负责"数据建模"，不输出宿命断言，数值仅供图示趋势。
 */
import { GAN_WUXING, ZHI_WUXING, WUXING_SHENG, TIAN_GAN, DI_ZHI } from '../data/ganzhi.js'

const TIAN_GAN_ARR = TIAN_GAN
const DI_ZHI_ARR = DI_ZHI

// 干支五行取法（GAN_WUXING / ZHI_WUXING 是索引式数组）
const ganWx = g => GAN_WUXING[TIAN_GAN_ARR.indexOf(g)] || ''
const zhiWx = z => ZHI_WUXING[DI_ZHI_ARR.indexOf(z)] || ''

/**
 * 计算单个干支对日主的"喜忌度"
 * @returns {number} 喜忌分 -2（大忌）~ +2（大用）
 */
function luckScoreOfGanzhi(gan, zhi, ys) {
  const seq = ys.sequence.map(s => s.wx)
  const avoid = ys.avoid.map(s => s.wx)
  const dmWx = ys.dmWx
  const gWx = ganWx(gan)
  const zWx = zhiWx(zhi)
  let s = 0

  for (const wx of [gWx, zWx]) {
    if (!wx) continue
    if (seq.includes(wx)) s += 1
    else if (avoid.includes(wx)) s -= 1
    else if (wx === dmWx) s += 0.5
    else {
      const shengWo = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === wx)
      if (seq.includes(shengWo)) s += 0.5
    }
  }
  return s
}

// 回退：本地推算 8 个大运（最小兜底，避免依赖精确起运）
function buildFallbackDaYun(chart) {
  const startAge = 1
  const startYear = (chart.year || new Date().getFullYear()) + startAge
  const yearGan = chart.pillars?.[0]?.gan || '甲'
  const ygIdx = TIAN_GAN_ARR.indexOf(yearGan)
  let forward = true
  if (chart.gender === '男') forward = (ygIdx % 2 === 0) // 阳男
  else forward = (ygIdx % 2 === 1) // 阴女
  // 从月柱推（简化：以年干起始偏移近似，仅供兜底图示）
  const mGanIdx = TIAN_GAN_ARR.indexOf(chart.pillars?.[1]?.gan || '甲')
  const mZhiIdx = DI_ZHI_ARR.indexOf(chart.pillars?.[1]?.zhi || '子')
  let mSex = -1
  for (let i = 0; i < 60; i++) if (i % 10 === mGanIdx && i % 12 === mZhiIdx) { mSex = i; break }
  if (mSex < 0) mSex = 0
  const out = []
  for (let i = 1; i <= 8; i++) {
    const step = forward ? i : -i
    const s = ((mSex + step) % 60 + 60) % 60
    const sYear = startYear + (i - 1) * 10
    out.push({
      gan: TIAN_GAN_ARR[s % 10],
      zhi: DI_ZHI_ARR[s % 12],
      start: sYear,
      end: sYear + 9,
      startAge: startAge + (i - 1) * 10,
      endAge: startAge + (i - 1) * 10 + 9,
      key: `${TIAN_GAN_ARR[s % 10]}${DI_ZHI_ARR[s % 12]}`
    })
  }
  return out
}

/**
 * 生成人生K线数据
 * @param {object} chart 排盘结果
 * @param {object} yongshen analyzeYongShen 返回
 * @param {number} yearNow 当前年份
 */
export function buildLifeKline(chart, yongshen, yearNow) {
  yearNow = yearNow || new Date().getFullYear()
  const daYun = (chart.daYunList && chart.daYunList.length >= 4)
    ? chart.daYunList.map(d => ({
        gan: d.g, zhi: d.z,
        start: d.start, end: d.end,
        startAge: d.startAge, endAge: d.endAge,
        key: d.key || `${d.g}${d.z}`
      }))
    : buildFallbackDaYun(chart)

  const seqWx = (yongshen.sequence || []).map(s => s.wx).filter(Boolean)
  const avoidWx = (yongshen.avoid || []).map(s => s.wx).filter(Boolean)

  const raw = daYun.map((d, i) => {
    const s = luckScoreOfGanzhi(d.gan, d.zhi, yongshen)
    const isNow = yearNow >= d.start && yearNow <= d.end
    let score = 50 + s * 22
    if (isNow) score = Math.min(96, score + 12)
    score = Math.max(8, Math.min(96, Math.round(score)))
    return {
      type: 'dayun',
      label: `${d.gan}${d.zhi}`,
      years: `${d.start}—${d.end}`,
      range: `${d.start}-${d.end}`,
      score,
      peak: seqWx.includes(ganWx(d.gan)) || seqWx.includes(zhiWx(d.zhi)),
      isNow,
      gan: d.gan, zhi: d.zhi,
      idx: i
    }
  })

  // 3 点移动平均平滑，让曲线更接近人生起伏
  const smooth = raw.map((r, i) => {
    const prev = raw[i - 1], next = raw[i + 1]
    if (prev && next) return { ...r, score: Math.round((prev.score + r.score * 2 + next.score) / 4) }
    return r
  })

  // 流年（最近 12 年，作为大运内细分波动）
  const flowYears = []
  for (let y = yearNow - 6; y <= yearNow + 5; y++) {
    const idx = ((y - 4) % 60 + 60) % 60
    const g = TIAN_GAN_ARR[idx % 10]
    const z = DI_ZHI_ARR[idx % 12]
    const s = luckScoreOfGanzhi(g, z, yongshen)
    flowYears.push({ year: y, gan: g, zhi: z, score: Math.max(5, Math.min(95, Math.round(50 + s * 20))) })
  }

  return {
    yearNow,
    dmWx: yongshen.dmWx,
    seqWx,
    avoidWx,
    series: smooth,
    flowYears,
    note: '运势评分由大运/流年干支五行与日主喜用关系建模得出，为趋势参考，非宿命断言。'
  }
}
