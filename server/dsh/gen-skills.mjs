// BUILTIN_SKILLS → server/dsh/skills/<name>/SKILL.md（dsh-skill-filesystem 格式）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const SKILLS_DIR = path.join(here, 'skills')

export function skillDirName(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function yamlStr(s) {
  return JSON.stringify(String(s || '').replace(/\s+/g, ' ').trim())
}

export function skillToMarkdown(skill) {
  const description = [skill.desc, skill.cap].filter(Boolean).join('。').slice(0, 600)
  return [
    '---',
    `name: ${skillDirName(skill.key)}`,
    `description: ${yamlStr(description)}`,
    '---',
    '',
    `# ${skill.name || skill.key}`,
    '',
    skill.cap ? `## 适用场景\n\n${skill.cap}\n` : '',
    `## 断法与人设\n\n${skill.sys || skill.desc || ''}`,
    '',
  ].join('\n')
}

export function writeSkills(dir = SKILLS_DIR, skills) {
  let n = 0
  for (const s of skills) {
    if (!s.sys && !s.cap) continue
    const d = path.join(dir, skillDirName(s.key))
    fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, 'SKILL.md'), skillToMarkdown(s))
    n++
  }
  return n
}

async function loadBuiltin() {
  const E = await import(path.join(here, 'plugins', 'lingshu-tools', 'dist', 'engines.mjs'))
  return E.BUILTIN_SKILLS
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = writeSkills(SKILLS_DIR, await loadBuiltin())
  console.log(`[gen-skills] 已生成 ${n} 个技能 → ${SKILLS_DIR}`)
}
