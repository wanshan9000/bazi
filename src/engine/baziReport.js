/**
 * 子平派八字报告引擎
 *
 * 严格按子平派论述层级生成报告：盘面确认 → 格局法 → 用神法 →
 * 结构分析 → 事业财 → 婚恋六亲 → 健康倾向 → 大运流年 → 流年专项 → 综合。
 *
 * 所有文本在排盘数据上程序化生成，对古典规则的描述与样本保持一致。
 */
import {
  TIAN_GAN, DI_ZHI, GAN_WUXING, GAN_YINYANG, ZHI_WUXING,
  ZHI_CANGGAN, SHENGXIAO, WUXING_SHENG, WUXING_KE,
  ZHI_CHONG, ZHI_HAI, ZHI_XING, ZHI_SANHUI, ZHI_SANHE, ZHI_LIUHE,
  ZHI_BANHE, ZHI_LIUHE_WX
} from '../data/ganzhi.js'
import { buildClassicsSection } from './classicCite.js'
import { buildLifeKline } from './lifeKline.js'
import { buildSafeSection } from './safeGuard.js'
import { calculateShensha } from './bazi.js'
import { guideSectionOf } from './skillGuide.js'
import { schemaToMarkdown } from './reportSchema.js'
import { buildWuyunliuqi } from './wuyunliuqi.js'

/* ------------------------------------------------------------------ *
 * 类型归一化（早期 bug 修复保留）
 * ------------------------------------------------------------------ */
const toArr = v => {
  if (Array.isArray(v)) return v
  if (v == null || v === '') return []
  return String(v).split(/[、,,  \/]/).filter(Boolean)
}

/* ------------------------------------------------------------------ *
 * 基础映射
 * ------------------------------------------------------------------ */
const wxName = wx => wx
const wxColor = wx => ({
  木: '#3a7d5a', 火: '#c8434b', 土: '#b38c4a',
  金: '#7a6f5f', 水: '#406b8a'
}[wx] || '#9b8276')

const ZHI_MAIN = {
  子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙',
  午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬'
}

const cangGanOf = zhi => ZHI_CANGGAN[DI_ZHI.indexOf(zhi)].slice()
const shiShenOfLocal = (g, dm) => {
  if (!dm) return ''
  const dmWx = GAN_WUXING[TIAN_GAN.indexOf(dm)]
  const gWx = GAN_WUXING[TIAN_GAN.indexOf(g)]
  const dmYy = GAN_YINYANG[TIAN_GAN.indexOf(dm)]
  const gYy = GAN_YINYANG[TIAN_GAN.indexOf(g)]
  const sameYy = dmYy === gYy
  if (gWx === dmWx) return sameYy ? '比肩' : '劫财'
  if (WUXING_SHENG[dmWx] === gWx) return sameYy ? '食神' : '伤官'
  if (WUXING_KE[dmWx] === gWx) return sameYy ? '偏财' : '正财'
  if (WUXING_KE[gWx] === dmWx) return sameYy ? '七杀' : '正官'
  if (WUXING_SHENG[gWx] === dmWx) return sameYy ? '偏印' : '正印'
  return ''
}

/* ------------------------------------------------------------------ *
 * 调候 / 节气简易表（基于月令 × 日主）
 * ------------------------------------------------------------------ */
// 节令：以"寅月·立春"起算的每月近似节气
const SOLAR_TERMS = [
  { m:  1, term: '小寒' }, { m:  2, term: '立春' }, { m:  3, term: '惊蛰' },
  { m:  4, term: '清明' }, { m:  5, term: '立夏' }, { m:  6, term: '芒种' },
  { m:  7, term: '小暑' }, { m:  8, term: '立秋' }, { m:  9, term: '白露' },
  { m: 10, term: '寒露' }, { m: 11, term: '立冬' }, { m: 12, term: '大雪' }
]
const MONTH_TERM = {
  1: '小寒', 2: '立春', 3: '惊蛰', 4: '清明', 5: '立夏', 6: '芒种',
  7: '小暑', 8: '立秋', 9: '白露', 10: '寒露', 11: '立冬', 12: '大雪'
}

/* 调候用神：月支 × 日主五行 → 推荐用神 */
const TIAOHOU = {
  '子·甲': '丙', '子·乙': '丙', '子·丙': '壬', '子·丁': '甲',
  '子·戊': '甲', '子·己': '甲', '子·庚': '丁', '子·辛': '丁',
  '子·壬': '戊', '子·癸': '辛',
  '丑·甲': '丙', '丑·乙': '丙', '丑·丙': '壬', '丑·丁': '甲',
  '丑·戊': '甲', '丑·己': '甲', '丑·庚': '丁', '丑·辛': '丁',
  '丑·壬': '丙', '丑·癸': '辛',
  '寅·甲': '庚丙', '寅·乙': '丙', '寅·丙': '壬', '寅·丁': '壬',
  '寅·戊': '丙', '寅·己': '丙', '寅·庚': '丁', '寅·辛': '丙',
  '寅·壬': '庚', '寅·癸': '辛',
  '卯·甲': '庚丙', '卯·乙': '丙', '卯·丙': '壬', '卯·丁': '甲',
  '卯·戊': '甲', '卯·己': '丙', '卯·庚': '丁', '卯·辛': '丁',
  '卯·壬': '庚', '卯·癸': '辛',
  '辰·甲': '壬', '辰·乙': '壬', '辰·丙': '壬', '辰·丁': '甲',
  '辰·戊': '癸', '辰·己': '癸', '辰·庚': '甲', '辰·辛': '甲',
  '辰·壬': '辛', '辰·癸': '辛',
  '巳·甲': '癸', '巳·乙': '癸', '巳·丙': '壬', '巳·丁': '壬',
  '巳·戊': '甲', '巳·己': '癸', '巳·庚': '壬', '巳·辛': '丙',
  '巳·壬': '甲', '巳·癸': '辛',
  '午·甲': '癸丁', '午·乙': '癸', '午·丙': '壬', '午·丁': '壬',
  '午·戊': '甲', '午·己': '癸', '午·庚': '丁壬', '午·辛': '癸',
  '午·壬': '癸', '午·癸': '辛',
  '未·甲': '癸', '未·乙': '癸', '未·丙': '壬', '未·丁': '癸',
  '未·戊': '癸', '未·己': '癸', '未·庚': '癸', '未·辛': '癸',
  '未·壬': '己', '未·癸': '辛',
  '申·甲': '庚丁', '申·乙': '丙', '申·丙': '壬', '申·丁': '甲',
  '申·戊': '甲', '申·己': '丙', '申·庚': '丁', '申·辛': '丁',
  '申·壬': '戊', '申·癸': '辛',
  '酉·甲': '庚丁', '酉·乙': '丙', '酉·丙': '壬', '酉·丁': '甲',
  '酉·戊': '甲', '酉·己': '丙', '酉·庚': '丁', '酉·辛': '丁',
  '酉·壬': '癸', '酉·癸': '辛',
  '戌·甲': '癸', '戌·乙': '癸', '戌·丙': '壬', '戌·丁': '甲',
  '戌·戊': '壬', '戌·己': '壬', '戌·庚': '丁', '戌·辛': '丁',
  '戌·壬': '甲', '戌·癸': '辛',
  '亥·甲': '丁庚', '亥·乙': '丙', '亥·丙': '戊', '亥·丁': '甲',
  '亥·戊': '甲', '亥·己': '丙', '亥·庚': '丁', '亥·辛': '丙',
  '亥·壬': '庚', '亥·癸': '辛'
}

const tiaohouOf = (zhi, dmWx) => TIAOHOU[`${zhi}·${dmWx}`] || ''

/* ------------------------------------------------------------------ *
 * 人元司令（月令司令之神）查表
 * 子平口径：每月按交节起算的司令天数（前段/中段/末段各主一藏干），
 * 司令之神 ≠ 月支本气，须看生于节后第几日，故「不机械等同月支本气」。
 * ------------------------------------------------------------------ */
// 各月支藏干的司令天数（交节起算，依次累加）
const SI_LING_DAYS = {
  子: { 壬: 10, 癸: 20 },
  丑: { 癸: 9, 辛: 3, 己: 18 },
  寅: { 戊: 7, 丙: 7, 甲: 16 },
  卯: { 甲: 10, 乙: 20 },
  辰: { 乙: 9, 癸: 3, 戊: 18 },
  巳: { 戊: 7, 庚: 7, 丙: 16 },
  午: { 丙: 10, 己: 9, 丁: 11 },
  未: { 丁: 9, 乙: 3, 己: 18 },
  申: { 戊: 7, 壬: 7, 庚: 16 },
  酉: { 庚: 10, 辛: 20 },
  戌: { 辛: 9, 丁: 3, 戊: 18 },
  亥: { 戊: 7, 甲: 7, 壬: 16 },
}
// 该月支对应的「节」在公历中的近似交节日（立春/惊蛰/清明…），用于估算节后第几日
// 注意：跨月出生（如 11 月初仍属戌月）须用 Date 差计算，见 silingOf()

// 计算某命盘出生时的月令司令之神
// 返回：{ gan, wx, offsetDays, list }——司令天干、五行、节后第几日、完整司令序列
function silingOf(chart) {
  const monthZhi = chart.pillars[1].zhi
  const order = SI_LING_DAYS[monthZhi]
  if (!order) return { gan: ZHI_MAIN[monthZhi], wx: GAN_WUXING[TIAN_GAN.indexOf(ZHI_MAIN[monthZhi])], offsetDays: 0, list: [] }
  // 该月支对应「节」的公历月日（立春/惊蛰/清明/立夏/芒种/小暑/立秋/白露/寒露/立冬/大雪/小寒）
  const JIE_TABLE = [
    ['子', 12, 7], ['丑', 1, 6], ['寅', 2, 4], ['卯', 3, 6], ['辰', 4, 5], ['巳', 5, 6],
    ['午', 6, 6], ['未', 7, 7], ['申', 8, 8], ['酉', 9, 8], ['戌', 10, 8], ['亥', 11, 7],
  ]
  const jm = JIE_TABLE.find(x => x[0] === monthZhi)
  if (!jm) return { gan: ZHI_MAIN[monthZhi], wx: GAN_WUXING[TIAN_GAN.indexOf(ZHI_MAIN[monthZhi])], offsetDays: 0, list: [] }
  const year = chart.year || new Date().getFullYear()
  let jieDate
  if (jm[1] === 1) {
    // 丑月：小寒在次年 1 月（丑月跨年，交节在出生年之前一节气段），仍以出生年 1 月计
    jieDate = new Date(year, 0, jm[2])
  } else {
    jieDate = new Date(year, jm[1] - 1, jm[2])
  }
  // 节后第几日：交节日与出生日的真实日差 + 1（跨月用 Date 差自动进位，避免同公历月内近似出错）
  const born = new Date(year, (chart.month || 1) - 1, chart.day || 15)
  let offset = Math.round((born - jieDate) / 86400000) + 1
  // 出生在交节前一日（仍属上一节气段）：丑月出生在 1/5 前等，钳制到 1 天由月支本身兜底
  if (offset < 1) offset = 1
  const list = []
  let acc = 0
  let gan = ZHI_MAIN[monthZhi]
  for (const [g, days] of Object.entries(order)) {
    acc += days
    list.push({ gan: g, wx: GAN_WUXING[TIAN_GAN.indexOf(g)], days, end: acc })
    if (offset <= acc) { gan = g; break }
  }
  return {
    gan,
    wx: GAN_WUXING[TIAN_GAN.indexOf(gan)],
    offsetDays: offset,
    list,
  }
}

/* ------------------------------------------------------------------ *
 * 身强弱粗评（与 judgeStrength 一致 + 额外打分，用于报告文本描述）
 * ------------------------------------------------------------------ */
function scoreStrength(chart) {
  const dmWx = chart.dayMasterWx
  const pillars = chart.pillars
  let score = 0
  // 月令
  const monthZhi = pillars[1].zhi
  const ylWx = ZHI_WUXING[DI_ZHI.indexOf(monthZhi)]
  if (ylWx === dmWx) score += 2.5
  if (WUXING_SHENG[dmWx] === ylWx) score += 1.2
  if (WUXING_KE[ylWx] === dmWx) score -= 1.2
  // 日支根 + 日干名（供阳刃查询）
  const dayGan = pillars[2].gan
  const dayZhi = pillars[2].zhi
  if (ZHI_WUXING[DI_ZHI.indexOf(dayZhi)] === dmWx) score += 1.0
  // 阳刃（按日干查表）
  const REND_DICT = {
    甲:'卯',乙:'辰',丙:'午',丁:'未',戊:'午',己:'未',庚:'酉',辛:'戌',壬:'子',癸:'丑'
  }
  const renZhi = REND_DICT[dayGan]
  const renFound = pillars.some((p, i) => i !== 2 && p.zhi === renZhi)
  if (renFound) score += 1.2
  // 比劫帮身
  pillars.forEach((p, i) => {
    if (i === 2) return
    if (GAN_WUXING[TIAN_GAN.indexOf(p.gan)] === dmWx) score += 1.0
    if (ZHI_WUXING[DI_ZHI.indexOf(p.zhi)] === dmWx) score += 0.4
  })
  // 印生
  const shengWo = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dmWx)
  pillars.forEach((p, i) => {
    if (i === 2) return
    if (GAN_WUXING[TIAN_GAN.indexOf(p.gan)] === shengWo) score += 0.7
    if (ZHI_WUXING[DI_ZHI.indexOf(p.zhi)] === shengWo) score += 0.3
  })
  return score
}

/* ------------------------------------------------------------------ *
 * 身强弱四维判定明细（供"身强弱四维判定"表格动态展示，与上方排盘一致）
 * ------------------------------------------------------------------ */
function strengthDetail(chart) {
  const dmWx = chart.dayMasterWx
  const dayGan = chart.dayMaster
  const pillars = chart.pillars
  const rows = []
  let total = 0
  // 得令：月令五行与日主关系
  const monthZhi = pillars[1].zhi
  const monthGan = pillars[1].gan
  const ylWx = ZHI_WUXING[DI_ZHI.indexOf(monthZhi)]
  let deLing = 0
  let ylDesc = ''
  if (ylWx === dmWx) { deLing += 2.5; ylDesc = `月令${monthGan}${monthZhi}，日主${dmWx}得月令本气，当令` }
  else if (WUXING_SHENG[dmWx] === ylWx) { deLing += 1.2; ylDesc = `月令${monthZhi}（${ylWx}），生扶日主${dmWx}` }
  else if (WUXING_KE[ylWx] === dmWx) { deLing -= 1.2; ylDesc = `月令${monthZhi}（${ylWx}），克耗日主${dmWx}` }
  else { ylDesc = `月令${monthZhi}（${ylWx}），与日主${dmWx}泄耗相持` }
  total += deLing
  rows.push({ dim: '得令', basis: ylDesc, score: (deLing === 0 ? '0' : (deLing > 0 ? '+' : '') + deLing) })
  // 通根：日支五行与日主关系
  const dayZhi = pillars[2].zhi
  const dayZhiWx = ZHI_WUXING[DI_ZHI.indexOf(dayZhi)]
  let root = 0
  let rootDesc = `日支${dayZhi}（${dayZhiWx}）`
  if (dayZhiWx === dmWx) { root += 1.0; rootDesc += '，本气与日主同气，通根有力' }
  else { root += 0.4; rootDesc += '，藏干余气助力有限' }
  total += root
  rows.push({ dim: '通根', basis: rootDesc, score: (root > 0 ? '+' : '') + root })
  // 生扶：其余三柱比劫 + 印星
  const shengWo = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dmWx)
  let shengfu = 0
  const helpGans = []
  pillars.forEach((p, i) => {
    if (i === 2) return
    if (GAN_WUXING[TIAN_GAN.indexOf(p.gan)] === dmWx) { shengfu += 1.0; helpGans.push(p.gan) }
    if (ZHI_WUXING[DI_ZHI.indexOf(p.zhi)] === dmWx) { shengfu += 0.4; helpGans.push(p.zhi) }
    if (shengWo && GAN_WUXING[TIAN_GAN.indexOf(p.gan)] === shengWo) { shengfu += 0.7; helpGans.push(p.gan) }
    if (shengWo && ZHI_WUXING[DI_ZHI.indexOf(p.zhi)] === shengWo) { shengfu += 0.3; helpGans.push(p.zhi) }
  })
  total += shengfu
  rows.push({ dim: '生扶', basis: shengfu > 0 ? `比劫印星生扶：${[...new Set(helpGans)].join('、')}` : '比劫印星生扶乏力', score: (shengfu > 0 ? '+' : '') + shengfu })
  // 合冲存废：日支通根是否被冲合所损（子平衡日主须考量合冲后的存废）
  const dayZhi0 = pillars[2].zhi
  let hechong = 0
  const hechongNotes = []
  pillars.forEach((p, i) => {
    if (i === 2) return
    const z = p.zhi
    // 六冲损根
    if (ZHI_CHONG[z] === dayZhi0 || ZHI_CHONG[dayZhi0] === z) {
      hechong -= 0.8
      hechongNotes.push(`${p.label}（${z}）冲日支${dayZhi0}，日根受损`)
    }
    // 六合（合化五行与日主同气则反助，异气则绊）
    if (ZHI_LIUHE[z] === dayZhi0 || ZHI_LIUHE[dayZhi0] === z) {
      const heWx = ZHI_LIUHE_WX[z] || ZHI_LIUHE_WX[dayZhi0]
      if (heWx === dmWx) { hechong += 0.6; hechongNotes.push(`${p.label}（${z}）合日支${dayZhi0}化${heWx}，反助日主`) }
      else { hechong += 0.3; hechongNotes.push(`${p.label}（${z}）合日支${dayZhi0}，日支被合绊`) }
    }
  })
  total += hechong
  rows.push({
    dim: '合冲存废',
    basis: hechongNotes.length ? hechongNotes.join('；') : '日支无冲合牵动，根气保全',
    score: (hechong === 0 ? '0' : (hechong > 0 ? '+' : '') + hechong)
  })
  rows.push({ dim: '总分', basis: '', score: (total > 0 ? '+' : '') + total })
  return rows
}

/* ------------------------------------------------------------------ *
 * 格局判定
 * ------------------------------------------------------------------ */
/**
 * 外格倾向探测（从格 / 专旺 / 化气）
 * 子平红线：从格、化格、专旺格「不轻许」。故这里仅做**倾向性提示**，
 * 当信号非常明确时输出保守文案（"有 X 倾向，须综合校验，不轻断"），
 * 只要存在任何救应（印、比劫、微根）即不判从，避免误断导致报告失准。
 */
