import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'
import { SEO_ROUTES } from '../../seo-pages.js'

test('中文五行术语页提供审慎定义、FAQ 与排盘入口', async () => {
  const { default: BaziTermPage } = await import('../BaziTermPage.jsx')
  let opened = 0
  const r = render(BaziTermPage, { page: SEO_ROUTES.fiveElementsMissing, onBack: () => {}, onStartCalculator: () => { opened += 1 } })
  try {
    assert.match(r.text(), /五行缺什么，是什么意思？/)
    assert.match(r.text(), /不等于现实中缺少某种东西/)
    assert.match(r.text(), /五行缺和五行弱一样吗？/)
    assert.match(r.text(), /三门先生/)
    assert.ok(r.$('a[href="/learn/bazi-basics"]'))
    r.click(r.findByText('核对我的八字盘'))
    assert.equal(opened, 1)
  } finally {
    r.unmount()
  }
})

test('英文 Day Master 术语页提供定义、FAQ 与排盘入口', async () => {
  const { default: BaziTermPage } = await import('../BaziTermPage.jsx')
  let opened = 0
  const r = render(BaziTermPage, { page: SEO_ROUTES.baziDayMaster, onBack: () => {}, onStartCalculator: () => { opened += 1 } })
  try {
    assert.match(r.text(), /What is a Day Master in BaZi?/) 
    assert.match(r.text(), /Heavenly Stem of the Day Pillar/)
    assert.match(r.text(), /Is the Day Master the same as the Day Pillar\?/) 
    assert.match(r.text(), /References and public texts/)
    assert.ok(r.$('a[href="/learn/bazi-four-pillars"]'))
    r.click(r.findByText('Check a BaZi chart'))
    assert.equal(opened, 1)
  } finally {
    r.unmount()
  }
})
