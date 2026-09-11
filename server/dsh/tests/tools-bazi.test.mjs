import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeBaziTool } from '../plugins/lingshu-tools/tools/bazi.js'
import { BIRTH_PARAMS, OPTIONAL_BIRTH_PARAMS } from '../plugins/lingshu-tools/birth.js'

const E = await import('../plugins/lingshu-tools/dist/engines.mjs')
const exec = { signal: new AbortController().signal }

test('bazi 工具：公历输入返回四柱与大运', async () => {
  const tool = makeBaziTool(E)
  assert.equal(tool.name, 'bazi')
  const out = await tool.execute({ year: 1990, month: 5, day: 6, hour: 8, gender: '男' }, exec)
  assert.match(out, /庚午/)
  assert.match(out, /大运/)
  assert.match(out, /乾造 1990年5月6日 8时/)
})

test('bazi 工具：农历输入先转公历', async () => {
  const tool = makeBaziTool(E)
  const out = await tool.execute({ year: 1990, month: 4, day: 12, hour: 8, gender: '男', calendar: 'lunar' }, exec)
  assert.match(out, /1990年5月6日/)
})

test('bazi 工具：盲派流派附做功要点且不含子平术语段', async () => {
  const tool = makeBaziTool(E)
  const out = await tool.execute({ year: 1990, month: 5, day: 6, hour: 8, gender: '男', school: 'mangpai' }, exec)
  assert.match(out, /盲派/)
})

test('bazi 工具默认回传紧凑校盘事实，避免把整份原始盘面塞进模型上下文', async () => {
  const tool = makeBaziTool(E)
  const out = await tool.execute({ year: 1978, month: 2, day: 18, hour: 18, gender: '女', school: 'mangpai' }, exec)

  assert.match(out, /四柱：戊午 甲寅 辛亥 丁酉/)
  assert.match(out, /起运.*1982-11-15/)
  assert.match(out, /当前大运】己酉/)
  assert.match(out, /盲派做功要点/)
  assert.ok(out.length < 1400, `紧凑排盘不应超过 1400 字，实际 ${out.length}`)
  assert.doesNotMatch(out, /## 刑冲合会/, '原始 JSON 关系表只会放大模型上下文，不应默认返回')
})

test('OPTIONAL_BIRTH_PARAMS 与 BIRTH_PARAMS 同形但去掉 required', () => {
  assert.equal(OPTIONAL_BIRTH_PARAMS.year.required, undefined)
  assert.equal(BIRTH_PARAMS.year.required, true)
})
