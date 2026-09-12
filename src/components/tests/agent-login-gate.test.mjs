import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const { default: AgentChatDsh } = await import('../AgentChatDsh.jsx')

beforeEach(() => { localStorage.clear() })

test('元气 Agent 首页向游客明确展示赠送积分体验', async () => {
  let loginContext = null
  const r = render(AgentChatDsh, {
    user: null,
    onRequireLogin: context => { loginContext = context },
    onUpgrade: () => {},
    onUserChange: () => {},
  })
  assert.ok(r.text().includes('赠送体验积分 · 用完后订阅'), `游客额度没有清楚展示：${r.text().slice(0, 500)}`)
  assert.equal(loginContext, null)
  r.unmount()
})
