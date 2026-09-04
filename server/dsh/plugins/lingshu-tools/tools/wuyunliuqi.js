import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'
import { BIRTH_PARAMS, chartFromArgs, birthLine } from '../birth.js'

export function makeWuyunliuqiTool(E) {
  return defineTool({
    name: 'wuyunliuqi',
    description: '按出生年干支排五运六气（中运/司天在泉/主客气/客运）并按属相判六大体质，给养生建议。问体质、五运六气、健康调理时调用；不做医疗诊断。',
    parameters: { ...BIRTH_PARAMS },
    output: textOutput(),
    async execute(args) {
      const chart = chartFromArgs(E, args)
      return `【命主】${birthLine(chart)}\n${E.buildWuyunliuqi(chart).text}`
    },
  })
}
