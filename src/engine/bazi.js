// 八字排盘引擎：根据公历生日推算四柱、五行、生肖、十神等
// 四柱采用「参天历法」精确节气（立春/交节时刻）排定，起运与大运同步精确计算

import {
  TIAN_GAN, DI_ZHI, GAN_WUXING, GAN_YINYANG, ZHI_WUXING,
  ZHI_CANGGAN, SHENGXIAO, WUXING_SHENG, WUXING_KE,
  ZHI_CHONG, ZHI_XING, ZHI_HAI, ZHI_CHUAN, ZHI_SANHUI, ZHI_BANHE,
  ZHI_SANHE, ZHI_LIUHE, ZHI_SANHE_WX, ZHI_SANHUI_WX, ZHI_LIUHE_WX
} from '../data/ganzhi.js'
import { buildBaziFromSolar } from 'cantian-tymext'
import { normalizeGender } from './gender.js'
// 转出：命盘相关模块历史上都从 bazi.js 取工具函数，保持这个入口可用。
export { normalizeGender }

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
// 注意：五虎遁的月干须按「60 甲子序号」整体对齐（寅月序号 = 12*(年干%5)+2），
// 不可用 (年干%5)*2+月支 直接推导——否则子月/丑月（月支序号 0/1，属跨年循环）天干会错。
export function monthPillar(date, yearGanIndex) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  let zhi = 0 // 小寒(1/6)前默认子月（上一节气大雪至小寒之间）
  for (const jq of JIEQI) {
    if (m > jq.month || (m === jq.month && d >= jq.day)) zhi = jq.zhi
  }
  // 月柱 60 甲子序号 = 12*(年干%5) + 2 + ((月支-2+12)%12)
  const sex = 12 * (yearGanIndex % 5) + 2 + ((zhi - 2 + 12) % 12)
  return { gan: TIAN_GAN[sex % 10], zhi: DI_ZHI[sex % 12] }
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

// 地支藏干十神：以日干为「我」，依次求地支每个藏干的十神
export function zhiShiShen(dayGan, zhi) {
  const cg = ZHI_CANGGAN[DI_ZHI.indexOf(zhi)] || []
  return cg.map(g => shiShen(dayGan, g))
}

// 地支冲（六冲）：返回与某地支相冲的地支，无则 null
export function zhiChong(zhi) { return ZHI_CHONG[zhi] || null }

// 地支合：返回该地支参与的全部合局信息（三会/三合/六合，按力量从强到弱），无则 []
export function zhiHe(zhi) {
  const idx = DI_ZHI.indexOf(zhi)
  if (idx < 0) return []
  const out = []
  // 三会（力量最强）
  for (const set of ZHI_SANHUI) {
    if (set.includes(zhi)) out.push({ type: '三会', name: set.join(''), wx: ZHI_SANHUI_WX[zhi] })
  }
  // 三合
  for (const set of ZHI_SANHE) {
    if (set.includes(zhi)) out.push({ type: '三合', name: set.join(''), wx: ZHI_SANHE_WX[zhi] })
  }
  // 六合
  const liu = ZHI_LIUHE[zhi]
  if (liu) out.push({ type: '六合', name: `${zhi}${liu}`, wx: ZHI_LIUHE_WX[zhi] })
  return out
}

// 地支刑：返回相刑信息（含三刑/无礼刑/自刑），无则 null
export function zhiXing(zhi) {
  const map = {
    寅: '巳申', 巳: '寅申', 申: '寅巳', // 寅巳申三刑（恃势之刑）
    丑: '戌未', 戌: '丑未', 未: '丑戌', // 丑戌未三刑（无恩之刑）
    子: '卯', 卯: '子',               // 子卯无礼之刑
    辰: '辰', 午: '午', 酉: '酉', 亥: '亥' // 自刑
  }
  return map[zhi] || null
}

// 地支害（六害）：返回与某地支相害的地支，无则 null
export function zhiHai(zhi) { return ZHI_HAI[zhi] || null }

// 地支穿（六穿）：盲派称"穿"，与六害同组关系，侧重暗中伤害
export function zhiChuan(zhi) { return ZHI_CHUAN[zhi] || null }

// 半合：判断两个地支是否构成三合半合，返回所化五行，否则 null
export function zhiBanHe(a, b) {
  const key = `${a}${b}`
  return ZHI_BANHE[key] || null
}

// 统一地支关系判定：判断 a、b 两支之间是冲/合/刑/害/穿中的哪一种
// 返回 { type, name, wx, desc } 或 null（无关系）
export function zhiRelation(a, b) {
  if (!a || !b) return null
  if (ZHI_CHONG[a] === b) return { type: '冲', name: `${a}${b}六冲`, wx: null, desc: `${a}${b}六冲` }
  if (ZHI_LIUHE[a] === b) return { type: '合', name: `${a}${b}六合`, wx: ZHI_LIUHE_WX[a], desc: `${a}${b}六合化${ZHI_LIUHE_WX[a]}` }
  if (ZHI_XING[a] === b) {
    // 自刑
    if (a === b) return { type: '刑', name: `${a}自刑`, wx: null, desc: `${a}自刑` }
    // 无礼刑（子卯）
    if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) return { type: '刑', name: '子卯无礼之刑', wx: null, desc: '子卯无礼之刑' }
    // 三刑
    const sXing = { 寅: '寅巳申', 巳: '寅巳申', 申: '寅巳申', 丑: '丑戌未', 戌: '丑戌未', 未: '丑戌未' }
    if (sXing[a]) return { type: '刑', name: `${sXing[a]}三刑`, wx: null, desc: `${sXing[a]}三刑` }
    return { type: '刑', name: `${a}${b}相刑`, wx: null, desc: `${a}${b}相刑` }
  }
  if (ZHI_HAI[a] === b) return { type: '害', name: `${a}${b}六害`, wx: null, desc: `${a}${b}六害（亦称六穿）` }
  return null
}

