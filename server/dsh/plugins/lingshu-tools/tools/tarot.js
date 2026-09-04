import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'

export function makeTarotTool(E) {
  return defineTool({
    name: 'tarot',
    description: '抽塔罗牌并给牌意（single 单张 / three 三张过去现在未来）。用户要抽牌、看塔罗、感情抉择指引时调用。',
    parameters: { spread: { type: 'string', enum: ['single', 'three'], description: '牌阵，默认 single' }, question: { type: 'string', description: '所问之事' } },
    output: textOutput(),
    async execute(args) {
      const result = E.drawCards(args.spread || 'single', Date.now())
      if (!result) throw new Error('塔罗牌阵加载失败')
      const interp = E.interpretTarot(result, args.question || '')
      const lines = ['【塔罗抽牌结果】', ...result.cards.map((c, i) => `第${i + 1}张：${c.name}（${c.reversed ? '逆位' : '正位'}）｜关键词：${(c.kw || []).join('、')}`)]
      if (interp?.summary) lines.push(interp.summary)
      if (interp?.perCard) interp.perCard.forEach((p, i) => lines.push(`牌${i + 1}牌意：${p.text}`))
      if (interp?.suggestion) lines.push(`行动建议：${interp.suggestion}`)
      return lines.join('\n')
    },
  })
}
