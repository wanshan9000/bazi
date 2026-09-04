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

test('OPTIONAL_BIRTH_PARAMS 与 BIRTH_PARAMS 同形但去掉 required', () => {
  assert.equal(OPTIONAL_BIRTH_PARAMS.year.required, undefined)
  assert.equal(BIRTH_PARAMS.year.required, true)
})
