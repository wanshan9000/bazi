// 服务端账号库的回归测试。
// 其中若干条是从原来的 src/engine/tests/membership-users.test.mjs 搬过来的 ——
// 那些行为（积分扣减、续费顺延、id 唯一）迁到服务端后，断言也应该跟着迁。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAccountStore } from '../accounts.js'
import { planByKey, FREE_PLAN, getMonthlyCredits } from '../../src/engine/membership.js'

function mkStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-'))
  return { store: createAccountStore(path.join(dir, 'accounts.json')), dir, file: path.join(dir, 'accounts.json') }
}

test('新注册用户带齐积分状态，且不泄漏口令散列', async () => {
  const { store } = mkStore()
  const raw = await store.create({ account: 'alice', password: 'secret123', nickname: '小明' })
  const u = store.publicUser(raw)
  assert.equal(typeof u.creditsUsed, 'number')
  assert.equal(typeof u.planCreditsResetAt, 'number')
  assert.ok(u.planExpiresAt > Date.now(), '新用户应有一个未来的到期时间')
  assert.equal(u.passHash, undefined, '不得把口令散列带到前端对象上')
  assert.equal(u.password, undefined)
})

test('扣分后余额真的减少；扣光后拒绝', async () => {
  const { store } = mkStore()
  const u = await store.create({ account: 'bob', password: 'secret123', nickname: '小明' })
  const plan = planByKey(u.plan)
  assert.equal(getMonthlyCredits(store.publicUser(u)), plan.credits)

  const res = store.consumeCredit(u.id, 'bazi.full')
  assert.equal(res.ok, true)
  assert.equal(res.user.creditsUsed, 8)
  assert.equal(getMonthlyCredits(res.user), plan.credits - 8)

  let last = res
  for (let i = 0; i < Math.ceil(plan.credits / 8) + 2 && last.ok; i++) {
    last = store.consumeCredit(u.id, 'bazi.full')
  }
  assert.equal(last.ok, false)
  assert.equal(last.reason, 'insufficient')
})

test('退还积分：不产出就不该收费，且不会退成负数', async () => {
  const { store } = mkStore()
  const u = await store.create({ account: 'carol', password: 'secret123', nickname: '小明' })
  store.consumeCredit(u.id, 'agent.chat')
  assert.equal(store.get(u.id).creditsUsed, 1)
  store.refundCredit(u.id, 'agent.chat')
  assert.equal(store.get(u.id).creditsUsed, 0)
  // 再退一次（模拟「扣减与退还之间发生了月度重置」）不得凭空发钱
  store.refundCredit(u.id, 'agent.chat')
  assert.equal(store.get(u.id).creditsUsed, 0, '退还不得把 creditsUsed 压到负数')
})

test('续费在原到期时间之上顺延；换档从当下重算', async () => {
  const { store } = mkStore()
  const u = await store.create({ account: 'dave', password: 'secret123', nickname: '小明' })
  const before = u.planExpiresAt

  const renew = store.changePlan(u.id, u.plan)
  assert.equal(renew.ok, true)
  assert.equal(renew.renewed, true)
  assert.ok(renew.user.planExpiresAt - before > 29 * 86400000,
    `续费必须整周期顺延，而不是把剩余天数吃掉：before=${before} after=${renew.user.planExpiresAt}`)

  const up = store.changePlan(u.id, 'heaven')
  assert.equal(up.renewed, false)
  assert.equal(up.user.plan, 'heaven')
  assert.equal(up.user.creditsUsed, 0)
})

// free 是「过期落点」，不是商品。能买进去的话，用户可以主动把自己降到 free
// 再借月度重置白拿额度，也会让购买列表出现一个 0 元档。
test('不能通过切档接口切到 free 档', async () => {
  const { store } = mkStore()
  const u = await store.create({ account: 'erin', password: 'secret123', nickname: '小明' })
  const res = store.changePlan(u.id, FREE_PLAN.key)
  assert.equal(res.ok, false)
  assert.equal(store.get(u.id).plan, 'earth')
})

