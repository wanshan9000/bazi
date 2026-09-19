import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'
import { buildChart } from '../../engine/bazi.js'

test('报告咨询保留完整请求上下文，但聊天首屏只展示咨询意图', async () => {
  const { normalizeAgentSeed } = await import('../AgentChatDsh.jsx')
  const fullReportContext = '报告咨询：子平派\n\n当前报告摘要：\n' + '完整报告内容。'.repeat(300)
  const result = normalizeAgentSeed({ text: fullReportContext, displayText: '想咨询这份子平报告' })

  assert.equal(result.requestText, fullReportContext, '发送给服务端的报告上下文不能丢失')
  assert.equal(result.displayText, '想咨询这份子平报告', '用户气泡不应渲染完整报告')
})

test('普通快捷提问仍使用原文作为请求和展示内容', async () => {
  const { normalizeAgentSeed } = await import('../AgentChatDsh.jsx')
  assert.deepEqual(normalizeAgentSeed('今年事业如何'), {
    requestText: '今年事业如何',
    displayText: '今年事业如何',
  })
})

test('子平报告咨询入口提供简洁首屏文案，同时保留完整报告上下文', async () => {
  const { default: BaziPage } = await import('../BaziPage.jsx')
  let request = null
  const r = render(BaziPage, {
    chart: buildChart(1998, 8, 12, 10, '女'),
    user: null,
    onBack: () => {},
    onChart: () => {},
    onRequireLogin: () => {},
    onUpgrade: () => {},
    onUserChange: () => {},
    onAskAgent: value => { request = value },
  })

  try {
    r.click(r.findByText('子平命书'))
    r.click(r.findByText('问元气 AI'))
    assert.equal(request.displayText, '想咨询这份子平报告')
    assert.match(request.prompt, /^报告咨询：子平派/m)
    assert.match(request.prompt, /当前报告摘要/)
  } finally {
    r.unmount()
  }
})
