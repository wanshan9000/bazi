import { defineTool } from '@deepseek-ai/dsh-tools'
import { textOutput } from '../toolOutput.js'
import { OPTIONAL_BIRTH_PARAMS, chartFromArgs } from '../birth.js'

const TYPES = ['bazi', 'mangpai', 'ziwei', 'liuyao', 'qimen', 'huangli', 'tarot', 'name', 'fengshui', 'hehun', 'zejiri', 'consult']
const NEED_BIRTH = new Set(['bazi', 'mangpai', 'ziwei', 'hehun', 'zejiri', 'consult', 'name'])

export function makeReportTool(E) {
  return defineTool({
    name: 'report',
    description: '生成完整测算报告（Markdown，前端会渲染成报告卡片）。仅当用户明确要“报告/完整解读/详解”时调用；普通提问用对应排盘工具即可。type：bazi 子平八字、mangpai 盲派、ziwei 紫微、liuyao 六爻、qimen 奇门、huangli 黄历、tarot 塔罗、name 取名、fengshui 风水、hehun 合婚（需 partner）、zejiri 择日（purpose）、consult 多流派会诊。',
    parameters: {
      type: { type: 'string', required: true, enum: TYPES },
      ...OPTIONAL_BIRTH_PARAMS,
      partner: { type: 'object', additionalProperties: false, properties: { ...OPTIONAL_BIRTH_PARAMS }, description: '合婚对方出生信息' },
      question: { type: 'string', description: '六爻所问之事' },
      date: { type: 'string', description: 'YYYY-MM-DD（黄历/奇门/紫微流年）' },
      purpose: { type: 'string', description: '择日目的：marry/move/business 等' },
      fullName: { type: 'string' }, surname: { type: 'string' },
      door: { type: 'string' },
    },
    output: textOutput(),
    async execute(args) {
      if (!TYPES.includes(args.type)) throw new Error(`未知报告类型：${args.type}`)
      const hasBirth = args.year && args.month && args.day && args.gender
      if (NEED_BIRTH.has(args.type) && !hasBirth) throw new Error(`${args.type} 报告需要出生年月日时与性别`)
      const chart = hasBirth ? chartFromArgs(E, args) : null
      const extra = { question: args.question, date: args.date, purpose: args.purpose, fullName: args.fullName, surname: args.surname }
      if (args.type === 'hehun') {
        if (!args.partner || !args.partner.year) throw new Error('合婚需要 partner 出生信息')
        extra.partner = chartFromArgs(E, args.partner)
      }
      if (args.type === 'fengshui') extra.layout = { door: args.door }
      const rep = E.buildReport(args.type, chart, extra)
      if (!rep.ok) throw new Error(`报告生成失败：${rep.error}`)
      const body = (rep.sections && rep.sections.length) ? E.schemaToMarkdown(rep) : rep.markdown
      if (/^#\s/.test(body)) return body
      return `# ${rep.title || '测算报告'}\n\n${body}`
    },
  })
}
