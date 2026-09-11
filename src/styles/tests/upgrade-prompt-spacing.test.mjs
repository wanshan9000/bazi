import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')

test('积分不足升级卡与上方报告白卡保留独立间隙', () => {
  assert.match(css, /\.report-lock\s*\{[^}]*margin-top:\s*24px;/)
})