function detectWaiGe(chart) {
  const dayGan = chart.dayMaster
  const dmWx = chart.dayMasterWx
  if (!dayGan || !dmWx) return ''
  const str = chart.strength
  // 天干五行计数 + 地支藏干主气五行计数
  const gWxCount = {}
  const zWxCount = {}
  chart.pillars.forEach(p => {
    const g = GAN_WUXING[TIAN_GAN.indexOf(p.gan)]
    gWxCount[g] = (gWxCount[g] || 0) + 1
    const zMain = ZHI_MAIN[p.zhi]
    const zWx = GAN_WUXING[TIAN_GAN.indexOf(zMain)]
    zWxCount[zWx] = (zWxCount[zWx] || 0) + 1
  })
  const total = chart.pillars.length * 2
  // 日主同气（比劫）在干支的占比
  const selfG = gWxCount[dmWx] || 0
  const selfZ = zWxCount[dmWx] || 0
  const selfRatio = (selfG + selfZ) / total
  // 生我者（印）
  const shengWo = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dmWx)
  const yinG = gWxCount[shengWo] || 0
  const yinZ = zWxCount[shengWo] || 0
  // 克我者（官杀）、我生者（食伤）、我克者（财）
  const keWo = Object.keys(WUXING_KE).find(k => WUXING_KE[k] === dmWx)
  const woSheng = WUXING_SHENG[dmWx]
  const woKe = WUXING_KE[dmWx]
  const jiG = (gWxCount[keWo] || 0) + (gWxCount[woSheng] || 0) + (gWxCount[woKe] || 0)
  const jiZ = (zWxCount[keWo] || 0) + (zWxCount[woSheng] || 0) + (zWxCount[woKe] || 0)

  // ① 专旺 / 从强：日主极强且比劫印占绝对主导，几乎无克泄耗
  const isZhuanWang = (str && str.strong) && selfRatio >= 0.55 && yinG + yinZ >= 2 && jiG + jiZ <= 1
  if (isZhuanWang) {
    return `命局${dmWx}气专旺（比劫、印星占比高而官杀财食伤几无），有「${dmWx}专旺（从强）」之倾向；然此格极为特殊，须相对日主强弱与透干通根确证，本报告不轻断——若运岁逢官杀财星引动即为破格，仍按日主身强以食伤泄秀/财官耗身论用，请以实际格局合参。`
  }

  // ② 从弱 / 从财官 / 从儿：日主极弱、无印无比劫、地支无日主根，全局被克泄耗主导
  const hasSelfRootZ = zWxCount[dmWx] ? (zWxCount[dmWx] || 0) > 0 : false
  const isCong = (str && str.weak) && (selfG + selfZ) <= 0 && yinG + yinZ === 0 && !hasSelfRootZ && (jiG + jiZ) >= 5
  if (isCong) {
    const dom = [keWo, woSheng, woKe].map(w => zWxCount[w] || 0)
    const maxWx = [keWo, woSheng, woKe][dom.indexOf(Math.max(...dom))]
    const type = maxWx === keWo ? '从杀' : maxWx === woKe ? '从财' : '从儿'
    return `日主${dmWx}极弱无根、全局皆被${keWo}（官杀）/${woSheng}（食伤）/${woKe}（财）所夺，有「${type}格」之倾向；然从格极罕，须防假从假化——若运岁逢印比救应、或原局透干微根，即属假从仍须以扶身论，须综合合化、冲合与运程确证，本报告不轻断，仍按身弱以印比扶身论用，请以实际格局合参。`
  }

  return ''
}

function analyzeGeJu(chart) {
  const dayGan = chart.dayMaster
  const dmWx = chart.dayMasterWx
  const monthZhi = chart.pillars[1].zhi
  const monthGan = chart.pillars[1].gan
  const ylMainGan = ZHI_MAIN[monthZhi]  // 月令本气
  const ylMainWx = GAN_WUXING[TIAN_GAN.indexOf(ylMainGan)]
  const canggan = cangGanOf(monthZhi)
  const waiGe = detectWaiGe(chart)

  // 找出十神
  const tianGanHas = {}
  chart.pillars.forEach(p => {
    const ss = shiShenOfLocal(p.gan, dayGan)
    tianGanHas[ss] = (tianGanHas[ss] || '') + p.gan
  })

  // 月令所主十神
  const ylBenqiSS = shiShenOfLocal(ylMainGan, dayGan)

  // 人元司令：以"节后第几日"查司令之神（≠ 月支本气），并看其是否透干
  const siling = silingOf(chart)
  const silingSS = shiShenOfLocal(siling.gan, dayGan)
  const silingTou = tianGanHas[silingSS] || ''

  // 基本判定
  let pattern = ''
  let verdict = ''
  let note = ''
  const isBenqiKe = (ylMainWx === WUXING_KE[dmWx])
  const isBenqiShenwo = (WUXING_SHENG[ylMainWx] === dmWx)

  // 若月令本身是库墓（辰戌丑未），优先用"杂气 X 格"——这是子平派正格之一
  const isMuKu = ['辰','戌','丑','未'].includes(monthZhi)
  if (isMuKu && tianGanHas['七杀']) {
    pattern = '杂气杀库格'
    verdict = '月令为库墓，藏杀不透，依藏用杀立局'
  } else if (isMuKu && tianGanHas['偏财']) {
    pattern = '杂气杀库透财格'
    verdict = `月令${monthZhi}为库墓，透${tianGanHas['偏财']}偏财于干，财从库出`
  } else if (isMuKu && (tianGanHas['正官'])) {
    pattern = '杂气官库格'
    verdict = '月令为库墓，藏官不出，依官之藏干论'
  } else if (isMuKu && (tianGanHas['偏财'] || tianGanHas['正财'])) {
    pattern = '杂气财库格'
    verdict = '月令为库墓，藏财居库上，以财星立局'
  } else if (isMuKu && (tianGanHas['伤官'] || tianGanHas['食神'])) {
    pattern = '杂气食伤格'
    verdict = '月令为库墓，藏食伤之星，立食伤格'
  }

  if (pattern) {
    // already set（杂气库墓）
  } else if (silingTou && silingSS !== '比肩' && silingSS !== '劫财') {
    // 司令之神透干 → 以司令立格（子平正法：格从月令司令之神）
    pattern = `${silingSS}格`
    verdict = `月令司令之神${siling.gan}（${silingSS}）透干，格局从司令之气而立`
  } else if (tianGanHas['正官']) {
    pattern = '正官格'
    verdict = silingTou ? '月支藏正官，干上透出' : `月令司令为${siling.gan}（${silingSS}），正官非司令之神，透干以官星论`
  } else if (tianGanHas['七杀']) {
    pattern = '七杀格'
    verdict = silingTou ? '月令司令之神透杀立格' : '七杀非司令之神，透干以杀星论'
  } else if (tianGanHas['正印']) {
    pattern = '正印格'
    verdict = '月干透印，印绶护身'
  } else if (tianGanHas['偏印']) {
    pattern = '偏印格（枭神）'
    verdict = '月干枭印透出'
  } else if (tianGanHas['正财']) {
    pattern = '正财格'
    verdict = silingTou ? '月令司令之神透财，财星当令' : '月令本气为财，干上透出'
  } else if (tianGanHas['偏财']) {
    pattern = '偏财格'
    verdict = silingTou ? '月令司令之神透偏财，财从令出' : '月令偏财透干'
  } else if (tianGanHas['食神']) {
    pattern = '食神格'
    verdict = '月干食神，主平安有福'
  } else if (tianGanHas['伤官']) {
    pattern = '伤官格'
    verdict = '月干伤官透，才华外显'
  } else {
    // 透干无月令本气
    if (isBenqiKe) {
      pattern = '杂气官杀局'
      verdict = `月令司令之神${siling.gan}（${silingSS}）不透，依藏干与用神立格局`
    } else if (silingSS === '比肩' || silingSS === '劫财') {
      pattern = '建禄格'
      verdict = `月令司令为${siling.gan}（${silingSS}），禄刃当令而无所取，专取官杀食伤以立格`
    } else {
      pattern = '杂气格'
      verdict = `月令司令之神${siling.gan}（${silingSS}）藏而不透，需细致分辨，以司令之气与用神立格局`
    }
  }

  // 成格 / 破格判定（粗规则）+ 清浊辨
  // 观杀/刃/印三件套有否
  let verdict2 = ''
  const hasShi = (s) => chart.pillars.slice(0, 3).concat([chart.pillars[3]]).reduce((acc, p) => {
    if (acc) return acc
    const cg = cangGanOf(p.zhi)
    return cg.some(g => shiShenOfLocal(g, dayGan) === s)
  }, false)
  const yinGan = tianGanHas['正印'] || tianGanHas['偏印']
  // 官杀混杂（正官七杀同透）为浊；印星透出可化浊为清
  const hunZa = tianGanHas['正官'] && tianGanHas['七杀']
  if (pattern.includes('官') || pattern.includes('杀')) {
    if (hunZa) verdict2 = yinGan ? '官杀混杂本浊，得印透化浊为清，格局可成' : '官杀混杂为浊，须去官留杀或去杀留官，格局方清'
    else if (yinGan) verdict2 = '杀印相生，格局成；行运宜见水土，方可入仕'
    else verdict2 = '杀（官）不透印，格成条件不足，转论扶抑'
  } else if (pattern.includes('伤官')) {
    if (yinGan) verdict2 = '伤官配印，格成；以印护身，清而不浊'
    else verdict2 = '伤官无制，格低；喜见正印与官杀护卫'
  } else if (pattern.includes('财')) {
    if (yinGan || tianGanHas['比肩'] || tianGanHas['劫财']) verdict2 = '财得扶，身可担财，格成'
    else verdict2 = '身弱财多，格低；用印比扶身'
  } else {
    verdict2 = '依用神调配'
  }

  return {
    monthZhi, monthGan, ylMainGan, ylMainWx, canggan,
    ylTerm: MONTH_TERM[{寅:2,卯:3,辰:4,巳:5,午:6,未:7,申:8,酉:9,戌:10,亥:11,子:12,丑:1}[monthZhi]] || MONTH_TERM[chart.birthMonth] || '',
    siling, silingSS, silingTou,
    pattern, verdict, verdict2,
    tianGanHas, isBenqiKe, isBenqiShenwo, waiGe
  }
}

/* ------------------------------------------------------------------ *
 * 用神法分析
 * ------------------------------------------------------------------ */
function analyzeYongShen(chart) {
  const dmWx = chart.dayMasterWx
  const monthZhi = chart.pillars[1].zhi
  // 强弱判定：优先采用排盘引擎（buildChart）基于五行生克权重算出的 chart.strength，
  // 它与 scoreStrength 的粗糙打分可能不一致（曾导致身弱命被判成"中和"而误用财官杀为用神）。
  // 仅当引擎判定缺失时，才回退到 scoreStrength 的阈值。
  const str = chart.strength
  const score = scoreStrength(chart)
  let isStrong, isWeak, isMid
  if (str && (str.strong != null || str.weak != null)) {
    isStrong = !!str.strong
    isWeak = !!str.weak
    isMid = !isStrong && !isWeak
  } else {
    isStrong = score >= 1.2
    isWeak = score <= -0.5
    isMid = !isStrong && !isWeak
  }

  const shengWo = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dmWx)
  const woSheng = WUXING_SHENG[dmWx]
  const woKe = WUXING_KE[dmWx]
  const keWo = Object.keys(WUXING_KE).find(k => WUXING_KE[k] === dmWx) || '' // 克我者（官杀）：直接取 k，不再二次映射

  // 调候用神：按日主天干查表（TIAOHOU 的 key 为天干）
  const dayGan = chart.dayMaster
  const tiaohou = tiaohouOf(monthZhi, dayGan)
  const tiaohouWxs = tiaohou ? toArr(tiaohou).map(g => GAN_WUXING[TIAN_GAN.indexOf(g)]) : []

  // 忌神（扶抑忌神）：先算出来，供调候是否可用作"扶身用神"做过滤
  const avoid = []
  if (isStrong) {
    if (dmWx && !avoid.find(a => a.wx === dmWx)) avoid.push({ wx: dmWx, why: '比劫生身太过' })
    if (shengWo && !avoid.find(a => a.wx === shengWo)) avoid.push({ wx: shengWo, why: '印星生身太过' })
  }
  if (isWeak) {
    if (woKe && !avoid.find(a => a.wx === woKe)) avoid.push({ wx: woKe, why: '财星耗身' })
    if (keWo && !avoid.find(a => a.wx === keWo)) avoid.push({ wx: keWo, why: '官杀克身' })
    if (woSheng && !avoid.find(a => a.wx === woSheng)) avoid.push({ wx: woSheng, why: '食伤泄身太过' })
  }
  const avoidWxs = new Set(avoid.map(a => a.wx).filter(Boolean))

  // 排序（子平扶抑正法：身弱扶身，身强泄耗克；调候统筹寒暖，但仅当其与扶抑方向一致时才进用神序列，
  // 否则调候只作正文参考，绝不能把忌神方向（如身弱时的财官伤食）误当"补身用神"）。
  const sequence = []
  if (isWeak) {
    // 身弱：用印（生我）扶身，次用比劫（同我）帮身
    if (shengWo && !sequence.find(s => s.wx === shengWo)) sequence.push({ wx: shengWo, why: '扶抑（印星生身）' })
    if (dmWx && !sequence.find(s => s.wx === dmWx)) sequence.push({ wx: dmWx, why: '扶抑（比劫帮身）' })
  } else {
    // 身强 / 中和偏强：用食伤（我生）泄秀、财（我克）耗身、官杀（克我）制身
    if (woSheng && !sequence.find(s => s.wx === woSheng)) sequence.push({ wx: woSheng, why: '扶抑（食伤泄秀）' })
    if (woKe && !sequence.find(s => s.wx === woKe)) sequence.push({ wx: woKe, why: '扶抑（财星耗身）' })
    if (keWo && !sequence.find(s => s.wx === keWo)) sequence.push({ wx: keWo, why: '扶抑（官杀制身）' })
  }
  // 调候用神：仅当不在忌神方向时才并入序列（作为统筹首项），避免把忌神误当用神
  if (tiaohouWxs[0] && !avoidWxs.has(tiaohouWxs[0]) && !sequence.find(s => s.wx === tiaohouWxs[0])) {
    sequence.unshift({ wx: tiaohouWxs[0], why: '调候寒暖燥湿之需、首重' })
  }
  // 删除空项
  const ordered = sequence.filter(s => s.wx && s.wx !== '?')

  // 病药（子平病药说：病为命局过旺过弱之偏气，药为纠偏之物）
  // 病在比劫/印（生扶太过）→ 药在官杀/财；病在财官/食伤（克泄太过）→ 药在印比
  let bing = '', yao = '', bingNote = ''
  if (isStrong) {
    bing = `${dmWx}（比劫）过旺，兼印星生身太过`
    yao = `${keWo}（官杀制身）为主药，${woSheng}（食伤泄秀）为辅`
    bingNote = '身旺以克泄耗为药，不喜再生扶'
  } else if (isWeak) {
    const bingList = []
    if (keWo) bingList.push(`${keWo}（官杀）克身`)
    if (woKe) bingList.push(`${woKe}（财星）耗身`)
    if (woSheng) bingList.push(`${woSheng}（食伤）泄身`)
    bing = bingList.length ? bingList.join('、') : '全局生扶乏力'
    yao = `${shengWo}（印星）生身为药，${dmWx}（比劫）帮身为辅`
    bingNote = '身弱以生扶为药，不喜再遭克泄'
  } else {
    bing = '五行大体平衡，无显著偏气'
    yao = `调候之需（${tiaohou || '随月令寒暖'}）为药`
    bingNote = '中和之局以调候流通为务，忌再行失衡'
  }

  return {
    isStrong, isWeak, isMid, score, dmWx, monthZhi,
    tiaohou, tiaohouWxs,
    shengWo, woSheng, woKe, keWo,
    sequence: ordered, avoid,
    bingyao: { bing, yao, note: bingNote }
  }
}

/* ------------------------------------------------------------------ *
 * 结构分析（刑冲合害 / 墓库 / 空亡）
 * ------------------------------------------------------------------ */
function analyzeStructure(chart) {
  const zhis = chart.pillars.map(p => p.zhi)
  const zhiNotes = []
  const allIndicesOf = (zh) => zhis.reduce((acc, z, i) => z === zh ? [...acc, i] : acc, [])
  const colLabel = i => chart.pillars[i].label

  // 地支两两配对关系：冲 / 合 / 刑 / 害 / 穿（用 ganzhi.js 统一数据表，避免硬编码不一致）
  for (let i = 0; i < zhis.length; i++) {
    for (let j = i + 1; j < zhis.length; j++) {
      const a = zhis[i], b = zhis[j]
      // 六冲
      if (ZHI_CHONG[a] === b) {
        zhiNotes.push(`六冲：${colLabel(i)}（${a}） 与 ${colLabel(j)}（${b}） ${a}${b}冲（${a === '辰' || b === '辰' ? '命局核心发动机' : '冲动变局，主变动'}）`)
      }
      // 六合（含合化五行）
      if (ZHI_LIUHE[a] === b) {
        zhiNotes.push(`六合：${colLabel(i)}（${a}） 与 ${colLabel(j)}（${b}） 六合化${ZHI_LIUHE_WX[a]}（${a}${b}合）`)
      }
      // 六害 / 六穿
      if (ZHI_HAI[a] === b) {
        zhiNotes.push(`六害（六穿）：${colLabel(i)}（${a}） 与 ${colLabel(j)}（${b}） ${a}${b}相害，暗中受制`)
      }
      // 相刑
      const xing = (ZHI_XING[a] === b)
      if (xing) {
        if (a === b) zhiNotes.push(`自刑：${colLabel(i)}（${a}） 与 ${colLabel(j)}（${b}） ${a}${b}自刑，内耗`)
        else if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) zhiNotes.push(`相刑：${colLabel(i)}（${a}） 与 ${colLabel(j)}（${b}） 子卯无礼之刑`)
        else if (['寅巳申', '丑戌未'].some(set => set.includes(a) && set.includes(b))) {
          const sName = ['寅', '巳', '申'].includes(a) && ['寅', '巳', '申'].includes(b) ? '寅巳申三刑' : '丑戌未三刑'
          zhiNotes.push(`三刑：${colLabel(i)}（${a}） 与 ${colLabel(j)}（${b}） ${sName}成局`)
        } else zhiNotes.push(`相刑：${colLabel(i)}（${a}） 与 ${colLabel(j)}（${b}） ${a}${b}相刑`)
      }
      // 半合（三合中的任意两支）
      const banHe = ZHI_BANHE[`${a}${b}`]
      if (banHe) {
        zhiNotes.push(`半合：${colLabel(i)}（${a}） 与 ${colLabel(j)}（${b}） 半合${banHe}局（${a}${b}）`)
      }
    }
  }

  // 三合局（完整三合）
  ZHI_SANHE.forEach(set => {
    if (set.every(z => zhis.includes(z))) {
      const wx = { 申: '水', 子: '水', 辰: '水', 亥: '木', 卯: '木', 未: '木', 寅: '火', 午: '火', 戌: '火', 巳: '金', 酉: '金', 丑: '金' }[set[0]]
      zhiNotes.push(`三合：${wx}局（${set.join('')}），学业事业有气势`)
    }
  })

  // 三会局（会合方，力量最盛）
  ZHI_SANHUI.forEach(set => {
    if (set.every(z => zhis.includes(z))) {
      const wx = { 亥: '水', 子: '水', 丑: '水', 寅: '木', 卯: '木', 辰: '木', 巳: '火', 午: '火', 未: '火', 申: '金', 酉: '金', 戌: '金' }[set[0]]
      zhiNotes.push(`三会：${wx}方局（${set.join('')}），气势最盛`)
    }
  })

  return { zhiNotes }
}

/* ------------------------------------------------------------------ *
 * 流年与简易大运（基于顶 / 推十年）
 * ------------------------------------------------------------------ */
function buildDaYunList(chart, yearNow) {
  // 用神/忌神的五行列表（用于给每运加"状态"评级）
  const yongshen = (() => { try { return analyzeYongShen(chart) } catch (e) { return null } })()
  const yongWxs = new Set((yongshen?.sequence || []).map(s => s.wx).filter(Boolean))
  const jiWxs = new Set((yongshen?.avoid || []).map(a => a.wx).filter(Boolean))
  // 简易状态评级：参考截图的四档（good ✅ / warn ⚠ / star ⭐ / plain）
  const evalLevel = (d) => {
    if (d.isNow) return { level: 'star', status: '当前大运·关键期', icon: '⭐' }
    const gzWx = ZHI_WUXING[DI_ZHI.indexOf(d.z)] // 地支主气五行
    if (jiWxs.has(gzWx)) return { level: 'warn', status: '动荡期', icon: '⚠' }
    if (yongWxs.has(gzWx)) return { level: 'good', status: '顺畅期', icon: '✓' }
    return { level: 'plain', status: '平稳期', icon: '' }
  }
  // 优先使用排盘引擎附带的精确大运（起运年龄按出生时刻距交节时辰精算）
  if (chart.daYunList && chart.daYunList.length >= 4) {
    return chart.daYunList.map(d => {
      const s = d.start
      const e = d.end
      const ev = evalLevel({ z: d.z, isNow: yearNow >= s && yearNow <= e })
      return {
        g: d.g, z: d.z,
        start: s, end: e,
        startAge: d.startAge, endAge: d.endAge,
        ganShiShen: d.ganShiShen, zhiShiShen: d.zhiShiShen,
        isNow: yearNow >= s && yearNow <= e,
        level: ev.level, status: ev.status, icon: ev.icon,
        key: d.key || `${d.g}${d.z}`
      }
    })
  }

  // 回退：本地推算（四柱算法异常时的兜底）
  const yearGan = chart.pillars[0].gan
  // 阳男阴女顺排，阴男阳女逆排
  const ygIdx = TIAN_GAN.indexOf(yearGan)
  const ygYy = GAN_YINYANG[ygIdx]
  let forward = false
  if (chart.gender === '男') forward = ygYy === '阳'
  else forward = ygYy === '阴'

  // 起运年龄：按出生日距最近节气的近似天数折算（3 天 = 1 岁），不再硬编码
  const startAge = estimateQiYunAge(chart.year, chart.month, chart.day)
  const startYear = (chart.year || new Date().getFullYear()) + startAge
  // 大运干支必须从「月柱」的 60 甲子序号顺/逆推（用年干推导天干会整体错位）
  const mGanIdx = TIAN_GAN.indexOf(chart.pillars[1].gan)
  const mZhiIdx = DI_ZHI.indexOf(chart.pillars[1].zhi)
  let mSex = -1
  for (let i = 0; i < 60; i++) {
    if (i % 10 === mGanIdx && i % 12 === mZhiIdx) { mSex = i; break }
  }
  if (mSex < 0) mSex = 0
  const order = []
  for (let i = 1; i <= 9; i++) {
    const step = forward ? i : -i
    const s = ((mSex + step) % 60 + 60) % 60
    order.push({ g: TIAN_GAN[s % 10], z: DI_ZHI[s % 12] })
  }

  return order.map((p, i) => {
    const sYear = startYear + i * 10
    const eYear = sYear + 9
    const isNow = yearNow >= sYear && yearNow <= eYear
    const ev = evalLevel({ z: p.z, isNow })
    return { g: p.g, z: p.z, start: sYear, end: eYear, isNow, level: ev.level, status: ev.status, icon: ev.icon, key: `${p.g}${p.z}` }
  })
}

