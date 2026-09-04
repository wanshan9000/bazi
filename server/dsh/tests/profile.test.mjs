import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DSH_HOME, PROFILE_DIR, SKILLS_DIR, installPlugin } from '../setup.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const dshBin = path.join(root, 'node_modules', '.bin', 'dsh')

test('lingshu profile 组合树：无 shell/编辑器，有命理工具与技能行', () => {
  installPlugin()
  const out = execFileSync(dshBin, ['--profile', 'lingshu', '--dump-config'], {
    cwd: PROFILE_DIR,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DSH_HOME, DSH_TELEMETRY_DISABLED: '1', LINGSHU_SKILLS_DIR: SKILLS_DIR },
    encoding: 'utf8',
  })
  // dsh-plugin-lingshu-tools 是纯字母数字连字符名，YAML dump 时不加引号
  // （@deepseek-ai/... 这类含 @ / 的名字才会被加引号）
  assert.match(out, /name: dsh-plugin-lingshu-tools/)
  assert.match(out, /name: '@deepseek-ai\/dsh-skill-filesystem'/)
  // disabled 行与 name 行之间可能夹着 config 块（如 str-replace-editor），
  // 所以断言「本行到下一个 - id: 之前」出现 disabled: true，而非严格相邻两行
  assert.match(out, /- id: persistent-bash\n(?:(?!- id:)[\s\S])*?disabled: true/)
  assert.match(out, /- id: str-replace-editor\n(?:(?!- id:)[\s\S])*?disabled: true/)
  assert.match(out, /mode: read-only/)
})
