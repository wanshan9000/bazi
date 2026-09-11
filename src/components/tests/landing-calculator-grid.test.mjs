import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'

const { default: Landing } = await import('../Landing.jsx')

test('首页元氣测算直接完整展示所有卡片，不再提供分类筛选条', () => {
  const r = render(Landing, {
    onGate: () => {}, onAskAgent: () => {}, onArticle: () => {}, onSubscribe: () => {}, user: null,
  })

  assert.equal(r.$$('.yc-cat-row').length, 0, '不应保留首页测算分类筛选条')
  assert.equal(r.$$('.yc-card').length, 8, '所有测算应直接在首页完整展示')
  r.unmount()
})
