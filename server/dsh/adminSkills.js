// 管理后台自定义技能 → server/dsh/skills/_admin/<name>/SKILL.md（skill-filesystem 会 watch 热加载）
import fs from 'node:fs'
import path from 'node:path'
import { skillToMarkdown, skillDirName, SKILLS_DIR } from './gen-skills.mjs'

export const ADMIN_SKILLS_DIR = path.join(SKILLS_DIR, '_admin')

// 防御性删除：只删 dir 下以 name 命名的子目录，绝不允许 name 解析后等于 dir
// 本身（例如 name 为空或 '.'）——那会导致把整个 _admin 目录连同其余技能一并删掉。
function removeSkillSubdir(dir, name) {
  if (!name) return
  const target = path.resolve(dir, name)
  if (target === path.resolve(dir)) return
  fs.rmSync(target, { recursive: true, force: true })
}

/**
 * 同步一个管理后台技能到 _admin/<name>/SKILL.md。
 * 若技能没有任何可用内容（desc/cap/sys 均为空），则不写入垃圾文件——
 * 若此前已同步过（例如技能被编辑成空），顺带删掉旧目录，让它从技能目录里消失。
 * @returns {boolean} 是否实际写入了文件
 */
export function syncAdminSkill(skill, dir = ADMIN_SKILLS_DIR) {
  const name = skillDirName(skill.key)
  if (!skill.sys && !skill.cap && !skill.desc) {
    removeSkillSubdir(dir, name)
    return false
  }
  const d = path.join(dir, name)
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, 'SKILL.md'), skillToMarkdown(skill))
  return true
}

export function removeAdminSkill(key, dir = ADMIN_SKILLS_DIR) {
  removeSkillSubdir(dir, skillDirName(key))
}
