import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const { ThinkBlock, isNearScrollBottom, renderAiText } = await import('../agent/ChatParts.jsx')

function AiTextFixture({ text, streaming = false }) {
  return renderAiText(text, streaming)
}

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

test('正文开始流式出现时，思考条立即收起但仍可手动展开', async () => {
  // 若移除“正文出现即收起”的联动，长思考块会继续挤占首屏，遮住实时答案。
  const r = render(ThinkBlock, { content: '正在核对命盘', streaming: true, collapseWhenStreamingText: false })
  try {
    assert.ok(r.$('.think-body'), '正文尚未出现时，思考条可展示进行状态')

    r.rerender({ content: '正在核对命盘', streaming: true, collapseWhenStreamingText: true })
    assert.ok(!r.$('.think-body'), '正文开始流式出现后，思考条应立即收起')

    r.click(r.$('.think-toggle'))
    assert.ok(r.$('.think-body'), '用户仍可主动展开查看思考状态')
  } finally {
    r.unmount()
  }
})

test('正文流中未闭合或转义的 think 也统一渲染为折叠思考条', () => {
  const raw = '<think>称骨与四柱的推演过程'
  const r = render(AiTextFixture, { text: raw })
  assert.ok(r.$('.think-block'), '未闭合 think 应进入标准思考块')
  assert.equal(r.text().includes('<think>'), false, '标签不应泄漏到正文')
  r.unmount()

  const encoded = '&lt;think&gt;被转义的推演过程'
  const r2 = render(AiTextFixture, { text: encoded })
  assert.ok(r2.$('.think-block'), '转义 think 也应进入标准思考块')
  assert.equal(r2.text().includes('<think>'), false, '转义标签不应泄漏到正文')
  r2.unmount()
})

test('历史会话中的粘连标题与表格分离为可读区块', () => {
  // 这份夹具来自已出现过的模型输出形状：标题漏了空格，下一节又把标题和表头写在同一行。
  // 如果 Markdown 解析回退为普通段落或把标题塞进 th，页面就会重新出现截图里的“##”和竖排表格。
  const text = `##盘面核对\n\n| 项目 | 内容 |\n|:---|:---|\n| 四柱 | 戊午 · 甲寅 · 辛亥 · 丁酉 |\n\n## 二、日主强弱 | 项目 | 状态 | 说明 |\n|:---|:---|:---|:---|\n| 得令 | 不得令 | 辛金生寅月 || **得地** | 略有根 | 时支酉金本气根 |`
  const r = render(AiTextFixture, { text })

  assert.deepEqual(
    Array.from(r.container.querySelectorAll('.md-h, .agent-report-section-title')).map(el => el.textContent),
    ['盘面核对', '二、日主强弱'],
    '两种异常标题都应恢复为独立标题',
  )
  assert.equal(r.container.querySelectorAll('table').length, 2, '两段表格仍应保留为可读表格')
  assert.deepEqual(
    Array.from(r.container.querySelectorAll('table')[1].querySelectorAll('th')).map(el => el.textContent),
    ['项目', '状态', '说明'],
    '粘连的章节标题不应成为表格第一列',
  )
  assert.equal(r.container.querySelectorAll('table')[1].querySelectorAll('tbody tr').length, 2, '被连写的两行数据应恢复为两条记录')
  r.unmount()
})

test('历史会话中的内部执行思路只显示统一思考条', () => {
  const r = render(AiTextFixture, {
    text: '<think>我需要先加载 mangpai Skill，再调用 bazi 工具，之后生成完整报告。</think>\n\n## 盘面核对\n- 四柱：戊午 · 甲寅 · 辛亥 · 丁酉',
  })

  r.click(r.$('.think-toggle'))
  assert.equal(r.text().includes('加载 mangpai Skill'), false, '历史里的内部执行细节不应在展开后泄漏')
  assert.ok(r.text().includes('已完成命盘与要点核对'), '思考条应提供面向用户的统一状态')
  assert.ok(r.text().includes('盘面核对'), '正文结论仍应完整保留')
  r.unmount()
})

test('盲派与子平报告在聊天气泡中使用命书卡片，而不影响普通对话', () => {
  // 若标题识别正则失效，报告仍会退回普通标题+列表，用户会重新面对一整堵长正文。
  const r = render(AiTextFixture, {
    text: '## 盘面核对\n- **四柱**：甲子 · 丙寅 · 辛酉 · 戊戌\n\n## 格局法\n- **月令**：先看藏干透出与救应。',
  })
  assert.equal(r.container.querySelectorAll('section.agent-report-section').length, 2)
  r.unmount()
})
