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

test('解读进度将工具事件转换成用户可读阶段，而不泄漏内部调用细节', () => {
  assert.match(safeThinkStep('start'), /识别本次解读主题/)
  assert.match(safeThinkStep('session_ready'), /建立本次咨询会话/)
  assert.match(safeThinkStep('context_ready'), /上下文与可用资料/)
  assert.match(safeThinkStep('engine_requested'), /提交给解读引擎/)
  assert.match(safeThinkStep('reasoning'), /梳理命盘关系与问题重点/)
  assert.match(safeThinkStep('reasoning'), /交叉核验信息之间的关联/)
  assert.match(safeThinkStep('tool_call', 'bazi'), /请求八字排盘计算/)
  assert.match(safeThinkStep('tool_call', 'bazi'), /起运方向/)
  assert.match(safeThinkStep('tool_result', 'bazi'), /四柱与大运计算已返回/)
  assert.match(safeThinkStep('tool_result', 'bazi'), /校验排盘结果/)
  assert.match(safeThinkStep('answering'), /正在整理核心判断/)
  assert.match(safeThinkStep('answering'), /清晰、可执行的建议/)
  assert.match(safeThinkStep('completed'), /本轮实时输出已结束/)
  assert.match(safeThinkStep('tool_call', 'unknown-tool'), /正在查询所需信息/)
  assert.equal(safeThinkStep('tool_call', 'skill').includes('Skill'), false)
})

test('相同解读进度只展示一次，新的阶段按顺序追加', () => {
  const started = { reasoning: safeThinkStep('start') }
  const duplicate = appendSafeThinkStep(started, safeThinkStep('start'))
  assert.equal(duplicate.reasoning, safeThinkStep('start'))
  const withTool = appendSafeThinkStep(duplicate, safeThinkStep('tool_call', 'bazi'))
  assert.equal(withTool.reasoning, `${safeThinkStep('start')}\n${safeThinkStep('tool_call', 'bazi')}`)
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

test('历史会话不再受主题轮次状态限制', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url)
    if (path.endsWith('/api/agent/models')) return json({ ok: true, routes: [{ key: 'minimax', label: 'MiniMax' }], default: 'minimax' })
    if (path.endsWith('/api/agent/sessions/topic-ended/messages')) {
      return json({
        ok: true,
        session: {
          id: 'topic-ended', route: 'minimax', title: '昨天的事业咨询',
        },
        messages: [{ role: 'ai', text: '我记得昨天的事业咨询。', time: Date.now() }],
      })
    }
    if (path.endsWith('/api/agent/chat')) {
      assert.equal(JSON.parse(init.body).sessionId, 'topic-ended')
      return json({ ok: false, reason: 'insufficient', msg: 'Token 积分已用完' }, 402)
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
    assert.ok(r.$('.current-session-chip'), 'Token 不足时仍应保留原会话')
    assert.equal(r.findByText('继续本话题'), null, '不应再出现按主题续问入口')
  } finally {
    r.unmount()
    globalThis.fetch = originalFetch
  }
})
