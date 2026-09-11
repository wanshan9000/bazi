import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'
import { BIRTH_PARAMS, chartFromArgs, birthLine } from '../birth.js'

const SYSTEM_NOTE = '【体系声明·必须遵守】八字大运按节气交运（阳男阴女顺排、阴男阳女逆排），起运日期/起运年龄以此处数据为准；紫微大限按五行局起限，是另一套算法，两者数字严禁混用、严禁编造。'

function pillarLine(chart) {
  return (chart.pillars || []).map(p => `${p.gan || ''}${p.zhi || ''}`).join(' ')
}

function currentLuck(chart, now = new Date()) {
  const age = now.getFullYear() - chart.year
  return (chart.daYunList || []).find(d => d.isNow)
    || (chart.daYunList || []).find(d => d.startAge <= age && age <= d.endAge)
    || null
}

// 模型需要的是能校验四柱和大运、能支撑当前问题的事实，而不是整张 Markdown
// 原盘（它包含神煞、十运和 JSON 关系表，通常约 3KB）。默认紧凑返回可将首轮
// 上下文压到约五分之一；用户明确索要原盘细表时才走 detail=full。
function renderCompactBazi(chart) {
  const current = currentLuck(chart)
  const tenGods = (chart.pillars || [])
    .map(p => `${p.label || ''}${p.shiShen ? ` ${p.shiShen}` : ''}`.trim())
    .filter(Boolean)
    .join('｜')
  const lines = [
    `【校盘】四柱：${pillarLine(chart)}｜日主：${chart.dayMaster || '待工具核对'}｜生肖：${chart.shengxiao || '待工具核对'}`,
    `【起运】${chart.qiYunText || `${chart.qiYunAge ?? '待工具核对'} 岁`}（${chart.qiYunDate || '日期待工具核对'}）`,
    `【当前大运】${current ? `${current.key}（${current.startAge}-${current.endAge} 岁，${current.start}-${current.end}）` : '未能定位，请以完整大运表复核'}`,
  ]
  if (tenGods) lines.push(`【四柱十神】${tenGods}`)
  return lines.join('\n')
}

function renderMangpai(ctx) {
  if (!ctx) return ['（盲派做功分析不可用）']
  const { dayGan, dayZhi, genji, zuo, wealth, advice } = ctx
  const lines = [
    `日主 ${dayGan}${dayZhi ? '坐' + dayZhi : ''}｜根基 ${genji}｜主做功 ${zuo}｜${wealth.level}`,
  ]
  if (wealth.note) lines.push(wealth.note)
  if (advice && typeof advice === 'object') {
    for (const [key, value] of Object.entries(advice)) {
      if (typeof value === 'string') lines.push(`${key}：${value}`)
    }
  }
  return lines
}

export function makeBaziTool(E) {
  return defineTool({
    name: 'bazi',
    description: '按出生年月日时与性别排八字四柱。调用前先加载 bazi-router skill，再按其选择的流派加载对应断法 skill；默认 school=mangpai，只有用户明确要求子平派时才使用 school=ziping。',
    parameters: {
      ...BIRTH_PARAMS,
      school: { type: 'string', enum: ['ziping', 'mangpai'], description: '流派：盲派（默认）或用户明确指定的子平派' },
      detail: { type: 'string', enum: ['compact', 'full'], description: '默认 compact，只返回校盘与回答必需事实；仅用户明确索要原始盘面细表时使用 full' },
    },
    output: textOutput(),
    async execute(args) {
      const chart = chartFromArgs(E, args)
      const body = args.detail === 'full' ? E.buildBaziFull(chart) : renderCompactBazi(chart)
      const segs = [`【命主】${birthLine(chart)}`, body]
      if ((args.school || 'mangpai') === 'mangpai') {
        segs.push('【盲派做功要点】', ...renderMangpai(E.buildMangpaiContext(chart)))
      }
      segs.push(SYSTEM_NOTE)
      return segs.join('\n')
    },
  })
}
