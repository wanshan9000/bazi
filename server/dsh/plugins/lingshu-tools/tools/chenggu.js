import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'
import { BIRTH_PARAMS, birthLine, chartFromArgs } from '../birth.js'

export function makeChengguTool(E) {
  return defineTool({
    name: 'chenggu',
    description: '称骨论命：按农历年干支、月、日、时查固定标准 51 档骨重，展示四项与边界口径；历史歌诀和八字日常建议分层生成。',
    parameters: BIRTH_PARAMS,
    output: textOutput(),
    async execute(args) {
      // 先经统一出生参数校验与农历换算，保证 Agent 与页面都以同一公历时刻进入称骨引擎。
      const chart = chartFromArgs(E, args)
      const report = E.generateChenggu({
        birth: { year: chart.year, month: chart.month, day: chart.day, hour: chart.hour, hourKnown: chart.hourKnown, gender: chart.gender },
        gender: chart.gender,
        format: 'markdown',
      })
      return [`【命主】${birthLine(chart)}`, report].join('\n')
    },
  })
}
