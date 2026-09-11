import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')

test('首页“大家都在测”沿用元氣测算的居中章节标题规格', () => {
  const headRule = css.match(/\.popular-tests-head\s*\{([\s\S]*?)\n\}/)?.[1] || ''
  const kickerRule = css.match(/\.popular-tests-kicker\s*\{([\s\S]*?)\n\}/)?.[1] || ''
  const titleRule = css.match(/\.popular-tests\s+h2\s*\{([\s\S]*?)\n\}/)?.[1] || ''
  const introRule = css.match(/\.popular-tests-head\s*>\s*p\s*\{([\s\S]*?)\n\}/)?.[1] || ''

  assert.match(headRule, /flex-direction:\s*column;/)
  assert.match(headRule, /align-items:\s*center;/)
  assert.match(kickerRule, /font-size:\s*11px;/)
  assert.match(kickerRule, /letter-spacing:\s*0\.32em;/)
  assert.match(titleRule, /font-size:\s*38px;/)
  assert.match(titleRule, /letter-spacing:\s*0\.18em;/)
  assert.match(introRule, /position:\s*static;/)
  assert.match(introRule, /text-align:\s*center;/)
})
