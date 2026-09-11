// 前端侧的会员 / 作用域隔离测试。
//
// 账号本身已迁到服务端（server/tests/accounts.test.mjs 覆盖注册、口令、积分、
// 到期降级等）。这里只测仍然属于浏览器的两件事：
//   1. membership.js 的纯函数（额度换算、到期判定）；
//   2. userScope 的存储命名空间（同一浏览器里不同账号不串台）。
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

function installStorage(name) {
  const mem = new Map()
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)) },
      removeItem: k => { mem.delete(k) },
      clear: () => mem.clear(),
      get length() { return mem.size },
      key: i => Array.from(mem.keys())[i] ?? null,
      _mem: mem,
    },
  })
  return globalThis[name]
}
const ls = installStorage('localStorage')
installStorage('sessionStorage')

const { getCreditBalance, getMonthlyCredits, getMonthlyProgress, planByKey, FREE_PLAN, SUPER_PLAN, PLANS, AGENT_CONSULTATION, agentConsultationAllowance, isPlanExpired, canAfford, canUseHuangliReminder } = await import('../membership.js')
const { localKey } = await import('../userScope.js')
const { remapScopedKeys } = await import('../../data/legacyMigrate.js')
const { setAuth, clearAuth } = await import('../../api/auth.js')

beforeEach(() => { clearAuth(); ls.clear() })

/* 伪造登录态。必须走 setAuth/clearAuth 而不是直接改 localStorage ——
 * api/auth.js 里有一层内存缓存，绕过去改存储的话缓存不会更新，
 * 测出来的是「上一个用户」，那不是真实行为。 */
function signIn(id) {
  setAuth('fake.jwt.token', { id, nickname: '缘主', plan: 'earth' })
}
function signOut() {
  clearAuth()
}

test('双钱包余额：未过期有月度额度；到期后只保留永久积分', () => {
  const now = Date.now()
  const active = { plan: 'oracle', planExpiresAt: now + 86400000, planCreditsResetAt: now + 86400000, monthlyCreditsUsed: 100, permanentCredits: 10 }
  assert.equal(getMonthlyCredits(active), planByKey('oracle').credits - 100)
  assert.equal(getCreditBalance(active).total, planByKey('oracle').credits - 90)

  // 这是「到期不降级」的回归点：过期账号的顶栏此前照样显示 1000 积分可用
  const expired = { ...active, planExpiresAt: now - 1000 }
  assert.equal(isPlanExpired(expired), true)
  assert.equal(getMonthlyCredits(expired), 0)
  assert.deepEqual(getCreditBalance(expired), { monthly: 0, permanent: 10, total: 10 })
})

test('free 档本身不会过期', () => {
  assert.equal(isPlanExpired({ plan: 'free', planExpiresAt: 1 }), false)
  assert.equal(isPlanExpired(null), false)
})

test('会员额度：客者与三档会员按翻倍后的产品策略展示', () => {
  assert.equal(FREE_PLAN.name, '客者')
  assert.equal(FREE_PLAN.perks.some(item => item.includes('10 次具体问题解读')), true)
  assert.equal(FREE_PLAN.perks.some(item => item.includes('20 点')), true)
  assert.deepEqual(PLANS.map(plan => [plan.key, plan.credits]), [
    ['earth', 60], ['heaven', 200], ['oracle', 520],
  ])
  assert.equal(AGENT_CONSULTATION.guestRounds, 10)
  assert.deepEqual(agentConsultationAllowance(60), { topics: 12, rounds: 96 })
  assert.equal(SUPER_PLAN.name, '尊者')
})

test('每日黄历提醒仅限凡者及以上的有效会员', () => {
  const now = Date.now()
  assert.equal(canUseHuangliReminder(null), false)
  assert.equal(canUseHuangliReminder({ plan: 'free' }), false)
  assert.equal(canUseHuangliReminder({ plan: 'earth', planExpiresAt: now + 1000 }), true)
  assert.equal(canUseHuangliReminder({ plan: 'heaven', planExpiresAt: now + 1000 }), true)
  assert.equal(canUseHuangliReminder({ plan: 'oracle', planExpiresAt: now + 1000 }), true)
  assert.equal(canUseHuangliReminder({ plan: 'earth', planExpiresAt: now - 1000 }), false)
  assert.equal(canUseHuangliReminder({ role: 'super_admin', plan: 'free' }), true)
})

