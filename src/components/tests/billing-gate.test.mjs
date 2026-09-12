// 计费闸门的行为测试。
//
// 这几条对应的都是真实出过的问题：扣费还没回来就放行、扣费失败照样出报告、
// 同一张盘反复进页面重复扣分。扣分改成走服务端（异步）之后，
// 「忘了 await」会让闸门彻底失效且肉眼看不出来 —— 必须有测试钉住。
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'
import { clearAuth, setAuth } from '../../api/auth.js'
import { buildChart } from '../../engine/bazi.js'

const chart = buildChart(1990, 5, 6, 8, '男')
const USER = {
  id: 'u-1', nickname: '缘主', account: 'tester', avatar: '🐻', plan: 'earth',
  creditsUsed: 0, planCreditsResetAt: Date.now() + 8.64e7, planExpiresAt: Date.now() + 8.64e7,
}

/** 记录扣费请求；insufficient=true 时一律回 402 */
function stubCredits({ insufficient = false } = {}) {
  const consumed = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url)
    const body = opts.body ? JSON.parse(opts.body) : null
    if (path.includes('/api/auth/credits/consume')) {
      consumed.push(body.feature)
      if (insufficient) {
        return { ok: false, status: 402, json: async () => ({ ok: false, reason: 'insufficient', cost: 8, available: 0 }), headers: { get: () => null } }
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, cost: 8, remaining: 192, user: { ...USER, creditsUsed: 8 } }), headers: { get: () => null } }
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, user: USER }), headers: { get: () => null } }
  }
  return consumed
}

beforeEach(() => {
  clearAuth()
  localStorage.clear()
  setAuth('jwt-abc', USER)
})

const { default: BaziPage } = await import('../BaziPage.jsx')
const { default: QimenPage } = await import('../QimenPage.jsx')
const { default: TarotPage } = await import('../TarotPage.jsx')

test('八字命书：登录用户进页面扣一次 bazi.full', async () => {
  const consumed = stubCredits()
  const r = render(BaziPage, { chart, user: USER, onBack: () => {}, onChart: () => {}, onRequireLogin: () => {}, onUpgrade: () => {}, onUserChange: () => {} })
  await flush(5)
  assert.deepEqual(consumed, ['bazi.full'])
  r.unmount()
})

// 这是「同一张盘重复扣 8 分」的回归点：以前用 useRef 记状态，
// 组件一卸载重挂（返回首页再进来）就又扣一次。
test('八字命书：同一张盘再次进入不重复扣分', async () => {
  const consumed = stubCredits()
  const props = { chart, user: USER, onBack: () => {}, onChart: () => {}, onRequireLogin: () => {}, onUpgrade: () => {}, onUserChange: () => {} }
  const a = render(BaziPage, props)
  await flush(5)
  a.unmount()

  const b = render(BaziPage, props)
  await flush(5)
  b.unmount()

  assert.deepEqual(consumed, ['bazi.full'], `同一张盘只应扣一次，实际扣了 ${consumed.length} 次`)
})

test('八字命书：游客不扣分', async () => {
  clearAuth()
  const consumed = stubCredits()
  const r = render(BaziPage, { chart, user: null, onBack: () => {}, onChart: () => {}, onRequireLogin: () => {}, onUpgrade: () => {}, onUserChange: () => {} })
  await flush(5)
  assert.deepEqual(consumed, [], '未登录不该走积分扣减')
  r.unmount()
})

test('八字命书：积分不足时不出报告，改为提示升级', async () => {
  const consumed = stubCredits({ insufficient: true })
  const r = render(BaziPage, { chart, user: USER, onBack: () => {}, onChart: () => {}, onRequireLogin: () => {}, onUpgrade: () => {}, onUserChange: () => {} })
  await flush(5)
  assert.deepEqual(consumed, ['bazi.full'])
  assert.ok(r.text().includes('积分不足'), `积分不足时页面应给出提示，实际：${r.text().slice(0, 200)}`)
  r.unmount()
})

test('奇门：扣费失败时不进报告页', async () => {
  const consumed = stubCredits({ insufficient: true })
  const r = render(QimenPage, { user: USER, onRequireLogin: () => {}, onUpgrade: () => {}, onUserChange: () => {} })
  await flush()
  const go = r.findByText('起盘排局')
  assert.ok(go, `找不到起盘按钮：${r.text().slice(0, 200)}`)
  r.click(go)
  await flush(6)

  assert.deepEqual(consumed, ['qimen.reading'])
  assert.ok(r.text().includes('积分不足'), `应提示积分不足，实际：${r.text().slice(0, 240)}`)
  assert.equal(r.findByText('重新排盘'), null, '扣费失败绝不能进到报告页')
  r.unmount()
})

test('奇门：扣费成功才进报告页', async () => {
  const consumed = stubCredits()
  const r = render(QimenPage, { user: USER, onRequireLogin: () => {}, onUpgrade: () => {}, onUserChange: () => {} })
  await flush()
  r.click(r.findByText('起盘排局'))
  await flush(8)

  assert.deepEqual(consumed, ['qimen.reading'])
  assert.ok(r.findByText('重新排盘'), `扣费成功应进入报告页，实际：${r.text().slice(0, 240)}`)
  r.unmount()
})

test('塔罗：扣费失败时不调用 onStart（不进抽牌页）', async () => {
  const consumed = stubCredits({ insufficient: true })
  let started = null
  const r = render(TarotPage, {
    onBack: () => {}, onStart: id => { started = id }, history: [],
    user: USER, onRequireLogin: () => {}, onUpgrade: () => {}, onUserChange: () => {},
  })
  await flush()
  const go = r.findByText('开始单牌解读')
  assert.ok(go, `找不到抽牌按钮：${r.text().slice(0, 200)}`)
  r.click(go)
  await flush(6)

  assert.deepEqual(consumed, ['tarot.single'])
  assert.equal(started, null, '扣不动积分就不该进抽牌页 —— 忘了 await 时正是这里失效')
  r.unmount()
})

test('塔罗：扣费成功才进抽牌页', async () => {
  stubCredits()
  let started = null
  const r = render(TarotPage, {
    onBack: () => {}, onStart: id => { started = id }, history: [],
    user: USER, onRequireLogin: () => {}, onUpgrade: () => {}, onUserChange: () => {},
  })
  await flush()
  r.click(r.findByText('开始单牌解读'))
  await flush(6)
  assert.ok(started, '扣费成功应进入抽牌页')
  r.unmount()
})
