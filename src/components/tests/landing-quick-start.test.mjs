import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'

const { default: Landing } = await import('../Landing.jsx')

test('首页快捷入口包含择吉、座位风水与紫微，并前往对应页面', () => {
  const opened = []
  const r = render(Landing, {
    onGate: view => opened.push(view), onAskAgent: () => {}, onArticle: () => {}, onSubscribe: () => {}, user: null,
  })
  const buttons = r.$$('.hero-cta button')
  const byLabel = label => buttons.find(button => button.textContent.trim() === label)

  for (const [label, route] of [['择吉', 'huangli'], ['座位风水', 'fengshui'], ['紫微', 'ziwei']]) {
    const button = byLabel(label)
    assert.ok(button, `缺少「${label}」快捷入口`)
    r.click(button)
    assert.equal(opened.at(-1), route)
  }
  r.unmount()
})
