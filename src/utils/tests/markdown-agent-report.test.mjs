import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../../test/render.mjs'

const { renderMarkdown } = await import('../markdown.jsx')

function ReportMarkdown({ text }) {
  return renderMarkdown(text, { variant: 'agent-report' })
}

test('命书模式把二级章节连同紧随条目渲染成精致信息卡', () => {
  // 若退回普通 Markdown 标题+列表，长命书会重新成为一整段难扫读的正文。
  const r = render(ReportMarkdown, {
    text: '## 盘面核对\n- **四柱**：甲子 · 丙寅 · 辛酉 · 戊戌\n- **当前大运**：庚午\n\n## 做功主线\n- 木火相引，先看行动与资源衔接。',
  })
  assert.equal(r.$$('.agent-report-section').length, 2)
  assert.deepEqual(r.$$('.agent-report-section-title').map(el => el.textContent), ['盘面核对', '做功主线'])
  assert.equal(r.$$('.agent-report-section .md-list').length, 2)
  r.unmount()
})
