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
const { default: ForgotPasswordPage } = await import('../ForgotPasswordPage.jsx')
const { default: MembershipModal } = await import('../MembershipModal.jsx')

async function openAccountLogin(r) {
  const tab = r.findByText('账号登录')
  // 海外页将邮箱/账号密码作为默认方式，不再额外放一个“账号登录”切换按钮。
  if (tab) {
    r.click(tab)
    await flush()
  }
}

test('海外登录页自动分流，不要求用户手动选择地区，并保留账号密码与 Google 入口', async () => {
  const originalDateTimeFormat = Intl.DateTimeFormat
  Intl.DateTimeFormat = () => ({ resolvedOptions: () => ({ timeZone: 'America/Los_Angeles' }) })
  stubFetch({ '/api/auth/providers': { body: { ok: true, google: false, wechat: false, sms: false } } })
  try {
    const r = render(LoginPage, { onBack: () => {}, onSwitch: () => {}, onSuccess: () => {} })
    await flush(2)
    const text = r.text()
    assert.ok(text.includes('用户名 / 邮箱'), `海外账号登录表单缺失：${text.slice(0, 300)}`)
    assert.ok(text.includes('Google 登录正在配置中。'), `Google 配置状态未说明：${text.slice(0, 300)}`)
    assert.ok(!text.includes('登录地区'), '不应要求用户手动选择地区')
    r.unmount()
  } finally {
    Intl.DateTimeFormat = originalDateTimeFormat
  }
})

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

test('登录页清楚告知注册赠送积分与兑换规则', async () => {
  const r = render(LoginPage, { onBack: () => {}, onSwitch: () => {}, onSuccess: () => {} })
  const text = r.text()
  assert.ok(text.includes('注册赠 20 积分'), `没有注册赠积分说明：${text.slice(0, 300)}`)
  assert.ok(text.includes('1 积分 = 19,000 Token'), `没有积分兑换规则：${text.slice(0, 300)}`)
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

test('账号登录提供邮箱找回入口；重设页按邮箱发送并提交新密码', async () => {
  const login = render(LoginPage, { onBack: () => {}, onSwitch: () => {}, onForgotPassword: () => {}, onSuccess: () => {} })
  await openAccountLogin(login)
  assert.ok(login.findByText('忘记密码？'), '账号登录必须有忘记密码入口')
  login.unmount()

  const calls = stubFetch({
    '/api/auth/password-reset/send-code': { body: { ok: true, msg: '验证码已发送' } },
    '/api/auth/password-reset/confirm': { body: { ok: true, msg: '密码已重置' } },
  })
  const r = render(ForgotPasswordPage, { onBack: () => {}, onLogin: () => {} })
  const [email, code, password, confirm] = r.$$('input')
  r.type(email, 'member@example.test')
  r.click(r.findByText('获取验证码'))
  await flush(3)
  r.type(code, '123456')
  r.type(password, 'renewed123')
  r.type(confirm, 'renewed123')
  r.click(r.$('button[type="submit"]'))
  await flush(4)
  assert.deepEqual(calls.find(call => call.path.includes('/password-reset/send-code')).body, { email: 'member@example.test' })
  assert.deepEqual(calls.find(call => call.path.includes('/password-reset/confirm')).body, { email: 'member@example.test', code: '123456', newPassword: 'renewed123' })
  assert.ok(r.text().includes('密码已重置'), `重设成功提示缺失：${r.text().slice(0, 300)}`)
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

test('订阅弹窗：同时提供永久积分包，并清楚标记为永久有效', async () => {
  stubFetch({})
  localStorage.setItem('genki-token', 'jwt-abc')
  const r = render(MembershipModal, {
    open: true, planKey: 'earth', user: USER, showPlanPicker: true,
    onClose: () => {}, onRequireLogin: () => {},
  })
  await flush()
  assert.ok(r.text().includes('永久积分包'), `没有永久积分包：${r.text().slice(0, 300)}`)
  assert.ok(r.text().includes('360 积分'), `没有完整积分包：${r.text().slice(0, 300)}`)
  r.unmount()
})

test('订阅弹窗：会员可切换月付、季付和年付，并说明积分兑换规则', async () => {
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
  assert.ok(text.includes('60 积分/月') && text.includes('1 积分 = 19,000 Token'), `没有突出积分额度与兑换规则：${text.slice(0, 700)}`)
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
