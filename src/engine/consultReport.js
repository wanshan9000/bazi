// 多流派会诊报告：将子平、盲派、紫微三派命理结论汇聚，呈现各派视角与共识分歧
// 为打破与 reports.js 的循环依赖，本文件不 import reports.js；
// 三个子报告由 reports.js 构建后以 params 传入。
import { makeReport, failReport } from './reportSchema.js'
import { buildSafeSection, uncertaintyTail } from './safeGuard.js'

// 从子平报告中提取"一句话总评"
function baziVerdict(rep) {
  const s = rep?.sections || []
  const summary = s.find(x => x.key === 'summary')
  const lines = summary?.data?.lines || []
  const gj = lines.find(l => l.k === '格局法')
  const ys = lines.find(l => l.k === '用神法')
  const sh = lines.find(l => l.k === '身强弱')
  const pat = gj?.v ? String(gj.v).split('·')[0].trim() : ''
  return {
    school: '子平派',
    head: pat ? `格局「${pat}」` : '格局已定',
    points: [
      { k: '格局法', v: String(gj?.v || ''), tone: gj?.v ? (String(gj.v).includes('贵') || String(gj.v).includes('成') ? 'good' : undefined) : undefined },
      { k: '用神法', v: String(ys?.v || ''), tone: 'good' },
      { k: '身强弱', v: String(sh?.v || '') },
    ],
    tail: String(summary?.data?.tail || rep?.advice || '').slice(0, 60),
  }
}

// 从盲派报告中提取核心结论
function mangpaiVerdict(rep) {
  const s = rep?.sections || []
  const taiji = s.find(x => x.key === 'taiji')
  const shi = s.find(x => x.key === 'shi')
  const genji = s.find(x => x.key === 'genji')
  const dinglun = s.find(x => x.key === 'dinglun')
  const shiItems = shi?.data?.items || []
  const wXiao = shiItems.find(i => i.name === '做功效率')
  const wFu = shiItems.find(i => i.name === '富贵三档')
  const genjiLast = genji?.data?.rows?.slice(-1)[0]
  return {
    school: '盲派',
    head: `${wXiao?.tag || ''}效率 · ${wFu?.tag || ''} · 根基${genjiLast?.[1] || ''}分`,
    points: [
      { k: '太极点', v: String(taiji?.data?.items?.[0]?.v || ''), tone: taiji?.data?.items?.[0]?.tone },
      { k: '做功效率', v: wXiao ? `${wXiao.tag}：${wXiao.desc}` : '' },
      { k: '富贵层级', v: wFu ? `${wFu.tag}：${wFu.desc}` : '' },
    ],
    tail: String((dinglun?.data?.items || []).map(i => i.desc).filter(Boolean).join('')).slice(0, 60),
  }
}

// 从紫微报告中提取核心结论（advice 可能是对象，需提取有效文本）
function ziweiVerdict(rep) {
  const hero = rep?.hero || {}
  const sub = String(rep?.sub || '')
  const ming = String(hero?.main || '').replace(/<[^>]*>/g, '').trim() || ''
  // advice 可能是对象（career/wealth/love）或字符串
  const raw = rep?.advice
  let tail = ''
  if (typeof raw === 'string') tail = raw
  else if (raw && typeof raw === 'object') tail = Object.values(raw).filter(v => typeof v === 'string').join(' ')
  return {
    school: '紫微斗数',
    head: ming,
    points: [
      { k: '五行局', v: String(rep?.meta?.fiveElementsClass || (sub.match(/[^｜|]*局/)?.[0]?.trim() || '')) },
      { k: '命宫主星', v: ming },
    ],
    tail: tail.slice(0, 80),
  }
}

export function buildConsultReport(chart, params = {}) {
  if (!chart) return failReport('尚未排盘，请先生成命盘')

  const bazi = params.bazi
  const mangpai = params.mangpai
  const ziwei = params.ziwei

  const verdicts = []
  if (bazi?.ok) verdicts.push(baziVerdict(bazi))
  if (mangpai?.ok) verdicts.push(mangpaiVerdict(mangpai))
  if (ziwei?.ok) verdicts.push(ziweiVerdict(ziwei))

  if (verdicts.length === 0) {
    return failReport('多派排盘均失败，请重新排盘后再试')
  }

  const schoolItems = verdicts.map(v => ({
    k: v.school,
    v: v.head || (v.points.map(p => p.v).filter(Boolean)[0] || '—'),
  }))

  const sections = [
    {
      key: 'schools',
      title: '流派会诊总览',
      kind: 'kv',
      data: { items: schoolItems },
      note: `共调用 ${verdicts.length} 派命理体系交叉验证，命主为 ${chart.year}年${chart.month}月${chart.day}日${chart.hour ? ' ' + chart.hour + '时' : ''}${chart.gender === '女' ? '（坤造）' : '（乾造）'}。`,
    },
    ...verdicts.map((v, i) => ({
      key: `school-${i}`,
      title: `◎ ${v.school} 视角`,
      kind: 'kv',
      data: { items: v.points.filter(p => p.v) },
      note: v.tail ? v.tail : undefined,
    })),
    {
      key: 'final',
      title: '综合定论',
      kind: 'note',
      data: { text: verdicts.map(v => `【${v.school}】${v.head || v.points.filter(p => p.v).map(p => p.v).join('；')}`).join('\n') },
    },
    // 理性提示（SAFE 红线 + 不确定性诚实表达 · 优先级10）
    buildSafeSection({ kind: 'fortune' }),
  ]

  const advice = `多流派会诊：${verdicts.map(v => `${v.school}（${v.head}）`).join('；')}。` +
    `建议以喜用神为主线，结合大运流年落实具体事项。` +
    `（${uncertaintyTail('fortune')}）`

  return makeReport('consult', {
    sub: `${chart.year}年${chart.month}月${chart.day}日 · ${chart.gender === '女' ? '坤造' : '乾造'}`,
    hero: { chars: [`${chart.year}`, `${chart.month}`, `${chart.day}`], main: `多流派 <b>${verdicts.length} 派</b>会诊 · 共识与分歧并行呈现` },
    meta: {},
    sections,
    advice,
    markdown: `# 多流派会诊报告\n\n${schoolItems.map(i => `- **${i.k}**：${i.v}`).join('\n')}\n\n${verdicts.map(v => `## ${v.school}\n${v.points.filter(p => p.v).map(p => `- ${p.k}：${p.v}`).join('\n')}`).join('\n\n')}`,
  })
}
