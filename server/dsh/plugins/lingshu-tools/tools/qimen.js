import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'

export function makeQimenTool(E) {
  return defineTool({
    name: 'qimen',
    description: '奇门遁甲排盘（时家+日家+月家+年家）。问奇门、九宫、八门、值符值使、择时方位时调用。',
    parameters: { datetime: { type: 'string', description: '起局时间 YYYY-MM-DD HH:mm，省略为现在' } },
    output: textOutput(),
    async execute(args) {
      const d = args.datetime ? new Date(args.datetime.replace(' ', 'T')) : new Date()
      if (Number.isNaN(d.getTime())) throw new Error('datetime 格式应为 YYYY-MM-DD HH:mm')
      return E.buildQimenFull(d)
    },
  })
}