// 近似起运年龄：数出生日到最近一个「节」的天数（立春/惊蛰/清明…），3 天折 1 岁
function estimateQiYunAge(year, month, day) {
  const JIE = [
    [1, 6], [2, 4], [3, 6], [4, 5], [5, 6], [6, 6],
    [7, 7], [8, 8], [9, 8], [10, 8], [11, 7], [12, 7]
  ]
  // 找下一个节（含当月，若已过则取下月）
  let days = 0
  for (let k = 0; k < 12; k++) {
    const [m, d] = JIE[k]
    if (m > month || (m === month && d >= day)) {
      days = Math.max(0, Math.round(((new Date(year, m - 1, d) - new Date(year, month - 1, day)) / 86400000)))
      break
    }
  }
  if (!days) {
    // 跨年：距次年立春
    days = Math.max(0, Math.round(((new Date(year + 1, 0, 4) - new Date(year, month - 1, day)) / 86400000)))
  }
  return Math.max(1, Math.round(days / 3))
}

function ganzhiOfYear(y) {
  const idx = ((y - 4) % 60 + 60) % 60
  const g = TIAN_GAN[idx % 10]
  const z = DI_ZHI[idx % 12]
  return { g, z, wx: GAN_WUXING[TIAN_GAN.indexOf(g)] }
}

/* ------------------------------------------------------------------ *
 * 报告构造
 * ------------------------------------------------------------------ */
