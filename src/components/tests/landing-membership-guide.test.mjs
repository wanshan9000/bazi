import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'

const { default: Landing } = await import('../Landing.jsx')

test('首页会员区展示游者与三档会员', () => {
  const r = render(Landing, {
    onGate: () => {}, onAskAgent: () => {}, onArticle: () => {}, onSubscribe: () => {}, user: null,
  })

  const cards = r.$$('.plan-card')
  assert.equal(cards.length, 4)
  assert.equal(r.$$('.plan-context').length, 0, '卡片顶部不应再显示详细说明区')
  assert.match(cards[0].textContent, /游者/)
  assert.match(cards[0].textContent, /免费体验/)
  assert.match(cards[0].textContent, /每项每天最多 20 次/)
  assert.match(cards[0].textContent, /每 30 天含 24 积分体验额度/)
  assert.match(cards[1].textContent, /凡者/)
  assert.match(cards[1].textContent, /每月 60 月度积分/)
  assert.match(cards[1].textContent, /可订阅个性黄历和使用全部功能/)
  assert.match(cards[2].textContent, /玄者/)
  assert.match(cards[2].textContent, /每月 200 月度积分/)
  assert.match(cards[2].textContent, /可订阅个性黄历和使用全部功能/)
  assert.match(cards[3].textContent, /天者/)
  assert.match(cards[3].textContent, /每月 520 月度积分/)
  assert.match(cards[3].textContent, /可订阅个性黄历和使用全部功能/)
  assert.equal(r.$$('.plan-en').length, 0, '首页会员卡不展示英文副标题')
  assert.equal(cards[0].querySelectorAll('.plan-perks li').length, 2, '游者只保留两条体验权益')
  assert.equal(cards[1].querySelectorAll('.plan-perks li').length, 2, '付费档展示积分与功能订阅权益')
  assert.equal(cards[2].querySelectorAll('.plan-perks li').length, 2, '付费档展示积分与功能订阅权益')
  assert.equal(cards[3].querySelectorAll('.plan-perks li').length, 2, '付费档展示积分与功能订阅权益')
  assert.equal(r.$$('.plan-desc').length, 0, '首页会员卡不展示重复的适用场景说明')
  assert.equal(r.$('.plans-credit-note'), null, '积分换算注记不应作为独立模块展示')
  r.unmount()
})
