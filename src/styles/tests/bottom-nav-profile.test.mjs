import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const cssBlock = selector => css.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

test('八项底栏在窄手机上保持等宽且文字不换行', () => {
  const link = cssBlock('\\.bn-link')
  const label = cssBlock('\\.bn-link \\.bl')

  assert.match(link, /min-width:\s*0;/)
  assert.match(label, /font-size:\s*clamp\(10px, 2\.9vw, 12px\);/)
  assert.match(label, /white-space:\s*nowrap;/)
})

test('底栏“我的”有与首页一致的紧凑个人标识', () => {
  const mark = cssBlock('\\.bn-profile-mark')

  assert.match(mark, /width:\s*20px;/)
  assert.match(mark, /height:\s*20px;/)
})
