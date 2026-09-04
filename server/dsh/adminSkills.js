// 管理后台自定义技能 → server/dsh/skills/_admin/<name>/SKILL.md（skill-filesystem 会 watch 热加载）
import fs from 'node:fs'
import path from 'node:path'
import { skillToMarkdown, skillDirName, SKILLS_DIR } from './gen-skills.mjs'

export const ADMIN_SKILLS_DIR = path.join(SKILLS_DIR, '_admin')

export function syncAdminSkill(skill, dir = ADMIN_SKILLS_DIR) {
  const d = path.join(dir, skillDirName(skill.key))
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, 'SKILL.md'), skillToMarkdown(skill))
}

export function removeAdminSkill(key, dir = ADMIN_SKILLS_DIR) {
  fs.rmSync(path.join(dir, skillDirName(key)), { recursive: true, force: true })
}
