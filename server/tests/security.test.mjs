import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createSecurityGuard } from '../security.js'

const tempFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'risk-')), 'security.json')

test('持续触发限流会自动封禁来源，解除后从记录中移除', () => {
  const guard = createSecurityGuard({ file: tempFile(), secret: 'x'.repeat(48), blockThreshold: 3, blockMinutes: 10 })
  guard.note({ ip: '198.51.100.3', path: '/auth/register', status: 429 })
  const snap = guard.snapshot()
  assert.equal(snap.overview.blocked, 1, '一次明确的限流事件达到低阈值时应自动封禁')
  assert.equal(snap.events.some(event => event.type === 'auto_block'), true)
  assert.equal(guard.unblock(snap.blocks[0].fingerprint), true)
  assert.equal(guard.snapshot().overview.blocked, 0)
})

test('风控记录只保存来源指纹，不保存明文 IP', () => {
  const file = tempFile()
  const guard = createSecurityGuard({ file, secret: 'y'.repeat(48), blockThreshold: 99 })
  guard.note({ ip: '203.0.113.9', path: '/auth/login', status: 401 })
  const raw = fs.readFileSync(file, 'utf-8')
  assert.equal(raw.includes('203.0.113.9'), false)
  assert.match(raw, /[a-f0-9]{16}/)
})
