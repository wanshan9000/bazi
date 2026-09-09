import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'
import { OPTIONAL_BIRTH_PARAMS, chartFromArgs } from '../birth.js'

function today() { const t = new Date(); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}` }

export function makeHuangliTool(E) {
  return defineTool({
    name: 'huangli',
    description: '统一黄历生成：mode=standard 查询传统黄历，mode=personalized 在有完整生辰时融合八字日运；tone 可选 practical 或 humorous。',
    parameters: {
      date: { type: 'string', description: 'YYYY-MM-DD，省略为今天' },
      scenario: { type: 'string', description: '场景：worker/student/free/enjoy，可省略' },
      mode: { type: 'string', enum: ['standard', 'personalized'], description: '缺省自动判断；personalized 需完整生辰' },
      tone: { type: 'string', enum: ['practical', 'humorous'], description: '缺省 practical' },
      ...OPTIONAL_BIRTH_PARAMS
    },
    output: textOutput(),
    async execute(args) {
      const dateStr = args.date || today()
      const chart = args.year && args.month && args.day && args.gender ? chartFromArgs(E, args) : null
      return E.generateHuangli({
        chart,
        date: dateStr,
        scenario: args.scenario,
        mode: args.mode,
        tone: args.tone,
        format: 'markdown',
      })
    },
  })
}