export function buildBaziReport(chart) {
  try {
    if (!chart || !chart.pillars || chart.pillars.length !== 4) {
      return { ok: false, error: '盘面数据缺失（需要完整四柱）' }
    }

    const dayGan = chart.dayMaster
    const dmWx = chart.dayMasterWx
    const dayZhi = chart.pillars[2].zhi
    const yearNow = new Date().getFullYear()

    /* 元数据：空亡 = 日柱所在旬中缺失的两支（按 60 甲子序号推算） */
    let daySexIdx = -1
    for (let i = 0; i < 60; i++) {
      if (TIAN_GAN[i % 10] === dayGan && DI_ZHI[i % 12] === dayZhi) { daySexIdx = i; break }
    }
    const xunStart = daySexIdx >= 0 ? Math.floor(daySexIdx / 10) * 10 : 0
    const kongActual = [
      DI_ZHI[(xunStart + 10) % 12],
      DI_ZHI[(xunStart + 11) % 12]
    ]

    const daxunList = buildDaYunList(chart, yearNow)
    const currentDY = daxunList.find(d => d.isNow) || daxunList[0]

    const geJu = analyzeGeJu(chart)
    const yongshen = analyzeYongShen(chart)
    const structure = analyzeStructure(chart)
    const score = scoreStrength(chart)
    // 身强弱文本必须与用神取用（yongshen.isWeak/isStrong，源自排盘引擎 chart.strength）保持一致，
    // 否则会出现"文本说身强、实际按身弱取用神"的自相矛盾。
    // 此处直接取 yongshen 的判定结果，score 仅作参考展示。
    const strengthTxt = yongshen.isWeak ? '身弱' : yongshen.isStrong ? '身强' : '中和'
    // 身强弱四维判定明细（动态计算，与上方排盘 chart.strength 保持一致）
    const strengthDetailRows = strengthDetail(chart)

    /* ===== 1. 盘面确认 ===== */
    const panmianItems = chart.pillars.map(p => ({
      label: p.label,
      gan: p.gan,
      zhi: p.zhi,
      shiShen: p.shiShen,
      canggan: cangGanOf(p.zhi).map(g => {
        const wX = GAN_WUXING[TIAN_GAN.indexOf(g)]
        const ss = shiShenOfLocal(g, dayGan)
        return `${g} (${ss})`
      })
    }))

    const panmianRows = panmianItems.map(p => ({
      label: p.label,
      gan: p.gan,
      zhi: p.zhi,
      shiShen: p.shiShen,
      canggan: p.canggan.join(' ')
    }))

    /* ===== 2. 格局法 ===== */
    const gejuText = [
      `月令：${geJu.monthZhi}（${geJu.ylTerm}），本气${geJu.ylMainGan}${geJu.ylMainWx}，人元司令之神为${geJu.siling.gan}（${geJu.siling.wx}）。`,
      `本命生于交节后第 ${geJu.siling.offsetDays} 日，正司「${geJu.siling.gan}」之气；月支三藏：${geJu.canggan.map(g => `${g}${GAN_WUXING[TIAN_GAN.indexOf(g)]}`).join('、')}，` +
        `本气${geJu.ylMainGan}（${geJu.ylMainWx}）与司令之神${geJu.siling.gan !== geJu.ylMainGan ? '不同，' : '同气，'}须以司令透藏辨格。`,
      `取格依据：依月令司令之神之主导立基，视其透藏、冲合、清浊辨论。` +
        `本局天干见 ${Object.entries(geJu.tianGanHas).map(([k, v]) => `${v}${k}`).join('、') || '无显著透星'}，` +
        `月令${geJu.monthZhi}藏 ${geJu.canggan.map(g => `${g}${GAN_WUXING[TIAN_GAN.indexOf(g)]}`).join('、')}，` +
        `取格以月令司令之神${geJu.siling.gan}（${geJu.silingSS}）之透藏与清浊定局。`,
      `成格 / 破格：${geJu.verdict2}。`,
      (['辰', '戌', '丑', '未'].includes(geJu.monthZhi)
        ? `杂气格特征：月令${geJu.monthZhi}为库墓，透干之星与库藏之气相表里，` +
          `须辨清浊与冲合，以观财官是否得库而发。`
        : `月令${geJu.monthZhi}非库墓，格局以${geJu.ylMainWx}本气为体，观其透干与日主强弱定论。`)
    ]
    if (geJu.waiGe) gejuText.push(`外格提示：${geJu.waiGe}`)

    /* ===== 3. 用神法 ===== */
    const ysWxs = (yongshen.sequence || []).map(s => s.wx).filter(Boolean).join('') || (yongshen.tiaohou || '')
    const ysTitle = `${strengthTxt} · 用神：${ysWxs}`
    const ysBlocks = [
      {
        k: '身强弱',
        v: `${dayGan}${dmWx}日主月令${yongshen.isWeak ? '死地/衰地' : (yongshen.isStrong ? '旺/相' : '无定')}，` +
           `${yongshen.isWeak ? '月令无助力，仅日支余气微根，时干比劫帮身仍不足，整体身弱' :
             yongshen.isStrong ? '月令比劫助力，得印生身而身强' : '得月令之力与外克相抵'}，` +
           `综合评分 ${score.toFixed(1)} 分，倾向${strengthTxt}。`
      },
      {
        k: '调候',
        v: `${chart.pillars[1]?.zhi || ''}月当令，月气已定旺衰，` +
           `调候用神为 ${yongshen.tiaohou || ''}（` +
           `${Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dmWx)}印 / ${dmWx}比劫` +
           `），与扶抑用神叠加，**调候高于一切**。`
      },
      {
        k: '扶抑',
        v: `${strengthTxt}用${
          yongshen.isWeak ? `印比（${yongshen.shengWo}、${dmWx}）以扶身` :
          yongshen.isStrong ? `财官（${yongshen.woKe}、${yongshen.keWo}）以消耗` : '中和为主'}${
          chart.pillars.some(p => ZHI_WUXING[DI_ZHI.indexOf(p.zhi)] === dmWx) ? '；月令本支可借气' : '；月令失令'
        }。`
      },
      {
        k: '通关',
        v: `命局主病在于${
          geJu.isBenqiKe ? `${dmWx}被土制` : '气之失调'}，` +
          `通关之媒在于${shengWoForText(dmWx)}，` +
          `以${WUXING_SHENG[dmWx]}为化机；` +
          (geJu.isBenqiShenwo ? '印星有力可化不利' : '印星藏或不透，通关较难') +
          '。'
      },
      {
        k: '病药',
        v: `病：${yongshen.bingyao.bing}；药：${yongshen.bingyao.yao}（${yongshen.bingyao.note}）。`
      },
      {
        k: '用神排序',
        v: (yongshen.sequence && yongshen.sequence.length
          ? yongshen.sequence.slice(0, 3).map((s, idx) => ` ${['①', '②', '③'][idx]}${s.wx}·${s.why}`).join(' → ')
          : ` ①${yongshen.tiaohouWxs[0] || ''}·调候`) + `；忌：${yongshen.avoid.length ? yongshen.avoid.map(a => a.wx).join('、') : '无明显忌神'}。`
      }
    ]

    /* ===== 4. 结构分析 ===== */
    const structureBlocks = [
      {
        k: '透干透根',
        v: `日主${dayGan}（${dmWx}）` +
           `${chart.pillars[0].gan === dayGan ? '透年干' :
             chart.pillars[1].gan === dayGan ? '透月干' :
             chart.pillars[3].gan === dayGan ? '透时干' : '无透'}，` +
           `日支${dayZhi}${ZHI_WUXING[DI_ZHI.indexOf(dayZhi)]}藏${cangGanOf(dayZhi).join('、')}；` +
           `印星${
             chart.pillars.some(p => GAN_WUXING[TIAN_GAN.indexOf(p.gan)] === Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dmWx))
               ? '可见于' : '不透'}` +
           '。'
      },
      {
        k: '刑冲合害',
        v: structure.zhiNotes.length ? structure.zhiNotes.map(n => `· ${n}`).join('\n')
                                     : '本局四柱无强冲相害，气归和平。'
      },
      {
        k: '墓库',
        v: `本局${
          chart.pillars.map(p => p.zhi).filter(z => ['辰', '戌', '丑', '未'].includes(z)).length
            ? `出现 ${chart.pillars.filter(p => ['辰', '戌', '丑', '未'].includes(p.zhi)).map(p => p.zhi).join('、')} 等库墓之字，` +
              `其中月令${chart.pillars[1].zhi}${ZHI_WUXING[DI_ZHI.indexOf(chart.pillars[1].zhi)]}为财库或杀库，` +
              `决定了命局"取用之门"。`
            : '无库墓主气，依天干论事'
        }。`
      },
      {
        k: '空亡',
        v: `日柱 ${dayGan}${dayZhi}，旬中空亡为 ${kongActual.join('、')}。${
          chart.pillars.some(p => kongActual.includes(p.zhi)) ? '命局有字落空亡，作事虚浮 — ' : '命局无字落空，'
        }大运流年填实方动。`
      },
      {
        k: '神煞',
        v: (() => {
          const ss = calculateShensha({
            yearGan: chart.pillars[0].gan, yearZhi: chart.pillars[0].zhi,
            monthGan: chart.pillars[1].gan, monthZhi: chart.pillars[1].zhi,
            dayGan: chart.pillars[2].gan, dayZhi: chart.pillars[2].zhi,
            timeGan: chart.pillars[3].gan, timeZhi: chart.pillars[3].zhi,
            gender: chart.gender
          })
          return ss.length ? ss.map(s => `· ${s}`).join('\n') : '本局神煞平平，无强煞冲犯，亦无显著贵人。'
        })()
      }
    ]

    /* ===== 5. 事业・财 ===== */
    const careerBlocks = [
      {
        k: '格局指向',
        v: `${geJu.pattern} · ${strengthTxt}，` +
           `${strengthTxt === '身弱' ? '杀旺压身，唯借印化或用神通关' :
             strengthTxt === '身强' ? '身能担财官，宜主动出击' : '中和之气，需观察岁运取用'}。` +
           `月令${geJu.monthZhi}之${geJu.ylMainWx}，主事业底色。`
      },
      {
        k: '行业倾向',
        v: getIndustryHint(chart, geJu, yongshen)
      },
      {
        k: '财星结构',
        v: `正财${tianGanAny(chart, dayGan, '正财') || '藏支'}, 偏财${tianGanAny(chart, dayGan, '偏财') || '藏支'}。` +
           `${isTianGanHas(chart, dayGan, '正财') || isTianGanHas(chart, dayGan, '偏财') ? '财星透达，主' : '财星藏于地支，'}取财方式与 ${strengthTxt}相关。`
      },
      {
        k: '岁运',
        v: (() => {
          const li = yongshen.sequence.map(s => s.wx).filter(Boolean)
          const ji = yongshen.avoid.map(a => a.wx).filter(Boolean)
          return `利${li.length ? li.join('、') : '中和之年'}岁运（${yongshen.sequence[0]?.why || '喜用所向'}）；` +
                 `忌${ji.length ? ji.join('、') : ''}之年（${yongshen.avoid[0]?.why || '所忌五行'}）。`
        })()
      }
    ]

    /* ===== 6. 婚恋・六亲 ===== */
    const marriageBlocks = [
      {
        k: '配偶宫',
        v: `日支${dayZhi}${ZHI_WUXING[DI_ZHI.indexOf(dayZhi)]}（${SHENGXIAO[DI_ZHI.indexOf(dayZhi)]}），` +
           `藏${cangGanOf(dayZhi).map(g => `${g}(${shiShenOfLocal(g, dayGan)})`).join('、')}。` +
           `配偶个性偏向${marriageHint(chart, dayGan, dayZhi)}，婚姻结构中"我"的位置主要由藏干定。`
      },
      {
        k: '配偶星',
        v: `男命：财星为妻；正财为妻、偏财为父或情人。` +
           `${isTianGanAny(chart, dayGan, '正财') ? '妻星天干透出' : '妻星藏支不透'}，` +
           `宜晚婚稳重，感情上早期多波折。`
      },
      {
        k: '六亲状态',
        v: getSixQin(chart, dayGan, geJu, yongshen)
      }
    ]

    /* ===== 7. 健康倾向 ===== */
    const healthBlocks = [
      {
        k: '五脏六腑',
        v: getOrganHint(dmWx, yongshen)
      },
      {
        k: '薄弱部位',
        v: getWeakBody(chart)
      },
      {
        k: '调养',
        v: (() => {
          const mainYong = yongshen.tiaohouWxs[0] || yongshen.shengWo || ''
          const DIR = { 水: ['北方', '黑色系', '近水之地'], 木: ['东方', '青色系', '近林之地'], 火: ['南方', '红色系', '向阳之地'], 金: ['西方', '白色系', '近金之地'], 土: ['中央', '土黄系', '近土之地'] }
          const d = DIR[mainYong] || ['中性方位', '本命色系', '宜居之地']
          return `喜用为${mainYong} → 宜${d[0]}、多近${d[2]}、常著${d[1]}；` +
                 `${yongshen.isWeak ? '多休息养精蓄锐，避免过度消耗' : '主动宣泄能量'}。`
        })()
      }
    ]

    /* ===== 8. 大运流年表 ===== */
    const daxunRows = daxunList.map(d => {
      const wx = GAN_WUXING[TIAN_GAN.indexOf(d.g)]
      const note = daxunNote(d, chart, geJu)
      return {
        name: d.key,
        range: `${d.start}-${d.end}`,
        wx,
        note
      }
    })

    /* ===== 9. 流年专项 ===== */
    const yearNotes = []
    for (const y of [yearNow, yearNow + 1, yearNow + 4, yearNow + 6, yearNow + 8]) {
      const gz = ganzhiOfYear(y)
      yearNotes.push(buildYearNote(y, gz, chart, geJu, yongshen))
    }

    /* ===== 10. 综合结论 ===== */
    const summaryFinal = [
      `格局法：${geJu.pattern}，${geJu.verdict}。`,
      `用神法：${yongshen.sequence.map(s => s.wx).filter(Boolean).join('、') || '中和'}${yongshen.sequence.some(s => s.why && s.why.includes('调候')) ? '（调候 + 扶抑）' : '（扶抑取用）'}${yongshen.avoid.length ? `，忌${yongshen.avoid.map(a => a.wx).join('、')}` : ''}。`,
      `身强弱：${strengthTxt} · 评分 ${score.toFixed(1)}。`
    ].join('  ')
    const lateDy = (daxunList[5] || daxunList[daxunList.length - 1])
    const summaryTail = `综合结论：此命${strengthTxt}` +
      `${geJu.isBenqiKe ? '杀旺' : ''}，` +
      `最旺之气为${yongshen.woSheng}（${countOf(chart, yongshen.woSheng)}份），` +
      `取财之门路在 ${(yongshen.sequence[0] && yongshen.sequence[0].wx) || yongshen.woKe || '水'} 之岁运方能大开。` +
      `晚年 ${lateDy.key} 运（${lateDy.start}-${lateDy.end}）是关键窗口期，需细心把关。` +
      `\n┄ 通俗讲：你命里最旺、最压人的那股气是${yongshen.woSheng}，真正能"镇得住、补得上"的是${yongshen.tiaohouWxs.length ? yongshen.tiaohouWxs.join('') : ''}和${yongshen.shengWo}。` +
      `发大财、事业上台阶，多半要等${yongshen.tiaohou || '水'}旺的年份到来；` +
      `${lateDy.start}-${lateDy.end}（${lateDy.key}运）这段是最要紧的窗口，机会来了要攥住。`

    /* ===== 大白话速览：先给普通人一句"看懂整份报告"的话（专业+白话双轨）===== */
    const yongList = (yongshen.sequence || []).map(s => s.wx).filter(Boolean)
    const yongTxt = yongList.length ? yongList.join('、') : (yongshen.tiaohouWxs[0] || '')
    const jiTxt = (yongshen.avoid || []).map(a => a.wx).join('、')
    const plainOverview = `${chart.dayMaster}日主 · ${strengthTxt}：` +
      `你命里属${chart.dayMasterWx}，${strengthTxt.indexOf('强') >= 0 ? '底子偏足、有主见，扛得住事，但也容易倔、要顺着来。' : strengthTxt.indexOf('弱') >= 0 ? '底子偏弱、心思细，适合借力、靠人和平台成就自己。' : '底子中性，能进能退，看走哪步、遇什么人。'} ` +
      `这辈子真正能"补你、旺你"的五行是 ${yongTxt}${jiTxt ? `，要尽量避开的五行是 ${jiTxt}` : ''}；` +
      `（多接触跟${yongTxt}相关的行业、颜色、方向，对你更有助力）` +
      (chart.qiYunAge != null ? `你 ${chart.qiYunText || `${chart.qiYunAge} 岁`} 才真正"起运"发力，` : '起运时间需按出生时辰复核，') +
      `日子是越过越有章法，关键看中年那一大运。`
    const plainOverviewSection = {
      key: 'plainview',
      title: '一句话速览',
      kind: 'note',
      data: {
        text: `【先看三件事】这份报告先给你一条主线，再用专业命理逐层印证：一、你是块什么料（性格与底子）；二、你命里最需要补什么、避开什么；三、人生哪几步是关键。\n\n` +
          `${plainOverview}\n\n` +
          `完整的专业术语、格局推断都在下方分节，先抓这条速览的大方向，再看细节印证。`
      }
    }

    /* ===== V12.0 子平报告：11 节 + 总结 ===== */

    // 一、四柱排盘：表格（柱位 / 天干 / 地支 / 藏干 / 十神）
    const paipanRows = chart.pillars.map(p => {
      const cgStr = cangGanOf(p.zhi).map(g => `${g}(${shiShenOfLocal(g, dayGan)})`).join('、')
        + (p.zhi === '日支' ? '' : (p.gan === dayGan ? ' · 同干' : ''))
      // 十神：以日主论各天干
      const tgShen = p.gan === dayGan ? '日主' : shiShenOfLocal(p.gan, dayGan)
      // 附加藏干的十神
      const zhiShen = cangGanOf(p.zhi).map(g => shiShenOfLocal(g, dayGan)).join('、')
      const tenGod = p.gan === dayGan
        ? `日主`
        : `${tgShen}（天干） / ${zhiShen}（地支）`
      return { label: p.label, gan: p.gan, zhi: p.zhi, canggan: cgStr, shiShen: tenGod }
    })

    // 二、五行旺衰分析
    const wxs = wuxingScoreTable(chart)
    const ylRel = yueLingRelation(chart, geJu)
    const wuXLT = wuxingLiuTong(chart)

    // 三、格局判定
    const gejuFeatures = geJuFeatures(chart, geJu, yongshen)

    // 四、用神与喜忌
    const xiJiRows = xiJiTable(yongshen, chart)
    const kouJueSishen = coreKouJue(chart, yongshen, geJu)

    // 五、十神详解
    const ssDetails = shiShenDetail(chart, geJu, yongshen)

    // 六、大运分析
    const currentDY2 = daxunList.find(d => d.isNow) || daxunList[0]
    const currentDYAnalysis = dayunSingleAnalysis(chart, currentDY2, yongshen, geJu)
    const nextDYIdx = (() => {
      const idx = daxunList.findIndex(d => d.isNow)
      return idx >= 0 ? idx + 1 : 1
    })()
    const nextDY = daxunList[nextDYIdx] || daxunList[daxunList.length - 1] || {}
    const nextDYAnalysis = dayunSingleAnalysis(chart, nextDY, yongshen, geJu)

    // 七、流年精析（单年）
    const ln = liuNianAnalysis(chart, yongshen, geJu)
    // 流年近年预鉴表（用于第六章·流年要点 6.1）
    const liunianRows = (() => {
      const curYear = new Date().getFullYear()
      const rows = []
      for (let i = 0; i < 6; i++) {
        const gz = ganzhiOfYear(curYear + i) // 干支纪年与出生年无关，按公历年份直接推
        const g = gz.g
        const z = gz.z
        const wx = gz.wx
        const ganShen = shiShenOfLocal(g, dayGan)
        let image = ''
        if (ganShen.includes('财')) image = `${wx}财星透出/入库`
        else if (ganShen.includes('官') || ganShen.includes('杀')) image = `${wx}官杀主事业压力`
        else if (ganShen.includes('食') || ganShen.includes('伤')) image = `${wx}食伤主创意表达`
        else if (ganShen.includes('印')) image = `${wx}印星主学业贵人`
        else image = `${wx}比劫主竞争`
        let judge = ''
        if (kongActual.includes(z)) judge = `${z}空亡填实，主${ganShen.includes('财') ? '财' : '动'}`
        else judge = `${ganShen}运，${wx === '水' ? '助身' : wx === '金' ? '通关' : wx === '木' ? '泄身' : wx === '火' ? '耗身' : '克身'}`
        rows.push({ year: curYear + i, gz: g + z, image, judge })
      }
      return rows
    })()

    // 八、婚姻与子女
    const childInfo = childAnalysis(chart)

    // 九、健康
    const huanYin = xianTianHuanYin(chart)
    const dayunWarn = dayunHealthWarn(chart, daxunList)

    // 十、职业与财富
    const industries = industryTable(chart, geJu, yongshen)
    const caiFu = caiFuCeLue(chart, geJu, yongshen)

    // 十一、父母长辈
    const parents = parentsAnalysis(chart, dayGan, geJu, yongshen)

    // 十三、人际关系
    const relation = relationAnalysis(chart, dayGan, geJu, yongshen)

    // 十五、风水调整
    const fengShui = fengShuiAdvice(chart, geJu, yongshen)

    // 十一、人生曲线
    const lifeQx = lifeQuXian(daxunList)
    const zongjieKj = zongjieKouJue(chart, yongshen, geJu, currentDY2, nextDY)

    const sections = [
      // 第一章·十神细解（表格化：每个十神一行，逐神纵向展开 数量/状态/解读/健康提示）
      {
        key: 'shishendetail',
        title: '第一章·十神细解',
        kind: 'kvComposite',
        data: {
          subsections: [{
            key: 'shishen-table',
            kind: 'table',
            data: {
              headers: ['十神', '数量', '状态', '解读', '健康提示'],
              rows: ssDetails.map(s => [s.ss, s.count, s.state, s.desc, s.health]),
              // 显式列宽：十神列放衬线粗体首列，需要容纳 2 字+padding 不挤线；
              // 状态列含较长藏干描述需适度宽；解读列最长。
              colWidths: ['16%', '12%', '16%', '38%', '18%']
            }
          }]
        }
      },

      // 第三章·格局法
      {
        key: 'gejud',
        title: '第二章·格局法',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '1.1',
              title: '3.1 格局定性',
              kind: 'kv',
              data: {
                blocks: [
                  { k: '格局定位', v: (() => {
                    const p = geJu.pattern
                    let name = p
                    if (p.includes('伤官') && (p.includes('偏财') || p.includes('正财'))) name = `${p}（或可称"食伤生财"结构）`
                    else if (p.includes('食神') && (p.includes('偏财') || p.includes('正财'))) name = `${p}（或可称"食神生财"结构）`
                    else if (p.includes('七杀') || p.includes('官')) name = `${p}（官杀格局结构）`
                    else if (p.includes('印')) name = `${p}（印绶护身结构）`
                    const cg = geJu.canggan && geJu.canggan.length ? `，杂气：${geJu.canggan.join('、')}` : ''
                    const silTxt = geJu.siling.gan === geJu.ylMainGan
                      ? `人元司令之神${geJu.siling.gan}（${geJu.siling.wx}）`
                      : `人元司令之神${geJu.siling.gan}（${geJu.siling.wx}，非本气、司权之令）`
                    return `${name} · ${geJu.monthZhi}（${geJu.ylTerm}后），${silTxt}${cg}。`
                  })() },
                  { k: '成破判定', v: (() => {
                    const v2 = geJu.verdict2 && geJu.verdict2 !== '依用神调配' ? `；${geJu.verdict2}` : ''
                    if (yongshen.isWeak) return `${geJu.pattern}。格不成：财官伤食成局，日主身弱难担——转比扶抑，取印比扶身${v2}。`
                    if (yongshen.isStrong) return `${geJu.pattern}。格成：日主${strengthTxt}，可任财官食伤之泄，取${yongshen.sequence.map(s => s.wx).filter(Boolean).join('、')}为用${v2}。`
                    return `${geJu.pattern}。日主中和，宜顺势调和，取流通之运${v2}。`
                  })() },
                  { k: '喜忌清浊', v: (() => {
                    const yongWx = yongshen.sequence.filter(s => s.wx).map(s => `${s.wx}（${s.why.split('（')[0]}）`).join('、')
                    const jiWx = yongshen.avoid.filter(a => a.wx).map(a => `${a.wx}（${a.why}）`).join('、')
                    return `喜用神：${yongWx || '—'}；忌神：${jiWx || '—'}；调候：${yongshen.tiaohou || '以扶抑为主'}。`
                  })() }
                ]
              }
            },
            {
              key: '1.2',
              title: '3.2 取格依据',
              kind: 'list',
              data: {
                items: (() => {
                  const dm = chart.dayMaster
                  const mz = geJu.monthZhi
                  const benqi = geJu.ylMainGan
                  const benqiWx = geJu.ylMainWx
                  const benqiSs = shiShenOfLocal(benqi, dm)
                  const cangSs = geJu.canggan.map(g => `${g}${shiShenOfLocal(g, dm) ? `（${shiShenOfLocal(g, dm)}）` : ''}`).join('、')
                  const tout = Object.entries(geJu.tianGanHas).map(([k, v]) => `${v}${k}`).join('、') || '无显著透星'
                  const isKu = ['辰', '戌', '丑', '未'].includes(mz)
                  return [
                    `1. 月令${mz}人元司令之神为${geJu.siling.gan}（${geJu.siling.wx}，生于节后第${geJu.siling.offsetDays}日司权），相对日主${dm}是「${geJu.silingSS}」，${isKu ? '此气藏于库墓之中' : '此气当令司权'}，为取格之体。${geJu.siling.gan !== benqi ? `本气${benqi}${benqiWx}退居其次，须以司令透藏辨格。` : ''}`,
                    `2. 月干透${chart.pillars[1].gan}${shiShenOfLocal(chart.pillars[1].gan, dm) ? `（${shiShenOfLocal(chart.pillars[1].gan, dm)}）` : ''}，天干见 ${tout}；月支${mz}三藏为 ${cangSs}，观透藏之清浊以定格局。`,
                    `3. ${isKu ? `月令${mz}为库墓，透干之星与库藏之气相表里，须辨冲合开闭，看财官是否得库而发。` : `月令${mz}非库墓，格局以司令之神${geJu.siling.gan}（${geJu.silingSS}）为体，依其透干与日主强弱定喜忌。`}${geJu.waiGe ? `另，命局有外格倾向，须综合校验，不轻断。` : ''}`
                  ]
                })()
              }
            },
          ]
        }
      },

      // 第四章·用神法
      {
        key: 'yongshen',
        title: '第三章·用神法',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '2.1',
              title: '4.1 身强弱四维判定',
              kind: 'table',
              data: {
                headers: ['维度', '依据', '得分'],
                rows: [
                  ...strengthDetailRows.map(r => [r.dim, r.basis, r.score]),
                  ['结论', `综合判定：日主${chart.dayMaster}${chart.dayMasterWx}，${strengthTxt}`, strengthTxt === '身强' ? '偏强' : strengthTxt === '身弱' ? '偏弱' : '中和']
                ]
              }
            },
            {
              key: '2.2',
              title: '4.2 喜忌总表',
              kind: 'table',
              data: {
                headers: ['类别', '五行', '说明'],
                rows: xiJiRows.map(r => [r.level, `${r.wx}（${r.gan}）`, r.desc]),
                // 类别列放 lv 徽章（含 padding+border），动态计算宽度过窄会竖排；
                // 五行较短；说明列放长描述。显式列宽优先于 planColumnWidths 推断。
                colWidths: ['18%', '22%', '60%']
              }
            },
            {
              key: '2.3',
              title: '4.3 调候与通关',
              kind: 'kv',
              data: {
                blocks: [
                  { k: '气候与调候', v: (() => {
                    const mz = chart.pillars[1]
                    const mzWx = ZHI_WUXING[DI_ZHI.indexOf(mz.zhi)]
                    const th = yongshen.tiaohou || '以扶抑喜忌为主'
                    return `${mz.zhi}月（${mz.gan}${mz.zhi}）${mzWx}当令，调候以${th}为要。`
                  })() },
                  { k: '用神结构', v: (() => {
                    const seq = yongshen.sequence.filter(s => s.wx).map(s => `${s.wx}（${s.why.split('（')[0]}）`).join('、')
                    const ji = yongshen.avoid.filter(a => a.wx).map(a => `${a.wx}（${a.why}）`).join('、')
                    return `扶抑喜用：${seq || '—'}；忌神：${ji || '—'}；调候：${yongshen.tiaohou || '—'}。`
                  })() },
                  { k: '病药', v: (() => {
                    const b = yongshen.bingyao
                    return `病：${b.bing}；药：${b.yao}（${b.note}）。`
                  })() },
                  { k: '用神定序', v: (() => {
                    const seq = yongshen.sequence.filter(s => s.wx)
                    const ordered = seq.map((s, i) => `${'①②③④⑤'[i] || i + 1}${s.wx}（${s.why.split('（')[0]}）`).join(' → ')
                    const ji = yongshen.avoid.filter(a => a.wx).map(a => a.wx).join('、')
                    return `${ordered || '—'} → 忌${ji || '—'}；${strengthTxt}格局，脚本初判与经典复核一致，${seq[0]?.wx || '—'}为第一优先。`
                  })() }
                ]
              }
            }
          ]
        }
      },

      // 第五章·大运分析
      {
        key: 'dayunanly',
        title: '第四章·大运分析',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '3.1',
              title: '4.1 起运与运程衔接',
              kind: 'kv',
              data: {
                blocks: [
                  { k: '起运信息', v: chart.qiYunText ? `${chart.qiYunText}起运（${chart.qiYunDate || ''}）。` : (chart.qiYunAge != null ? `起运约 ${chart.qiYunAge} 岁（${chart.qiYunDate || ''}）。` : '起运年龄请结合出生时辰与上下节气复核。') },
                  { k: '运程衔接', v: `当前大运（${currentDY2.key} ${currentDY2.start}~${currentDY2.end}）：${currentDYAnalysis.summary}。下一步大运（${nextDY.key} ${nextDY.start}~${nextDY.end}）：${nextDYAnalysis.summary}。${yongshen.isWeak ? '此运是人生关键转折，宜蓄力转型。' : '顺势而为，把握机会，稳中求进。'}` }
                ]
              }
            },
            {
              key: '3.2',
              title: '4.2 大运全览',
              kind: 'dayunGroup',
              data: (() => {
                // 大运全览卡片（10 运）：每张卡一个十年窗口，当前/下一运与重点大运在卡内直接高亮
                const dayuns = daxunList.map((d, i) => {
                  const gzWx = ZHI_WUXING[DI_ZHI.indexOf(d.z)]
                  let mark = ''
                  if (d.isNow) mark = 'NOW'
                  else if (d === nextDY) mark = 'NEXT'
                  const ageTxt = `${d.startAge || '?'}-${d.endAge || '?'}岁`
                  const sub = `${d.start}~${d.end} · ${ageTxt}`
                  let desc = ''
                  if (d.isNow) {
                    desc = `当前大运（${ageTxt}），${d.status}；地支主气${d.z}（${gzWx}）主导这十年大势。`
                  } else if (d === nextDY) {
                    desc = `下一大运（${ageTxt}），${d.status}；建议提前 2-3 年布局方向、行业、关系网络。`
                  } else if (d.startAge <= currentDY2.startAge) {
                    desc = `已交大运（${ageTxt}），${d.status}；该运主气${gzWx}五行能量已过，可作历史复盘参照。`
                  } else {
                    desc = `未到之运（${ageTxt}），${d.status}；属于"远景趋势"参考，不宜早断。`
                  }
                  const tone = d.level === 'star' ? 'star' : d.level === 'warn' ? 'warn' : d.level === 'good' ? 'good' : 'plain'
                  return {
                    name: d.key,
                    tag: `${d.icon || ''} ${d.status}`,
                    sub,
                    desc,
                    tone,
                    mark
                  }
                })
                return { dayuns }
              })()
            },
            {
              key: '3.3',
              title: `5.3 当前大运：${currentDY2.key}（${currentDY2.start}-${currentDY2.end}）`,
              kind: 'dayunDetail',
              data: {
                state: 'now',
                cards: [
                  { name: '天干', gz: currentDY2.g, wx: GAN_WUXING[TIAN_GAN.indexOf(currentDY2.g)], shiShen: currentDY2.ganShiShen || '', desc: yongshen.isWeak ? '用神透出，求财模式从"单打独斗"转向"平台借力"。' : '身能担财官，此运可从容进取。' },
                  { name: '地支', gz: currentDY2.z, wx: ZHI_WUXING[DI_ZHI.indexOf(currentDY2.z)], shiShen: currentDY2.zhiShiShen || '', desc: yongshen.isWeak ? '财星有力，收入提升。' : '发挥空间增大。' },
                  { name: '综合判断', desc: currentDYAnalysis.summary + (yongshen.isWeak ? '羊金用神到位，化杀生身，收入远超前途。' : '身强担财官、稳进。'), key: true }
                ]
              }
            },
            {
              key: '3.4',
              title: `5.4 下步大运：${nextDY.key || '—'}（${nextDY.start || '—'}-${nextDY.end || '—'}）`,
              kind: 'dayunDetail',
              data: {
                state: 'next',
                cards: [
                  { name: '天干', gz: nextDY.g || '—', wx: nextDY.g ? GAN_WUXING[TIAN_GAN.indexOf(nextDY.g)] : '', shiShen: nextDY.ganShiShen || '', desc: `${nextDY.ganShiShen ? `${nextDY.ganShiShen}透出` : '比劫帮身'}，${yongshen.isWeak ? '宜借运扶身，蓄力而上。' : `日主${strengthTxt}，可顺势进取。`}` },
                  { name: '地支', gz: nextDY.z || '—', wx: nextDY.z ? ZHI_WUXING[DI_ZHI.indexOf(nextDY.z)] : '', shiShen: nextDY.zhiShiShen || '', desc: `${nextDY.zhiShiShen ? `${nextDY.zhiShiShen}当令` : '与命局联动'}，${yongshen.isWeak ? '印比扶身之机。' : '食财官泄秀之用。'}` },
                  { name: '综合判断', desc: nextDYAnalysis.summary + (yongshen.isWeak ? '此运是人生关键转折，宜借扶身之运蓄力，稳中求进。' : '顺势有为、把握机会。'), key: true }
                ]
              }
            }
          ]
        }
      },

      // 第六章·流年要点
      {
        key: 'liunian',
        title: `第五章·流年要点（${new Date().getFullYear()}${ln.gz}）`,
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '4.1',
              title: '4.1 近年预鉴',
              kind: 'table',
              // 顶部聚焦注释：当前流年（动态年份干支）的转机年判断，与下方表格首行呼应
              note: `【转机年·${new Date().getFullYear()}】${ln.verdict}`,
              data: {
                headers: ['年', '干支', '流年意象', '核心判断'],
                rows: liunianRows.map(r => [String(r.year), r.gz, r.image, r.judge]),
                // 首行（当前流年）高亮，替代原"重点流年卡片"
                current: 0
              }
            }
          ]
        }
      },

      // 第七章·事业方向
      {
        key: 'career',
        title: '第六章·事业方向',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '5.1',
              title: '4.1 事业方向',
              kind: 'list',
              note: (() => {
                // 职业定位：身强/身弱的不同路径 + 用神主导方向（原 4.3 内容作为顶部注释）
                const yongSeq = yongshen.sequence.filter(s => s.wx)
                const top = yongSeq[0]?.wx
                const descMap = { '金': '宜走官杀管理、专业权威路线', '水': '宜走食伤表达、技术输出路线', '木': '宜走印星学问、资源整合路线', '火': '宜走比劫合作、独立创业路线', '土': '宜走财星经营、稳健积累路线' }
                const posture = yongshen.isWeak ? '以扶身为先，宜借贵人平台稳步发展，适合专业深耕' : '身强任事，宜独立执业、开拓进取'
                return `【职业定位】${posture}。用神主导方向：${descMap[top] || '顺势而为'}。重点关注行业：${industries.slice(0, 3).map(i => i.industry).join('、') || '见下方建议'}。`
              })(),
              data: {
                items: (() => {
                  // 行业建议列表（原 4.2 内容）+ 优势定位概要（原 4.1 融入第一项）
                  const list = []
                  if (industries.length > 0) {
                    list.push(`**优势定位（第一优先）**：${industries[0].industry}（${industries[0].wx}${industries[0].why}）`)
                  } else {
                    list.push(`**优势定位**：命局以${strengthTxt}${dayGan}${chart.dayMasterWx}日主为基，${yongshen.isWeak ? '宜取印比扶身，走稳健专业路线' : '宜取食财官泄耗，走进取开拓路线'}。`)
                  }
                  industries.slice(1).forEach((ind, i) => {
                    list.push(`**次选**：${ind.industry}（${ind.wx}${ind.why}）`)
                  })
                  const avoidWx = yongshen.avoid.filter(a => a.wx).map(a => a.wx).join('、') || '—'
                  list.push(`**慎入**：${yongshen.isWeak ? '纯管理岗（身弱杀旺，无印化难抵权力）' : '过度依赖' + avoidWx + '之行业（忌神）'}`)
                  return list
                })()
              }
            },
            {
              key: '5.2',
              title: '4.2 事业风险',
              kind: 'kv',
              data: {
                blocks: [
                  { k: '事业风险', v: (() => {
                    const jiWx = yongshen.avoid.filter(a => a.wx).map(a => a.wx).join('、') || '—'
                    const hasJie = chart.pillars.some(p => p.shiShen && p.shiShen.includes('劫财'))
                    // 官杀分透/藏口径：天干透显则显，藏支则"藏而不透"，全无才言"不显"
                    const guanAll = []
                    chart.pillars.forEach((p, i) => {
                      if (i !== 2) guanAll.push(shiShenOfLocal(p.gan, dayGan))
                      cangGanOf(p.zhi).forEach(g => guanAll.push(shiShenOfLocal(g, dayGan)))
                    })
                    const hasGuanTian = chart.pillars.some(p => p.shiShen && (p.shiShen.includes('正官') || p.shiShen.includes('七杀')))
                    const hasGuanCang = guanAll.includes('正官') || guanAll.includes('七杀')
                    const risks = []
                    if (hasJie) risks.push('比劫夺财，合伙需防被分财、慎与亲友合伙')
                    if (hasGuanTian) risks.push('官杀透显，宜谋体制或规范行业之职，名分与实权可兼得')
                    else if (hasGuanCang) risks.push('官杀藏而不透，宜先以专业技术沉淀，待大运引动再图显达')
                    else risks.push('官杀不显，体制内求官阻力大，宜以专业技术立身')
                    if (yongshen.isWeak) risks.push('身弱难任财官，宜借力而行，避免独挑重担')
                    return risks.join('；') || `忌神（${jiWx}）之年易有波折，宜稳健经营。`
                  })() }
                ]
              }
            }
          ]
        }
      },

      // 第八章·财运分析
      {
        key: 'wealth',
        title: '第七章·财运分析',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '6.1',
              title: '4.1 财富特征',
              kind: 'kv',
              data: {
                blocks: (() => {
                  const caiGans = chart.pillars.map((p, i) => i === 2 ? null : shiShenOfLocal(p.gan, dayGan)).filter(Boolean)
                  const hasPianCai = caiGans.some(s => s.includes('偏财'))
                  const hasZhengCai = caiGans.some(s => s.includes('正财'))
                  const hasShiShang = caiGans.some(s => s.includes('食') || s.includes('伤'))
                  const source = hasPianCai ? '偏财为主（项目制、一次性大额），正财为辅' : hasShiShang ? '食伤生财（靠才华、技术变现）' : '以正财、稳健积累为主'
                  const level = yongshen.isWeak ? '宜守财，先求稳再求大' : '身强可任财官，进取得当可望积累可观的财富'
                  return [
                    { k: '财富结构', v: `${source}。` },
                    { k: '财富能力', v: `${yongshen.isWeak ? '财为喜忌交杂，宜守中求进' : '喜神为财，身强能任，财运根基较好'}。` },
                    { k: '财富量级', v: `${level}。${caiFu.mode}` },
                    { k: '理财提醒', v: caiFu.warn }
                  ]
                })()
              }
            },
            {
              key: '6.2',
              title: '4.2 理财建议',
              kind: 'note',
              data: { text: caiFu.mode + '；' + caiFu.timing + '；' + caiFu.warn }
            }
          ]
        }
      },

      // 第九章·婚姻家庭
      {
        key: 'marriage',
        title: '第八章·婚姻家庭',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '7.1',
              title: '4.1 配偶信息',
              kind: 'list',
              data: {
                items: (() => {
                  const items = []
                  const caiWx = WUXING_KE[chart.dayMasterWx] // 财星五行
                  const caiPositions = chart.pillars.map((p, i) => i === 2 ? null : { i, s: shiShenOfLocal(p.gan, dayGan), gz: p.gan + p.zhi }).filter(Boolean)
                  // 配偶星只认正财/偏财——"劫财"含"财"字曾导致被误判为配偶星
                  const caiFound = caiPositions.filter(x => x.s && (x.s === '正财' || x.s === '偏财'))
                  const caiText = caiFound.length
                    ? `配偶星：${caiFound.map(x => `${x.s}透于${['年干','月干','时干'][x.i] || '柱'}（${x.gz}）`).join('、')}`
                    : `配偶星：财星（${caiWx}）藏而不透，晚婚倾向，正缘宜待大运引动`
                  items.push(caiText)
                  // 配偶宫（日支）：藏干取实际地支藏干，而非不存在的 hiddenGan 字段
                  const palace = chart.pillars[2]
                  const cang = cangGanOf(palace.zhi)
                  const cangShen = cang.map(g => shiShenOfLocal(g, dayGan)).filter(Boolean).join('、')
                  const palaceWx = ZHI_WUXING[DI_ZHI.indexOf(palace.zhi)]
                  items.push(`配偶宫：日支${palace.zhi}（${palaceWx}），藏干：${cangShen}——配偶个性特征、相处模式由此推断`)
                  // 日支与用神喜忌
                  const isYong = yongshen.sequence.some(s => s.wx === palaceWx)
                  items.push(`配偶宫${isYong ? '得用神之气，婚姻有助益，配偶是贵人' : '与用神关系平常，婚姻重在磨合经营'}。`)
                  return items
                })()
              }
            },
            {
              key: '7.2',
              title: '4.2 婚恋建议',
              kind: 'list',
              data: {
                items: (() => {
                  const items = []
                  const caiWx = WUXING_KE[chart.dayMasterWx]
                  // 用神大运或财星大运为姻缘佳期（只看当前及未来之运，已过之运不充当"时机"）
                  const nowIdx = daxunList.findIndex(d => d.isNow)
                  const futureDY = nowIdx >= 0 ? daxunList.slice(nowIdx) : daxunList
                  const yongDY = futureDY.find(d => {
                    const dwx = GAN_WUXING[TIAN_GAN.indexOf(d.g)]
                    return yongshen.sequence.some(s => s.wx === dwx) || dwx === caiWx
                  }) || futureDY[0]
                  if (yongDY) items.push(`姻缘最佳时机：${yongDY.key}运（${yongDY.start}~${yongDY.end} 年），桃花与婚缘渐旺`)
                  // 用神流年
                  const goodYear = ln && ln.verdict ? ln.verdict : '逢用神流年，姻缘有动'
                  items.push(`近期动向：${goodYear}`)
                  items.push(`单身者宜在${strengthTxt}格局下，于财星、用神之年把握正缘，忌神年宜静。`)
                  return items
                })()
              }
            },
            {
              key: '7.3',
              title: '4.3 婚姻风险',
              kind: 'list',
              data: {
                items: (() => {
                  const items = []
                  const hasJie = chart.pillars.some(p => p.shiShen && p.shiShen.includes('劫财'))
                  if (hasJie) items.push('比劫夺财之星现，婚后财务上防被分夺，合伙经营需谨慎')
                  const hasShuangGuan = chart.pillars.some(p => (p.shiShen && p.shiShen.includes('官') || p.shiShen.includes('杀')))
                  if (hasShuangGuan) items.push('官杀透显，感情中易有竞争或压力，需沟通自律')
                  if (yongshen.isWeak) items.push('身弱难任财官，早婚易生变，宜待身旺之运再定')
                  else items.push(`${strengthTxt}任事，婚姻重在相互扶持，忌神之年宜多沟通`)
                  return items
                })()
              }
            }
          ]
        }
      },

      // 第十章·健康养生
      {
        key: 'health',
        title: '第九章·健康养生',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '8.1',
              title: '4.1 命局薄弱点',
              kind: 'list',
              data: {
                items: (() => {
                  // 五行最弱项 = 健康薄弱点
                  const sorted = wxs.rows.slice().sort((a, b) => a.v - b.v)
                  const weak = sorted.filter(r => r.v <= sorted[0].v + 1).slice(0, 2)
                  const items = weak.map(r => `${r.wx}（${r.organ || '对应部位'}）：${r.level || '偏弱'}`)
                  const base = getWeakBody(chart)
                  if (base && !items.includes(base)) items.push(base)
                  return items.slice(0, 3)
                })()
              }
            },
            {
              key: '8.3',
              title: '4.2 五运六气·体质盘',
              kind: 'list',
              data: {
                items: (() => {
                  const wq = buildWuyunliuqi(chart)
                  if (!wq.ok) return ['（缺少出生信息，无法排五运六气）']
                  return [
                    `中运：${wq.zhongyun}（${wq.guojibu}）｜客运初运：${wq.keyun}`,
                    `司天：${wq.sitian}｜在泉：${wq.zaiquan}`,
                    `主气（出生当令）：${wq.zhuqi.name}（${wq.zhuqi.note}）`,
                    ...(wq.tizhi ? [`出生属相 ${wq.sx} 肖 → ${wq.tizhi.tz}体质（本气${wq.tizhi.wx}），易见健康倾向：${wq.tizhi.risk}`] : [])
                  ]
                })()
              }
            },
            {
              key: '8.2',
              title: '4.3 养生建议（命局·五运六气）',
              kind: 'note',
              data: { text: (() => {
                const sorted = wxs.rows.slice().sort((a, b) => a.v - b.v)
                const weakest = sorted[0]
                const weakestWx = weakest ? weakest.wx : ''
                const weakestOrgan = weakest ? (weakest.organ || '对应部位') : ''
                const weakestLevel = weakest ? (weakest.level || '偏弱') : ''
                const wq = buildWuyunliuqi(chart)
                if (!wq.ok) return '（缺少出生信息，无法排五运六气）'
                const dmWx = chart.dayMasterWx || GAN_WUXING[TIAN_GAN.indexOf(chart.dayMaster)]
                const ysWxs = new Set((yongshen.sequence || []).map(s => s.wx).filter(Boolean))
                const tzWx = wq.tizhi ? wq.tizhi.wx : ''
                const segs = []
                // ① 整体原则（命局层面，无条件给出）
                segs.push(`① 整体原则：规律作息、均衡饮食。命局最弱为${weakestWx || '—'}（${weakestOrgan}·${weakestLevel}），宜针对性调养；忌神之年注意劳逸结合，定期体检。`)
                if (wq.tizhi) {
                  const base = wq.yangsheng || ''
                  const doubleHit = tzWx && weakestWx && tzWx === weakestWx
                  const ysHit = tzWx && ysWxs.has(tzWx)
                  // ② 体质调养
                  segs.push(`② 体质调养（${wq.sx}肖 · ${wq.tizhi.tz}）：${base}`)
                  // ③ 命局呼应
                  if (doubleHit) {
                    segs.push(`③ 命局呼应：体质本气${tzWx}恰为命局最弱项（${weakestWx}·${weakestOrgan}），双重指向同脏，是养生第一优先级。`)
                  } else if (weakestWx) {
                    segs.push(`③ 命局呼应：命局最弱为${weakestWx}（${weakestOrgan}），调养时与体质（本气${tzWx || '—'}）统筹，先护短板再理体质。`)
                  }
                  // ④ 用神
                  if (ysHit) {
                    segs.push(`④ 用神相合：体质本气${tzWx}正是本局用神方向，顺势调养可兼顾补气扶身，事半功倍。`)
                  } else {
                    segs.push(`④ 用神提示：本局用神为${[...ysWxs].join('、') || '—'}，饮食起居宜向用神方向倾斜，以扶身抗岁运之克泄。`)
                  }
                } else {
                  segs.push(`② 体质未判，按命局最弱${weakestWx}（${weakestOrgan}）与用神方向调养。`)
                }
                // ⑤ 中运
                segs.push(`⑤ 中运提示：出生年${wq.zhongyun}运${wq.guojibu === '太过' ? '太过，此气偏亢，易亢则乘其所胜' : '不及，此气偏弱，易弱则受其所不胜'}，${wq.guojibu === '太过' ? '忌过多进补同气之物' : '宜平补该气以扶不及'}。`)
                // ⑥ 岁运
                segs.push(`⑥ 岁运呼应：${dmWx}日主逢${wq.sitian}司天之年，天地之气与日主生克联动，宜在该类年份提前作息、定期体检。`)
                segs.push(`（以上为传统五运六气/体质理论的生活调养参考，不构成医疗诊断；如有不适请及时就医。）`)
                return segs.join('\n')
              })() }
            }
          ]
        }
      },

      // 第十一章·父母长辈
      {
        key: 'parents',
        title: '第十章·父母长辈',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '9.1',
              title: `11.1 父亲（年柱${parents.father.ganZhi}）`,
              kind: 'list',
              data: {
                items: [
                  `年柱${parents.father.shen}：${parents.father.bodyDesc.split('，')[0]}，${parents.father.bodyDesc}`,
                  `年支${parents.father.ganZhi[1]}：${parents.father.health}`,
                  parents.father.isRoot ? '年柱为根在月支（辰中藏戊与戌比助），父亲对命主影响力大，命主早年受父亲影响深' : '年柱不为根或与月支不合，父亲对命主影响力较弱，命主早年影响主要来自母亲或祖辈'
                ]
              }
            },
            {
              key: '9.2',
              title: `11.2 母亲（月柱${parents.mother.ganZhi}）`,
              kind: 'list',
              data: {
                items: (() => {
                  const mShen = parents.mother.shen
                  const mGan = chart.pillars[1].gan
                  const mGanWx = GAN_WUXING[TIAN_GAN.indexOf(mGan)]
                  const isJi = yongshen.avoid.some(a => a.wx === mGanWx)
                  return [
                    `月柱${mShen}：${parents.mother.bodyDesc.split('，')[0]}，${parents.mother.bodyDesc}`,
                    `月支${parents.mother.ganZhi[1]}：${parents.mother.health}`,
                    `月柱为父母之宫，月令透出${mGan}${mGanWx}${mShen}${isJi ? '为忌神，母亲为家庭操心，健康宜多关注' : '非忌神，母亲操持得当，助力较多'}`
                  ]
                })()
              }
            },
            {
              key: '9.3',
              title: '4.3 父母职业倾向',
              kind: 'list',
              data: {
                items: [
                  `父亲（年柱${parents.father.shen}）：${parents.father.bodyDesc}`,
                  `母亲（月柱${parents.mother.shen}）：${parents.mother.bodyDesc}`
                ]
              }
            },
            {
              key: '9.4',
              title: '4.4 孝道建议',
              kind: 'note',
              data: { text: (() => {
                const m = chart.pillars[0]
                const fShen = shiShenOfLocal(m.gan, dayGan)
                const hasYong = yongshen.sequence.some(s => s.wx === ZHI_WUXING[DI_ZHI.indexOf(m.zhi)])
                return `父亲星（${fShen}）藏于年柱${m.zhi}，父母健康是命主重要的福报支撑。${hasYong ? '年柱得用神之气，父母助力较佳。' : '逢忌神之年宜多留意长辈健康。'}`
              })() }
            }
          ]
        }
      },

      // 第十二章·子女后代
      {
        key: 'children',
        title: '第十一章·子女后代',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '10.1',
              title: '4.1 子女情况',
              kind: 'kv',
              data: {
                blocks: [
                  { k: '子女宫', v: childInfo.timeDesc },
                  { k: '子女星', v: childInfo.summary + '（' + childInfo.found + '）' },
                  { k: '子女特征', v: (() => {
                    const timeP = chart.pillars[3]
                    const ts = shiShenOfLocal(timeP.gan, dayGan)
                    const tz = shiShenOfLocal(timeP.zhi, dayGan)
                    return `时柱${timeP.gan}${timeP.zhi}为子女宫，${ts}透干${tz ? '、' + tz + '藏支' : ''}，子女有其个性和天赋，宜因材施教。`
                  })() }
                ]
              }
            },
            {
              key: '10.2',
              title: '4.2 生育建议',
              kind: 'list',
              data: {
                items: (() => {
                  const items = []
                  // 用神大运为子女缘佳期（只看当前及未来之运）
                  const nowIdx = daxunList.findIndex(d => d.isNow)
                  const futureDY = nowIdx >= 0 ? daxunList.slice(nowIdx) : daxunList
                  const yongDY = futureDY.find(d => yongshen.sequence.some(s => s.wx === GAN_WUXING[TIAN_GAN.indexOf(d.g)])) || futureDY[0]
                  items.push(`子女缘分：${childInfo.found !== '无子女星透干或藏支' ? '子女星现于命局，缘分较佳' : '子女星藏而不显'}；${yongDY ? `${yongDY.key}运（${yongDY.start}~${yongDY.end} 年）子女运渐旺` : ''}`)
                  items.push(`生育应期：逢用神之年、${chart.gender === '男' ? '官杀' : '食伤'}（子女星）引动之岁，子女星到位`)
                  items.push(`头胎倾向：以${chart.gender === '男' ? '官杀' : '食伤'}（子女星）之阴阳五行判断，宜结合大运流年`)
                  return items
                })()
              }
            },
            {
              key: '10.3',
              title: '4.3 教育建议',
              kind: 'note',
              data: { text: (() => {
                const timeP = chart.pillars[3]
                const ts = shiShenOfLocal(timeP.gan, dayGan)
                const hasYong = yongshen.sequence.some(s => s.wx === GAN_WUXING[TIAN_GAN.indexOf(timeP.gan)])
                return `时柱${timeP.gan}${timeP.zhi}为子女宫，${ts}坐镇。${ts.includes('伤官') || ts.includes('食神') ? '子女宜培养技术型才华，不宜强迫走管理路线。' : '子女性格随和，宜引导其发挥所长。'}${hasYong ? '子女星得用神之气，子女对命主有助力。' : '子女缘重在用心经营。'}`
              })() }
            }
          ]
        }
      },

      // 第十三章·人际关系
      {
        key: 'relation',
        title: '第十二章·人际关系',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '11.1',
              title: '4.1 人脉特征',
              kind: 'list',
              data: {
                items: relation.traits.map((t, i) => `${['年柱', '月柱', '时柱', '地支'][i] || '命局'}：${t}`)
              }
            },
            {
              key: '11.2',
              title: '4.2 交友建议',
              kind: 'list',
              data: {
                items: (() => {
                  const items = [`宜交：${relation.yongFriend}，多为帮你的贵人型`, `忌交：${relation.jiFriend}，多为消耗你的人`]
                  const hasJie = chart.pillars.some(p => p.shiShen && p.shiShen.includes('劫财'))
                  items.push(hasJie ? '比劫现于命局：合伙宜慎，防被分利，宜保持适度边界' : '命局比劫不显：人际较为平和，合作顺遂')
                  return items
                })()
              }
            },
            {
              key: '11.3',
              title: '4.3 处世建议',
              kind: 'note',
              data: { text: (() => {
                const jiWx = yongshen.avoid.filter(a => a.wx).map(a => a.wx).join('、') || '—'
                return `人际交往中防口舌、防小人，忌神（${jiWx}）之年尤其谨慎，宜亲近用神类人群，远离消耗你的人。`
              })() }
            }
          ]
        }
      },

      // 第十四章·运势总论
      {
        key: 'summary',
        title: '第十三章·运势总论',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '12.1',
              title: '4.1 人生轨迹',
              kind: 'table',
              data: {
                headers: ['阶段', '年龄', '特征'],
                rows: lifeQx.map(s => [s.stage, s.ageRange, s.tone])
              }
            },
            {
              key: '12.2',
              title: '4.2 人生等级评定',
              kind: 'kv',
              data: {
                blocks: (() => {
                  const yongWx = yongshen.sequence.filter(s => s.wx).map(s => s.wx).join('、') || '—'
                  const jiWx = yongshen.avoid.filter(a => a.wx).map(a => a.wx).join('、') || '—'
                  const hasYongDY = daxunList.some(d => {
                    const dwx = GAN_WUXING[TIAN_GAN.indexOf(d.g)]
                    return yongshen.sequence.some(s => s.wx === dwx)
                  })
                  return [
                    { k: '人生等级评定', v: `${strengthTxt}格局，喜用${yongWx}，忌${jiWx}，中上之姿，贵在把握用神之运。` },
                    { k: '核心优势', v: `喜用神（${yongWx}）若得岁运生扶，主事业财富可期` },
                    { k: '时机决定格局', v: hasYongDY ? '逢用神大运，是人生跃升的关键窗口' : '逢喜用之年，宜积极进取' },
                    { k: '最终层次', v: `取决于对用神（${yongWx}）之年运的把握程度。` }
                  ]
                })()
              }
            },
            {
              key: '12.3',
              title: '4.3 核心结论',
              kind: 'list',
              data: {
                items: (() => {
                  const yongWx = yongshen.sequence.filter(s => s.wx).map(s => s.wx).join('、') || '—'
                  const jiWx = yongshen.avoid.filter(a => a.wx).map(a => a.wx).join('、') || '—'
                  return [
                    `1. 格局：${geJu.pattern}，日主${strengthTxt}，取用神${yongWx}`,
                    `2. 用神：${yongWx}；忌神：${jiWx}`,
                    '3. 发动机：用神大运流年是命运开关，宜把握',
                    `4. 护身符：顺应${strengthTxt}格局，忌神之年守成即赢`,
                    `5. 最大风险：${new Date().getFullYear()} 年及忌神（${jiWx}）之年，宜守不宜攻`
                  ]
                })()
              }
            }
          ]
        }
      },

      // 第十五章·改运建议
      {
        key: 'advice',
        title: '第十四章·改运建议',
        kind: 'kvComposite',
        data: {
          subsections: [
            {
              key: '13.1',
              title: '4.1 风水调整',
              kind: 'list',
              data: {
                items: [
                  `方位：${fengShui.direction}（${yongshen.sequence[0]?.wx || '金'}）、${fengShui.xishenDir}（${yongshen.sequence[1]?.wx || ''}）为用神方，卧室 / 办公室朝北朝西有利`,
                  `颜色：${fengShui.color}为喜，忌${fengShui.jiColor}（忌神色）`,
                  `数字：${fengShui.numYong}（${yongshen.sequence[0]?.wx || '金'}、${yongshen.sequence[1]?.wx || ''}）为幸运数；${fengShui.numJi}（${yongshen.avoid[0]?.wx || '火'}、${yongshen.avoid[1]?.wx || ''}）忌`,
                  `行业：${industries.slice(0, 3).map(r => r.industry).join(' / ')}为宜；忌${industries.slice(3).map(r => r.industry).join(' / ') || '纯体力/纯创意类'}`
                ]
              }
            },
            {
              key: '13.2',
              title: '4.2 行动指南',
              kind: 'list',
              data: {
                items: (() => {
                  const yongWx = yongshen.sequence.filter(s => s.wx).map(s => s.wx).join('、') || '—'
                  const jiWx = yongshen.avoid.filter(a => a.wx).map(a => a.wx).join('、') || '—'
                  const nowIdx = daxunList.findIndex(d => d.isNow)
                  const futureDY = nowIdx >= 0 ? daxunList.slice(nowIdx) : daxunList
                  const yongDY = futureDY.find(d => yongshen.sequence.some(s => s.wx === GAN_WUXING[TIAN_GAN.indexOf(d.g)])) || futureDY[0]
                  return [
                    `1. 现在至 ${new Date().getFullYear()}：守住主业，戒高风险投资，积累资源，等待用神（${yongWx}）之运`,
                    `2. ${yongDY ? `${yongDY.key}运（${yongDY.start}~${yongDY.end} 年）` : '用神之运'}：命运重要窗口，谨慎把握，进取与风控并重`,
                    `3. ${new Date().getFullYear()} 年及忌神（${jiWx}）之年：宜守成为主，切戒高风险操作`,
                    `4. 婚恋：${yongshen.isWeak ? '宜待身旺之运' : '逢喜用之年'}再定终身更稳`
                  ]
                })()
              }
            },
            {
              key: '13.3',
              title: '4.3 心态调整',
              kind: 'list',
              data: {
                items: (() => {
                  const yongWx = yongshen.sequence.filter(s => s.wx).map(s => s.wx).join('、') || '—'
                  return [
                    `接受${strengthTxt}这个现实，扬长避短，用智慧和技术取胜`,
                    '顺用神而为，忌神之年该静则静，用神之年该动则动',
                    '不必艳羡他人，命中之财在适合你的用神领域，靠本事吃饭才是正道',
                    `核心心法：稳住心态，善用${yongWx}之机；每一天都是在为命运蓄力`
                  ]
                })()
              }
            }
          ]
        }
      }

    ]

    const advice = `此命${strengthTxt}最旺之气（${yongshen.woSheng}）无制，` +
      `${yongshen.isWeak ? `印比（${yongshen.shengWo}、${dmWx}）不可缺` : `财官（${yongshen.woKe}、${yongshen.keWo}）可消耗`}。` +
      (chart.qiYunAge != null
        ? `本局起运 ${chart.qiYunText || `${chart.qiYunAge} 岁`}（${chart.qiYunDate || ''}），交节时刻邻近者建议以精确出生时间复核。`
        : `起运年龄请结合出生时辰与上下节气复核（精确到日子即可纠偏 ±1）。`) +
      `本报告为子平派骨架结论，重大决策请再参详具体岁运。` +
      `命理贵在"以验定盘"：若可回顾近十年升迁、婚恋、学业、疾厄等关键年份，` +
      `将有助于校准本局格局与用神之判定，建议结合过往节点复核喜忌。`

    // 注入 skill 技法总纲（读取元气AI「易学-泰山」技能动态导读，与盲派/紫微等报告对齐）
    const guide = guideSectionOf('bazi')
    if (guide) sections.unshift(guide)

    const result = {
      ok: true,
      type: 'bazi',
      icon: '子',
      title: '子平派八字完整报告',
      sub: `${chart.name || '命主'} · ${chart.gender || ''} · ${chart.shengxiao}肖 · ${chart.dayMasterWx}命`,
      hero: {
        title: `${chart.dayMaster}日主 · ${strengthTxt} · 喜${ysWxs || (yongshen.tiaohou || '')}`,
        sub: `${geJu.pattern} · ${yongshen.tiaohou || ''}气先行，${yongshen.shengWo}印后辅`,
        tag: '子平派'
      },
      sections,
      advice,
    }
    // ⚠ markdown 曾是一句占位串「# 子平派八字完整报告\n\n...详见下方分节」——
    // 页面的「复制 / 下载 / 分享」导出的就是它，用户拿到手的是一行省略号。
    // 用统一的 schemaToMarkdown 从 sections 真正渲染一份完整正文。
    result.markdown = schemaToMarkdown(result)
    return result
  } catch (err) {
    return { ok: false, error: '报告生成失败：' + (err.message || String(err)) }
  }
}

