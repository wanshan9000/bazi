import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const { ThinkBlock, isNearScrollBottom } = await import('../agent/ChatParts.jsx')

test('聊天自动跟随只在用户停留在底部时启用', () => {
  assert.equal(isNearScrollBottom({ scrollHeight: 1200, scrollTop: 700, clientHeight: 480 }), true)
  assert.equal(isNearScrollBottom({ scrollHeight: 1200, scrollTop: 500, clientHeight: 480 }), false)
})

test('深度思考完成后自动收起，用户仍可手动展开', async () => {
  const r = render(ThinkBlock, { content: '正在推演命盘关系', streaming: true })
  assert.ok(r.$('.think-body'), '流式思考应默认展开')
  assert.ok(r.text().includes('思考中'), '流式状态应显示思考耗时')

  r.rerender({ content: '已完成命盘推演', streaming: false })
  await flush()
  assert.equal(r.$('.think-body'), null, '思考完成后应自动收起，让结论优先呈现')
  assert.ok(r.text().includes('已思考'), '完成后应显示思考耗时')

  r.click(r.$('.think-toggle'))
  assert.ok(r.$('.think-body'), '用户点击后仍可手动展开')
  r.unmount()
})
