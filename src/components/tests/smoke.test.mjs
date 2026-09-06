// 全组件冒烟渲染。
//
// 为什么值得写：奇门页曾经因为漏声明一个 state 变量，已登录用户一打开就
// ReferenceError 整页白屏 —— 那种 bug 只要渲染过一次就会暴露，可当时
// 38 个组件一条自动化测试都没有，只能靠人点。
//
// 这里对每个组件用一组「有代表性的 props」渲染一次，断言：
//   1. 不抛异常；
//   2. 渲染出了非空内容（不是白屏）。
// 具体行为由各自的专项测试覆盖，这里只守住底线。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'
import { buildChart } from '../../engine/bazi.js'

// 组件里凡是要调接口的地方，测试环境不该真的发请求。
// 统一给一个「什么都返回空」的 fetch，让组件走到自己的错误/空态分支。
globalThis.fetch = async () => ({
  ok: true, status: 200,
  json: async () => ({ ok: true }),
  text: async () => '',
  headers: { get: () => null },
})

const chart = buildChart(1990, 5, 6, 8, '男')

const user = {
  id: 'u-test', nickname: '测试缘主', account: 'tester', avatar: '🐻',
  plan: 'earth', creditsUsed: 10,
  planCreditsResetAt: Date.now() + 86400000,
  planExpiresAt: Date.now() + 86400000,
  createdAt: Date.now(), lastLoginAt: Date.now(),
}

const noop = () => {}

/** [模块路径, props, 期望出现在页面上的一段文字] */
const CASES = [
  ['../UpgradePrompt.jsx', { featureName: '八字命书', cost: 8, remaining: 3, planLabel: '凡境', onUpgrade: noop, onClose: noop }, '积分不足'],
  ['../ReportLock.jsx', { user: null, onRequireLogin: noop, backView: 'qimen', icon: '◈', eyebrow: '奇门遁甲', title: '免费次数已用完', desc: '注册后继续', note: '备注' }, '免费次数已用完'],
  ['../ShichenPicker.jsx', { value: 8, onChange: noop }, null],
  ['../StarField.jsx', {}, null],
  ['../BirthForm.jsx', { onBack: noop, onGenerate: noop }, null],
  ['../ChartView.jsx', { chart }, '日主'],
  ['../BaziPage.jsx', { chart, user: null, onBack: noop, onChart: noop, onRequireLogin: noop, onUpgrade: noop, onUserChange: noop }, null],
  ['../ZiweiPage.jsx', { chart, onBack: noop, onChart: noop, user: null, onRequireLogin: noop, onUpgrade: noop, onUserChange: noop }, null],
  ['../QimenPage.jsx', { user: null, onRequireLogin: noop, onUpgrade: noop, onUserChange: noop }, '起盘'],
  ['../TarotPage.jsx', { onBack: noop, onStart: noop, history: [], user: null, onRequireLogin: noop, onUpgrade: noop, onUserChange: noop }, null],
  ['../ChengguPage.jsx', { onBack: noop }, null],
  ['../HoroscopePage.jsx', { onBack: noop }, null],
  ['../NamePage.jsx', { chart, onBack: noop, onChart: noop }, null],
  ['../FengshuiPage.jsx', { chart, onBack: noop, onChart: noop }, '风水'],
  ['../ArticlesPage.jsx', { onBack: noop, onOpen: noop }, null],
  ['../LoginPage.jsx', { onBack: noop, onSwitch: noop, onSuccess: noop }, null],
  ['../RegisterPage.jsx', { onBack: noop, onSwitch: noop, onSuccess: noop }, null],
  ['../ProfilePage.jsx', { user, historyCount: 2, tarotCount: 1, onBack: noop, onLogout: noop, onUpdate: noop, onSubscribe: noop }, '测试缘主'],
  ['../SubscribePage.jsx', { chart, onBack: noop, user, onRequireLogin: noop }, null],
  ['../Landing.jsx', { onGate: noop, onAskAgent: noop, onArticle: noop, onSubscribe: noop, user: null }, null],
  ['../FusedHuangliCard.jsx', { chart, date: new Date(2026, 8, 6), onChangeDate: noop }, null],
  ['../AgentSettings.jsx', { cfg: {}, onSave: noop, onClose: noop }, null],
]

