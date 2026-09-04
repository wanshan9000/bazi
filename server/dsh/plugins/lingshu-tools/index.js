// dsh 插件：把灵枢命理引擎注册为模型可调用的工具
import { pathToFileURL } from 'node:url'
import { makeBaziTool } from './tools/bazi.js'
import { makeZiweiTool } from './tools/ziwei.js'
import { makeLiuyaoTool } from './tools/liuyao.js'
import { makeQimenTool } from './tools/qimen.js'
import { makeHuangliTool, makeModernHuangliTool } from './tools/huangli.js'
import { makeTarotTool } from './tools/tarot.js'
import { makeNameTool } from './tools/name.js'
import { makeFengshuiTool } from './tools/fengshui.js'
import { makeWuyunliuqiTool } from './tools/wuyunliuqi.js'
import { makeReportTool } from './tools/report.js'

export const name = 'lingshu-tools'
export const inject = ['tools']

async function loadEngines() {
  const file = process.env.LINGSHU_ENGINES
  if (!file) throw new Error('lingshu-tools: 缺少 LINGSHU_ENGINES（engines.mjs 路径）')
  return import(pathToFileURL(file).href)
}

export const TOOL_FACTORIES = [
  makeBaziTool, makeZiweiTool, makeLiuyaoTool, makeQimenTool, makeHuangliTool, makeModernHuangliTool,
  makeTarotTool, makeNameTool, makeFengshuiTool, makeWuyunliuqiTool, makeReportTool,
]

export async function apply(ctx) {
  const E = await loadEngines()
  for (const make of TOOL_FACTORIES) {
    const tool = make(E)
    ctx.effect(() => ctx.tools.register(tool), `lingshu.${tool.name}`)
  }
  console.error('[lingshu-tools] 已注册工具：', ctx.tools.schemas().map(t => t.name).join(','))
}
