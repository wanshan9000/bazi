import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { skillToMarkdown, writeSkills, skillDirName } from '../gen-skills.mjs'
import { syncAdminSkill, removeAdminSkill } from '../adminSkills.js'

test('skill key 转 kebab-case 目录名', () => {
  assert.equal(skillDirName('modern_huangli'), 'modern-huangli')
  assert.equal(skillDirName('yixue-taishan'), 'yixue-taishan')
})

test('SKILL.md 含 frontmatter 与正文', () => {
  const md = skillToMarkdown({ key: 'bazi', name: '八字解读', desc: '子平八字', cap: '能力', sys: '你是子平派宗师' })
  assert.match(md, /^---\nname: bazi\ndescription: /)
  assert.match(md, /你是子平派宗师/)
})

test('writeSkills 生成内置技能目录', async () => {
  const { BUILTIN_SKILLS } = await import('../plugins/lingshu-tools/dist/engines.mjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'))
  const n = writeSkills(dir, BUILTIN_SKILLS)
  assert.ok(n >= 10)
  assert.ok(fs.existsSync(path.join(dir, 'mangpai', 'SKILL.md')))
})

test('管理后台技能同步到 _admin', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-'))
  syncAdminSkill({ key: 'my_skill', name: '我的技能', desc: 'd', sys: 's' }, dir)
  assert.ok(fs.existsSync(path.join(dir, 'my-skill', 'SKILL.md')))
  removeAdminSkill('my_skill', dir)
  assert.ok(!fs.existsSync(path.join(dir, 'my-skill')))
})