test('尊者拥有无限额度且不会因会员有效期到期降级', () => {
  const superAdmin = { role: 'super_admin', plan: SUPER_PLAN.key, planExpiresAt: 1, creditsUsed: 9999 }
  assert.equal(isPlanExpired(superAdmin), false)
  assert.equal(getMonthlyCredits(superAdmin), Infinity)
  assert.equal(getMonthlyProgress(superAdmin), 0)
  assert.equal(canAfford(superAdmin, 'agent.topic'), true)
})

test('planByKey 认识 free，但它不在可购买的 PLANS 里', async () => {
  const { PLANS } = await import('../membership.js')
  assert.equal(planByKey('free').key, 'free')
  assert.equal(PLANS.some(p => p.key === 'free'), false, 'free 是过期落点，不该出现在定价页')
})

test('canAfford 以余额为准；未计价的功能一律放行', () => {
  const now = Date.now()
  const poor = { plan: 'earth', planExpiresAt: now + 86400000, planCreditsResetAt: now + 86400000, monthlyCreditsUsed: 59, permanentCredits: 0 }
  assert.equal(canAfford(poor, 'bazi.full'), false) // 需 5 分，只剩 1
  assert.equal(canAfford(poor, 'agent.topic'), false) // 需 5 分
  assert.equal(canAfford(poor, 'huangli.daily'), true, '未列入积分表的功能视为免费')
})

test('月度进度在 0~1 之间且用满不溢出', () => {
  const now = Date.now()
  const u = { plan: 'earth', planExpiresAt: now + 86400000, planCreditsResetAt: now + 86400000, monthlyCreditsUsed: 999 }
  const p = getMonthlyProgress(u)
  assert.ok(p >= 0 && p <= 1, `进度越界：${p}`)
})

test('userScope：旧的游客数据只迁移给第一个账号，不串给后来者', () => {
  ls.setItem('genki-memory', JSON.stringify(['游客留下的记忆']))

  signIn('u-alice')
  const keyA = localKey('genki-memory')
  assert.equal(keyA, 'genki-memory::u-alice')
  assert.equal(ls.getItem(keyA), JSON.stringify(['游客留下的记忆']), '第一个账号应继承游客数据')

  signOut()
  signIn('u-bob')
  const keyB = localKey('genki-memory')
  assert.equal(keyB, 'genki-memory::u-bob')
  assert.equal(ls.getItem(keyB), null, 'B 不应看到 A/游客的数据')
})

test('userScope：游客作用域不加命名空间', () => {
  signOut()
  assert.equal(localKey('genki-memory'), 'genki-memory')
})

// 账号迁到服务端后 uid 会变。不搬这些键的话，老用户登录后会看到「历史全没了」。
test('迁移：::旧uid 的存储键会改挂到新 uid 上', () => {
  ls.setItem('genki-memory::old1', '["记忆"]')
  ls.setItem('genki-chart-collection::old1', '["命盘"]')
  ls.setItem('无关的键', 'x')

  const moved = remapScopedKeys('old1', 'new1')
  assert.equal(moved, 2)
  assert.equal(ls.getItem('genki-memory::new1'), '["记忆"]')
  assert.equal(ls.getItem('genki-chart-collection::new1'), '["命盘"]')
  assert.equal(ls.getItem('无关的键'), 'x', '不相干的键不该被动过')
})

test('迁移：不覆盖新账号已有的数据', () => {
  ls.setItem('genki-memory::old1', '["旧的"]')
  ls.setItem('genki-memory::new1', '["新账号自己的"]')
  remapScopedKeys('old1', 'new1')
  assert.equal(ls.getItem('genki-memory::new1'), '["新账号自己的"]')
})

// 「积分不足 → 去升级」的引导档位。此前各页面各写一遍
// `plan === 'earth' ? 'heaven' : 'oracle'`，free 档不等于 earth，
// 于是刚过期的账号会被直接推到最贵的天机境。
test('nextPlanKey：free 推凡者，凡者推玄者，玄者推天者', async () => {
  const { nextPlanKey } = await import('../membership.js')
  assert.equal(nextPlanKey('free'), 'earth')
  assert.equal(nextPlanKey('earth'), 'heaven')
  assert.equal(nextPlanKey('heaven'), 'oracle')
  assert.equal(nextPlanKey('oracle'), null)
  assert.equal(nextPlanKey('supreme'), null)
  assert.equal(nextPlanKey(undefined), 'earth', '档位缺失时按最低档处理，不该推最贵的')
})
