import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'
import { clearAuth, setAuth } from '../../api/auth.js'

const ordinaryUser = {
  id: 'member-ordinary',
  nickname: '普通用户',
  account: 'ordinary',
  avatar: '🌸',
  role: 'user',
  plan: 'free',
  permanentCredits: 10,
  monthlyCreditsUsed: 0,
  creditsUsed: 0,
  planExpiresAt: 0,
  createdAt: Date.now(),
  lastLoginAt: Date.now(),
}

test('普通登录用户看不到管理入口，直达后台地址会回到首页', async () => {
  const originalFetch = globalThis.fetch
  clearAuth()
  setAuth('ordinary-token', ordinaryUser)
  window.history.replaceState(null, '', '#/admin')
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, user: ordinaryUser }),
  })

  const { default: App } = await import('../../App.jsx')
  const r = render(App)
  try {
    await flush(5)
    assert.equal(Boolean(r.findByText('管理控制台')), false, '普通用户不应看到管理控制台入口或页面')
    assert.match(r.text(), /先和元氣AI聊聊人生吧/, '普通用户直达后台地址应回到首页')
    assert.equal(window.location.hash, '#/home')
  } finally {
    r.unmount()
    clearAuth()
    globalThis.fetch = originalFetch
    window.history.replaceState(null, '', '#/home')
  }
})
