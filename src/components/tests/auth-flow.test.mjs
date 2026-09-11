// 登录 / 注册 / 计费闸门的行为测试。
//
// 冒烟测试只保证「渲染不崩」，这里验证真正会出错的地方：
// 表单提交后有没有把结果交出去、失败时给不给提示、扣费失败会不会照样放行。
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'
import { clearAuth } from '../../api/auth.js'

/** 把 fetch 换成按路径返回预设响应的桩，并记录所有请求 */
function stubFetch(routes) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url)
    calls.push({ path, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers || {} })
    const match = Object.keys(routes).find(k => path.includes(k))
    const r = match ? routes[match] : { status: 404, body: { ok: false, msg: '没有这个接口' } }
    const payload = typeof r.body === 'function' ? r.body(calls.at(-1)) : r.body
    return {
      ok: (r.status || 200) < 400,
      status: r.status || 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
      headers: { get: () => null },
    }
  }
  return calls
}

const USER = {
  id: 'u-1', nickname: '缘主', account: 'tester', avatar: '🐻', plan: 'earth',
  creditsUsed: 0, planCreditsResetAt: Date.now() + 8.64e7, planExpiresAt: Date.now() + 8.64e7,
}

beforeEach(() => { clearAuth(); localStorage.clear() })

const { default: LoginPage } = await import('../LoginPage.jsx')
const { default: MembershipModal } = await import('../MembershipModal.jsx')

async function openAccountLogin(r) {
  const tab = r.findByText('账号登录')
  assert.ok(tab, '应提供账号登录方式')
  r.click(tab)
  await flush()
}

test('登录成功：把服务端返回的用户交给 onSuccess，并存下 token', async () => {
  stubFetch({ '/api/auth/login': { body: { ok: true, token: 'jwt-abc', user: USER } } })
  let got = null
  const r = render(LoginPage, { onBack: () => {}, onSwitch: () => {}, onSuccess: u => { got = u } })
  await openAccountLogin(r)
  const [acct, pwd] = r.$$('input')
  r.type(acct, 'tester')
  r.type(pwd, 'secret123')
  r.click(r.$('button[type="submit"]'))
  await flush(5)

  assert.ok(got, '登录成功必须把用户交出去')
  assert.equal(got.id, 'u-1')
  assert.equal(localStorage.getItem('genki-token'), 'jwt-abc', 'token 必须落地，否则一刷新就掉线')
  r.unmount()
})

test('登录失败：显示服务端的提示，不调用 onSuccess', async () => {
  stubFetch({ '/api/auth/login': { status: 401, body: { ok: false, msg: '账号或密码不正确' } } })
  let called = false
  const r = render(LoginPage, { onBack: () => {}, onSwitch: () => {}, onSuccess: () => { called = true } })
  await openAccountLogin(r)
  const [acct, pwd] = r.$$('input')
  r.type(acct, 'tester')
  r.type(pwd, 'wrong')
  r.click(r.$('button[type="submit"]'))
  await flush(5)

  assert.equal(called, false, '登录失败不得放行')
  assert.ok(r.text().includes('账号或密码不正确'), `没有显示错误提示：${r.text().slice(0, 200)}`)
  assert.equal(localStorage.getItem('genki-token'), null)
  r.unmount()
})

test('登录页清楚告知注册赠送 20 点永久积分可开启四个咨询主题', async () => {
  const r = render(LoginPage, { onBack: () => {}, onSwitch: () => {}, onSuccess: () => {} })
  const text = r.text()
  assert.ok(text.includes('注册赠 20 点永久积分'), `没有注册赠点说明：${text.slice(0, 300)}`)
  assert.ok(text.includes('4 个元气 Agent 咨询主题'), `没有说明注册后可持续咨询：${text.slice(0, 300)}`)
  r.unmount()
})

