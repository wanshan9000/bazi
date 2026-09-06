// legacy 的默认技能集必须与内置技能全集一致。
// 服务端 dsh 会把 server/dsh/skills/ 下的 SKILL.md 全量加载；legacy 若默认少几个，
// 同一个问题在两条路径上的能力范围就不一样，回退时表现莫名其妙地变弱。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CONFIG } from '../llm.js'
import { BUILTIN_SKILLS } from '../../data/skills.js'
import { skillDirName } from '../../../server/dsh/gen-skills.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')

test('DEFAULT_CONFIG.enabledSkills 覆盖全部内置技能', () => {
  const all = BUILTIN_SKILLS.map(s => s.key).sort()
  const enabled = [...DEFAULT_CONFIG.enabledSkills].sort()
  assert.deepEqual(enabled, all, `默认启用的技能与内置全集不一致，缺：${all.filter(k => !enabled.includes(k)).join(', ') || '无'}`)
})

test('内置技能与服务端 SKILL.md 目录一一对应', () => {
  const dir = path.join(repoRoot, 'server/dsh/skills')
  const dirs = fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name)
    .sort()
  // 目录名由 gen-skills 的 skillDirName 从 key 派生（kebab 化），不是 key 原文
  const expected = BUILTIN_SKILLS.map(s => skillDirName(s.key)).sort()
  assert.deepEqual(dirs, expected,
    `skills.js 与 server/dsh/skills/ 目录不一致：仅在目录中 ${dirs.filter(d => !expected.includes(d)).join(', ') || '无'}；仅在 skills.js 中 ${expected.filter(k => !dirs.includes(k)).join(', ') || '无'}`)
})
