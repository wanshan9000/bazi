import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const cssBlock = selector => css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

test('元气 Agent 的思考与工具折叠条使用紧凑的纵向间距', () => {
  assert.match(css, /\.think-block\s*\{[\s\S]*?margin:\s*4px 0 6px;/)
  assert.match(css, /\.tool-block\s*\{[\s\S]*?margin:\s*4px 0 6px;/)
})

test('思考折叠条保持可点击但不占用过高空间', () => {
  const thinkToggle = cssBlock('\\.think-toggle')
  assert.match(thinkToggle, /min-height:\s*36px;/)
  assert.match(thinkToggle, /padding:\s*5px 14px;/)
})

test('展开的思考内容区限制为半高阅读窗口', () => {
  const thinkBody = cssBlock('\\.think-body')
  assert.match(thinkBody, /height:\s*110px;/)
  assert.match(thinkBody, /overflow-y:\s*auto;/)
})
