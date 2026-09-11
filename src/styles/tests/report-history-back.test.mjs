import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const component = fs.readFileSync(path.resolve(here, '../../components/NativeReportHistory.jsx'), 'utf8')
const historyBackRule = css.match(/\.report-history-mode\s+\.back-btn\s*\{([^}]*)\}/)?.[1] || ''

test('历史报告页在全站隐藏返回入口的规则下，仍显示顶部返回按钮', () => {
  assert.match(component, /className="back-btn"/)
  assert.match(component, /我的报告/)
  assert.match(css, /\.report-history-mode\s+\.back-btn\s*\{[\s\S]*?display:\s*inline-flex\s*!important;/)
})

test('历史报告的顶部返回按钮使用紧凑的 14px 字号', () => {
  assert.match(historyBackRule, /font-size:\s*14px;/)
})
