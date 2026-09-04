// 盲派普通解读 + 流派自动选择
// 目标：普通测算时，盲派命理不再只存在于"完整报告"，而是提供一套简明普通解读
// （做功/根基/效率/财富格局等），并可据命盘的量化信号自动选择"子平 or 盲派"哪套更明确、更精准。

import { buildBaziFromSolar } from 'cantian-tymext'
import { analyzeMangpai, mangpaiAdvice } from './mangpai.js'

// 从本地 chart 构建盲派所需 bazi 对象（与 buildMangpaiReport 同源，保证口径一致）
export function buildMangpaiBazi(chart) {
  if (!chart) return null
  const pad2 = n => String(n).padStart(2, '0')
  try {
    return buildBaziFromSolar({
      solarTime: `${chart.year}-${pad2(chart.month)}-${pad2(chart.day)} ${pad2(chart.hour ?? 12)}:00`,
      gender: chart.gender === '女' ? 0 : 1,
      sect: 2,
    })
  } catch (e) {
    return null
  }
}

// 子平量化明确度信号（用于"哪套更精准"自动选择）
// 基于本地 chart（不重排盘）：身强弱是否极端、用神是否明确，越明确越可信。
// 基础分刻意低于"体系成熟加成"，让盲派在根基扎实时有机会凭借自身信号胜出。
export function zipingSignals(chart) {
  if (!chart) return { ok: false, score: 50, detail: '' }
  let score = 32 // 子平体系成熟，给稳定基础分
  const notes = []

  // ① 身强弱明确度：strength.ratio 越偏离 0.5（中和）越明确
  if (chart.strength && typeof chart.strength.ratio === 'number') {
    const polar = Math.min(1, Math.abs(chart.strength.ratio - 0.5) * 2)
    score += Math.round(polar * 22)
    notes.push(`身强弱${chart.strength.strong ? '偏强' : '偏弱'}(极化${Math.round(polar * 100)}%)`)
  } else {
    notes.push('身强弱中和')
  }

  // ② 用神明确度：有明确喜用忌神 → 取用清晰
  const hasFav = Array.isArray(chart.favorable) && chart.favorable.length > 0
  const hasAvoid = Array.isArray(chart.avoid) && chart.avoid.length > 0
  if (hasFav && hasAvoid) { score += 16; notes.push('用神明确') }
  else if (hasFav || hasAvoid) { score += 7; notes.push('用神一般') }
  else { notes.push('用神中和') }

  return { ok: true, score: Math.min(100, score), detail: notes.join('、') || '平稳' }
}

// 盲派量化明确度信号（用于"哪套更精准"自动选择）
// 打分原则：根基分（0-15）为主、效率评级为次、有明确做功再加分。
// 根基≥10 分且效率较高者，盲派"看事直断"的可信度显著提升，应有机会胜过子平默认。
export function mangpaiSignals(chart) {
  const bazi = buildMangpaiBazi(chart)
  if (!bazi) return { ok: false, score: 0, total: 0, grade: '', detail: '' }
  const m = analyzeMangpai(bazi)
  if (!m) return { ok: false, score: 0, total: 0, grade: '', detail: '' }

  const total = m.genji ? (m.genji.total || 0) : 0            // 根基分 0-15
  const grade = m.zuo && m.zuo.xiaoLv ? (m.zuo.xiaoLv.grade || '') : '' // 效率 S/A/B/C
  const hasGong = !!(m.zuo && m.zuo.main)

  // 根基 0-15 → 0-60 分（每分 4 分）；效率评级再叠加
  let score = Math.round((total / 15) * 60)
  const gradeBoost = { S: 25, 'A+': 22, A: 20, B: 12, C: 5 }[grade] ?? 8
  score += gradeBoost
  if (hasGong) score += 12
  score = Math.min(100, score)

  const detail = `根基${total}分(${m.genji?.level || ''})、效率${grade || '?'}${hasGong ? '、有做功' : '、做功不显'}`
  return { ok: true, score, total, grade, hasGong, detail }
}

// 盲派普通解读（供 system prompt 注入，简明版，非完整报告）
// 返回结构：{ ok, school, dayGan, dayZhi, genji, zuo, wealth, advice: {career, wealth, love, health, opening} }
export function buildMangpaiContext(chart) {
  const bazi = buildMangpaiBazi(chart)
  if (!bazi) return null
  const m = analyzeMangpai(bazi)
  if (!m) return null

  const adv = mangpaiAdvice(m) || {}
  const grade = m.zuo?.xiaoLv?.grade || ''
  const gradeTxt = { S: '顶尖，能赚大钱、格局开得大', A: '很高，能拿大头', B: '中等，小康小贵', C: '偏稳，细水长流' }[grade] || '中规中矩'

  return {
    ok: true,
    school: '盲派',
    dayGan: bazi.日主 || m.dayGan || '',
    dayZhi: m.pre?.dayZhi || '',
    genji: m.genji ? `${m.genji.total}分（${m.genji.level || ''}）` : '',
    zuo: m.zuo?.main ? m.zuo.main.name : '制',
    gradeTxt,
    wealth: {
      level: m.zuo?.xiaoLv?.grade ? `来财效率${grade}·${gradeTxt}` : '中规中矩',
      note: (m.zuo && m.zuo.xiaoLv) ? (m.zuo.xiaoLv.tip || '') : '',
    },
    advice: adv,
  }
}

// 流派自动选择：根据命盘量化信号，决定普通测算用"子平"还是"盲派"更精准。
// 判定思路：同时算两套体系的"解读明确度"（0-100），盲派必须明显优于子平（高 8+ 分）
// 且自身足够明确（≥60）才切盲派，否则默认子平（更成熟、报告结构完善）。
// 这样：盲派信号强的命盘自动走盲派；盲派一般/中庸则稳定走子平，避免无意义切换。
// chart 需含 year/month/day/hour/gender 及子平侧字段（strength/favorable/avoid/wuxing）。
export function pickSchool(chart) {
  const zp = zipingSignals(chart)
  const mp = mangpaiSignals(chart)
  if (!mp.ok) return { school: 'ziping', reason: '盲派排盘不可用，默认使用子平', zipingScore: zp.score, mangpaiScore: 0 }
  // 与注释设计意图一致：盲派必须明显优于子平（高 8+ 分）且自身足够明确（≥60）才切盲派
  if (mp.score >= 60 && mp.score > zp.score + 8) {
    return { school: 'mangpai', reason: `盲派解读更明确（根基强/效率高），切换盲派`, zipingScore: zp.score, mangpaiScore: mp.score }
  }
  return { school: 'ziping', reason: '子平更成熟稳定', zipingScore: zp.score, mangpaiScore: mp.score }
}