/* ------------------------------------------------------------------ *
 * 文本辅助
 * ------------------------------------------------------------------ */
function shengWoForText(dmWx) {
  const sw = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dmWx)
  return sw ? `${sw}印（生我者）` : '印星'
}

function tianGanAny(chart, dayGan, ss) {
  return chart.pillars.map(p => {
    if (p.gan === dayGan) return null
    return shiShenOfLocal(p.gan, dayGan) === ss ? p.gan : null
  }).filter(Boolean).join('')
}

function isTianGanAny(chart, dayGan, ss) {
  return chart.pillars.some(p => p.gan !== dayGan && shiShenOfLocal(p.gan, dayGan) === ss)
}
function isTianGanHas(chart, dayGan, ss) { return isTianGanAny(chart, dayGan, ss) }

function dyAvoidWx(chart) {
  return Object.keys(WUXING_KE).find(k => WUXING_KE[k] === chart.dayMasterWx) || '土'
}

function countOf(chart, wx) {
  if (!chart || !chart.wuxing) return 0
  return (chart.wuxing[wx] || 0).toFixed(1)
}

function marriageHint(chart, dayGan, dayZhi) {
  // 简单依日支对应一种配偶特质
  const map = {
    子: '聪慧机敏、外冷内热', 丑: '稳重务实、注重物质', 寅: '刚强独立、有事业心',
    卯: '温和细腻、亲和艺术', 辰: '包容有度、富有内涵', 巳: '智慧敏锐、有主见',
    午: '热情开朗、外向张扬', 未: '温良敦厚、注重精神', 申: '理性果决、行动力强',
    酉: '精致讲究、有审美', 戌: '忠厚仁义、有担当', 亥: '豁达宽容、富有智慧'
  }
  return map[dayZhi] || '性格多元'
}