test('会员到期自动降级到 free，额度随之变成 free 档', async () => {
  const { store } = mkStore()
  const u = await store.create({ account: 'frank', password: 'secret123', nickname: '小明', plan: 'oracle' })
  store.consumeCredit(u.id, 'bazi.full')
  // 把到期时间推到过去
  store.get(u.id).planExpiresAt = Date.now() - 1000

  const after = store.get(u.id)
  assert.equal(after.plan, FREE_PLAN.key, '过期后必须降级，否则 planExpiresAt 写了也白写')
  assert.equal(after.creditsUsed, 0, '降级时额度窗口重置')
  assert.equal(getMonthlyCredits(store.publicUser(after)), FREE_PLAN.credits)
})

test('月度窗口到期后积分归零', async () => {
  const { store } = mkStore()
  const u = await store.create({ account: 'grace', password: 'secret123', nickname: '小明' })
  store.consumeCredit(u.id, 'bazi.full')
  const raw = store.get(u.id)
  raw.planCreditsResetAt = Date.now() - 1000
  assert.equal(store.get(u.id).creditsUsed, 0)
})

test('用户 id 唯一：同一毫秒连续注册不得碰撞', async () => {
  const { store } = mkStore()
  const ids = []
  for (let i = 0; i < 5; i++) ids.push((await store.create({ account: 'acct' + i, password: 'secret123', nickname: '小明' })).id)
  assert.equal(new Set(ids).size, ids.length, `id 碰撞：${ids.join(', ')}`)
})

test('口令散列带盐、可校验、错误口令拒绝', async () => {
  const { store } = mkStore()
  const a = await store.create({ account: 'hank', password: 'secret123', nickname: '小明' })
  const b = await store.create({ account: 'ivy', password: 'secret123', nickname: '小明' })
  assert.ok(a.passHash.startsWith('scrypt$'), `期望 scrypt 格式，实际 ${a.passHash}`)
  assert.notEqual(a.passHash, b.passHash, '相同口令必须因盐不同而散列不同')
  assert.equal(await store.checkPassword(a, 'secret123'), true)
  assert.equal(await store.checkPassword(a, 'wrong-pass'), false)
})

test('账号大小写不敏感，避免 Alice / alice 变成两个账号', async () => {
  const { store } = mkStore()
  await store.create({ account: 'Judy', password: 'secret123', nickname: '小明' })
  assert.ok(store.byAccount('judy'), '按小写应能查到')
  assert.ok(store.byAccount('JUDY'))
})

test('头像只接受白名单内的值', async () => {
  const { store } = mkStore()
  const u = await store.create({ account: 'kate', password: 'secret123', nickname: '小明' })
  assert.equal(store.update(u.id, { avatar: '<img src=x onerror=alert(1)>' }).ok, false)
  assert.equal(store.update(u.id, { avatar: store.AVATARS[2] }).ok, true)
})

test('落盘后重新打开仍在（不是只活在内存里）', async () => {
  const { file } = mkStore()
  const s1 = createAccountStore(file)
  const u = await s1.create({ account: 'leo', password: 'secret123', nickname: '小明' })
  const s2 = createAccountStore(file)
  assert.equal(s2.get(u.id).account, 'leo')
  assert.equal(await s2.checkPassword(s2.get(u.id), 'secret123'), true)
})

// 账号库解析失败时若当空库继续跑，下一次写入就会把所有人的账号抹掉。
test('账号库损坏时另存备份，不静默清空', async () => {
  const { file } = mkStore()
  const s1 = createAccountStore(file)
  await s1.create({ account: 'mia', password: 'secret123', nickname: '小明' })
  fs.writeFileSync(file, '{ 这不是 JSON')
  const s2 = createAccountStore(file)
  assert.equal(s2.count(), 0)
  const baks = fs.readdirSync(path.dirname(file)).filter(f => f.includes('.corrupt-'))
  assert.equal(baks.length, 1, '损坏的账号库必须留一份备份供人工恢复')
})

test('注销后账号消失', async () => {
  const { store } = mkStore()
  const u = await store.create({ account: 'nina', password: 'secret123', nickname: '小明' })
  assert.equal(store.remove(u.id), true)
  assert.equal(store.get(u.id), null)
  assert.equal(store.remove(u.id), false)
})
