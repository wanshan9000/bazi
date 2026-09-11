import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const { default: AgentChatDsh } = await import('../AgentChatDsh.jsx')

beforeEach(() => { localStorage.clear() })

test('元气 Agent 首页向客者明确展示十次具体问题解读体验', async () => {
  let loginContext = null
  const r = render(AgentChatDsh, {
    user: null,
    onRequireLogin: context => { loginContext = context },
    onUpgrade: () => {},
    onUserChange: () => {},
  })
  assert.ok(r.text().includes('客者免费体验 10 次具体问题解读'), `客者额度没有清楚展示：${r.text().slice(0, 500)}`)
  assert.equal(loginContext, null)
  r.unmount()
})