function getIndustryHint(chart, geJu, yongshen) {
  const dmWx = chart.dayMasterWx
  const base = {
    木: '文化教育、设计研发、文创类',
    火: '互联网传播、电力能源、光电行业',
    土: '房地产、建筑工程、农业',
    金: '金融银行、机械制造、五金电子',
    水: '贸易物流、IT 流通、水利行业'
  }
  return `${base[dmWx] || '通用行业'}；` +
         (geJu.isBenqiKe
           ? '命带杀星，宜走专业技术路线（杀星主导，非纯管理岗）。'
           : '格局平和，宜以稳为基。')
}

function getSixQin(chart, dayGan, geJu, yongshen) {
  const yl = chart.pillars[1].gan
  const ylShen = shiShenOfLocal(yl, dayGan)
  const ysPrefix = yongshen.isWeak ? '身弱，父母' : '身强，'
  return `${ysPrefix}亲与己的关系密切；` +
         `月干透${yl}${ylShen}，` +
         `父母之星居月柱，主` +
         (ylShen.includes('印') ? '印护有方，家庭慈爱，'
           : ylShen.includes('财') ? '家庭以财为重，'
           : ylShen.includes('官') ? '家庭规矩森严，'
           : ylShen.includes('杀') ? '家教严苛，'
           : '关系多元，') +
         '兄弟多见竞争。'
}

function getOrganHint(dmWx, yongshen) {
  const map = {
    木: '肝胆、筋腱、眼睛',
    火: '心脏、小肠、血液循环、舌',
    土: '脾胃、肌肉、皮肤',
    金: '肺、大肠、呼吸系统、鼻',
    水: '肾、膀胱、泌尿系统、耳'
  }
  return `${dmWx}五脏：${map[dmWx]}。用神经络：${
    yongshen.shengWo === '金' ? '肺经、大肠经优先调养' :
    yongshen.shengWo === '水' ? '肾经、膀胱经优先调养' :
    yongshen.shengWo === '木' ? '肝经、胆经优先调养' :
    yongshen.shengWo === '火' ? '心经、小肠经' :
    '脾胃经'}。`
}

function getWeakBody(chart) {
  const warn = []
  if (chart.pillars.some(p => p.zhi === '辰') && chart.pillars.some(p => p.zhi === '戌')) {
    warn.push('辰戌冲：脾胃、心血管、腰骶为弱区')
  }
  if (chart.pillars.filter(p => p.zhi === '卯').length >= 2) {
    warn.push('卯木旺极：肝胆、筋骨注意')
  }
  return warn.length ? warn.join('；') : '日主中和，无明显短板；唯在岁运冲克方见虚区'
}

function daxunNote(d, chart, geJu) {
  const wx = GAN_WUXING[TIAN_GAN.indexOf(d.g)]
  const dw = {
    木: '伤食吐秀、才华发越', 火: '财星显达、慎防破耗',
    土: '杀星透干、压力显现', 金: '印星护身、缓和身弱',
    水: '比劫帮身、稳健推进'
  }
  let base = dw[wx] || ''
  if (chart.strength.weak && (wx === '金' || wx === '水')) base = '用神到位 · 身弱扶助最强运之一'
  if (chart.strength.strong && (wx === '木' || wx === '火')) base = '用神到位 · 身强消耗最佳运之一'
  if (d.isNow) base = '· 当前大运 · ' + base
  return base
}

function buildYearNote(y, gz, chart, geJu, yongshen) {
  const isAdv = yongshen.tiaohouWxs[0] === gz.wx
  return {
    year: y,
    gz: `${gz.g}${gz.z}`,
    wx: gz.wx,
    summary: `${y} 年 · ${gz.g}${gz.z}（${gz.wx}气流年）`,
    text: `${y}年${gz.g}${gz.z}，` +
          `${gz.wx}气流入。${
            isAdv ? '🎯 与用神同气，**利**；' :
            chart.favorable && chart.favorable.includes(gz.wx) ? '与喜神同气，利；' :
            '与命局有冲有合。'}` +
          `结合${chart.dayMaster}日主与${geJu.pattern}观察，${
            yongshen.isWeak ? '身弱宜静守，待扶持到大运方大开大合；' :
                              '身强则顺势可取。'}` +
          `结合流年生肖与空亡填实与否，察其虚实。` +
          `参看配偶宫与事业宫在岁运流年之合冲，定吉凶之实。`
  }
}

/* ------------------------------------------------------------------ *
 * V12.0 新增辅助函数（对齐参考版格式）
 * ------------------------------------------------------------------ */

/** 2.1 五行分数表（含强弱判定） */
function wuxingScoreTable(chart) {
  const count = chart.wuxing || {}
  const total = Object.values(count).reduce((a, b) => a + b, 0) || 1
  const avg = total / 5
  const rows = []
  for (const wx of ['木', '火', '土', '金', '水']) {
    const v = +(count[wx] || 0).toFixed(1)
    let level = '中和'
    if (v >= avg * 1.5) level = '旺'
    else if (v >= avg * 1.15) level = '偏旺'
    else if (v >= avg * 0.85) level = '中和'
    else if (v >= avg * 0.5) level = '偏弱'
    else level = '极弱'
    // 找出在四柱里的来源（天干 + 地支本气 + 中气余气）
    const sources = []
    for (const p of chart.pillars) {
      if (GAN_WUXING[TIAN_GAN.indexOf(p.gan)] === wx) sources.push(`${p.label}·${p.gan}`)
      if (ZHI_WUXING[DI_ZHI.indexOf(p.zhi)] === wx) sources.push(`${p.label}·${p.zhi}（主气）`)
    }
    rows.push({ wx, v, level, sources })
  }
  return { rows, total: +total.toFixed(1), avg: +avg.toFixed(1) }
}

/** 2.2 月令与日主关系 */
function yueLingRelation(chart, geJu) {
  const dayGan = chart.dayMaster
  const dmWx = chart.dayMasterWx
  const monthZhi = chart.pillars[1].zhi
  const ylMainGan = geJu.ylMainGan
  const ylMainWx = GAN_WUXING[TIAN_GAN.indexOf(ylMainGan)]
  // 找日干在四柱地支里的根（包括藏干余气）
  const roots = []
  let rootCount = 0
  for (let i = 0; i < chart.pillars.length; i++) {
    const p = chart.pillars[i]
    const cg = cangGanOf(p.zhi)
    const found = cg.find((g, k) => g === dayGan || GAN_WUXING[TIAN_GAN.indexOf(g)] === dmWx)
    if (found) {
      const level = ['本气', '中气', '余气'][cg.indexOf(found)] || '余气'
      roots.push(`${i === 2 ? '日支' : p.label}（${p.zhi}）${level}含${found}`)
      rootCount++
    }
  }
  // 月令与日主的关系（按五行生克，使用子平标准术语）
  let relText = ''
  if (ylMainWx === dmWx) relText = `${ylMainGan}${ylMainWx}与日主${dmWx}比和，日主得令`
  else if (WUXING_SHENG[ylMainWx] === dmWx) relText = `${ylMainGan}${ylMainWx}生日主${dmWx}（印星当令）`
  else if (WUXING_SHENG[dmWx] === ylMainWx) relText = `${ylMainGan}${ylMainWx}为日主${dmWx}所生（食伤当令）`
  else if (WUXING_KE[ylMainWx] === dmWx) relText = `${ylMainGan}${ylMainWx}克日主${dmWx}（官杀当令）`
  else if (WUXING_KE[dmWx] === ylMainWx) relText = `日主${dmWx}克${ylMainGan}${ylMainWx}（财星当令）`
  else relText = `${ylMainGan}${ylMainWx}与日主${dmWx}无直接生克`
  return {
    ylText: `${chart.dayMaster}${dmWx}生于${monthZhi}月（${geJu.ylTerm}），月令主气为${ylMainGan}（${ylMainWx}），${relText}。${relText.includes('克') ? '日主不得月令。' : '日主得月令之力。'}`,
    tongGenText: roots.length ? `通根：${roots.join('、')}。${rootCount >= 2 ? '根多处' : '根少处'}，力量${rootCount >= 2 ? '中等' : '偏弱'}。` : '日主在四柱地支无强根，必须借月令或印比扶身。',
    jiaJiText: (() => {
      const tGan = chart.pillars[3].gan
      const yGan = chart.pillars[0].gan
      const tShen = shiShenOfLocal(tGan, dayGan)
      const yShen = shiShenOfLocal(yGan, dayGan)
      const parts = []
      if (tShen === '劫财' || tShen === '比肩') parts.push(`时干${tGan}${tShen}帮身`)
      if (yShen === '劫财' || yShen === '比肩') parts.push(`年干${yGan}${yShen}帮身`)
      if (!parts.length) parts.push('时干与年干均无同类帮扶')
      return parts.join('；') + '。'
    })(),
    jieLun: (() => {
      return `日主${chart.strength.weak ? '偏弱' : chart.strength.strong ? '偏强' : '中和'}，需${chart.strength.weak ? '印比扶身' : chart.strength.strong ? '食伤财官泄耗' : '中和调候'}。`
    })()
  }
}

/** 2.3 五行流通图（生成Mermaid风格描述） */
function wuxingLiuTong(chart) {
  const ws = wuxingScoreTable(chart)
  // 构建主流通道
  const flow = []
  const dmWx = chart.dayMasterWx
  const wxs = ['木', '火', '土', '金', '水']
  for (let i = 0; i < wxs.length; i++) {
    const a = wxs[i]
    const b = wxs[(i + 1) % wxs.length]
    flow.push(`${a}→${b}`)
  }
  // 找出旺/弱项
  const strong = ws.rows.filter(r => r.level === '旺' || r.level === '偏旺').map(r => r.wx)
  const weak = ws.rows.filter(r => r.level === '偏弱' || r.level === '极弱').map(r => r.wx)
  // 关键矛盾：旺土克水、旺金克木、旺木克土 等
  const mdLines = []
  for (let i = 0; i < wxs.length; i++) {
    const a = wxs[i]
    const b = wxs[(i + 1) % wxs.length] // A→B 是生（B生A）
    if (strong.includes(a) && weak.includes(b)) {
      mdLines.push(`${a}→${b}（${a}生${b}，但${b}偏弱，须补${b}以接力）`)
    }
  }
  // 关键矛盾（按图片样式）
  const cm = []
  if (strong.includes(dmWx) && weak.includes(WUXING_KE[dmWx])) {
    cm.push(`日主${dmWx}旺，财星${WUXING_KE[dmWx]}弱 → 身旺财弱`)
  }
  if (strong.includes(WUXING_KE[dmWx]) && weak.includes(dmWx)) {
    cm.push(`财星${WUXING_KE[dmWx]}旺，日主${dmWx}弱 → 身弱财旺`)
  }
  if (weak.includes(WUXING_SHENG[dmWx]) && strong.includes(WUXING_KE[dmWx])) {
    cm.push(`${WUXING_SHENG[dmWx]}弱、${WUXING_KE[dmWx]}旺 → 主受克`)
  }
  // 通用补全（全部基于当前命局五行旺弱动态生成，不写死五行）
  const sortedRows = ws.rows.slice().sort((a, b) => b.v - a.v)
  const topStrong = sortedRows.find(r => r.level === '旺' || r.level === '偏旺') || sortedRows[0]
  const bottomWeak = sortedRows.filter(r => r.level === '偏弱' || r.level === '极弱').sort((a, b) => a.v - b.v)[0]
  const COMMON_CM = [
    `${topStrong.wx}旺泄${dmWx} → 日主被耗`,
    bottomWeak ? `${topStrong.wx}克${bottomWeak.wx} → 主${bottomWeak.wx}虚弱` : `五行失衡，喜用需扶`,
    bottomWeak ? `${bottomWeak.wx}极弱 → 无力生扶其它五行` : `五行流通偏顺，宜顺势而为`,
  ]
  for (const c of COMMON_CM) if (cm.length < 3 && !cm.includes(c)) cm.push(c)
  return { strong, weak, flow: mdLines.join('；'), conflicts: cm.slice(0, 3) }
}

