import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAgentStore } from '../agentStore.js'

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'as-')), 'agent_sessions.json')

test('创建/列出/按 uid 隔离', () => {
  const s = createAgentStore(tmp())
  const a = s.createSession('u1', { route: 'deepseek-flash', title: 'A' })
  s.createSession('u2', { route: 'deepseek-flash', title: 'B' })
  assert.equal(s.listSessions('u1').length, 1)
  assert.equal(s.getSession('u2', a.id), null)
  assert.equal(s.getSession('u1', a.id).title, 'A')
})

test('消息镜像上限 200 且更新 updatedAt', () => {
  const s = createAgentStore(tmp())
  const a = s.createSession('u1', { route: 'deepseek-flash' })
  for (let i = 0; i < 205; i++) s.appendMessage('u1', a.id, { role: 'user', text: `m${i}`, time: 't' })
  const msgs = s.listMessages('u1', a.id)
  assert.equal(msgs.length, 200)
  assert.equal(msgs[0].text, 'm5')
  assert.equal(s.getSession('u1', a.id).messageCount, 200)
})

test('删除会话', () => {
  const s = createAgentStore(tmp())
  const a = s.createSession('u1', { route: 'deepseek-flash' })
  assert.equal(s.deleteSession('u1', a.id), true)
  assert.equal(s.listSessions('u1').length, 0)
})

test('持久化到文件', () => {
  const f = tmp()
  const a = createAgentStore(f).createSession('u1', { route: 'deepseek-flash', title: 'X' })
  assert.equal(createAgentStore(f).getSession('u1', a.id).title, 'X')
})

test('删除别人的会话：返回 false 且不碰对方的消息', () => {
  const s = createAgentStore(tmp())
  const a = s.createSession('u1', { route: 'deepseek-flash' })
  s.appendMessage('u1', a.id, { role: 'user', text: '嗨', time: 't' })
  assert.equal(s.deleteSession('u2', a.id), false)
  assert.equal(s.listSessions('u1').length, 1)
  assert.deepEqual(s.listMessages('u1', a.id).map(m => m.text), ['嗨'])
})
