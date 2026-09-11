import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'
import { buildChart } from '../../engine/bazi.js'

test('报告页尾操作提供咨询元气 AI 与回到首页', async () => {
  const { default: ReportAgentFooter } = await import('../ReportAgentFooter.jsx')
  let asked = 0
  let returned = 0
  const r = render(ReportAgentFooter, {
    onAskAgent: () => { asked++ },
    onBack: () => { returned++ },
  })

  assert.ok(r.$('.report-agent-footer-zone'), '操作条应放在报告主体结束后的独立留白区')
  assert.ok(r.$('.report-agent-footer'), '报告页操作应保留在报告尾部')
  assert.equal(r.$('.report-agent-footer-zone .report-agent-footer').parentElement.className, 'report-agent-footer-zone')
  assert.equal(r.$('.report-agent-float'), null, '报告页操作不应固定悬浮在屏幕上')
  const ask = r.findByText('咨询元气 AI')
  const back = r.findByText('回到首页')
  assert.ok(ask, '页尾应提供元气 AI 咨询入口')
  assert.ok(back, '页尾应提供回到首页入口')
  r.click(ask)
  r.click(back)
  assert.equal(asked, 1)
  assert.equal(returned, 1)
  r.unmount()
})

test('报告咨询上下文会保留报告身份、已知事实与当前报告摘要', async () => {
  const { buildReportAgentPrompt } = await import('../ReportAgentFooter.jsx')
  const prompt = buildReportAgentPrompt({
    reportName: '奇门遁甲',
    facts: ['起局：丙午日午时', '所问：是否适合推进合作'],
    report: { markdown: '# 奇门报告\n\n### 用事总断\n宜先沟通后行动。' },
  })

  assert.match(prompt, /奇门遁甲报告/)
  assert.match(prompt, /起局：丙午日午时/)
  assert.match(prompt, /宜先沟通后行动/)
})

test('长报告咨询上下文会带上来源标签，并压缩到 Agent 可接收的长度', async () => {
  const { buildReportAgentPrompt, REPORT_AGENT_PROMPT_LIMIT } = await import('../ReportAgentFooter.jsx')
  const prompt = buildReportAgentPrompt({
    reportName: '奇门遁甲',
    facts: ['起局：丙午日午时', '所问：是否适合推进合作'],
    report: { markdown: `# 奇门报告\n\n${'前文判断。'.repeat(360)}\n\n最终结论：宜先沟通后行动。` },
  })

  assert.ok(prompt.startsWith('报告咨询：奇门遁甲'), `缺少报告来源标签：${prompt.slice(0, 60)}`)
  assert.ok(prompt.length <= REPORT_AGENT_PROMPT_LIMIT, `上下文过长：${prompt.length}`)
  assert.match(prompt, /前文判断/)
  assert.match(prompt, /最终结论：宜先沟通后行动/)
})

test('黄历结果页复用统一的报告页尾双按钮', async () => {
  const { default: SubscribePage } = await import('../SubscribePage.jsx')
  const r = render(SubscribePage, {
    chart: buildChart(1998, 8, 12, 10, '女'),
    user: null,
    onBack: () => {},
    onRequireLogin: () => {},
    onUpgrade: () => {},
    onAskAgent: () => {},
  })

  assert.ok(r.$('.report-agent-footer'), '黄历结果页也应使用统一报告页尾')
  assert.equal(r.$('.hl-report-actions'), null, '不应保留独立的黄历页尾按钮样式')
  r.unmount()
})
