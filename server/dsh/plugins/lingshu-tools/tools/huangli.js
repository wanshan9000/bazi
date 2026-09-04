import { defineTool } from '@deepseek-ai/dsh-tools'
import { OPTIONAL_BIRTH_PARAMS, chartFromArgs } from '../birth.js'

function today() { const t = new Date(); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}` }
function toLocalDate(s) { const p = String(s).split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1) }

export function makeHuangliTool(E) {
  return defineTool({
    name: 'huangli',
    description: '查某天老黄历宜忌、吉神凶煞、冲煞，可结合命主八字给开运建议。问黄历、宜忌、吉日、搬家开业嫁娶择日时调用。',
    parameters: { date: { type: 'string', description: 'YYYY-MM-DD，省略为今天' }, scenario: { type: 'string', description: '场景：worker/student/boss 等，可省略' }, ...OPTIONAL_BIRTH_PARAMS },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const dateStr = args.date || today()
      const chart = args.year && args.month && args.day && args.gender ? chartFromArgs(E, args) : null
      const d = E.buildDaily(toLocalDate(dateStr), chart)
      const extra = {}
      if (d.action) extra.action = d.action
      if (d.tips) extra.tips = d.tips
      return E.buildFusedHuangli(dateStr, args.scenario, extra)
    },
  })
}

export function makeModernHuangliTool(E) {
  return defineTool({
    name: 'modern_huangli',
    description: '现代幽默黄历（打工人/学生/老板视角的宜忌，娱乐向）。用户说沙雕黄历、打工人黄历、摸鱼宜忌时调用。',
    parameters: { date: { type: 'string', description: 'YYYY-MM-DD，省略为今天' }, scenario: { type: 'string', description: 'worker/student/boss' } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) { return E.buildFusedHuangli(args.date || today(), args.scenario) },
  })
}
