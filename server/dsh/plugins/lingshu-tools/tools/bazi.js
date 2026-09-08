import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'
import { BIRTH_PARAMS, chartFromArgs, birthLine } from '../birth.js'

const SYSTEM_NOTE = '【体系声明·必须遵守】八字大运按节气交运（阳男阴女顺排、阴男阳女逆排），起运日期/起运年龄以此处数据为准；紫微大限按五行局起限，是另一套算法，两者数字严禁混用、严禁编造。'

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
    },
    output: textOutput(),
    async execute(args) {
      const chart = chartFromArgs(E, args)
      const segs = [`【命主】${birthLine(chart)}`, E.buildBaziFull(chart)]
      if (chart.daYunList && chart.daYunList.length) {
        const currentAge = new Date().getFullYear() - chart.year
        const cur = chart.daYunList.find(d => d.isNow) ??
          chart.daYunList.find(d => d.startAge <= currentAge && currentAge < d.endAge + 1)
        segs.push(`【八字大运】起运 ${chart.qiYunText || `${chart.qiYunAge} 岁`}（${chart.qiYunDate || ''}）。当前大运：${cur ? `${cur.g}${cur.z}（${cur.startAge}-${cur.endAge} 岁，${cur.start}-${cur.end}）` : '见上表'}。`)
      }
      if ((args.school || 'mangpai') === 'mangpai') {
        segs.push('【盲派做功要点】', ...renderMangpai(E.buildMangpaiContext(chart)))
      }
      segs.push(SYSTEM_NOTE)
      return segs.join('\n')
    },
  })
}
