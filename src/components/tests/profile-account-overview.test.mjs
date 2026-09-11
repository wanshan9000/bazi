import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'
import { clearAuth, setAuth } from '../../api/auth.js'
import ProfilePage from '../ProfilePage.jsx'

let originalFetch

const user = {
  id: 'profile-overview-user', account: 'overview', nickname: '三门', avatar: '🦊',
  plan: 'heaven', createdAt: Date.now() - 3 * 86400000,
  monthlyCredits: 200, monthlyCreditsUsed: 0, permanentCredits: 20,
}

beforeEach(() => {
  clearAuth()
  setAuth('profile-overview-token', user)
  originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ status: 200, json: async () => ({ ok: true, reports: [] }) })
})

afterEach(() => { globalThis.fetch = originalFetch })

test('个人中心将身份、报告与点数收进同一账户总览卡', async () => {
  const r = render(ProfilePage, { user, onBack() {}, onLogout() {}, onUpdate() {}, onSubscribe() {}, onReports() {} })
  await flush(3)
  const overview = r.$('[aria-label="账户总览"]')
  assert.ok(overview, '缺少统一的账户总览区域')
  assert.ok(overview.querySelector('.pr-id-card'), '账户总览内应包含身份信息')
  assert.ok(overview.querySelector('.pr-report-tool'), '账户总览内应包含我的报告入口')
  assert.ok(overview.querySelector('.pr-points-tool'), '账户总览内应包含点数状态')
  r.unmount()
})

test('尊者身份在账户总览中只展示一次', async () => {
  const r = render(ProfilePage, {
    user: { ...user, plan: 'supreme', isSuperAdmin: true },
    onBack() {}, onLogout() {}, onUpdate() {}, onSubscribe() {}, onReports() {}
  })
  await flush(3)
  const overview = r.$('[aria-label="账户总览"]')
  assert.equal((overview.textContent.match(/尊者/g) || []).length, 1, '尊者身份不应在账户总览内重复出现')
  r.unmount()
})

test('账户总览以报告与点数双卡呈现，并提供元气 AI 咨询入口', async () => {
  let asked = 0
  const r = render(ProfilePage, {
    user: { ...user, plan: 'supreme', isSuperAdmin: true },
    onBack() {}, onLogout() {}, onUpdate() {}, onSubscribe() {}, onReports() {}, onAskAgent() { asked++ }
  })
  await flush(3)
  const overview = r.$('[aria-label="账户总览"]')
  assert.ok(overview.querySelector('.pr-account-tools'), '账户总览应包含账户工具双卡')
  assert.equal(overview.querySelectorAll('.pr-account-tool').length, 2, '账户工具应只保留报告与点数两张卡')
  const ask = r.findByText('去咨询')
  assert.ok(ask, '账户总览应提供元气 AI 咨询入口')
  r.click(ask)
  assert.equal(asked, 1, '点击元气 AI 入口应触发咨询')
  r.unmount()
})

test('没有可升级档位时，会员入口明确指向订阅管理', async () => {
  const r = render(ProfilePage, {
    user: { ...user, plan: 'supreme', isSuperAdmin: true },
    onBack() {}, onLogout() {}, onUpdate() {}, onSubscribe() {}, onReports() {}
  })
  await flush(3)
  assert.equal(r.$('.pr-points-action')?.textContent.replace(/\s+/g, ''), '会员订阅管理›')
  r.unmount()
})
