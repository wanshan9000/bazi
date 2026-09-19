import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const { default: AgentChatDsh, agentEntitlement } = await import('../AgentChatDsh.jsx')

beforeEach(() => { localStorage.clear() })

test('元气 Agent 首页向游客明确展示赠送积分体验', async () => {
  let loginContext = null
  const r = render(AgentChatDsh, {
    user: null,
    onRequireLogin: context => { loginContext = context },
    onUpgrade: () => {},
    onUserChange: () => {},
  })
  assert.ok(r.text().includes('游客每 30 天赠 ¥5 等值积分'), `游客额度没有清楚展示：${r.text().slice(0, 500)}`)
  assert.ok(r.text().includes('游者'), '游客应显示游者身份')
  assert.ok(r.text().includes('注册后完成有效分享，获 24 永久积分'), 'Agent 首页应提示游客注册后可获得分享积分')
  assert.equal(r.container.querySelector('.agent-entitlement'), null, '权益不应作为聊天区上方的独立信息条展示')
  assert.ok(r.container.querySelector('.chat-scroll .agent-welcome-entitlement'), '权益应作为三门先生的欢迎消息展示')
  assert.equal(loginContext, null)
  r.unmount()
})

test('低积分用户会在 Agent 对话前收到补充提醒', () => {
  const notice = agentEntitlement({ plan: 'earth', monthlyCreditsUsed: 55, permanentCredits: 0 }, 'zh-CN')
  assert.equal(notice.tier, '凡者')
  assert.equal(notice.low, true)
  assert.match(notice.lowText, /可用积分仅剩 5/)
})
