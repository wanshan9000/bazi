// 会员 / 积分 / 作用域隔离的回归测试。
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
      _mem: mem,
    },
  })
  return globalThis[name]
}
const ls = installStorage('localStorage')
const ss = installStorage('sessionStorage')

const users = await import('../../data/users.js')
const { getMonthlyCredits, planByKey } = await import('../membership.js')
const { localKey } = await import('../userScope.js')

beforeEach(() => { ls.clear(); ss.clear() })

async function mkUser(account = 'alice') {
  const r = await users.register({ nickname: '小明', account, password: 'secret123' })
  assert.equal(r.ok, true, r.msg || '注册失败')
  return r.user
}

test('publicUser 带出积分状态字段（否则余额永远显示满额）', async () => {
  const u = await mkUser()
  assert.equal(typeof u.creditsUsed, 'number')
  assert.equal(typeof u.planCreditsResetAt, 'number')
  assert.equal(typeof u.planExpiresAt, 'number')
  assert.ok(u.planExpiresAt > Date.now(), '新用户应有一个未来的到期时间')
  assert.equal(u.password, undefined, '不得把口令散列带到前端对象上')
})

test('扣分后返回的用户对象反映真实余额', async () => {
  const u = await mkUser()
  const plan = planByKey(u.plan)
  assert.equal(getMonthlyCredits(u), plan.credits)

  const res = users.consumeCredit(u.id, 'bazi.full')
  assert.equal(res.ok, true)
  assert.equal(res.user.creditsUsed, 8)
  // 这是「顶栏积分扣了不变」的回归点
  assert.equal(getMonthlyCredits(res.user), plan.credits - 8)
})

test('余额不足时拒绝扣减', async () => {
  const u = await mkUser()
  const plan = planByKey(u.plan)
  let last = null
  for (let i = 0; i < Math.ceil(plan.credits / 8) + 2; i++) {
    last = users.consumeCredit(u.id, 'bazi.full')
    if (!last.ok) break
  }
  assert.equal(last.ok, false)
  assert.equal(last.reason, 'insufficient')
})

test('续费在原到期时间之上顺延，而不是从今天重算', async () => {
  const u = await mkUser()
  const before = users.getSession().planExpiresAt
  const res = users.changePlan(u.id, u.plan) // 同档位 = 续费
  assert.equal(res.ok, true)
  assert.equal(res.renewed, true)
  assert.ok(res.user.planExpiresAt > before,
    `续费必须延长有效期：before=${before} after=${res.user.planExpiresAt}`)
  // 顺延一整个周期（约 30 天），不是把剩余天数吃掉
  assert.ok(res.user.planExpiresAt - before > 29 * 86400000)
})

test('换档从当下重新起算', async () => {
  const u = await mkUser()
  const res = users.changePlan(u.id, 'heaven')
  assert.equal(res.ok, true)
  assert.equal(res.renewed, false)
  assert.equal(res.user.plan, 'heaven')
  assert.equal(res.user.creditsUsed, 0)
})

test('userScope：旧的游客数据只迁移给第一个账号，不串给后来者', async () => {
  ls.setItem('genki-memory', JSON.stringify(['游客留下的记忆']))

  const a = await mkUser('alice')
  const keyA = localKey('genki-memory')
  assert.equal(keyA, `genki-memory::${a.id}`)
  assert.equal(ls.getItem(keyA), JSON.stringify(['游客留下的记忆']), '第一个账号应继承游客数据')

  users.logout()
  const b = await mkUser('bob')
  const keyB = localKey('genki-memory')
  assert.equal(keyB, `genki-memory::${b.id}`)
  assert.equal(ls.getItem(keyB), null, 'B 不应看到 A/游客的数据')
})

test('userScope：游客作用域不加命名空间', () => {
  users.logout()
  assert.equal(localKey('genki-memory'), 'genki-memory')
})

test('用户 id 必须唯一：同一毫秒连续注册不得碰撞', async () => {
  const ids = []
  for (let i = 0; i < 5; i++) {
    users.logout()
    ids.push((await mkUser('acct' + i)).id)
  }
  assert.equal(new Set(ids).size, ids.length,
    `id 发生碰撞：${ids.join(', ')} —— 碰撞的账号会共用同一份 userScope 数据`)
})

test('口令散列带盐且不是 djb2', async () => {
  await mkUser('carol')
  const raw = JSON.parse(ls.getItem('sanmen-users')).find(u => u.account === 'carol')
  assert.ok(raw.password.startsWith('pbkdf2$'), `期望 PBKDF2 格式，实际 ${raw.password}`)
  // 同一口令两次注册应得到不同散列（盐不同）
  users.logout()
  await mkUser('dave')
  const raw2 = JSON.parse(ls.getItem('sanmen-users')).find(u => u.account === 'dave')
  assert.notEqual(raw.password, raw2.password, '相同口令必须因盐不同而散列不同')
})

test('登录校验：正确口令通过，错误口令拒绝', async () => {
  await mkUser('erin')
  users.logout()
  assert.equal((await users.login('erin', 'wrong-pass')).ok, false)
  const ok = await users.login('erin', 'secret123')
  assert.equal(ok.ok, true, ok.msg)
})

test('旧 djb2 散列仍可登录，并自动升级为 PBKDF2', async () => {
  // 手工塞一个旧格式用户（djb2('secret123')）
  const djb2 = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return 'u' + (h >>> 0).toString(36) }
  ls.setItem('sanmen-users', JSON.stringify([{
    id: 'legacy1', nickname: '老用户', account: 'legacy', password: djb2('secret123'),
    avatar: '🐻', plan: 'earth', creditsUsed: 0, planCreditsResetAt: Date.now() + 86400000,
    planExpiresAt: Date.now() + 86400000, createdAt: Date.now(), lastLoginAt: Date.now(),
  }]))
  const res = await users.login('legacy', 'secret123')
  assert.equal(res.ok, true, '老用户不能被锁在门外')
  const raw = JSON.parse(ls.getItem('sanmen-users'))[0]
  assert.ok(raw.password.startsWith('pbkdf2$'), '登录成功后应升级散列格式')
})
