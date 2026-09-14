import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const { ThinkBlock, ToolCallsBlock, isNearScrollBottom, renderAiText } = await import('../agent/ChatParts.jsx')

function AiTextFixture({ text, streaming = false, suppressThinkBlocks = false }) {
  return renderAiText(text, streaming, { suppressThinkBlocks })
}

test('聊天自动跟随只在用户停留在底部时启用', () => {
  assert.equal(isNearScrollBottom({ scrollHeight: 1200, scrollTop: 700, clientHeight: 480 }), true)
  assert.equal(isNearScrollBottom({ scrollHeight: 1200, scrollTop: 500, clientHeight: 480 }), false)
})

test('解读过程按阶段列表展示，而不是一段空白说明', () => {
  const r = render(ThinkBlock, {
    content: '已接收咨询，正在确认解读主题…\n正在核对已知资料与命盘信息…',
    streaming: true,
  })
  try {
    assert.equal(r.container.querySelectorAll('.think-steps li').length, 2)
    assert.ok(r.text().includes('1'))
    assert.ok(r.text().includes('2'))
    assert.ok(r.$('.think-steps li.is-current'), '流式状态应标记当前正在进行的步骤')
  } finally {
    r.unmount()
  }
})

test('解读进度完成后自动收起，用户仍可手动展开', async () => {
  const r = render(ThinkBlock, { content: '正在推演命盘关系', streaming: true })
  assert.ok(r.$('.think-body'), '流式解读进度应默认展开')
  assert.ok(r.text().includes('解读中'), '流式状态应显示解读耗时')

  r.rerender({ content: '已完成命盘推演', streaming: false })
  await flush()
  assert.equal(r.$('.think-body'), null, '思考完成后应自动收起，让结论优先呈现')
  assert.ok(r.text().includes('解读完成'), '完成后应显示解读耗时')

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

test('工具调用在正文生成期间明确显示仍在处理，结束后才标记完成', async () => {
  const r = render(ToolCallsBlock, {
    tools: [{ name: 'bazi', status: 'pending' }, { name: 'report', status: 'pending' }],
    streaming: true,
    heartbeat: { stage: 'tool', at: Date.now() },
  })
  try {
    assert.ok(r.$('.tool-streaming'), '流式期间工具条应使用进行中状态')
    assert.ok(r.text().includes('正在核验 2 / 2 项资料'))
    assert.ok(r.text().includes('连接正常'))
    assert.equal(r.$('.tool-status').getAttribute('aria-label'), '仍在生成回复')

    r.rerender({ tools: [{ name: 'bazi', status: 'complete' }, { name: 'report', status: 'complete' }], streaming: false })
    await flush()
    assert.equal(r.$('.tool-streaming'), null, '结束后才退出进行中状态')
    assert.ok(r.text().includes('已调用 2 个工具'))
    r.click(r.$('.tool-toggle'))
    assert.equal(r.container.querySelectorAll('.tool-item-state.is-complete').length, 2)
    assert.equal(r.$('.tool-status').getAttribute('aria-label'), '调用完成')

    r.rerender({ tools: [{ name: 'bazi', status: 'failed' }], streaming: true, heartbeat: { stage: 'synthesis', at: Date.now() } })
    assert.ok(r.text().includes('有 1 项资料未完成核验'), '失败工具不应被概括为已核验')
    assert.equal(r.container.querySelectorAll('.tool-item-state.is-failed').length, 1)
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

test('同一轮中分段的模型 think 只显示一条解读过程', () => {
  const r = render(AiTextFixture, {
    text: '<think>第一段内部过程</think>\n结论正在整理。\n<think>第二段内部过程</think>',
  })

  assert.equal(r.container.querySelectorAll('.think-block').length, 1)
  assert.ok(r.text().includes('结论正在整理'))
  r.unmount()
})

test('实时阶段进度存在时隐藏模型原始 think 的重复条', () => {
  const r = render(AiTextFixture, {
    text: '<think>模型内部过程</think>\n这是正在流式输出的正文。',
    streaming: true,
    suppressThinkBlocks: true,
  })

  assert.equal(r.container.querySelectorAll('.think-block').length, 0)
  assert.ok(r.text().includes('这是正在流式输出的正文'))
  r.unmount()
})

test('盲派与子平报告在聊天气泡中使用统一文本版式，不再套命书卡片', () => {
  const r = render(AiTextFixture, {
    text: '## 盘面核对\n- **四柱**：甲子 · 丙寅 · 辛酉 · 戊戌\n\n## 格局法\n- **月令**：先看藏干透出与救应。',
  })
  assert.equal(r.container.querySelectorAll('section.agent-report-section').length, 0)
  assert.deepEqual(Array.from(r.container.querySelectorAll('.md-h')).map(el => el.textContent), ['盘面核对', '格局法'])
  r.unmount()
})

test('新版独占加粗短标题保留信息组层级，字段强调不误作标题', () => {
  const r = render(AiTextFixture, {
    text: '**整体判断**\n- 当前以稳住节奏为先。\n- **关键依据**：日主得根，先看执行与积累。\n\n**行动建议**\n- 本周先完成一件可交付的小事。',
  })
  try {
    assert.deepEqual(
      Array.from(r.container.querySelectorAll('.md-h')).map(el => el.textContent),
      ['整体判断', '行动建议'],
    )
    assert.equal(r.container.querySelectorAll('.md-list').length, 2)
    assert.equal(r.container.querySelector('.md-list strong').textContent, '关键依据')
  } finally {
    r.unmount()
  }
})

test('模型残留的分隔符与 Markdown 标题不会泄漏到聊天正文', () => {
  const r = render(AiTextFixture, { text: '---## 子平派分析\n- **月令**：戌月本气为戊土。' })
  try {
    assert.deepEqual(Array.from(r.container.querySelectorAll('.md-h')).map(el => el.textContent), ['子平派分析'])
    assert.equal(r.text().includes('---##'), false)
  } finally {
    r.unmount()
  }
})

test('网关压缩换行后仍恢复截图式的标题与条目排版', () => {
  const r = render(AiTextFixture, {
    text: '**盘面核对·出生口径：公历1975年10月13日6:30（卯时）·男**-**四柱**：乙卯丙戌壬辰癸卯-**日主**：壬水；生肖兔**盲派先看三处**-**原局地支**：卯、戌、辰、卯。**接下来怎么走**-若问近期，宜先守成。-建议：把重要的事用合作落地。',
  })
  try {
    assert.deepEqual(
      Array.from(r.container.querySelectorAll('.md-h')).map(el => el.textContent),
      ['盲派先看三处', '接下来怎么走'],
    )
    assert.equal(r.container.querySelectorAll('.md-list').length, 3)
    assert.equal(r.container.querySelector('.md-p').textContent, '盘面核对·出生口径：公历1975年10月13日6:30（卯时）·男')
    assert.equal(r.text().includes('男-四柱'), false, '压缩的条目不能继续与标题粘连')
  } finally {
    r.unmount()
  }
})
