import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const { default: AgentChatDsh, resolveAgentRoute, serializeAgentRoute, safeThinkStep, appendSafeThinkStep } = await import('../AgentChatDsh.jsx')

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

test('历史 MiniMax 缓存不会再自动覆盖默认 Flash', () => {
  // 若回退为直接读取 localStorage，老用户会继续走慢模型，首轮等待问题会复发。
  assert.equal(resolveAgentRoute('minimax', 'deepseek-flash'), 'deepseek-flash')
})

test('用户重新选择的深度模型会作为显式偏好保留', () => {
  // 新偏好必须可区分于旧字符串缓存，否则为了迁移旧缓存会误伤用户的手动选择。
  const saved = serializeAgentRoute('minimax')
  assert.equal(resolveAgentRoute(saved, 'deepseek-flash'), 'minimax')
})

test('已失效的显式模型偏好会回退到服务端当前可用的默认模型', () => {
  const saved = serializeAgentRoute('deepseek-flash')
  assert.equal(resolveAgentRoute(saved, 'minimax', ['minimax']), 'minimax')
})

test('安全思考步骤将工具事件转换成用户可读过程，而不泄漏内部调用细节', () => {
  assert.equal(safeThinkStep('start'), '正在理解你的问题…')
  assert.equal(safeThinkStep('reasoning'), '正在梳理问题要点…')
  assert.equal(safeThinkStep('tool_call', 'bazi'), '正在排出四柱与大运…')
  assert.equal(safeThinkStep('tool_result', 'bazi'), '四柱与大运已核对，正在组织解读…')
  assert.equal(safeThinkStep('tool_call', 'unknown-tool'), '正在查询所需信息…')
  assert.equal(safeThinkStep('tool_call', 'skill').includes('Skill'), false)
})

test('相同安全步骤只展示一次，新的阶段按顺序追加', () => {
  const started = { reasoning: safeThinkStep('start') }
  const duplicate = appendSafeThinkStep(started, safeThinkStep('start'))
  assert.equal(duplicate.reasoning, '正在理解你的问题…')
  const withTool = appendSafeThinkStep(duplicate, safeThinkStep('tool_call', 'bazi'))
  assert.equal(withTool.reasoning, '正在理解你的问题…\n正在排出四柱与大运…')
})

test('模型列表晚到时不会清空已恢复的历史会话', async () => {
  // 要防的回归：用户进入历史会话后，模型可用列表才返回；旧逻辑会因此抹掉
  // sessionId，下一次发送被服务端当成新话题，模型自然拿不到此前上下文。
  const originalFetch = globalThis.fetch
  let resolveModels
  globalThis.fetch = async url => {
    const path = String(url)
    if (path.endsWith('/api/agent/models')) {
      return new Promise(resolve => { resolveModels = () => resolve(json({ ok: true, routes: [{ key: 'minimax', label: 'MiniMax' }], default: 'minimax' })) })
    }
    if (path.endsWith('/api/agent/sessions/keep-context/messages')) {
      return json({
        ok: true,
        session: { id: 'keep-context', route: 'minimax', title: '继续聊昨天的事', consultation: null },
        messages: [
          { role: 'user', text: '昨天说过我的事业选择', time: Date.now() - 1000 },
          { role: 'ai', text: '我记住了你的两个备选方向。', time: Date.now() },
        ],
      })
    }
    throw new Error(`未预期的请求：${path}`)
  }

  const r = render(AgentChatDsh, {
    initialSessionId: 'keep-context', user: null,
    onRequireLogin() {}, onUpgrade() {}, onUserChange() {},
  })
  try {
    await flush()
    assert.ok(r.$('.current-session-chip'), '恢复会话后应显示当前会话标识')

    resolveModels()
    await flush()
    assert.ok(r.$('.current-session-chip'), '模型列表返回后仍须保留当前会话标识')
  } finally {
    r.unmount()
    globalThis.fetch = originalFetch
  }
})

