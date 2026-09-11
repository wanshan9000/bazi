import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const cssBlock = selector => css.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

test('八字报告的宫位卡会在窄容器中回落为可读宽度', () => {
  const grid = cssBlock('\\.br-palace-grid')

  assert.match(grid, /grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(100%, 320px\), 1fr\)\);/)
})

test('八字报告卡的标题与摘要不会把摘要压成竖排', () => {
  const head = cssBlock('\\.br-palace-head')
  const tag = cssBlock('\\.br-palace-tag')

  assert.match(head, /grid-template-columns:\s*max-content minmax\(0, 1fr\);/)
  assert.match(tag, /display:\s*-webkit-box;/)
  assert.match(tag, /-webkit-line-clamp:\s*3;/)
  assert.match(tag, /overflow:\s*hidden;/)
})
