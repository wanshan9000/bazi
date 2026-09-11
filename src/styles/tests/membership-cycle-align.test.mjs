import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const rule = css.match(/\.mm-cycle-switch button\s*\{([^}]*)\}/)?.[1] || ''

test('会员周期字段在按钮内上下居中', () => {
  assert.match(rule, /align-items:\s*center;/)
})
