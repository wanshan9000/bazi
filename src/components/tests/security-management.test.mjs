import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'

const now = Date.now()
const snapshot = {
  overview: { blocked: 1, riskEvents24h: 1, autoBlocks24h: 1 },
  blocks: [{ fingerprint: 'a1b2c3d4e5f6a7b8', reason: '异常请求频繁', manual: false, expiresAt: now + 3600000 }],
  events: [
    { id: 'risk-current', type: 'risk', action: '登录', status: 429, reason: '触发频率限制', fingerprint: '1111111111111111', at: now - 60000 },
    { id: 'auto-current', type: 'auto_block', action: '注册', status: 403, reason: '注册持续异常，已自动保护', fingerprint: '2222222222222222', at: now - 120000 },
    { id: 'risk-old', type: 'risk', action: 'AI 对话', status: 429, reason: '过期风险事件', fingerprint: '3333333333333333', at: now - 25 * 3600000 },
  ],
}

test('安全风控：指标卡默认展示 24 小时风险事件，并可切换对应明细', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, data: snapshot }),
    text: async () => '',
    headers: { get: () => null },
  })
  const { default: SecurityManagement } = await import('../SecurityManagement.jsx')
  const r = render(SecurityManagement, { token: 'admin-token' })
  await flush()

  assert.ok(r.text().includes('24 小时风险事件明细'))
  assert.ok(r.text().includes('触发频率限制'))
  assert.ok(!r.text().includes('过期风险事件'), '24 小时风险事件不应展示过期记录')

  r.click(r.findByText('当前封禁'))
  assert.ok(r.text().includes('生效中的限制'))
  assert.ok(r.text().includes('异常请求频繁'))

  r.click(r.findByText('24 小时自动封禁'))
  assert.ok(r.text().includes('24 小时自动封禁明细'))
  assert.ok(r.text().includes('注册持续异常，已自动保护'))
  assert.ok(!r.text().includes('触发频率限制'), '自动封禁明细不应混入普通风险事件')
  r.unmount()
})
