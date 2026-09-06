// 定时推送排程：只测纯函数 nextRunAt，不启动真实调度器（会读订阅库、发短信）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextRunAt } from '../scheduler.js'

test('nextRunAt：当天还没到点 → 排在当天', () => {
  const from = new Date(2026, 8, 6, 5, 30, 0, 0) // 2026-09-06 05:30
  const at = nextRunAt('07:00', from)
  assert.equal(at.getDate(), 6)
  assert.equal(at.getHours(), 7)
  assert.equal(at.getMinutes(), 0)
})

test('nextRunAt：当天已过点 → 排到次日', () => {
  const from = new Date(2026, 8, 6, 9, 0, 0, 0)
  const at = nextRunAt('07:00', from)
  assert.equal(at.getDate(), 7)
  assert.equal(at.getHours(), 7)
})

// 这条是热循环 bug 的回归断言：早先按"还差几分钟"算延时，命中当分钟时差值为 0，
// setTimeout(0) 立刻重入、重排又是 0，在那一分钟里把订阅者连环推送上百次。
test('nextRunAt：正好命中目标时刻 → 排到次日，绝不产生 0 延时', () => {
  const from = new Date(2026, 8, 6, 7, 0, 0, 0)
  const at = nextRunAt('07:00', from)
  assert.equal(at.getDate(), 7, '同一时刻必须推到次日，否则会 setTimeout(0) 空转')
  assert.ok(at.getTime() - from.getTime() > 0, '延时必须严格为正')
})

test('nextRunAt：目标分钟内的任意秒都不会排出 0 延时', () => {
  for (const sec of [0, 1, 30, 59]) {
    const from = new Date(2026, 8, 6, 7, 0, sec, 0)
    const delay = nextRunAt('07:00', from).getTime() - from.getTime()
    assert.ok(delay > 0, `07:00:${sec} 时延时应为正，实际 ${delay}`)
  }
})

test('nextRunAt：跨月末正确进位', () => {
  const from = new Date(2026, 8, 30, 23, 0, 0, 0) // 9-30 23:00
  const at = nextRunAt('07:00', from)
  assert.equal(at.getMonth(), 9) // 10 月
  assert.equal(at.getDate(), 1)
})

test('nextRunAt：三个时段各自独立，且都落在未来 24 小时内', () => {
  const from = new Date(2026, 8, 6, 12, 0, 0, 0)
  for (const hhmm of ['07:00', '12:00', '21:00']) {
    const delay = nextRunAt(hhmm, from).getTime() - from.getTime()
    assert.ok(delay > 0 && delay <= 24 * 3600 * 1000, `${hhmm} 延时越界：${delay}`)
  }
})
