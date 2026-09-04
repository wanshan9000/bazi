import { defineTool } from '@deepseek-ai/dsh-tools'
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
    description: '按出生年月日时与性别排八字四柱，返回四柱、十神、藏干、纳音、空亡、神煞、身强弱、喜用神、大运（含起运日期/起运年龄）。回答八字命局、五行喜忌、流年大运、几岁起运时调用。school=mangpai 时附盲派做功要点（体用宾主/根基/做功）。',
    parameters: {
      ...BIRTH_PARAMS,
      school: { type: 'string', enum: ['ziping', 'mangpai'], description: '流派：子平(默认)或盲派' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const chart = chartFromArgs(E, args)
      const segs = [`【命主】${birthLine(chart)}`, E.buildBaziFull(chart)]
      if (chart.daYunList && chart.daYunList.length) {
        const currentAge = new Date().getFullYear() - chart.year
        const cur = chart.daYunList.find(d => d.isNow) ??
          chart.daYunList.find(d => d.startAge <= currentAge && currentAge < d.endAge + 1)
        segs.push(`【八字大运】起运 ${chart.qiYunText || `${chart.qiYunAge} 岁`}（${chart.qiYunDate || ''}）。当前大运：${cur ? `${cur.g}${cur.z}（${cur.startAge}-${cur.endAge} 岁，${cur.start}-${cur.end}）` : '见上表'}。`)
      }
      if (args.school === 'mangpai') {
        segs.push('【盲派做功要点】', ...renderMangpai(E.buildMangpaiContext(chart)))
      }
      segs.push(SYSTEM_NOTE)
      return segs.join('\n')
    },
  })
}
