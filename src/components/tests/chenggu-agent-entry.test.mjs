import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const { default: ChengguPage } = await import('../ChengguPage.jsx')

test('称骨歌诀卡可将本次报告带入元气 Agent', async () => {
  let request = null
  const r = render(ChengguPage, {
    onBack: () => {},
    onAskAgent: value => { request = value },
  })

  const calculate = r.findByText('称骨论命')
  assert.ok(calculate, '应能生成称骨报告')
  r.click(calculate)
  await flush()

  const ask = r.findByText('咨询元气 AI')
  assert.ok(ask, `歌诀卡右侧应有咨询入口，实际：${r.text().slice(0, 300)}`)
  r.click(ask)

  assert.ok(request, '点击咨询入口必须交出报告上下文')
  assert.match(request.prompt, /称骨重量|骨重/, '咨询内容需包含称骨结果')
  assert.match(request.prompt, /歌诀/, '咨询内容需包含传统歌诀')
  assert.match(request.prompt, /八字/, '咨询内容需包含八字建议依据')
  r.unmount()
})

test('称骨歌诀卡在桌面端为歌诀与咨询入口的并列结构', async () => {
  const r = render(ChengguPage, { onBack: () => {}, onAskAgent: () => {} })
  r.click(r.findByText('称骨论命'))
  await flush()

  const layout = r.$('.cg-classic-layout')
  assert.ok(layout, '歌诀卡应有独立的桌面两列布局容器')
  assert.ok(layout.querySelector('.cg-source-verse'), '左侧必须保留歌诀原文')
  assert.ok(layout.querySelector('.cg-agent-btn'), '右侧必须保留咨询入口')
  r.unmount()
})