test('登录请求不把口令写进 URL', async () => {
  const calls = stubFetch({ '/api/auth/login': { body: { ok: true, token: 't', user: USER } } })
  const r = render(LoginPage, { onBack: () => {}, onSwitch: () => {}, onSuccess: () => {} })
  await openAccountLogin(r)
  const [acct, pwd] = r.$$('input')
  r.type(acct, 'tester')
  r.type(pwd, 'secret123')
  r.click(r.$('button[type="submit"]'))
  await flush(5)
  const login = calls.find(c => c.path.includes('/api/auth/login'))
  assert.equal(login.method, 'POST')
  assert.ok(!login.path.includes('secret123'), '口令绝不能出现在 URL 里（会进日志和 Referer）')
  assert.equal(login.body.password, 'secret123')
  r.unmount()
})

test('订阅弹窗：支付预览不应直接调用切档接口', async () => {
  const calls = stubFetch({})
  localStorage.setItem('genki-token', 'jwt-abc')
  const r = render(MembershipModal, {
    open: true, planKey: 'heaven', user: USER,
    onClose: () => {}, onRequireLogin: () => {},
  })
  await flush()
  assert.ok(r.text().includes('支付服务准备中'), `没有显示支付页：${r.text().slice(0, 200)}`)
  assert.equal(calls.filter(c => c.path.includes('/api/auth/plan')).length, 0)
  r.unmount()
})

test('订阅弹窗：续费入口先展示会员选择，选档后进入扫码支付页', async () => {
  stubFetch({})
  localStorage.setItem('genki-token', 'jwt-abc')
  const r = render(MembershipModal, {
    open: true, planKey: 'earth', user: USER, showPlanPicker: true,
    onClose: () => {}, onRequireLogin: () => {},
  })
  const option = r.findByText('玄者', '.mm-plan-option')
  assert.ok(option, `找不到会员选择：${r.text().slice(0, 200)}`)
  r.click(option)
  await flush()
  assert.ok(r.text().includes('续费 玄者'), `选择后没有进入支付页：${r.text().slice(0, 200)}`)
  r.unmount()
})

test('订阅弹窗：同时提供永久点数包，并清楚标记为永久有效', async () => {
  stubFetch({})
  localStorage.setItem('genki-token', 'jwt-abc')
  const r = render(MembershipModal, {
    open: true, planKey: 'earth', user: USER, showPlanPicker: true,
    onClose: () => {}, onRequireLogin: () => {},
  })
  await flush()
  assert.ok(r.text().includes('永久点数包'), `没有永久点数包：${r.text().slice(0, 300)}`)
  assert.ok(r.text().includes('360 点'), `没有完整点数包：${r.text().slice(0, 300)}`)
  r.unmount()
})

test('订阅弹窗：会员可切换月付、季付和年付，并说明元气 Agent 主题额度', async () => {
  stubFetch({})
  localStorage.setItem('genki-token', 'jwt-abc')
  const r = render(MembershipModal, {
    open: true, planKey: 'earth', user: USER, showPlanPicker: true,
    onClose: () => {}, onRequireLogin: () => {},
  })
  await flush()
  const text = r.text()
  assert.ok(text.includes('月付') && text.includes('季付') && text.includes('年付'), `缺少订阅周期：${text.slice(0, 500)}`)
  assert.ok(text.includes('95 折') && text.includes('83 折'), `缺少周期优惠：${text.slice(0, 500)}`)
  assert.ok(text.includes('12 个咨询主题') && text.includes('96 次具体问题解读'), `没有突出元气 Agent 顾问额度：${text.slice(0, 700)}`)
  r.unmount()
})

test('未登录时点订阅走登录引导，不发切档请求', async () => {
  const calls = stubFetch({})
  let asked = null
  const r = render(MembershipModal, {
    open: true, planKey: 'heaven', user: null,
    onClose: () => {}, onRequireLogin: v => { asked = v || 'subscribe' },
  })
  const confirm = r.findByText('注册 / 登录')
  assert.ok(confirm, `找不到主按钮：${r.text().slice(0, 200)}`)
  r.click(confirm)
  await flush()
  assert.ok(asked, '未登录必须先引导登录')
  assert.equal(calls.filter(c => c.path.includes('/api/auth/plan')).length, 0)
  r.unmount()
})
