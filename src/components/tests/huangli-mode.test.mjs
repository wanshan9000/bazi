import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'
import { buildChart } from '../../engine/bazi.js'

const { default: SubscribePage } = await import('../SubscribePage.jsx')

beforeEach(() => {
  localStorage.removeItem('genki-huangli-sub')
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ ok: true, reachable: false }),
    text: async () => '', headers: { get: () => null },
  })
})

test('黄历：未输入八字时先展示常规黄历，并可主动进入个性化生辰填写', async () => {
  const r = render(SubscribePage, { chart: null, onBack: () => {}, user: null, onRequireLogin: () => {} })
  await flush()

  assert.ok(r.text().includes('先从今天的传统信息开始'))
  assert.ok(r.text().includes('传统规则层'))
  assert.ok(r.text().includes('月令'))
  assert.ok(r.text().includes('建除值日'))
  assert.ok(!r.text().includes('用你的八字看每日安排'), '常规黄历不应强制填写生辰')

  r.click(r.findByText('输入生辰'))
  assert.ok(r.text().includes('用你的八字看每日安排'))
  assert.ok(r.text().includes('享受族（退休人士）'))
  r.unmount()
})

test('黄历场景：未主动选择身份时，新生辰应清除旧选择并按年龄与性别自动判断', async () => {
  const savedChart = buildChart(1988, 6, 15, 12, '男')
  localStorage.setItem('genki-huangli-sub', JSON.stringify({
    chart: savedChart,
    pref: { time: 'morning', notify: false, enabled: true, role: 'free', favZodiac: [] },
    subToken: ''
  }))
  const r = render(SubscribePage, { chart: null, onBack: () => {}, user: null, onRequireLogin: () => {} })
  await flush()

  r.click(r.findByText('更换生辰'))
  const selects = r.$$('select')
  assert.ok(selects.length >= 5)
  r.select(selects[2], '1960')
  r.click(r.findByText('查看我的今日参考'))
  await flush()

  assert.ok(r.text().includes('享受族（退休人士）'))
  assert.ok(!r.text().includes('自由族的今日安排'))
  r.unmount()
})

test('黄历生肖：按生辰自动标记本命生肖，同时支持额外多选关注', async () => {
  const chart = buildChart(1988, 6, 15, 12, '男')
  const r = render(SubscribePage, { chart, onBack: () => {}, user: null, onRequireLogin: () => {} })
  await flush()

  const mine = r.$(`[data-zodiac="${chart.shengxiao}"]`)
  assert.ok(mine?.classList.contains('mine'))
  assert.equal(mine?.getAttribute('aria-pressed'), 'true')

  const extraZodiac = chart.shengxiao === '鼠' ? '牛' : '鼠'
  const extra = r.$(`[data-zodiac="${extraZodiac}"]`)
  r.click(extra)
  assert.ok(extra?.classList.contains('active'))
  assert.ok(mine?.classList.contains('mine'))
  r.unmount()
})
