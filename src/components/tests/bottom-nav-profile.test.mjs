import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'
import { clearAuth, setAuth } from '../../api/auth.js'

const member = {
  id: 'member-nav',
  nickname: '元氣用户',
  account: 'member-nav',
  avatar: '🐻',
  role: 'user',
  plan: 'free',
  permanentCredits: 20,
  monthlyCreditsUsed: 0,
  creditsUsed: 0,
  planExpiresAt: 0,
  createdAt: Date.now(),
  lastLoginAt: Date.now(),
}

beforeEach(() => {
  clearAuth()
  localStorage.clear()
  window.history.replaceState(null, '', '#/home')
})

test('客者从底部「我的」进入登录页而不是空的个人中心', async () => {
  const { default: App } = await import('../../App.jsx')
  const r = render(App)
  try {
    await flush(4)
    const mine = r.$('.bottom-nav [aria-label="我的"]')
    assert.ok(mine, '底部导航应提供“我的”入口')

    r.click(mine)
    await flush(4)

    assert.equal(window.location.hash, '#/login')
    assert.match(r.text(), /欢迎回来.*元氣滿滿/)
  } finally {
    r.unmount()
  }
})

test('未登录直达我的报告时显示登录页而不是空白页面', async () => {
  window.history.replaceState(null, '', '#/reports')
  const { default: App } = await import('../../App.jsx')
  const r = render(App)
  try {
    await flush(4)

    assert.match(r.text(), /欢迎回来.*元氣滿滿/, '报告归档是账号数据，未登录时应落到登录页')
  } finally {
    r.unmount()
  }
})

test('未登录直达报告详情时显示登录页而不是空白页面', async () => {
  window.history.replaceState(null, '', '#/report-detail?report=report-1')
  const { default: App } = await import('../../App.jsx')
  const r = render(App)
  try {
    await flush(4)

    assert.match(r.text(), /欢迎回来.*元氣滿滿/, '报告详情也必须受登录保护')
  } finally {
    r.unmount()
  }
})

test('已登录用户从底部「我的」直达个人中心', async () => {
  const originalFetch = globalThis.fetch
  setAuth('member-nav-token', member)
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, user: member }),
  })
  const { default: App } = await import('../../App.jsx')
  const r = render(App)
  try {
    await flush(4)
    const mine = r.$('.bottom-nav [aria-label="我的"]')
    assert.ok(mine, '登录后底部导航仍应保留“我的”入口')

    r.click(mine)
    await flush(4)

    assert.equal(window.location.hash, '#/profile')
    assert.match(r.text(), /我的元氣/)
    assert.match(r.text(), /积分账户/)
  } finally {
    r.unmount()
    globalThis.fetch = originalFetch
    clearAuth()
  }
})
