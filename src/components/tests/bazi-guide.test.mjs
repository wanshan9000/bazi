import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'

test('英文 BaZi 指南展示术语、FAQ 与真实排盘入口', async () => {
  const { default: BaziGuidePage } = await import('../BaziGuidePage.jsx')
  let opened = 0
  const r = render(BaziGuidePage, { onBack: () => {}, onStartCalculator: () => { opened += 1 } })
  try {
    assert.ok(r.text().includes('What is BaZi?'))
    assert.ok(r.text().includes('Day Master'))
    assert.ok(r.text().includes('Can a BaZi chart predict my future?'))
    assert.ok(r.text().includes('三门先生'))
    assert.ok(r.text().includes('References and public texts'))
    assert.equal(r.$('.bazi-guide'), r.container.firstElementChild)
    r.click(r.findByText('Open the BaZi calculator'))
    assert.equal(opened, 1)
    assert.match(r.text(), /Create a free chart/)
    assert.match(r.text(), /Ask Genki AI with your chart/)
  } finally {
    r.unmount()
  }
})