test('重新进入 Agent 时会自动恢复最新的可继续会话', async () => {
  // 要防的回归：sessionId 只存在 React 内存，用户离开页面再回来若不手动点
  // “会话历史”，下一句会被当作新话题，Agent 自然无法接住昨天的上下文。
  const originalFetch = globalThis.fetch
  globalThis.fetch = async url => {
    const path = String(url)
    if (path.endsWith('/api/agent/models')) return json({ ok: true, routes: [{ key: 'minimax', label: 'MiniMax' }], default: 'minimax' })
    if (path.endsWith('/api/agent/sessions')) {
      return json({
        ok: true,
        sessions: [{
          id: 'resume-yesterday', route: 'minimax', title: '昨天的事业咨询', updatedAt: Date.now(),
          consultation: { kind: 'paid', totalRounds: 8, remainingRounds: 4, expiresAt: Date.now() + 60_000 },
        }],
      })
    }
    if (path.endsWith('/api/agent/sessions/resume-yesterday/messages')) {
      return json({
        ok: true,
        session: {
          id: 'resume-yesterday', route: 'minimax', title: '昨天的事业咨询',
          consultation: { kind: 'paid', totalRounds: 8, remainingRounds: 4, expiresAt: Date.now() + 60_000 },
        },
        messages: [
          { role: 'user', text: '昨天我在两个工作机会之间犹豫', time: Date.now() - 1_000 },
          { role: 'ai', text: '我记得，我们在比较稳定性与成长空间。', time: Date.now() },
        ],
      })
    }
    throw new Error(`未预期的请求：${path}`)
  }

  const r = render(AgentChatDsh, { user: null, onRequireLogin() {}, onUpgrade() {}, onUserChange() {} })
  try {
    await flush(5)
    assert.ok(r.$('.current-session-chip'), '应自动恢复最近的可继续会话')
    assert.match(r.text(), /我记得，我们在比较稳定性与成长空间。/)
  } finally {
    r.unmount()
    globalThis.fetch = originalFetch
  }
})

test('主题结束时保留原会话并提供续问入口', async () => {
  // 主题额度结束不等于历史失效。若此处清 sessionId，用户点“继续”就会被新会话
  // 接走，原本的排盘与对话上下文全断。
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url)
    if (path.endsWith('/api/agent/models')) return json({ ok: true, routes: [{ key: 'minimax', label: 'MiniMax' }], default: 'minimax' })
    if (path.endsWith('/api/agent/sessions/topic-ended/messages')) {
      return json({
        ok: true,
        session: {
          id: 'topic-ended', route: 'minimax', title: '昨天的事业咨询',
          consultation: { kind: 'paid', totalRounds: 8, remainingRounds: 0, expiresAt: Date.now() + 60_000 },
        },
        messages: [{ role: 'ai', text: '我记得昨天的事业咨询。', time: Date.now() }],
      })
    }
    if (path.endsWith('/api/agent/chat')) {
      assert.equal(JSON.parse(init.body).sessionId, 'topic-ended')
      return json({ ok: false, reason: 'topic_exhausted', msg: '这个咨询主题的 8 次具体问题解读已完成' }, 402)
    }
    throw new Error(`未预期的请求：${path}`)
  }

  const r = render(AgentChatDsh, {
    initialSessionId: 'topic-ended',
    user: { id: 'u-1', plan: 'free', permanentCredits: 20, monthlyCredits: 0 },
    onRequireLogin() {}, onUpgrade() {}, onUserChange() {},
  })
  try {
    await flush(4)
    r.type(r.$('.chat-input'), '继续问昨天的事业选择')
    r.click(r.$('.send-btn'))
    await flush(4)
    assert.ok(r.$('.current-session-chip'), '主题结束后仍应留在原会话')
    assert.ok(r.findByText('继续本话题'), '应让用户显式确认续问，而不是悄悄新开会话')
  } finally {
    r.unmount()
    globalThis.fetch = originalFetch
  }
})
