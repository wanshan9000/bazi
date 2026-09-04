/**
 * 典籍引用编排器（典籍引用层 · 优先级8）
 *
 * 根据八字分析结果，把「格局 / 用神 / 身强弱 / 十神 / 大运 / 流年」等
 * 主题映射到经典原文，生成可直接渲染的 classics section。
 * 无据可引的主题 → noBasis，诚实说明，绝不编造出处。
 */
import { pickClassic } from '../data/classics.js'

/**
 * 生成典籍引用 section（在报告中插入，供用户核对出处）
 * @param {object} opts
 * @param {string} [opts.pattern] 当前格局名（如 "正官格"）
 * @param {object} [opts.yongshen] analyzeYongShen 的返回值
 * @param {string} [opts.bodyDesc] 身强弱描述
 * @param {string} [opts.shishen] 十神主题
 * @param {boolean} [opts.withLuck] 是否附带大运流年主题
 */
export function buildClassicsSection(opts) {
  const { pattern, yongshen, bodyDesc, shishen, withLuck } = opts || {}
  const entries = []

  // 格局 → 经典
  if (pattern) {
    const { cite, noBasis } = pickClassic('geju', { pattern })
    entries.push({ topic: '格局', label: `格局 · ${pattern}`, cite, noBasis })
  }

  // 身强弱
  if (bodyDesc) {
    const { cite, noBasis } = pickClassic('body')
    entries.push({ topic: '身强弱', label: bodyDesc, cite, noBasis })
  }

  // 用神
  if (yongshen && yongshen.sequence && yongshen.sequence.length) {
    const first = yongshen.sequence[0]
    const { cite, noBasis } = pickClassic('yongshen', { yongshenWx: first?.wx })
    entries.push({ topic: '用神', label: `用神 · ${first?.wx || ''}（${first?.why || ''}）`, cite, noBasis })
  }

  // 调候用神
  if (yongshen && yongshen.monthZhi) {
    const { cite, noBasis } = pickClassic('tiaohou', { yongshenWx: yongshen.tiaohouWxs?.[0] })
    entries.push({ topic: '调候', label: `调候 · ${yongshen.monthZhi}月`, cite, noBasis })
  }

  // 十神主题
  if (shishen) {
    const { cite, noBasis } = pickClassic('shishen')
    entries.push({ topic: '十神', label: shishen, cite, noBasis })
  }

  // 大运流年（可核对）
  if (withLuck) {
    const d = pickClassic('dayun')
    const l = pickClassic('liunian')
    entries.push({ topic: '大运', label: '大运起落', cite: d.cite, noBasis: d.noBasis })
    entries.push({ topic: '流年', label: '流年吉凶', cite: l.cite, noBasis: l.noBasis })
  }

  const cited = entries.filter(e => e.cite)
  const noBasisTopics = entries.filter(e => e.noBasis).map(e => e.topic)

  return {
    key: 'classics',
    title: '典籍印证',
    kind: 'classics',
    data: { entries, citedCount: cited.length },
    note: cited.length
      ? `已援引 ${cited.length} 条命理经典原文（出处见卡片，可自行核对）。`
      : '当前命局较少直接对应经典条文，故不作生硬套用，仅作参考。',
    noBasisTopics
  }
}
