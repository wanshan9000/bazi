import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const cssBlock = selector => css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

test('应用壳使用稳定视口高度并裁掉意外横向溢出', () => {
  const html = cssBlock('html')
  const body = cssBlock('body')
  const shell = cssBlock('\\.app-shell')

  assert.match(html, /overflow-x:\s*clip;/)
  assert.match(html, /-webkit-text-size-adjust:\s*100%;/)
  assert.match(body, /min-height:\s*100svh;/)
  assert.match(body, /overflow-x:\s*clip;/)
  assert.match(shell, /min-height:\s*100svh;/)
})

test('奇门报告标题在手机不再使用 100vw 制造横向拖动', () => {
  const title = cssBlock('\\.qimen-report-page-title')
  assert.match(title, /width:\s*calc\(100% \+ 28px\);/)
  assert.match(title, /margin:\s*4px 0 18px -14px;/)
})

test('手机聚焦可编辑控件不会触发 Safari 自动缩放', () => {
  const mobileInputRule = css.match(/\/\* iOS Safari 会在聚焦小于 16px[\s\S]*?@media \(max-width: 720px\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(mobileInputRule, /font-size:\s*16px !important;/)
})
