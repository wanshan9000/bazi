import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'

test('AI 对话分享入口只允许选择预置安全小结，不读取对话原文', async () => {
  const { default: AgentSummaryShare } = await import('../AgentSummaryShare.jsx')
  const r = render(AgentSummaryShare, { locale: 'zh-CN' })
  try {
    assert.match(r.text(), /不会包含对话原文、出生资料、地点或完整命盘/)
    assert.match(r.text(), /完成有效分享，获 24 永久积分/)
    r.click(r.findByText('选择后分享'))
    assert.match(r.text(), /选择一条可公开的小结/)
    assert.doesNotMatch(r.text(), /1992|测试用户|四柱/)
    r.click(r.$$('input[type="radio"]')[0])
    assert.ok(r.findByText('分享已选小结'))
  } finally {
    r.unmount()
  }
})