// 神煞计算（对齐 cantian-bazi skill 的权威查表：贵人/驿马/将星等按年干+日干双查）
// 返回命中的神煞列表，每条含名称与解读
export function calculateShensha({ yearGan, yearZhi, monthGan, monthZhi, dayGan, dayZhi, timeGan, timeZhi, gender = '男' }) {
  const allZhi = [yearZhi, monthZhi, dayZhi, timeZhi]
  const zhiSet = new Set(allZhi)
  const zhiHas = (z) => zhiSet.has(z)
  const result = []

  // ---------- 贵人（年干 + 日干 双查四柱支） ----------
  const tianyiguiren = { 甲: '丑未', 乙: '子申', 丙: '亥酉', 丁: '亥酉', 戊: '丑未', 己: '子申', 庚: '丑未', 辛: '午寅', 壬: '卯巳', 癸: '卯巳' }
  const taiji = { 甲: '子午', 乙: '子午', 丙: '酉卯', 丁: '酉卯', 戊: '辰戌丑未', 己: '辰戌丑未', 庚: '寅亥', 辛: '寅亥', 壬: '巳申', 癸: '巳申' }
  const wenchang = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' }
  const guoyin = { 甲: '戌', 乙: '亥', 丙: '丑', 丁: '寅', 戊: '丑', 己: '寅', 庚: '辰', 辛: '巳', 壬: '未', 癸: '申' }
  const jinyu = { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' }
  const tianchu = { 甲: '巳', 乙: '午', 丙: '巳', 丁: '午', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' }
  const fuxing = { 甲: '寅子', 乙: '卯丑', 丙: '寅子', 丁: '亥', 戊: '申', 己: '未', 庚: '午', 辛: '巳', 壬: '辰', 癸: '卯丑' }
  const tianguan = { 甲: '未', 乙: '辰', 丙: '巳', 丁: '酉', 戊: '戌', 己: '卯', 庚: '丑', 辛: '申', 壬: '寅', 癸: '午' }
  const grabDual = (map, zhi, name, desc) => {
    const targets = (map[dayGan] || '') + (map[yearGan] || '')
    for (const z of allZhi) if (targets.includes(z)) { result.push(`${name}入命【${z}】：${desc}`); return }
  }
  grabDual(tianyiguiren, null, '天乙贵人', '一生逢凶化吉，贵人提携，最得力')
  grabDual(taiji, null, '太极贵人', '逢凶化吉，福禄兼得，晚年安逸')
  grabDual(wenchang, null, '文昌贵人', '聪明过人，利学业文途，考运佳')
  grabDual(guoyin, null, '国印贵人', '掌印掌权，宜公职管理，权威受人敬')
  grabDual(jinyu, null, '金舆贵人', '得异性/祖荫相助，财源丰')
  grabDual(tianchu, null, '天厨贵人', '享天赐之禄，福禄双全，平安吉顺')
  grabDual(fuxing, null, '福星贵人', '逢凶化吉，一生福禄优游，平安快乐')
  grabDual(tianguan, null, '天官贵人', '得贵气官禄，宜仕途公门')

  // ---------- 天德/月德/天德合/月德合（月支定目标，查四柱干支） ----------
  const tiande = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' }
  const yuede = { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' }
  const tiandehe = { 寅: '壬', 卯: '巳', 辰: '丁', 巳: '丙', 午: '寅', 未: '己', 申: '戊', 酉: '亥', 戌: '辛', 亥: '庚', 子: '申', 丑: '乙' }
  const yuedehe = { 寅: '辛', 午: '辛', 戌: '辛', 申: '丁', 子: '丁', 辰: '丁', 巳: '乙', 酉: '乙', 丑: '乙', 亥: '己', 卯: '己', 未: '己' }
  const allGan = [yearGan, monthGan, dayGan, timeGan]
  const allGzArr = [`${yearGan}${yearZhi}`, `${monthGan}${monthZhi}`, `${dayGan}${dayZhi}`, `${timeGan}${timeZhi}`]
  if (allGzArr.some(gz => gz.includes(tiande[monthZhi]))) result.push(`天德贵人入命【月支${monthZhi}】：心地仁慈，逢凶化吉，贵人相助`)
  if (allGzArr.some(gz => gz.includes(yuede[monthZhi]))) result.push(`月德贵人入命【月支${monthZhi}】：福荫深厚，灾祸不侵，多行善积德`)
  if (allGzArr.some(gz => gz.includes(tiandehe[monthZhi]))) result.push(`天德合入命【月支${monthZhi}】：贵气加身，化灾解厄`)
  if (allGzArr.some(gz => gz.includes(yuedehe[monthZhi]))) result.push(`月德合入命【月支${monthZhi}】：温厚有福，人缘佳`)

  // 德秀贵人（月支定三合局，查四柱天干）
  const dexiu = { 寅午戌: '丙丁戊癸', 申子辰: '壬癸戊丙辛甲己', 巳酉丑: '庚辛乙', 亥卯未: '甲乙丁壬' }
  for (const [group, gans] of Object.entries(dexiu)) {
    if (group.includes(monthZhi) && allGan.some(g => gans.includes(g))) {
      result.push(`德秀贵人入命：聪慧秀气，品性端正，利文采`)
      break
    }
  }

  // ---------- 禄神 / 羊刃 / 飞刃 / 流霞 / 红艳（日干查四柱支） ----------
  const lushen = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' }
  const yangren = { 甲: '卯', 乙: '寅', 丙: '午', 丁: '巳', 戊: '午', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥' }
  const feiren = { 甲: '酉', 乙: '申', 丙: '子', 丁: '亥', 戊: '子', 己: '亥', 庚: '卯', 辛: '寅', 壬: '午', 癸: '巳' }
  const liuxia = { 甲: '酉', 乙: '戌', 丙: '未', 丁: '申', 戊: '巳', 己: '午', 庚: '辰', 辛: '卯', 壬: '亥', 癸: '寅' }
  const hongyan = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' }
  const grabGanZhi = (map, name, desc) => {
    const t = map[dayGan]
    if (t && zhiHas(t)) result.push(`${name}入命【${t}】：${desc}`)
  }
  grabGanZhi(lushen, '禄神', '衣食无忧，得禄得福，财运安稳')
  grabGanZhi(yangren, '羊刃', '性刚果决，胆大敢闯，身旺见刃宜武职')
  grabGanZhi(feiren, '飞刃', '刚烈好胜，防意外破财')
  grabGanZhi(liuxia, '流霞', '男命酒色，女命产厄，防血光')
  grabGanZhi(hongyan, '红艳煞', '异性缘佳，风流多情，感情宜专')

  // ---------- 年支/日支锚：驿马、将星、华盖、桃花、亡神、劫煞、灾煞、天罗地网（其余柱查） ----------
  const jiangxingMap = { 子: '子', 丑: '酉', 寅: '午', 卯: '卯', 辰: '子', 巳: '酉', 午: '午', 未: '卯', 申: '子', 酉: '酉', 戌: '午', 亥: '卯' }
  const yimaMap = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' }
  const huagaiMap = { 申: '辰', 子: '辰', 辰: '辰', 寅: '戌', 午: '戌', 戌: '戌', 巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未' }
  const taohuaMap = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' }
  const wangshenMap = { 申: '亥', 子: '亥', 辰: '亥', 寅: '巳', 午: '巳', 戌: '巳', 巳: '申', 酉: '申', 丑: '申', 亥: '寅', 卯: '寅', 未: '寅' }
  const jieshaMap = { 申: '巳', 子: '巳', 辰: '巳', 寅: '亥', 午: '亥', 戌: '亥', 巳: '寅', 酉: '寅', 丑: '寅', 亥: '申', 卯: '申', 未: '申' }
  const zaishaMap = { 申: '午', 子: '午', 辰: '午', 寅: '子', 午: '子', 戌: '子', 巳: '卯', 酉: '卯', 丑: '卯', 亥: '酉', 卯: '酉', 未: '酉' }
  const restZhi = [monthZhi, dayZhi, timeZhi]
  // 锚类神煞：以年支/日支为锚，查其余柱（排除锚柱自身，对齐 skill）
  const grabAnchor = (map, name, desc, useYear = true, useDay = true) => {
    if (useYear) {
      const yt = map[yearZhi]
      if (yt && [monthZhi, dayZhi, timeZhi].includes(yt)) { result.push(`${name}入命【${yt}】：${desc}`); return }
    }
    if (useDay) {
      const dt = map[dayZhi]
      if (dt && [yearZhi, monthZhi, timeZhi].includes(dt)) { result.push(`${name}入命【${dt}】：${desc}`); return }
    }
  }
  grabAnchor(yimaMap, '驿马', '动中求财，宜外出发展，走动运强')
  grabAnchor(jiangxingMap, '将星', '领导才能，威严决断，掌权之象')
  grabAnchor(huagaiMap, '华盖', '聪慧有才艺，孤高喜玄学宗教，宜修心')
  grabAnchor(taohuaMap, '桃花', '人缘魅力佳，感情丰富，异性缘旺')
  grabAnchor(wangshenMap, '亡神', '城府深，多谋略，遇贵星更吉')
  grabAnchor(jieshaMap, '劫煞', '才智高，喜冲不喜合，忌煞星')
  grabAnchor(zaishaMap, '灾煞', '多变动，防意外伤灾，宜谨慎', true, false)

  // ---------- 孤辰/寡宿/红鸾/天喜/勾绞/丧门/吊客/披麻/披头/六厄/元辰（年支锚查其余柱） ----------
  const guchenMap = { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' }
  const guasuMap = { 亥: '戌', 子: '戌', 丑: '戌', 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未' }
  const hongluanMap = { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' }
  const tianxiMap = { 子: '酉', 丑: '申', 寅: '未', 卯: '午', 辰: '巳', 巳: '辰', 午: '卯', 未: '寅', 申: '丑', 酉: '子', 戌: '亥', 亥: '戌' }
  const goujiaoMap = { 子: '卯', 丑: '辰', 寅: '巳', 卯: '午', 辰: '未', 巳: '申', 午: '酉', 未: '戌', 申: '亥', 酉: '子', 戌: '丑', 亥: '寅' }
  const sangmenMap = { 子: '寅', 丑: '卯', 寅: '辰', 卯: '巳', 辰: '午', 巳: '未', 午: '申', 未: '酉', 申: '戌', 酉: '亥', 戌: '子', 亥: '丑' }
  const diaokeMap = { 子: '戌', 丑: '亥', 寅: '子', 卯: '丑', 辰: '寅', 巳: '卯', 午: '辰', 未: '巳', 申: '午', 酉: '未', 戌: '申', 亥: '酉' }
  const pimaMap = { 子: '酉', 丑: '戌', 寅: '亥', 卯: '子', 辰: '丑', 巳: '寅', 午: '卯', 未: '辰', 申: '巳', 酉: '午', 戌: '未', 亥: '申' }
  const pitouMap = { 子: '辰', 丑: '卯', 寅: '寅', 卯: '丑', 辰: '子', 巳: '亥', 午: '戌', 未: '酉', 申: '申', 酉: '未', 戌: '午', 亥: '巳' }
  const liuerMap = { 寅: '酉', 午: '酉', 戌: '酉', 申: '卯', 子: '卯', 辰: '卯', 亥: '午', 卯: '午', 未: '午', 巳: '子', 酉: '子', 丑: '子' }
  const yuanChenYi = { 子: '巳', 丑: '午', 寅: '未', 卯: '申', 辰: '酉', 巳: '戌', 午: '亥', 未: '子', 申: '丑', 酉: '寅', 戌: '卯', 亥: '辰' }
  const grabYearAnchor = (map, name, desc) => {
    const t = map[yearZhi]
    if (t && [monthZhi, dayZhi, timeZhi].includes(t)) result.push(`${name}入命【${t}】：${desc}`)
  }
  grabYearAnchor(guchenMap, '孤辰', '生性孤独，独立，喜独处')
  grabYearAnchor(guasuMap, '寡宿', '孤枕难眠，晚婚/缘份浅')
  grabYearAnchor(hongluanMap, '红鸾', '婚恋喜庆之兆，主桃花良缘')
  grabYearAnchor(tianxiMap, '天喜', '喜事临门，人缘桃花佳')
  grabYearAnchor(goujiaoMap, '勾绞煞', '人际关系差，感情易争吵，易有官非牵连')
  grabYearAnchor(sangmenMap, '丧门', '不利六亲，岁运遇之防孝服')
  grabYearAnchor(diaokeMap, '吊客', '不利六亲，岁运遇之防孝服、破财')
  grabYearAnchor(pimaMap, '披麻', '防孝服之忧，多孝悌之事')
  grabYearAnchor(pitouMap, '披头', '六亲缘浅，宜注意长辈健康')
  grabYearAnchor(liuerMap, '六厄', '困厄之象，行事宜谨慎守成')
  grabYearAnchor(yuanChenYi, '元辰', '任性固执，防是非官非')
  // 天罗地网（算法1：年支/日支锚，其余柱支相配）
  const tldwCombos = ['戌亥', '辰巳', '亥戌', '巳辰']
  const anchorTldw = (anchorZhi) => [monthZhi, dayZhi, timeZhi].some(rz => tldwCombos.includes(anchorZhi + rz))
  if (anchorTldw(yearZhi)) result.push(`天罗地网【年支${yearZhi}】：行事易受困，需谨慎防范是非`)
  else if (anchorTldw(dayZhi)) result.push(`天罗地网【日支${dayZhi}】：行事易受困，需谨慎防范是非`)

  // ---------- 月支锚：血刃、天医 ----------
  const xueren = { 寅: '丑', 卯: '未', 辰: '寅', 巳: '申', 午: '卯', 未: '酉', 申: '辰', 酉: '戌', 戌: '巳', 亥: '亥', 子: '午', 丑: '子' }
  const tianyi = { 寅: '丑', 卯: '寅', 辰: '卯', 巳: '辰', 午: '巳', 未: '午', 申: '未', 酉: '申', 戌: '酉', 亥: '戌', 子: '亥', 丑: '子' }
  const xr = xueren[monthZhi]
  if (zhiHas(xr)) result.push(`血刃入命【${xr}】：防血光意外`)
  const ty = tianyi[monthZhi]
  if (zhiHas(ty)) result.push(`天医星入命【${ty}】：医卜星相有缘，利健康调理`)

  // ---------- 日柱查 ----------
  const dayGz = `${dayGan}${dayZhi}`
  const shie = ['甲辰', '乙巳', '壬申', '丙申', '丁亥', '庚辰', '戊戌', '癸亥', '辛巳', '己丑']
  const kuigang = ['戊戌', '壬辰', '庚戌', '庚辰']
  const guluansha = ['甲寅', '乙巳', '丙午', '丁巳', '戊午', '戊申', '辛亥', '壬子']
  const yinchayangcuo = ['丙子', '丙午', '丁丑', '丁未', '戊寅', '戊申', '辛卯', '辛酉', '壬辰', '壬戌', '癸巳', '癸亥']
  const sifeiri = { 寅: ['庚申', '辛酉'], 卯: ['庚申', '辛酉'], 辰: ['庚申', '辛酉'], 巳: ['壬子', '癸亥'], 午: ['壬子', '癸亥'], 未: ['壬子', '癸亥'], 申: ['甲寅', '乙卯'], 酉: ['甲寅', '乙卯'], 戌: ['甲寅', '乙卯'], 亥: ['丙午', '丁巳'], 子: ['丙午', '丁巳'], 丑: ['丙午', '丁巳'] }
  const tiansheri = { 寅: '戊寅', 卯: '戊寅', 辰: '戊寅', 巳: '甲午', 午: '甲午', 未: '甲午', 申: '戊申', 酉: '戊申', 戌: '戊申', 亥: '甲子', 子: '甲子', 丑: '甲子' }
  const shiling = ['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚戌', '庚寅', '辛亥', '壬寅', '癸未']
  const bazhuan = ['甲寅', '乙卯', '丁未', '戊戌', '己未', '庚申', '辛酉', '癸丑']
  const jiuchou = ['丁酉', '戊子', '戊午', '己卯', '己酉', '辛卯', '辛酉', '壬子', '壬午']
  const jinshen = ['乙丑', '己巳', '癸酉']
  const liuxiu = ['丙午', '丁未', '戊子', '戊午', '己丑', '己未']
  const rider = ['甲寅', '丙辰', '戊辰', '庚辰', '壬戌']
  const rigui = ['丁酉', '丁亥', '癸卯', '癸巳']
  if (shie.includes(dayGz)) result.push(`十恶大败【${dayGz}】：无禄日，财来财去难聚`)
  if (kuigang.includes(dayGz)) result.push(`魁罡入命：性格刚强，果断领导力，身旺则富贵`)
  if (guluansha.includes(dayGz)) result.push(`孤鸾入命【${dayGz}】：孤鸾煞，婚恋宜晚，感情多波折`)
  if (yinchayangcuo.includes(dayGz)) result.push(`阴差阳错【${dayGz}】：婚缘多阻，感情易错位`)
  if ((sifeiri[monthZhi] || []).includes(dayGz)) result.push(`四废日【${dayGz}】：气弱力衰，行事宜沉稳`)
  if (tiansheri[monthZhi] === dayGz) result.push(`天赦星【${dayGz}】：逢凶化吉，一生少灾厄`)
  if (shiling.includes(dayGz)) result.push(`十灵日入命：聪明灵慧，通灵有悟性`)
  if (bazhuan.includes(dayGz)) result.push(`八专日入命：专一执着，精力旺盛`)
  if (jiuchou.includes(dayGz)) result.push(`九丑日入命：貌美多情，婚恋宜谨慎`)
  if (liuxiu.includes(dayGz)) result.push(`六秀入命：生性聪敏，才华出众`)
  if (rider.includes(dayGz)) result.push(`日德入命：慈善有福，免横祸`)
  if (rigui.includes(dayGz)) result.push(`日贵入命：仁德有姿色，德行受人尊重`)
  if (jinshen.includes(dayGz) || jinshen.includes(`${timeGan}${timeZhi}`)) result.push(`金神入格：四柱见火则贵，刚断明敏，名利双收`)
  // 进神（日柱查）
  if (['甲子', '甲午', '己卯', '己酉'].includes(dayGz)) result.push(`进神日入命：志向高远，进取心强，做事有魄力`)
  // 天转 / 地转（月支查日柱）
  const tianzhuan = { 寅: '乙卯', 卯: '乙卯', 辰: '乙卯', 巳: '丙午', 午: '丙午', 未: '丙午', 申: '辛酉', 酉: '辛酉', 戌: '辛酉', 亥: '壬子', 子: '壬子', 丑: '壬子' }
  const dizhuan = { 寅: '辛卯', 卯: '辛卯', 辰: '辛卯', 巳: '戊午', 午: '戊午', 未: '戊午', 申: '癸酉', 酉: '癸酉', 戌: '癸酉', 亥: '丙子', 子: '丙子', 丑: '丙子' }
  if (tianzhuan[monthZhi] === dayGz) result.push(`天转煞入命：逢变易之年，宜守不宜攻，谨防变动`)
  if (dizhuan[monthZhi] === dayGz) result.push(`地转煞入命：逢变动之时，宜稳中求进，谨防破财`)
  // 天罗地网（算法2：年纳音 + 日支）
  const tldwYearNayin = NAYIN_WUXING[`${yearGan}${yearZhi}`]
  if ((tldwYearNayin === '火' && (dayZhi === '戌' || dayZhi === '亥')) ||
      ((tldwYearNayin === '水' || tldwYearNayin === '土') && (dayZhi === '辰' || dayZhi === '巳'))) {
    result.push(`天罗地网【年纳音${tldwYearNayin}日支${dayZhi}】：行事易受困，需谨慎防范是非`)
  }
  // 童子煞（日柱/时柱查）
  const tongziNayin = tldwYearNayin
  const tongziCheck = (restZhi) => {
    if ('寅卯辰申酉戌'.includes(monthZhi) && (restZhi === '寅' || restZhi === '子')) return true
    if ('巳午未亥子丑'.includes(monthZhi) && (restZhi === '卯' || restZhi === '未' || restZhi === '辰')) return true
    if (tongziNayin === '金' || tongziNayin === '木') return restZhi === '午' || restZhi === '卯'
    if (tongziNayin === '水' || tongziNayin === '火') return restZhi === '酉' || restZhi === '戌'
    if (tongziNayin === '土') return restZhi === '辰' || restZhi === '巳'
    return false
  }
  if (tongziCheck(dayZhi)) result.push(`童子煞入命【日支${dayZhi}】：多招不利，宜早宜和，谨防犯冲`)
  if (tongziCheck(timeZhi)) result.push(`童子煞入命【时支${timeZhi}】：多招不利，宜早宜和，谨防犯冲`)
  // 隔角煞（日支查时支）
  const gejiao = { 子: '寅', 丑: '卯', 寅: '辰', 卯: '巳', 辰: '午', 巳: '未', 午: '申', 未: '酉', 申: '戌', 酉: '亥', 戌: '子', 亥: '丑' }
  if (gejiao[dayZhi] === timeZhi) result.push(`隔角煞入命【时支${timeZhi}】：多思虑，宜开阔心胸，防自困`)

  // ---------- 学堂 / 词馆（年纳音定支查各柱支 + 日干定干支查各柱） ----------
  const nayinWx = { 金: '巳', 木: '亥', 水: '申', 火: '寅', 土: '申' }
  const yearNayin = NAYIN_WUXING[`${yearGan}${yearZhi}`]
  const xuetangGan = { 甲: '己亥', 乙: '壬午', 丙: '丙寅', 丁: '丁酉', 戊: '戊寅', 己: '己酉', 庚: '辛巳', 辛: '甲子', 壬: '甲申', 癸: '乙卯' }
  const ciguanGan = { 甲: '庚寅', 乙: '辛卯', 丙: '乙巳', 丁: '戊午', 戊: '丁巳', 己: '庚午', 庚: '壬申', 辛: '癸酉', 壬: '癸亥', 癸: '壬戌' }
  const xtNayin = nayinWx[yearNayin]
  const restGzArr = [`${monthGan}${monthZhi}`, `${dayGan}${dayZhi}`, `${timeGan}${timeZhi}`] // 学堂/词馆查非年柱
  if ((xtNayin && restGzArr.some(gz => gz[1] === xtNayin)) || restGzArr.includes(xuetangGan[dayGan])) {
    result.push(`学堂入命：聪明好学，记忆力强，多高学历，贵气十足`)
  }
  const cigNayin = { 金: '申', 木: '寅', 水: '亥', 火: '巳', 土: '亥' }[yearNayin]
  if ((cigNayin && restGzArr.some(gz => gz[1] === cigNayin)) || restGzArr.includes(ciguanGan[dayGan])) {
    result.push(`词馆入命：文思敏捷，文才出众，利文途`)
  }

  // ---------- 三奇贵人（四柱天干组合） ----------
  const allGanStr = allGan.join('')
  if (/甲.*戊.*庚|庚.*戊.*甲/.test(allGanStr)) result.push(`三奇贵人入命（天上三奇）：格局清贵，才华出众`)
  else if (/乙.*丙.*丁|丁.*丙.*乙/.test(allGanStr)) result.push(`三奇贵人入命（地下三奇）：格局清贵，才华出众`)
  else if (/壬.*癸.*辛|辛.*癸.*壬/.test(allGanStr)) result.push(`三奇贵人入命（人中三奇）：格局清贵，才华出众`)

  // ---------- 空亡（年旬 + 日旬，双查四柱支） ----------
  // 旬空：某干支所在旬（旬首甲子/甲戌/甲申/甲午/甲辰/甲寅）的空亡地支
  const GANZHI_60 = Array.from({ length: 60 }, (_, i) => TIAN_GAN[i % 10] + DI_ZHI[i % 12])
  const kongwangMap = { 甲子: '戌亥', 甲戌: '申酉', 甲申: '午未', 甲午: '辰巳', 甲辰: '寅卯', 甲寅: '子丑' }
  const xunOf = gz => {
    const idx = GANZHI_60.indexOf(gz)
    if (idx < 0) return { gan: '甲', name: '' }
    const xunShou = GANZHI_60[Math.floor(idx / 10) * 10] // 旬首干支
    return { gan: xunShou[0], name: kongwangMap[xunShou] || '' }
  }
  const yearXun = xunOf(`${yearGan}${yearZhi}`)
  const dayXun = xunOf(`${dayGan}${dayZhi}`)
  // 年旬：查非年柱（月/日/时）；日旬：查非日柱（年/月/时）
  const kongwangReported = new Set()
  for (const [label, z] of [['月柱', monthZhi], ['日柱', dayZhi], ['时柱', timeZhi]]) {
    if (yearXun.name.includes(z) && !kongwangReported.has(label)) {
      kongwangReported.add(label)
      result.push(`空亡【${label}${z}】：逢${yearXun.gan}子旬空，岁运填实方发力`)
    }
  }
  for (const [label, z] of [['年柱', yearZhi], ['月柱', monthZhi], ['时柱', timeZhi]]) {
    if (dayXun.name.includes(z) && !kongwangReported.has(label)) {
      kongwangReported.add(label)
      result.push(`空亡【${label}${z}】：逢${dayXun.gan}子旬空，岁运填实方发力`)
    }
  }

  // ---------- 反吟伏吟（四柱内部两两比对） ----------
  const allGz = [`${yearGan}${yearZhi}`, `${monthGan}${monthZhi}`, `${dayGan}${dayZhi}`, `${timeGan}${timeZhi}`]
  const ganOrder = { 甲: 1, 乙: 2, 丙: 3, 丁: 4, 戊: 5, 己: 6, 庚: 7, 辛: 8, 壬: 9, 癸: 10 }
  const chongMap = { 子: '午', 丑: '未', 寅: '申', 卯: '酉', 辰: '戌', 巳: '亥', 午: '子', 未: '丑', 申: '寅', 酉: '卯', 戌: '辰', 亥: '巳' }
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const g1 = allGz[i][0]; const z1 = allGz[i][1]
      const g2 = allGz[j][0]; const z2 = allGz[j][1]
      if (g1 === g2 && z1 === z2) result.push(`伏吟犯命【${allGz[i]} ${allGz[j]}】：家运差，夫妻缘动摇，事业破财`)
      const ganKe = (
        (ganOrder[g1] <= 2 && ganOrder[g2] >= 5 && ganOrder[g2] <= 6) ||
        (ganOrder[g1] >= 3 && ganOrder[g1] <= 4 && ganOrder[g2] >= 7 && ganOrder[g2] <= 8) ||
        (ganOrder[g1] >= 5 && ganOrder[g1] <= 6 && ganOrder[g2] >= 9) ||
        (ganOrder[g1] >= 7 && ganOrder[g1] <= 8 && ganOrder[g2] <= 2) ||
        (ganOrder[g1] >= 9 && ganOrder[g2] >= 3 && ganOrder[g2] <= 4)
      )
      if (ganKe && chongMap[z1] === z2) result.push(`反吟犯命【${allGz[i]} ${allGz[j]}】：家运败坏，夫妻缘散，事业破财，健康危机`)
    }
  }

  return result
}

// 纳音五行表（60 甲子 → 五行），用于学堂/词馆/天罗地网查法
const NAYIN_WUXING = {
  甲子: '金', 乙丑: '金', 丙寅: '火', 丁卯: '火', 戊辰: '木', 己巳: '木',
  庚午: '土', 辛未: '土', 壬申: '金', 癸酉: '金', 甲戌: '火', 乙亥: '火',
  丙子: '水', 丁丑: '水', 戊寅: '土', 己卯: '土', 庚辰: '金', 辛巳: '金',
  壬午: '木', 癸未: '木', 甲申: '水', 乙酉: '水', 丙戌: '土', 丁亥: '土',
  戊子: '火', 己丑: '火', 庚寅: '木', 辛卯: '木', 壬辰: '水', 癸巳: '水',
  甲午: '金', 乙未: '金', 丙申: '火', 丁酉: '火', 戊戌: '木', 己亥: '木',
  庚子: '土', 辛丑: '土', 壬寅: '金', 癸卯: '金', 甲辰: '火', 乙巳: '火',
  丙午: '水', 丁未: '水', 戊申: '土', 己酉: '土', 庚戌: '金', 辛亥: '金',
  壬子: '木', 癸丑: '木', 甲寅: '水', 乙卯: '水', 丙辰: '土', 丁巳: '土',
  戊午: '火', 己未: '火', 庚申: '木', 辛酉: '木', 壬戌: '水', 癸亥: '水'
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
// 子平正法：月令为提纲，得令与否对日主旺衰权重最大。
// 在五行字频基础上叠加"月令"权重（月支本气五行相对日主五行的生克关系）：
//   月令生我（印）/ 同我（比劫）→ 得令加分（+0.10）
//   月令我克（财）/ 我生（食伤）→ 失令减分（-0.08）
//   月令克我（官杀）→ 受克减分（-0.06）
// 月支缺省时退回纯字频（兼容旧调用）。
export function judgeStrength(dayWx, count, monthZhi) {
  const shengWx = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dayWx) // 生我者
  let strength = count[dayWx] + (count[shengWx] || 0) * 0.8
  const total = Object.values(count).reduce((a, b) => a + b, 0) || 1
  let ratio = strength / total
  if (monthZhi) {
    const monthWx = ZHI_WUXING[DI_ZHI.indexOf(monthZhi)]
    if (monthWx === dayWx || monthWx === shengWx) ratio += 0.10      // 得令
    else if (WUXING_KE[dayWx] === monthWx || WUXING_SHENG[dayWx] === monthWx) ratio -= 0.08 // 我克/我生 → 失令
    else ratio -= 0.06 // 月令克我 → 受克
  }
  return {
    ratio,
    strong: ratio >= 0.55,
    weak: ratio <= 0.42
  }
}

// 喜用神（简化推断：身强喜克泄耗，身弱喜生扶）
export function favorableElements(dayWx, strength) {
  const cycle = ['木', '火', '土', '金', '水'] // 相生循环：木→火→土→金→水→木
  const i = cycle.indexOf(dayWx)
  const shengMe = cycle[(i + 4) % 5] // 生我（我之印）：上一相生位
  const woSheng = cycle[(i + 1) % 5] // 我生（我之食伤）：下一相生位
  const keWo = cycle[(i + 3) % 5]    // 克我（我之官杀）：隔三位（相克）
  const woKe = cycle[(i + 2) % 5]    // 我克（我之妻财）：隔两位（相克）
  if (strength.strong) return { favorable: [woSheng, woKe, keWo], avoid: [dayWx, shengMe] }
  return { favorable: [shengMe, dayWx], avoid: [woSheng, keWo] }
}

// 生成完整命盘
// 四柱以「参天历法」精确节气排定（修复固定日期近似在交节时刻附近出错的问题）；
// 时柱统一采用「参天」口径（晚子时 23:00-23:59 按次日子时起干），
// 与盲派报告、Agent 精排解读（buildBaziFull）保持一致，避免同一命盘两处时柱打架；
// 参天不可用时回退为五鼠遁 + 当天日干起时。
export function buildChart(year, month, day, hour, gender) {
  const hourVal = hour ?? 12
  // 全站统一用 '男'/'女' 作为性别口径。页面里的下拉框历史上有写 male/female 的
  // （起名页、风水页），而这里只判 === '女'，于是女命被当成男命排盘、且 chart.gender
  // 原样存成 'female' 让下游「坤造/乾造」也跟着错。在引擎入口归一，调用方怎么传都不会错。
  const g = normalizeGender(gender)
  const pad2 = n => String(n).padStart(2, '0')
  let ct = null
  try {
    ct = buildBaziFromSolar({
      solarTime: `${year}-${pad2(month)}-${pad2(day)} ${pad2(hourVal)}:00`,
      gender: g === '女' ? 0 : 1, // 参天约定：0 女 / 1 男
      sect: 2, // 晚子时（23:00-23:59）日柱仍算当天
    })
  } catch (e) {
    ct = null
  }

  const date = new Date(year, month - 1, day)
  let yp, mp, dp
  if (ct) {
    yp = { gan: ct.年柱.天干.天干, zhi: ct.年柱.地支.地支, year }
    mp = { gan: ct.月柱.天干.天干, zhi: ct.月柱.地支.地支 }
    dp = { gan: ct.日柱.天干.天干, zhi: ct.日柱.地支.地支 }
  } else {
    yp = yearPillar(date)
    mp = monthPillar(date, TIAN_GAN.indexOf(yp.gan))
    dp = dayPillar(date)
  }
  // 时柱：优先取参天精确时柱（口径与盲派/Agent 一致）；不可用时回退五鼠遁
  let hp
  if (ct && ct.时柱 && ct.时柱.天干 && ct.时柱.地支) {
    hp = { gan: ct.时柱.天干.天干, zhi: ct.时柱.地支.地支 }
  } else {
    hp = hourPillar(hourVal, TIAN_GAN.indexOf(dp.gan))
  }

  const pillars = [
    { label: '年柱', ...yp, shiShen: shiShen(dp.gan, yp.gan) },
    { label: '月柱', ...mp, shiShen: shiShen(dp.gan, mp.gan) },
    { label: '日柱', ...dp, shiShen: '日主' },
    { label: '时柱', ...hp, shiShen: shiShen(dp.gan, hp.gan) }
  ]

  const count = wuxingCount(pillars)
  const strength = judgeStrength(GAN_WUXING[TIAN_GAN.indexOf(dp.gan)], count, mp.zhi)
  const fav = favorableElements(GAN_WUXING[TIAN_GAN.indexOf(dp.gan)], strength)
  const shengxiao = SHENGXIAO[DI_ZHI.indexOf(yp.zhi)]

  // 五行排序（从多到少）
  const wuxingRank = Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)

  const result = {
    year, month, day, hour: hourVal, gender: g,
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

  // 精确大运（参天历法：起运年龄按出生时刻距交节时辰计算），供子平/盲派报告统一使用
  if (ct && ct.大运) {
    result.qiYunDate = ct.大运.起运日期
    // 起运年龄按「实岁 + 月」口径（与 lunar_python / yixue-taishan 一致）：
    // 用出生日 → 起运日精确折算，避免引擎虚岁与本地实岁互相矛盾。
    let qyAge = { years: Math.max(0, (ct.大运.起运年龄 || 1) - 1), months: 0 }
    let qyText = ''
    try {
      const [yy, mm, dd] = String(result.qiYunDate).split('-').map(Number)
      if (yy && mm) qyAge = realAgeFrom(yy, mm, dd, year, month, day)
    } catch (e) { /* 保持兜底值 */ }
    result.qiYunAge = qyAge.years + qyAge.months / 12
    result.qiYunText = qyAge.months > 0 ? `${qyAge.years}岁${qyAge.months}个月` : `${qyAge.years}岁`
    // 大运：引擎第一条即为首运（从月柱相邻柱起排，阳男阴女顺、阴男阳女逆），
    // 月柱本身不入大运列表。年龄按实岁递推：首步 = 起运整岁，之后每十年 +10；
    // 公历年份保留引擎精确值。
    const baseAge = Math.max(0, qyAge.years)
    result.daYunList = (ct.大运.大运 || []).map((d, i) => {
      const gz = d.干支 || ''
      const sAge = baseAge + i * 10
      return {
        key: gz,
        g: gz.charAt(0),
        z: gz.charAt(1) || '',
        start: d.开始年份,
        end: d.结束,
        startAge: sAge,
        endAge: sAge + 9,
        ganShiShen: d.天干十神,
        zhiShiShen: d.地支十神,
        zhiCanGan: d.地支藏干,
        isFirst: i === 0
      }
    })
  }
  return result
}

// 实足年龄（岁+月+日）：从出生日到目标日，与 lunar_python 起运口径一致
function realAgeFrom(qyY, qyM, qyD, bornY, bornM, bornD) {
  let years = qyY - bornY
  let months = qyM - bornM
  let days = qyD - bornD
  if (days < 0) { months -= 1; days += 30 }
  if (months < 0) { years -= 1; months += 12 }
  if (years < 0) { years = 0; months = 0; days = 0 }
  return { years, months, days }
}

/**
 * 当前流年干支。
 *
 * ⚠ 原实现直接拿公历年号推干支 —— 但命理的年以**立春**为界，不是元旦。
 * 每年 1 月 1 日到 2 月 4 日前后这三十几天里，流年应当仍算上一年，
 * 原实现会整整错一位（比如 2026-01-15 报「丙午」，实际仍是「乙巳」）。
 * 现在优先用参天历法按精确交节时刻定年柱，不可用时退回 yearPillar 的
 * 立春近似（2/4），两条路都以立春为界。
 *
 * @param {Date} [at] 参考时刻，默认当下。显式传入便于测试与「指定日期」场景。
 */
export function currentYearGanzhi(at = new Date()) {
  const pad2 = n => String(n).padStart(2, '0')
  try {
    const ct = buildBaziFromSolar({
      solarTime: `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${pad2(at.getHours())}:00`,
      gender: 1,
      sect: 2,
    })
    if (ct && ct.年柱 && ct.年柱.天干 && ct.年柱.地支) {
      return {
        year: at.getFullYear(),
        gan: ct.年柱.天干.天干,
        zhi: ct.年柱.地支.地支,
      }
    }
  } catch { /* 参天不可用时走下面的近似 */ }
  const yp = yearPillar(at)
  return { year: at.getFullYear(), gan: yp.gan, zhi: yp.zhi }
}
