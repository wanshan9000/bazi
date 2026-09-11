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
