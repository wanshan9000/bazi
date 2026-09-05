import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { skillToMarkdown, writeSkills, skillDirName, readSkillDoc, SKILL_DOCS_DIR } from '../gen-skills.mjs'
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

test('skill-docs 长文正文拼接到人设之后，缺文档的技能不受影响', () => {
  const docsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-docs-'))
  fs.writeFileSync(path.join(docsDir, 'mangpai.md'), '## 第一原理\n\n不看旺衰。\n')
  assert.equal(readSkillDoc('mangpai', docsDir), '## 第一原理\n\n不看旺衰。')
  assert.equal(readSkillDoc('bazi', docsDir), '')

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-doc-'))
  writeSkills(dir, [
    { key: 'mangpai', name: '盲派', desc: 'd', sys: '你是盲派宗师' },
    { key: 'bazi', name: '八字', desc: 'd', sys: '你是子平宗师' },
  ], docsDir)
  const mp = fs.readFileSync(path.join(dir, 'mangpai', 'SKILL.md'), 'utf8')
  assert.match(mp, /## 断法与人设\n\n你是盲派宗师\n\n---\n\n## 第一原理/)
  const bz = fs.readFileSync(path.join(dir, 'bazi', 'SKILL.md'), 'utf8')
  assert.ok(!bz.includes('---\n\n##'), '无文档技能不应出现分隔线')
})

test('入库的 skill-docs 正文不含 Hermes 环境残留与具体命例', () => {
  for (const name of ['mangpai', 'wuyunliuqi', 'yixue-taishan']) {
    const doc = readSkillDoc(name, SKILL_DOCS_DIR)
    assert.ok(doc.length > 1000, `${name} 文档应存在`)
    for (const bad of ['.hermes', 'python3', 'subprocess', 'buildBazi', 'references/', '本八字', 'skill_manage', 'Djvu']) {
      assert.ok(!doc.includes(bad), `${name} 文档不应包含 ${bad}`)
    }
  }
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

test('skillDirName 对纯符号 key（kebab 化结果为空）退化为哈希目录名', () => {
  assert.match(skillDirName('___'), /^skill-[0-9a-f]{8}$/)
  assert.match(skillDirName('---'), /^skill-[0-9a-f]{8}$/)
  // 同一 key 每次派生结果稳定，便于覆盖同步/删除
  assert.equal(skillDirName('___'), skillDirName('___'))
})

test('同步/删除纯符号 key 技能不会波及 _admin 目录下的其它技能', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-symbol-'))
  syncAdminSkill({ key: 'normal-skill', name: '正常技能', desc: 'd', sys: 's' }, dir)
  assert.ok(fs.existsSync(path.join(dir, 'normal-skill', 'SKILL.md')))

  syncAdminSkill({ key: '___', name: '符号技能', desc: 'd', sys: 's' }, dir)
  const weirdDir = path.join(dir, skillDirName('___'))
  assert.ok(fs.existsSync(path.join(weirdDir, 'SKILL.md')))

  removeAdminSkill('___', dir)
  assert.ok(!fs.existsSync(weirdDir))
  // 关键断言：兄弟技能与 _admin 目录本身都还在
  assert.ok(fs.existsSync(dir))
  assert.ok(fs.existsSync(path.join(dir, 'normal-skill', 'SKILL.md')))
})

test('syncAdminSkill 对无 sys/cap/desc 的空技能不落盘，且清理已存在的旧目录', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-empty-'))
  const wroteFirst = syncAdminSkill({ key: 'goes-empty', name: 'X', desc: '有内容', sys: 's' }, dir)
  assert.equal(wroteFirst, true)
  assert.ok(fs.existsSync(path.join(dir, 'goes-empty', 'SKILL.md')))

  // 技能被编辑成空（desc/cap/sys 全无）：不应写出 description: "" 的垃圾文件，
  // 且应清掉此前同步的旧目录，使其从技能目录中消失
  const wroteSecond = syncAdminSkill({ key: 'goes-empty', name: 'X' }, dir)
  assert.equal(wroteSecond, false)
  assert.ok(!fs.existsSync(path.join(dir, 'goes-empty')))

  // 一开始就是空技能：同样不落盘
  const wroteBlankFromStart = syncAdminSkill({ key: 'blank-from-start', name: 'Y' }, dir)
  assert.equal(wroteBlankFromStart, false)
  assert.ok(!fs.existsSync(path.join(dir, 'blank-from-start')))
})