/** 3.2 格局特点表 */
function geJuFeatures(chart, geJu, yongshen) {
  const features = []
  const dmWx = chart.dayMasterWx
  const pat = geJu.pattern
  if (pat.includes('正官') || pat.includes('七杀')) {
    features.push({ k: '杀刃相辅', v: '杀星有力，须配印化或食神制杀，否则压力丛生。' })
    features.push({ k: '压力动力', v: '杀代表压力与挑战，也代表权力与决断力——既能压垮也能成事。' })
  }
  if (pat.includes('财')) {
    features.push({ k: '财星结构', v: `${pat} 偏${pat.includes('正') ? '正' : '偏'}财，务实求财、产业求财为主。` })
    features.push({ k: '财官联动', v: '身弱财多则为财累身；身强财弱则须借大运补财。' })
  }
  if (pat.includes('印')) {
    features.push({ k: '印星护身', v: '格局有印，贵人运旺、学业早成；但印过旺会克制食伤（才华与表达）。' })
    features.push({ k: '学识与修养', v: '印主学识、修养、母缘。印格者重精神生活胜过物质。' })
  }
  if (pat.includes('伤官') || pat.includes('食神')) {
    features.push({ k: '才华外显', v: '食伤主口才、技艺、创意，适合走技术、艺术、自媒体路线。' })
    features.push({ k: '食神制杀', v: `${pat} 配杀，可成"食神制杀"贵格；配印则"伤官配印"，皆为上格。` })
  }
  // 印枭无力
  if (!features.some(f => f.k.includes('印'))) {
    features.push({ k: '印枭无力', v: `${Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dmWx)}印极弱或正印极弱，贵人助力有限、需靠自身努力。` })
  }
  // 身弱不担财通用
  if (chart.strength && chart.strength.weak && pat.includes('财')) {
    features.push({ k: '身弱不担财', v: '财来则身扛不住，须先印比扶身，再徐图财。' })
  }
  // 身弱不担官通用
  if (chart.strength && chart.strength.weak && (pat.includes('官') || pat.includes('杀'))) {
    features.push({ k: '身弱不担官杀', v: '官杀压身，必须印化或食制方能转化压力为动力。' })
  }
  return features.slice(0, 5)
}

/** 4.2 喜忌总表 */
function xiJiTable(yongshen, chart) {
  const dmWx = chart.dayMasterWx
  const rows = []
  const yongList = (yongshen.sequence || []).map(s => s.wx).filter(Boolean)
  const yongTop = yongList[0] || ''
  // 用神（最喜）
  const yongTenMap = { 木: '甲乙', 火: '丙丁', 土: '戊己', 金: '庚辛', 水: '壬癸' }
  rows.push({ level: '用神', tag: '★★★★★', wx: yongTop, gan: yongTenMap[yongTop] || '—', desc: '命局最喜，逢之必大发；行运、流年、地支见之即吉。' })
  // 喜神（次喜）
  const xiTop = yongList[1] || yongTop
  rows.push({ level: '喜神', tag: '★★★', wx: xiTop, gan: yongTenMap[xiTop] || '—', desc: '次喜，助益命中用神但不如用神直接。' })
  // 中性
  const midWx = ['木', '火', '土', '金', '水'].find(w => w !== yongTop && w !== xiTop && !yongshen.avoid.find(a => a.wx === w))
  rows.push({ level: '中性', tag: '★★', wx: midWx || '—', gan: yongTenMap[midWx] || '—', desc: '帮身但不生根，水来土不克、逢之大运流年可承接。' })
  // 忌神（祸首）
  const jiList = (yongshen.avoid || []).map(a => a.wx).filter(Boolean)
  const jiTop = jiList[0] || ''
  rows.push({ level: '忌神', tag: '★', wx: jiTop, gan: yongTenMap[jiTop] || '—', desc: '身弱则财官伤食为忌，主受克受累，逢之须防。' })
  // 最忌
  const zuiji = jiList[1] || ''
  rows.push({ level: '最忌', tag: '★', wx: zuiji, gan: yongTenMap[zuiji] || '—', desc: '克泄交加，财不生杀、加重身弱；遇之须忍守。' })
  return rows
}

/** 4.3 核心口诀 */
function coreKouJue(chart, yongshen, geJu) {
  const yong = yongshen.sequence[0]?.wx || ''
  const xishen = yongshen.sequence[1]?.wx || ''
  const ji = yongshen.avoid[0]?.wx || ''
  // 五行对应表
  const YONG_TEXT = { 木: '木', 火: '火', 土: '土', 金: '金', 水: '水' }
  const y = YONG_TEXT[yong] || yong || '金'
  const x = YONG_TEXT[xishen] || xishen || (y === '金' ? '水' : '金')
  const j = YONG_TEXT[ji] || ji || '火'
  return [
    `${y}为药，${x}为病，${j}为财。`,
    `${y}来则病入膏肓，${x}来则克到病处。`,
  ].join('\n')
}

/** 5. 十神逐神分析 */
function shiShenDetail(chart, geJu, yongshen) {
  const dayGan = chart.dayMaster
  const dmWx = chart.dayMasterWx
  const pillars = chart.pillars
  // 收集所有十神（天干 + 藏干）
  // 注：日柱只跳过日干（日主本身不论十神），日支藏干必须计入（如"日坐七杀/日坐伤官"等坐支结构）
  const items = {}
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i]
    if (i !== 2) {
      const tg = shiShenOfLocal(p.gan, dayGan)
      if (tg && !items[tg]) items[tg] = { tian: [], di: [] }
      if (tg) items[tg].tian.push({ pos: p.label, char: p.gan })
    }
    // 藏干（含日支）
    const cg = cangGanOf(p.zhi)
    for (let k = 0; k < cg.length; k++) {
      const g = cg[k]
      const ss = shiShenOfLocal(g, dayGan)
      if (!ss) continue
      if (!items[ss]) items[ss] = { tian: [], di: [] }
      items[ss].di.push({ pos: p.label, char: g, level: ['本气', '中气', '余气'][k] })
    }
  }
  // 定义十神详情的模板
  const SHI_SHEN_DESC = {
    '比肩': {
      base: '比肩与我同类阴阳同性，主独立、固执、自尊心强。',
      health: '比肩过旺主脾胃失调、皮肤干燥。'
    },
    '劫财': {
      base: '劫财与我同类阴阳异性，主竞争、合伙、偏财运。',
      health: '劫财多主心脏、血液循环小疾，易激动。'
    },
    '食神': {
      base: '食神为我生之同性，主口福、福气、才艺。',
      health: '食神主脾胃虚弱时需调养，饮食不规律为忌。'
    },
    '伤官': {
      base: '伤官为我生之异性，主才华、创新、叛逆。',
      health: '伤官泄身过度，主肾气不足、腰膝酸软。'
    },
    '偏财': {
      base: '偏财为我克之异性，主偏财运、父亲、异性缘。',
      health: '偏财多主肠胃消化、视力需保养。'
    },
    '正财': {
      base: '正财为我克之同性，主稳定财源、妻子、务实。',
      health: '正财暗耗日主，主肌肉劳损、筋骨疲劳。'
    },
    '七杀': {
      base: '七杀为克我之异性，主压力、权威、决断力。',
      health: '七杀克身过重，主筋骨、心血管隐患。'
    },
    '正官': {
      base: '正官为克我之同性，主权力、名誉、约束。',
      health: '正官过旺主脾胃虚弱、肝胆不适。'
    },
    '偏印': {
      base: '偏印为生我之异性，主谋略、悟性、宗教玄学。',
      health: '偏印夺食，主肺部、呼吸道。'
    },
    '正印': {
      base: '正印为生我之同性，主学识、贵人、母缘。',
      health: '正印护身不及，主脑供血、记忆衰退。'
    },
  }
  const detailList = []
  // 按特定顺序
  const order = ['伤官', '偏财', '正财', '劫财', '比肩', '食神', '七杀', '正官', '偏印', '正印']
  for (const ss of order) {
    if (!items[ss]) continue
    const it = items[ss]
    const tianCount = it.tian.length
    const diCount = it.di.length
    // 状态判断
    let state = ''
    const totalCount = tianCount + diCount
    if (tianCount > 0 && diCount > 0) state = `${(it.tian[0].pos + '干' + it.tian[0].char)}透干，地支${diCount}处藏`
    else if (tianCount > 0) state = `${(it.tian[0].pos + '干' + it.tian[0].char)}透干有力`
    else state = `${it.di[0].pos}地支${it.di[0].char}（${it.di[0].level}）藏支`
    // 数量描述（首字为合计总数，括号内拆解天干/地支，避免"1个（天干1+地支2）"自相矛盾）
    let countText = ''
    if (tianCount > 0 && diCount > 0) countText = `${tianCount + diCount}个（天干${tianCount} + 地支${diCount}）`
    else if (tianCount > 0) countText = `${tianCount}个（透干）`
    else countText = `${diCount}个（藏干${it.di.map(d => d.level).join('、')}）`
    // 解读
    const baseDesc = SHI_SHEN_DESC[ss]?.base || ''
    const healthDesc = SHI_SHEN_DESC[ss]?.health || ''
    // 针对每个十神的个性化解读（基于其在四柱的宫位）
    const customDesc = (() => {
      // 五行派生（基于日主 dmWx，避免写死具体干支）
      const yinWx = WUXING_SHENG[dmWx]        // 印 = 生我者
      const caiWx = WUXING_KE[dmWx]           // 财 = 我克者
      const shaWx = Object.keys(WUXING_KE).find(k => WUXING_KE[k] === dmWx) // 官杀 = 克我者
      if (ss === '伤官') {
        if (tianCount > 0 && diCount === 0) return `聪明、有才华、表达力强，但不服管束。适合技术、创意、咨询、教育等靠"脑力"吃饭的工作。伤官旺而无印（${yinWx}）制，易有恃才傲物、人际关系紧张的倾向。`
        if (tianCount === 0 && diCount > 0) return `才华深藏不露，待大运引出方能显达。命中伤官不外显，宜从事研究类、技术类工作。`
        return `伤官组合丰富，才华横溢。印（${yinWx}）有力可制衡，则入"伤官配印"贵格；若印弱则恃才傲物、易招是非。`
      }
      if (ss === '偏财') {
        if (chart.pillars[1].gan === it.tian[0]?.char && tianCount > 0) return `对财富有敏锐嗅觉，善于发现商机。${caiWx}生${shaWx}七杀（财生杀），求财过程必伴随压力、风险。偏财透干，有横财运，但需大运配合才能守住。`
        return `偏财星入命，求财有道，但多在变动中求财。`
      }
      if (ss === '劫财') {
        if (it.di.some(d => d.level === '本气')) return `劫财生财（同气引动财星${caiWx}），助长伤官之势。时柱劫财，朋友、兄弟、合伙人相助，但也容易被分财。`
        return `劫财入库或藏支，晚年需注意子女开销或合伙破财。`
      }
      if (ss === '七杀') {
        if (tianCount === 0 && diCount >= 2) return `七杀不透，压力是"暗藏的"——别人看不到、自己背负。无强印化杀，早期发展艰辛，需靠大运来转化。`
        return `七杀透干，主权威、有魄力、能担大事。但身弱必须印化，否则扛不住。`
      }
      if (ss === '正官') {
        return `正官主规则、名誉、地位。身弱见官，主压力大；身强见官，可入仕途。`
      }
      if (ss === '正印') {
        return `正印护身，贵人运强；学业、名誉、母亲缘佳。`
      }
      return baseDesc
    })()
    detailList.push({
      ss,
      count: countText,
      state,
      desc: customDesc,
      health: healthDesc || '此神入命无特别健康提示，常规调养即可。'
    })
  }
  return detailList
}

/** 6. 大运逐运分析（6.2 / 6.3） */
function dayunSingleAnalysis(chart, d, yongshen, geJu) {
  const wx = GAN_WUXING[TIAN_GAN.indexOf(d.g)]
  // 综合判断
  const yongList = (yongshen.sequence || []).map(s => s.wx).filter(Boolean)
  const jiList = (yongshen.avoid || []).map(a => a.wx).filter(Boolean)
  const yongFlag = yongList.includes(wx)
  const jiFlag = jiList.includes(wx)
  let summary = ''
  if (yongFlag) summary = `此运是人生${d.level === 'star' ? '黄金期' : '关键期'}。`
  else if (jiFlag) summary = `此运动荡期，宜守不宜进。`
  else summary = '此运平顺期，稳步推进即可。'
  // 关键年份（按图片样式列出 5 个）
  const keyYears = []
  const dayGan = chart.dayMaster
  const dmWx = chart.dayMasterWx
  for (let i = 0; i < 5; i++) {
    const yr = d.start + i * 2
    if (yr > d.end) break
    const gz = ganzhiOfYear(yr)
    const ywx = GAN_WUXING[TIAN_GAN.indexOf(gz.g)]
    // 找年干与日主的关系
    const ygShen = shiShenOfLocal(gz.g, dayGan)
    let flag = ''
    // 检查地支与命局四柱的冲合刑穿
    let matchedEvent = null
    for (let j = 0; j < chart.pillars.length; j++) {
      const p = chart.pillars[j]
      if (ZHI_CHONG[p.zhi] === gz.z) {
        matchedEvent = `${p.label}${p.zhi}${gz.z}冲`
        break
      }
      if (ZHI_XING[p.zhi] && ZHI_XING[p.zhi][gz.z]) {
        matchedEvent = `${p.label}${p.zhi}${gz.z}${ZHI_XING[p.zhi][gz.z]}`
        break
      }
    }
    if (matchedEvent) {
      flag = matchedEvent
    } else if (ygShen === '正官') {
      flag = '官星合身'
    } else if (ygShen === '七杀') {
      flag = '七杀克身'
    } else if (ygShen === '正印' || ygShen === '偏印') {
      flag = '印来助身'
    } else if (ygShen === '伤官' && ywx === '火') {
      flag = '伤官生财'
    } else if (ygShen === '偏财' || ygShen === '正财') {
      flag = '财来'
    } else if (yongList.includes(ywx)) {
      flag = i === 0 ? '开局跃迁' : '用神到位'
    } else if (jiList.includes(ywx)) {
      flag = i === 0 ? '初期动荡' : '须防'
    } else {
      flag = '平稳'
    }
    keyYears.push({ year: yr, gz: `${gz.g}${gz.z}`, flag })
  }
  return { summary, keyYears }
}

