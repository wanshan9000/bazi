// api 客户端的回归测试。
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { api } = await import('../client.js')

function stub(status, body) {
  globalThis.fetch = async () => ({
    ok: status < 400,
    status,
    json: async () => body,
    headers: { get: () => null },
  })
}

// /api/health 在「元气 AI 不可用」时返回 503，那是给部署和监控的信号。
// 把它当成「整个后端挂了」的话，没配 AI 密钥时订阅页与注册页会一律显示服务不可用，
// 尽管短信和微信通道好好的。
test('health：AI 不可用（503）时仍算服务器可达', async () => {
  stub(503, { ok: false, sms: 'configured', wechat: 'configured', agent: 'unavailable' })
  const h = await api.health()
  assert.equal(h.reachable, true, '服务器答了话就算可达')
  assert.equal(h.ok, false, 'ok 仍如实反映 AI 通道未就绪')
  assert.equal(h.sms, 'configured', '各通道状态必须原样带出，订阅页要靠它判断')
})

test('health：一切正常时 ok 与 reachable 都为真', async () => {
  stub(200, { ok: true, sms: 'configured', wechat: 'local(mock)', agent: 'ready' })
  const h = await api.health()
  assert.equal(h.ok, true)
  assert.equal(h.reachable, true)
  assert.equal(h.wechat, 'local(mock)')
})

test('health：网络不通才算不可达', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  const h = await api.health()
  assert.equal(h.reachable, false)
  assert.equal(h.ok, false)
})

test('health：响应不是 JSON 时不抛异常', async () => {
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => { throw new SyntaxError('Unexpected token <') },
    headers: { get: () => null },
  })
  const h = await api.health()
  assert.equal(h.reachable, false)
})
