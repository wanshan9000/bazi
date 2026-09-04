import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'
import { BIRTH_PARAMS, chartFromArgs, birthLine } from '../birth.js'

export function makeZiweiTool(E) {
  return defineTool({
    name: 'ziwei',
    description: '按出生年月日时与性别排紫微斗数命盘：命宫总格、十二宫主星、四化、大限（按五行局起限）。问紫微、十二宫、星曜、大限时调用。注意紫微"大限"与八字"大运"是两套算法，不可混用。',
    parameters: { ...BIRTH_PARAMS, targetDate: { type: 'string', description: '流年/流月目标日期 YYYY-MM-DD，可省略' } },
    output: textOutput(),
    async execute(args) {
      const chart = chartFromArgs(E, args)
      return `【命主】${birthLine(chart)}\n${E.buildZiwei(chart, args.targetDate ? new Date(args.targetDate) : undefined)}`
    },
  })
}