/** 7. 流年精析（单年：yearNow） */
function liuNianAnalysis(chart, yongshen, geJu) {
  const y = new Date().getFullYear()
  const gz = ganzhiOfYear(y)
  const yearWx = gz.wx
  const dayGan = chart.dayMaster
  const yearGanShen = shiShenOfLocal(gz.g, dayGan)
  // 与大运的关系
  const daxunList = chart.daYunList || []
  const currentDY = daxunList.find(dy => y >= dy.start && y <= dy.end) || {}
  // 干合检测（甲己、乙庚、丙辛、丁壬、戊癸）
  const HE_PAIRS = [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']]
  const heWithDY = currentDY.g && HE_PAIRS.some(p => (p[0] === gz.g && p[1] === currentDY.g) || (p[1] === gz.g && p[0] === currentDY.g))
  let dyRel = ''
  if (currentDY.z) {
    if (ZHI_CHONG[currentDY.z] === gz.z) dyRel = '大运地支与流年冲'
    else if (ZHI_LIUHE[currentDY.z] === gz.z) dyRel = '大运地支与流年合'
  }
  if (heWithDY) dyRel = (dyRel ? dyRel + '、' : '') + '流年与大运干合'
  // 综合断语
  const yongList = (yongshen.sequence || []).map(s => s.wx).filter(Boolean)
  const jiList = (yongshen.avoid || []).map(a => a.wx).filter(Boolean)
  const isAdv = yongList.includes(yearWx)
  const isJi = jiList.includes(yearWx)
  let verdict = ''
  const yearLabel = `${y}年（${gz.g}${gz.z}）`
  if (isAdv) verdict = `${yearLabel}与用神同气（${yearWx}气流年），${chart.strength.weak ? '身弱得扶，大有可为' : '顺势大进'}。`
  else if (isJi) verdict = `${yearLabel}与忌神同气（${yearWx}气流年），须${chart.strength.weak ? '静守、减少大动作' : '防破耗、谨防官非'}。`
  else verdict = `${yearLabel}平和，${chart.strength.weak ? '以稳为主、徐图进展' : '顺势推进'}。`
  return {
    year: y, gz: `${gz.g}${gz.z}`, wx: yearWx,
    ganShen: yearGanShen, dyRel,
    verdict,
    dayMaster: dayGan,
  }
}

/** 11.1 父母长辈分析（基于年柱、月柱与十神） */
function parentsAnalysis(chart, dayGan, geJu, yongshen) {
  const yearGan = chart.pillars[0].gan
  const yearZhi = chart.pillars[0].zhi
  const monthGan = chart.pillars[1].gan
  const monthZhi = chart.pillars[1].zhi
  // 父母十神判断
  const fatherShen = shiShenOfLocal(yearGan, dayGan)
  const motherShen = shiShenOfLocal(monthGan, dayGan)
  // 父亲倾向：年干代表父亲
  const fatherGanWx = GAN_WUXING[TIAN_GAN.indexOf(yearGan)]
  const fatherDesc = {
    '木': '父亲聪明有才华，仁慈温和；技术型、手工业、教育、文字工作方向倾向明显',
    '火': '父亲热情有魄力，社会影响力强；适合商业、传媒、领导岗位',
    '土': '父亲稳重守信，厚重可靠；适合管理、金融、土地、房产',
    '金': '父亲刚毅果断，重原则义气；适合军警、金融、机械',
    '水': '父亲聪明灵活，擅变通；适合商贸、流通、文艺'
  }[fatherGanWx] || ''
  // 母亲倾向：月干代表母亲
  const motherGanWx = GAN_WUXING[TIAN_GAN.indexOf(monthGan)]
  const motherDesc = {
    '木': '母亲聪慧仁慈，勤劳；适合教育、文化、医护',
    '火': '母亲热情有活力，善于交际；适合商业、传媒',
    '土': '母亲厚重温和，持家能力强；适合财务、餐饮、农业',
    '金': '母亲刚毅果断，做事讲原则；适合金融、法律',
    '水': '母亲聪敏灵活，善协调；适合流通、人际、文艺'
  }[motherGanWx] || ''
  // 父母健康
  const fatherZhiWx = ZHI_WUXING[DI_ZHI.indexOf(yearZhi)]
  const fatherHealth = {
    '木': '父亲注意肝胆、筋骨',
    '火': '父亲注意心脏、眼睛',
    '土': '父亲注意脾胃、消化',
    '金': '父亲注意肺部、呼吸道',
    '水': '父亲注意肾脏、泌尿'
  }[fatherZhiWx] || ''
  const motherHealth = {
    '木': '母亲注意肝胆、情绪',
    '火': '母亲注意心脏、血压',
    '土': '母亲注意脾胃、血糖',
    '金': '母亲注意肺部、皮肤',
    '水': '母亲注意肾脏、内分泌'
  }[motherGanWx] || ''
  // 父母关系（卯戌合/六合）
  const heFlag = (yearZhi === '卯' && monthZhi === '戌') || (yearZhi === '戌' && monthZhi === '卯')
    || (yearZhi === '寅' && monthZhi === '午') || (yearZhi === '午' && monthZhi === '寅')
    || (yearZhi === '巳' && monthZhi === '酉') || (yearZhi === '酉' && monthZhi === '巳')
  // 父亲为根：年柱为根在月支与否
  const isFatherRoot = yearZhi === monthZhi || ZHI_LIUHE_WX?.[yearZhi] === ZHI_WUXING[DI_ZHI.indexOf(monthZhi)]

  return {
    father: {
      shen: fatherShen,
      bodyDesc: fatherDesc,
      health: fatherHealth,
      ganZhi: `${yearGan}${yearZhi}`,
      isRoot: isFatherRoot
    },
    mother: {
      shen: motherShen,
      bodyDesc: motherDesc,
      health: motherHealth,
      ganZhi: `${monthGan}${monthZhi}`
    },
    couple: {
      harmony: heFlag,
      note: heFlag ? `${yearZhi}${monthZhi}相合，父母关系和睦，互相扶持` : '父母关系中规中矩，偶有摩擦'
    }
  }
}

/** 13.1 人际关系分析（基于十神组合） */
function relationAnalysis(chart, dayGan, geJu, yongshen) {
  const dmWx = chart.dayMasterWx
  // 五行对应人群
  const SHEN_TRAITS = {
    '比肩': '朋友中性独立，多为同辈兄弟型',
    '劫财': '人际交往中常有竞争者或分利者，合伙需谨慎',
    '食神': '人缘好，靠才艺、表达吸引人',
    '伤官': '个性张扬不服输，易得罪人，也易得贵人',
    '偏财': '人脉广，善交际，朋友多但流动性强',
    '正财': '朋友圈稳重，多务实型朋友',
    '七杀': '人际中有强力支持者（贵人），也易遇强势之人',
    '正官': '朋友圈多有公职、上司、长辈型人士',
    '偏印': '思维独特，与常人思路不同，朋友偏小众',
    '正印': '贵人运好，长辈、上司、学长常扶持'
  }
  // 命局中十神组合（日干=日主不论十神；藏干含日支——日坐十神决定与伴侣/同事的相处底色）
  const allShen = []
  chart.pillars.forEach((p, i) => {
    if (i !== 2) allShen.push(shiShenOfLocal(p.gan, dayGan))
    cangGanOf(p.zhi).forEach(g => allShen.push(shiShenOfLocal(g, dayGan)))
  })
  const uniq = [...new Set(allShen)].filter(Boolean)
  // 宜交 / 忌交（按用神喜忌推）
  const yongTop = yongshen.sequence[0]?.wx || '金'
  const jiTop = yongshen.avoid[0]?.wx || '火'
  const YONG_PEOPLE = {
    '木': '印比之友（温和、稳重、支持你的人）',
    '火': '食伤之友（表达能力强、为你扬名的人）',
    '土': '财星之友（务实、握资源、带你挣钱的人）',
    '金': '官杀之友（强势、给你压力也是机会的人）',
    '水': '金水之友（灵活、善变通、信息面广的人）'
  }
  const JI_PEOPLE = {
    '木': '比劫（合伙分利型）',
    '火': '财星（来散你财的人）',
    '土': '官杀（来夺你财的人）',
    '金': '伤官（张扬个性冲突型）',
    '水': '印星（依赖你而非助你的人）'
  }
  return {
    traits: uniq.slice(0, 4).map(s => SHEN_TRAITS[s]).filter(Boolean),
    uniq,
    yongFriend: YONG_PEOPLE[yongTop] || YONG_PEOPLE.金,
    jiFriend: JI_PEOPLE[jiTop] || JI_PEOPLE.火
  }
}

/** 15.1 风水调整建议（按五行喜忌推方位/颜色/数字/行业） */
function fengShuiAdvice(chart, geJu, yongshen) {
  const yongTop = yongshen.sequence[0]?.wx || '金'
  const xishen = yongshen.sequence[1]?.wx || yongTop
  const jiTop = yongshen.avoid[0]?.wx || '火'
  // 方位
  const DIRECTION = {
    '木': '东方',
    '火': '南方',
    '土': '中央',
    '金': '西方',
    '水': '北方'
  }
  // 颜色
  const COLOR = {
    '木': '黑、蓝、绿',
    '火': '红、紫、亮色',
    '土': '黄、棕、米色',
    '金': '白、银、金色',
    '水': '黑、深蓝、灰'
  }
  const JI_COLOR = {
    '木': '金（白、银）',
    '火': '黑、深蓝',
    '土': '木（绿）',
    '金': '红、紫',
    '水': '黄、棕'
  }
  // 数字
  const NUM_YONG = {
    '木': '3、8',
    '火': '2、7',
    '土': '5、10',
    '金': '4、9',
    '水': '1、6'
  }
  const NUM_JI = {
    '木': '4、9',
    '火': '1、6',
    '土': '2、7',
    '金': '3、8',
    '水': '5、10'
  }
  return {
    direction: DIRECTION[yongTop],
    xishenDir: DIRECTION[xishen],
    color: COLOR[yongTop],
    jiColor: JI_COLOR[jiTop],
    numYong: NUM_YONG[yongTop],
    numJi: NUM_JI[jiTop]
  }
}

/** 8.2 子女分析 */
function childAnalysis(chart) {
  const dayGan = chart.dayMaster
  const gender = chart.gender
  const timeGan = chart.pillars[3].gan
  const timeZhi = chart.pillars[3].zhi
  // 男命：官杀为子女；女命：食伤为子女
  const childStar = gender === '男' ? ['正官', '七杀'] : ['食神', '伤官']
  const starDesc = {
    '正官': '正官（男命以官杀为子女星）', '七杀': '七杀（男命以官杀为子女星）',
    '食神': '食神（女命以食伤为子女星）', '伤官': '伤官（女命以食伤为子女星）'
  }
  // 找子女星在四柱（日干=日主天然非子女星；日支藏干也要论——日支坐子女星同样有缘分）
  const found = []
  for (let i = 0; i < chart.pillars.length; i++) {
    const p = chart.pillars[i]
    if (i !== 2) {
      const tg = shiShenOfLocal(p.gan, dayGan)
      if (childStar.includes(tg)) found.push(`${p.label}·${p.gan}（${starDesc[tg]}）`)
    }
    const cg = cangGanOf(p.zhi)
    for (const g of cg) {
      const ss = shiShenOfLocal(g, dayGan)
      if (childStar.includes(ss)) found.push(`${p.label}·${p.zhi}藏${g}（${starDesc[ss]}）`)
    }
  }
  // 时柱主子女宫
  const timeShen = shiShenOfLocal(timeGan, dayGan)
  const timeDesc = `时柱${timeGan}${timeZhi}（${gender === '男' ? (timeShen.includes('官') || timeShen.includes('杀') ? '子女星入时柱' : '子女星未入时柱') : (timeShen.includes('食') || timeShen.includes('伤') ? '子女星入时柱' : '子女星未入时柱')}）。`
  return {
    star: childStar.map(s => starDesc[s]).join('、'),
    found: found.length ? found.join('、') : '无子女星透干或藏支',
    timeDesc,
    summary: found.length ?
      `子女星${gender === '男' ? '官杀' : '食伤'}透干或藏支，${gender === '男' ? '儿子、女儿皆有' : '女儿、儿子皆有'}缘分。` :
      `子女星深藏不露，怀孕、生产须待大运流年引动。`,
    count: found.length
  }
}

/** 9.1 先天隐患表（按五行脏腑） */
function xianTianHuanYin(chart) {
  const dmWx = chart.dayMasterWx
  const count = chart.wuxing || {}
  const ORGANS = {
    '木': '肝胆', '火': '心脏、眼睛', '土': '脾胃、肌肉',
    '金': '肺、大肠、鼻', '水': '肾、膀胱、泌尿'
  }
  const rows = []
  for (const wx of ['木', '火', '土', '金', '水']) {
    const v = count[wx] || 0
    const total = Object.values(count).reduce((a, b) => a + b, 0) || 1
    const avg = total / 5
    // 严格阈值的强弱判定（与图片参考接近）
    let level = '中和'
    let stars = 0
    const ratio = v / avg
    if (ratio < 0.5) { level = '极弱'; stars = 3 }
    else if (ratio < 0.85) { level = '偏弱'; stars = 2 }
    else if (ratio < 1.15) { level = '中和'; stars = 0 }
    else if (ratio < 1.5) { level = '偏旺'; stars = 2 }
    else { level = '旺'; stars = 3 }
    const organ = ORGANS[wx]
    // 五行分值是累加出来的浮点数，直接内插会出现「火极旺（7.199999999999999分）」这种输出
    const score = Math.round(v * 10) / 10
    let desc = ''
    if (level === '极弱') desc = `${wx}弱（${score}分）易虚：${organ}功能偏弱${wx === dmWx ? '。偏弱但不至于病，年少保养即可' : '。'}${wx === dmWx ? '（日主偏弱、年少体弱、中年后靠保养）' : ''}`
    else if (level === '偏弱') desc = `${wx}稍弱（${score}分）：${organ}需保养。`
    else if (level === '中和') desc = `${wx}中和（${score}分）：${organ}运行正常。`
    else if (level === '偏旺') desc = `${wx}稍旺（${score}分）：${organ}易亢进、上火。`
    else desc = `${wx}极旺（${score}分）：${organ}燥热、炎症倾向。`
    rows.push({ wx, organ, risk: level, stars, desc })
  }
  return rows
}

/** 9.2 大运预警 */
function dayunHealthWarn(chart, daxunList) {
  const items = []
  const dmWx = chart.dayMasterWx
  const dayGan = chart.dayMaster
  const KILL_WX = WUXING_KE[dmWx]
  for (const d of daxunList) {
    const wx = GAN_WUXING[TIAN_GAN.indexOf(d.g)]
    const zwx = ZHI_WUXING[DI_ZHI.indexOf(d.z)]
    // 辰戌冲主脾胃/心血管
    if ((d.z === '辰' || d.z === '戌') && chart.pillars.some(p => (d.z === '辰' && p.z === '戌') || (d.z === '戌' && p.z === '辰'))) {
      const keyYear = d.start + 3
      items.push({ dy: `${d.g}${d.z}运（${d.start}-${d.end}）`, issue: `${d.z === '辰' ? '辰戌' : '戌辰'}冲加剧，土旺克水，须特别注意脾胃、心血管。${keyYear}年（${keyYear}）是健康关键年。`, level: 'high' })
    }
    // 七杀克身大运主筋骨/心血管
    else if (wx === KILL_WX || zwx === KILL_WX) {
      const killEle = wx === KILL_WX ? wx : zwx
      const orgMap = { 火: '心血管', 土: '脾胃', 金: '筋骨、呼吸', 水: '泌尿', 木: '肝胆' }
      items.push({ dy: `${d.g}${d.z}运（${d.start}-${d.end}）`, issue: `${killEle}旺克身，${orgMap[killEle] || '心血管'}隐患，劳逸适度二线修养。`, level: 'high' })
    }
    // 比劫旺运主脾胃/湿热
    else if (wx === dmWx && chart.strength.strong) {
      items.push({ dy: `${d.g}${d.z}运（${d.start}-${d.end}）`, issue: '身旺逢比劫帮身，须防脾胃、湿热、情绪抑郁。', level: 'mid' })
    }
    // 食伤旺运主肝肾
    else if (wx === WUXING_SHENG[dmWx] && chart.strength.strong) {
      items.push({ dy: `${d.g}${d.z}运（${d.start}-${d.end}）`, issue: '食伤旺运，主肝气郁结、肾气消耗。', level: 'mid' })
    }
  }
  return items.slice(0, 4)
}

/** 10.1 适合行业表（按适配星级） */
function industryTable(chart, geJu, yongshen) {
  const yongList = (yongshen.sequence || []).map(s => s.wx).filter(Boolean)
  const yongTop = yongList[0] || chart.dayMasterWx
  const jiList = (yongshen.avoid || []).map(a => a.wx).filter(Boolean)
  const jiTop = jiList[0] || ''
  // 用神对应的代表行业
  const YONG_INDUSTRY = {
    '木': '教育培训/咨询',
    '火': '互联网/IT',
    '土': '房地产/建筑',
    '金': 'AI/算法/数据分析',
    '水': '贸易/物流',
  }
  // 次喜
  const XISHEN_INDUSTRY = {
    '木': '文化创意/出版',
    '火': '文化传媒',
    '土': '农业/畜牧',
    '金': '金融/投资/法律',
    '水': '酒店/旅游',
  }
  // 中性
  const MID_INDUSTRY = {
    '木': '中医/养生/花艺',
    '火': '电力能源/光电',
    '土': '陶瓷/矿业',
    '金': '机械/制造',
    '水': '医疗/外科',
  }
  // 忌神
  const JI_INDUSTRY = {
    '木': '纯销售/餐饮',
    '火': '纯创意/餐饮',
    '土': '纯体力劳动',
    '金': '锐利行业',
    '水': '水上高风险',
  }
  const rows = []
  rows.push({ star: 5, industry: YONG_INDUSTRY[yongTop] || '通用行业', wx: yongTop, why: '用神到位、最佳方向' })
  rows.push({ star: 4, industry: XISHEN_INDUSTRY[yongTop] || '通用行业', wx: yongTop, why: '金水相生、逻辑工作' })
  // 找中性的 wx
  const midWx = ['木', '火', '土', '金', '水'].find(w => w !== yongTop && w !== jiTop) || yongTop
  rows.push({ star: 3, industry: MID_INDUSTRY[midWx] || '通用行业', wx: midWx, why: '中性行业，可作辅业' })
  rows.push({ star: 2, industry: JI_INDUSTRY[midWx] || '通用行业', wx: midWx, why: '中性，但非最佳' })
  rows.push({ star: 1, industry: JI_INDUSTRY[jiTop] || JI_INDUSTRY['木'] || '纯创意/纯销售/餐饮', wx: jiTop || '木火', why: `忌神，${chart.strength?.weak ? '身弱难担' : '非本命用神，宜少涉'}${jiTop ? `（${jiTop}）` : ''}` })
  return rows
}

/** 10.2 财富策略 */
function caiFuCeLue(chart, geJu, yongshen) {
  const nowY = new Date().getFullYear()
  const yongTop = yongshen.sequence[0]?.wx || ''
  const jiTop = yongshen.avoid[0]?.wx || ''
  const curDY = (chart.daYunList || []).find(d => d.isNow) || chart.daYunList?.[0] || {}
  const nextDY = (chart.daYunList || []).slice(1).find(d => d.isNow === false && parseInt(d.start) > nowY) || {}
  // 财富跃升大运：用神相同的大运
  const wealthDY = (chart.daYunList || []).find(d => GAN_WUXING[TIAN_GAN.indexOf(d.g)] === yongTop) || {}
  // 忌神五行对应的典型地支（动态推导，不写死）
  const jiZhi = DI_ZHI.filter(z => ZHI_WUXING[z] === jiTop)
  const jiZhiTxt = jiZhi.length ? jiZhi.join('、') : jiTop
  // 求财模式动态化：身弱宜借势平台（用神印比），身强宜独立执掌（用神财官食伤）
  const isWeak = !!yongshen.isWeak || !!(chart.strength && chart.strength.weak)
  const isStrong = !!yongshen.isStrong || !!(chart.strength && chart.strength.strong)
  const mode = isWeak
    ? '你更适合借平台、靠团队与贵人"借势生财"，赚的是系统与协作的溢价，不宜单打独斗——宁为凤尾，不为鸡头。'
    : isStrong
      ? '你身强任事，适合"执掌生财"：独立操盘、主导项目，赚的是掌权与配置资源的差价，忌守株待兔。'
      : '你身居中平，宜"稳中求变"：主业立身、副业开花，借势与执掌兼备，择机而动。'
  return {
    mode,
    timing: `逢${yongTop}运（${wealthDY.key || ''} ${wealthDY.start || ''}-${wealthDY.end || ''} 年）是财富跃升期；逢用神流年是财富兑现期。`,
    warn: `逢${jiTop}旺流年（${jiZhiTxt}）需守，逢与${jiTop}相冲合之地支流年需防。`
  }
}

/** 11.2 人生曲线（按青年/中年/壮年/晚年） */
function lifeQuXian(daxunList) {
  if (!daxunList.length) return []
  const stages = []
  const now = new Date().getFullYear()
  // 青年
  const young = daxunList.filter(d => d.endAge < 30).map(d => d.key)
  const mid = daxunList.filter(d => d.startAge >= 23 && d.startAge < 43).map(d => d.key)
  const prime = daxunList.filter(d => d.startAge >= 43 && d.startAge < 63).map(d => d.key)
  const late = daxunList.filter(d => d.startAge >= 63).map(d => d.key)
  if (young.length) stages.push({ stage: '青年', dy: young.join('、'), age: '20岁前', tone: '学艺期，靠技术吃饭', toneColor: 'plain' })
  if (mid.length) stages.push({ stage: '中年', dy: mid.join('、'), age: '23-42岁', tone: '打拼期，辛苦求财', toneColor: 'plain' })
  if (prime.length) stages.push({ stage: '壮年', dy: prime.join('、'), age: '43-62岁', tone: '黄金期，平台崛起', toneColor: 'good' })
  if (late.length) stages.push({ stage: '晚年', dy: late.join('、'), age: '63岁后', tone: '守成期，名大于利', toneColor: 'good' })
  return stages
}

/** 11.3 总结核心口诀 */
function zongjieKouJue(chart, yongshen, geJu, curDy, nextDy) {
  const dayGan = chart.dayMaster
  const dmWx = chart.dayMasterWx
  const yong = yongshen.sequence[0]?.wx || ''
  const xishen = yongshen.sequence[1]?.wx || yong
  const ji = yongshen.avoid[0]?.wx || ''
  const currentDY = curDy || {}
  const nextDY = nextDy || {}
  const monthZhi = chart.pillars[1].zhi
  const yearZhi = chart.pillars[0].zhi
  // 合化检测
  const HE_PAIRS = [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']]
  const yearGan = chart.pillars[0].gan
  const monthGan = chart.pillars[1].gan
  let curHeText = ''
  if (currentDY.g) {
    const heYear = HE_PAIRS.some(p => (p[0] === currentDY.g && p[1] === yearGan) || (p[1] === currentDY.g && p[0] === yearGan))
    const heMonth = HE_PAIRS.some(p => (p[0] === currentDY.g && p[1] === monthGan) || (p[1] === currentDY.g && p[0] === monthGan))
    const hePartner = heYear ? yearGan : (heMonth ? monthGan : '')
    const heKind = hePartner ? (GAN_WUXING[TIAN_GAN.indexOf(hePartner)] === '木' ? '伤' : GAN_WUXING[TIAN_GAN.indexOf(hePartner)] === '火' ? '财' : GAN_WUXING[TIAN_GAN.indexOf(hePartner)] === '土' ? '官' : GAN_WUXING[TIAN_GAN.indexOf(hePartner)] === '金' ? '印' : '劫') : ''
    if (hePartner) curHeText = `${currentDY.g}${hePartner}合${heKind}化`
  }
  let nextHeText = ''
  if (nextDY.g) {
    const heYear = HE_PAIRS.some(p => (p[0] === nextDY.g && p[1] === yearGan) || (p[1] === nextDY.g && p[0] === yearGan))
    const heMonth = HE_PAIRS.some(p => (p[0] === nextDY.g && p[1] === monthGan) || (p[1] === nextDY.g && p[0] === monthGan))
    if (heYear) nextHeText = `${nextDY.g}${yearGan}合金，才化为权`
    else if (heMonth) nextHeText = `${nextDY.g}${monthGan}合化为印`
  }
  // 辰戌冲
  let line3 = ''
  if (ZHI_CHONG[monthZhi] === yearZhi) {
    line3 = `${monthZhi}${yearZhi}一冲，不冲不发；金运一到，富贵开花。`
  } else if (ZHI_CHONG[monthZhi]) {
    line3 = `${monthZhi}${ZHI_CHONG[monthZhi]}一冲，${chart.strength.weak ? '冲中求变' : '冲则发'}；金运一到，富贵开花。`
  } else {
    line3 = '格局清纯、不冲不发；金运一到，富贵开花。'
  }
  return [
    `${dayGan}${dmWx}生${monthZhi}，${yongshen.isWeak ? '身弱担财' : '身强担官'}；${xishen || yong}星为药，${ji}星为病。`,
    curHeText ? `${currentDY.key || (currentDY.g + currentDY.z)}运，${curHeText}，${yongshen.isWeak ? '财不生杀身' : '印护身强'}` : '',
    nextHeText,
    line3,
  ].filter(Boolean).join('\n')
}
function yongListContains(yongshen, wx) {
  return (yongshen.sequence || []).some(s => s.wx === wx)
}
function yongTop(yongshen) {
  return yongshen.sequence[0]?.wx || yongshen.tiaohouWxs[0] || '水'
}
