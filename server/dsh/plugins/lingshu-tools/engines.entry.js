// Vite lib 入口：把浏览器侧引擎打成一份 Node 可 import 的 ESM bundle。
// 浏览器全局兜底：个别数据模块在函数内引用 localStorage，Node 下给一个内存实现。
// 注意：Node 20+ 内置了一个惰性 localStorage getter（需要 --localstorage-file 才可用），
// 光是 `typeof globalThis.localStorage` 这样的读取就会触发它并打印 ExperimentalWarning。
// 用 getOwnPropertyDescriptor 探测、defineProperty 覆盖，避免触发该 getter。
if (!Object.getOwnPropertyDescriptor(globalThis, 'localStorage')?.value) {
  const mem = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)) },
      removeItem: k => { mem.delete(k) },
      clear: () => mem.clear(),
    },
  })
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis

export { buildChart } from '../../../../src/engine/bazi.js'
export { buildBaziFull, generateHuangli } from '../../../../src/engine/cantian.js'
export { buildZiwei } from '../../../../src/engine/ziwei.js'
export { buildLiuyaoPan } from '../../../../src/engine/liuyao.js'
export { buildQimenFull } from '../../../../src/engine/qimen.js'
export { buildDaily } from '../../../../src/engine/huangli.js'
export { drawCards, interpret as interpretTarot } from '../../../../src/data/tarot.js'
export { analyzeName, recommendName } from '../../../../src/engine/nameAnalysis.js'
export { analyzeFengshui } from '../../../../src/engine/fengshui.js'
export { buildWuyunliuqi } from '../../../../src/engine/wuyunliuqi.js'
export { generateChenggu } from '../../../../src/engine/chenggu.js'
export { buildReport } from '../../../../src/engine/reports.js'
export { schemaToMarkdown } from '../../../../src/engine/reportSchema.js'
export { buildMangpaiContext } from '../../../../src/engine/mangpaiContext.js'
export { lunarToSolar } from '../../../../src/utils/lunar.js'
export { BUILTIN_SKILLS } from '../../../../src/data/skills.js'
