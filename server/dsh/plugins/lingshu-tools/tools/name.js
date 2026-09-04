import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'
import { OPTIONAL_BIRTH_PARAMS, chartFromArgs } from '../birth.js'

export function makeNameTool(E) {
  return defineTool({
    name: 'name',
    description: '姓名五格三才分析（给 fullName）或结合八字喜用推荐名字（给 surname + 出生信息）。问取名、改名、名字好不好时调用。',
    parameters: { fullName: { type: 'string', description: '要分析的完整姓名' }, surname: { type: 'string', description: '推荐名字时的姓氏' }, ...OPTIONAL_BIRTH_PARAMS },
    output: textOutput(),
    async execute(args) {
      const chart = args.year && args.month && args.day && args.gender ? chartFromArgs(E, args) : null
      if (args.fullName) {
        const a = E.analyzeName({ fullName: args.fullName, surname: args.surname, chart })
        const grid = a.grid.map(g => `${g.name}${g.num}画（${g.luck.category}）`).join('、')
        return [`【姓名五格分析】${args.fullName}`, `五格：${grid}`, `三才${a.sanCai.tian}${a.sanCai.ren}${a.sanCai.di}（${a.sanCai.verdict}）`, `评分：${a.score}（${a.grade}）`, a.summaryText].join('\n')
      }
      if (!args.surname) throw new Error('请提供 fullName（分析）或 surname（推荐）')
      const recs = E.recommendName(chart || {}, args.surname)
      if (!recs.length) throw new Error('无法生成推荐，请补充出生信息')
      return ['【取名推荐】（结合八字喜用神）', ...recs.map(r => `${r.input.fullName}｜${r.score}分｜${r.grid.map(x => `${x.name}${x.num}`).join(' ')}｜${r.sanCai.verdict}`)].join('\n')
    },
  })
}
