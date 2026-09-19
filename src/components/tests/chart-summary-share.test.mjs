import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flush, render } from '../../test/render.mjs'

const { default: ChartSummaryShare } = await import('../ChartSummaryShare.jsx')

test('八字报告分享直接打开二维码弹窗，且不泄露命盘内容', async () => {
  const r = render(ChartSummaryShare)

  assert.ok(r.findByText('分享'), '八字报告应提供直接分享入口')
  r.click(r.findByText('分享'))
  await flush()
  assert.ok(document.body.querySelector('.report-share-dialog'), '分享应在页面根节点的统一弹窗中展开')
  assert.ok(document.body.querySelector('.report-share-qr img'), '分享弹窗应生成可扫码二维码')
  assert.match(document.body.textContent, /扫码分享八字入门/)
  assert.equal(document.body.querySelectorAll('.report-share-dialog input').length, 0, '分享不应要求选择命盘字段')
  assert.doesNotMatch(document.body.textContent, /日主|最旺五行|最弱五行|喜用五行/, '分享弹窗不应展示命盘摘要')
  r.unmount()
})
