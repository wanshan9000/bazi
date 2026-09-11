import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const block = selector => css.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

test('删除确认弹窗有可渲染的危险主操作颜色与独立操作区', () => {
  const root = block(':root')
  const actions = block('\\.saved-report-confirm-actions')
  const danger = block('\\.saved-report-confirm-danger')

  assert.match(root, /--danger:\s*#[0-9a-fA-F]{6};/)
  assert.match(actions, /display:\s*grid;/)
  assert.match(actions, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/)
  assert.match(danger, /background:\s*var\(--danger\);/)
  assert.match(danger, /color:\s*#fff;/)
})