for (const [mod, props, expect] of CASES) {
  const name = mod.replace('../', '').replace('.jsx', '')
  test(`冒烟：${name} 能渲染且不白屏`, async () => {
    const imported = await import(new URL(mod, import.meta.url).href)
    const Component = imported.default
    assert.equal(typeof Component, 'function', `${name} 没有默认导出的组件`)

    let r
    try {
      r = render(Component, props)
      await flush()
    } catch (e) {
      assert.fail(`${name} 渲染抛异常：${e && e.stack ? e.stack : e}`)
    }
    try {
      assert.ok(r.html().length > 0, `${name} 渲染出了空内容（白屏）`)
      if (expect) {
        assert.ok(r.text().includes(expect), `${name} 页面上没有出现「${expect}」，实际：${r.text().slice(0, 200)}`)
      }
    } finally {
      r.unmount()
    }
  })
}

// 命盘为空是每个排盘页都会遇到的状态（用户还没填出生信息就点进来）。
// 这几处历史上出过「读 chart.pillars[0] 直接抛」的崩溃。
for (const mod of ['../BaziPage.jsx', '../ZiweiPage.jsx', '../ChartView.jsx', '../FusedHuangliCard.jsx', '../FengshuiPage.jsx']) {
  const name = mod.replace('../', '').replace('.jsx', '')
  test(`冒烟：${name} 在 chart 为空时不崩`, async () => {
    const { default: Component } = await import(new URL(mod, import.meta.url).href)
    let r
    try {
      r = render(Component, {
      chart: null, onBack: noop, onChart: noop, user: null,
      onRequireLogin: noop, onUpgrade: noop, onUserChange: noop,
      history: [], date: new Date(2026, 8, 6), onChangeDate: noop,
    })
      await flush()
    } catch (e) {
      assert.fail(`${name} 在无命盘时抛异常：${e && e.stack ? e.stack : e}`)
    }
    r.unmount()
  })
}

// 会员到期后 plan 会变成 free。它不在 PLANS 里，个人中心却一定会渲染到它 ——
// 漏一处映射就是过期用户一进个人中心整页白屏。
test('冒烟：ProfilePage 在会员已过期（free 档）时不崩且显示为凡人', async () => {
  const { default: ProfilePage } = await import('../ProfilePage.jsx')
  const expired = { ...user, plan: 'free', planExpiresAt: 0, creditsUsed: 0 }
  let r
  try {
    r = render(ProfilePage, {
      user: expired, historyCount: 0, tarotCount: 0,
      onBack: noop, onLogout: noop, onUpdate: noop, onSubscribe: noop,
    })
    await flush()
  } catch (e) {
    assert.fail(`过期用户的个人中心崩了：${e && e.stack ? e.stack : e}`)
  }
  // 只盯当前档位的徽章：页面下方本来就会列出三个可购买档位，那里出现「凡境」是对的
  const badge = r.$('.pr-badge-tag')
  assert.ok(badge, '找不到档位徽章')
  assert.equal(badge.textContent.trim(), '凡人', '过期账号不该显示成付费档')
  r.unmount()
})

// 过期用户的下一档应该是玄境，不是最贵的天机境。
test('冒烟：ProfilePage 给 free 用户推荐玄境', async () => {
  const { default: ProfilePage } = await import('../ProfilePage.jsx')
  let asked = null
  const r = render(ProfilePage, {
    user: { ...user, plan: 'free', planExpiresAt: 0 },
    historyCount: 0, tarotCount: 0,
    onBack: noop, onLogout: noop, onUpdate: noop, onSubscribe: k => { asked = k },
  })
  await flush()
  const btn = r.findByText('升级至')
  assert.ok(btn, `找不到升级按钮：${r.text().slice(0, 200)}`)
  r.click(btn)
  assert.equal(asked, 'heaven')
  r.unmount()
})
