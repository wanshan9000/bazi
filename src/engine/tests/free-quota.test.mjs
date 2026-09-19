import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consumeGuestFeature, guestFeatureStatus } from '../freeQuota.js'

test('游客无 Token 功能按功能独立计数，每项每天最多二十次', () => {
  localStorage.clear()
  for (let i = 0; i < 20; i++) assert.equal(consumeGuestFeature('bazi.chart').ok, true)
  assert.equal(consumeGuestFeature('bazi.chart').ok, false)
  assert.deepEqual(guestFeatureStatus('bazi.chart'), { used: 20, limit: 20, remaining: 0 })
  assert.deepEqual(guestFeatureStatus('chenggu'), { used: 0, limit: 20, remaining: 20 })
})
