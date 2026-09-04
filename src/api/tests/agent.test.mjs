import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSseChunks } from '../agent.js'

test('按 \n\n 分帧，跨块拼接', () => {
  const p = parseSseChunks()
  assert.deepEqual(p.feed('data: {"type":"text","delta":"你"}\n\ndata: {"ty'), [{ type: 'text', delta: '你' }])
  assert.deepEqual(p.feed('pe":"done"}\n\n'), [{ type: 'done' }])
})

test('忽略非 JSON 行', () => {
  const p = parseSseChunks()
  assert.deepEqual(p.feed(': ping\n\n'), [])
})
