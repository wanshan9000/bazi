// server/data 快照的回归测试。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runBackup } from '../backup.js'

function mkdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'))
}

test('快照会复制数据文件，内容一致', () => {
  const dir = mkdir()
  const src = path.join(dir, 'accounts.json')
  fs.writeFileSync(src, JSON.stringify({ users: [{ id: 'u1' }] }))
  const out = runBackup({ dir: path.join(dir, 'backups'), keep: 5, targets: [src] })
  assert.equal(out.copied.length, 1)
  assert.equal(out.errors.length, 0)
  const copy = path.join(dir, 'backups', out.copied[0])
  assert.deepEqual(JSON.parse(fs.readFileSync(copy, 'utf-8')), { users: [{ id: 'u1' }] })
})

test('不存在的文件跳过，不算失败', () => {
  const dir = mkdir()
  const out = runBackup({ dir: path.join(dir, 'backups'), keep: 5, targets: [path.join(dir, 'nope.json')] })
  assert.equal(out.copied.length, 0)
  assert.equal(out.errors.length, 0)
  assert.equal(out.skipped.length, 1)
})

// 源文件已经损坏时再存一份没有意义，反而会把仅存的几个好副本挤出保留窗口。
test('源文件损坏时跳过，不把坏数据存成备份', () => {
  const dir = mkdir()
  const src = path.join(dir, 'accounts.json')
  fs.writeFileSync(src, '{ 这不是 JSON')
  const out = runBackup({ dir: path.join(dir, 'backups'), keep: 5, targets: [src] })
  assert.equal(out.copied.length, 0)
  assert.equal(out.skipped.length, 1)
  assert.match(out.skipped[0], /损坏/)
})

test('轮转：同一文件只保留最近 keep 份', () => {
  const dir = mkdir()
  const bdir = path.join(dir, 'backups')
  const src = path.join(dir, 'accounts.json')
  fs.writeFileSync(src, JSON.stringify({ users: [] }))
  // 时间戳精度是秒，直接喂不同的 now 才能造出多份
  for (let i = 0; i < 6; i++) {
    runBackup({ dir: bdir, keep: 3, targets: [src], now: new Date(Date.UTC(2026, 0, 1, 0, 0, i)) })
  }
  const files = fs.readdirSync(bdir).filter(f => f.startsWith('accounts.'))
  assert.equal(files.length, 3, `应只保留 3 份，实际 ${files.join(', ')}`)
  // 保留的必须是最新的三份（文件名里的时间戳字典序即时间序）
  assert.deepEqual(files.sort().map(f => f.slice(-9, -5)), ['0003', '0004', '0005'])
})

test('多个源文件各自独立轮转，互不挤占', () => {
  const dir = mkdir()
  const bdir = path.join(dir, 'backups')
  const a = path.join(dir, 'accounts.json')
  const b = path.join(dir, 'subscribers.json')
  fs.writeFileSync(a, '{}')
  fs.writeFileSync(b, '{}')
  for (let i = 0; i < 4; i++) {
    runBackup({ dir: bdir, keep: 2, targets: [a, b], now: new Date(Date.UTC(2026, 0, 1, 0, 0, i)) })
  }
  const files = fs.readdirSync(bdir)
  assert.equal(files.filter(f => f.startsWith('accounts.')).length, 2)
  assert.equal(files.filter(f => f.startsWith('subscribers.')).length, 2)
})
