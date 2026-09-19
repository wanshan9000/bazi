import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'

test('中文八字入门页展示术语、FAQ 与真实排盘入口', async () => {
  const { default: BaziBasicsPage } = await import('../BaziBasicsPage.jsx')
  let opened = 0
  let agentOpened = 0
  const r = render(BaziBasicsPage, { onBack: () => {}, onStartCalculator: () => { opened += 1 }, onOpenAgent: () => { agentOpened += 1 } })
  try {
    assert.ok(r.text().includes('八字是什么？'))
    assert.ok(r.text().includes('天干地支'))
    assert.ok(r.text().includes('八字可以准确预测未来吗？'))
    assert.ok(r.text().includes('三门先生'))
    assert.ok(r.text().includes('《滴天髓》'))
    r.click(r.findByText('开始八字排盘'))
    assert.equal(opened, 1)
    r.click(r.findByText('咨询元氣 Agent'))
    assert.equal(agentOpened, 1)
  } finally {
    r.unmount()
  }
})
