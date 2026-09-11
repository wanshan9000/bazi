import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const component = fs.readFileSync(path.resolve(here, '../../components/ReportAgentFooter.jsx'), 'utf8')

test('报告咨询入口恢复为报告尾部的双按钮，而非固定悬浮', () => {
  assert.match(component, /className="report-agent-footer"/)
  assert.doesNotMatch(component, /report-agent-float/)
  assert.doesNotMatch(css, /\.report-agent-float[\s\S]*?position:\s*fixed;/)
  assert.doesNotMatch(css, /\.report-agent-float\s+\.report-agent-home\s*\{\s*display:\s*none;/)
})

test('报告页尾操作去除外层卡片，只保留双按钮与留白', () => {
  assert.match(css, /\.report-agent-footer-zone\s*\{[^}]*background:\s*transparent;/)
  assert.match(css, /\.report-agent-footer\s*\{[^}]*padding:\s*0;/)
  assert.match(css, /\.report-agent-footer\s*\{[^}]*border:\s*0;/)
  assert.match(css, /\.report-agent-footer\s*\{[^}]*background:\s*transparent;/)
  assert.match(css, /\.report-agent-footer\s*\{[^}]*box-shadow:\s*none;/)
})
