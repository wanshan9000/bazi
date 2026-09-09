import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOL_FACTORIES } from '../plugins/lingshu-tools/index.js'

const E = await import('../plugins/lingshu-tools/dist/engines.mjs')
const exec = { signal: new AbortController().signal }
const tools = Object.fromEntries(TOOL_FACTORIES.map(f => { const t = f(E); return [t.name, t] }))
const birth = { year: 1990, month: 5, day: 6, hour: 8, gender: '男' }

test('注册了全部 10 个基础工具', () => {
  assert.deepEqual(Object.keys(tools).sort(), ['bazi', 'fengshui', 'huangli', 'liuyao', 'name', 'qimen', 'report', 'tarot', 'wuyunliuqi', 'ziwei'])
})

test('ziwei 返回十二宫', async () => {
  assert.match(await tools.ziwei.execute(birth, exec), /命宫/)
})
test('liuyao 起卦返回卦名', async () => {
  assert.match(await tools.liuyao.execute({ question: '这次跳槽如何' }, exec), /卦/)
})
test('qimen 排盘', async () => {
  assert.match(await tools.qimen.execute({ datetime: '2026-09-04 10:00' }, exec), /值符|九宫|八门/)
})
test('huangli 指定日期', async () => {
  assert.match(await tools.huangli.execute({ date: '2026-09-04' }, exec), /宜|忌/)
})
test('huangli 可切换幽默表达', async () => {
  assert.match(await tools.huangli.execute({ date: '2026-09-04', scenario: 'worker', tone: 'humorous' }, exec), /幽默参考/)
})
test('tarot 三张牌', async () => {
  assert.match(await tools.tarot.execute({ spread: 'three', question: '感情' }, exec), /正位|逆位/)
})
test('name 分析具体名字', async () => {
  assert.match(await tools.name.execute({ fullName: '王小明', ...birth }, exec), /五格/)
})
test('name 推荐名字', async () => {
  assert.match(await tools.name.execute({ surname: '王', ...birth }, exec), /推荐/)
})
test('fengshui 需要门向', async () => {
  const out = await tools.fengshui.execute({ door: '东', rooms: [{ name: '主卧', dir: '北' }], ...birth }, exec)
  assert.match(out, /风水布局分析/)
})
test('wuyunliuqi', async () => {
  assert.match(await tools.wuyunliuqi.execute(birth, exec), /中运|司天/)
})
