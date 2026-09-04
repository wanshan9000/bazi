import { defineTool } from '@deepseek-ai/dsh-tools'

export function makeLiuyaoTool(E) {
  return defineTool({
    name: 'liuyao',
    description: '就一件具体事随机起一卦（六爻纳甲装卦），返回本卦/变卦、动爻、世应、六亲。用户问"某事要不要做/会怎样/帮我起一卦"时调用；用户报了三个数字时传 n1 n2 n3。',
    parameters: {
      question: { type: 'string', required: true, description: '所问之事' },
      n1: { type: 'integer' }, n2: { type: 'integer' }, n3: { type: 'integer' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      return `【所问】${args.question}\n${E.buildLiuyaoPan({ n1: args.n1, n2: args.n2, n3: args.n3, question: args.question })}`
    },
  })
}
