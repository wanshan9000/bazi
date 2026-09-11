import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'

const { default: Landing } = await import('../Landing.jsx')

test('首页热门测试提供感情、财源、爱情塔罗和风水的真实入口', () => {
  const opened = []
  const asked = []
  const r = render(Landing, {
    onGate: view => opened.push(view),
    onAskAgent: query => asked.push(query),
    onArticle: () => {}, onSubscribe: () => {}, user: null,
  })

  const cards = r.$$('.popular-test-card')
  assert.equal(cards.length, 4, '首页应展示四张高频测试卡')

  const card = title => cards.find(node => node.textContent.includes(title))
  for (const title of ['感情测试', '财源测试', '爱情塔罗', '书桌风水']) {
    assert.ok(card(title), `缺少「${title}」入口`)
  }

  r.click(card('感情测试'))
  assert.match(asked.at(-1), /感情.*桃花/)
  r.click(card('财源测试'))
  assert.match(asked.at(-1), /财运.*赚钱/)
  r.click(card('爱情塔罗'))
  assert.equal(opened.at(-1), 'tarot')
  r.click(card('书桌风水'))
  assert.equal(opened.at(-1), 'fengshui')
  r.unmount()
})
