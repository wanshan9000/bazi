// BUILTIN_SKILLS → server/dsh/skills/<name>/SKILL.md（dsh-skill-filesystem 格式）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const here = path.dirname(fileURLToPath(import.meta.url))
export const SKILLS_DIR = path.join(here, 'skills')
// 长文断法正文（手写、入库）：skill-docs/<目录名>.md 存在时拼到该技能 SKILL.md 人设之后。
// BUILTIN_SKILLS 里的 sys 只放精炼人设；表格、口诀、输出模板等放这里，避免把几十 KB 塞进 JS 字符串。
export const SKILL_DOCS_DIR = path.join(here, 'skill-docs')

export function skillDirName(key) {
  const raw = String(key)
  const kebab = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  // key 全由非字母数字组成（如 "___"、"---"）时 kebab 化结果为空串：
  // 绝不能返回空目录名——那会让调用方拼出 path.join(dir, '')（即 dir 本身），
  // 使写入/删除操作作用到整个技能目录而非某个技能子目录。退化为按 key 内容
  // 派生的稳定短哈希目录名，保证非空且合法 kebab-case。
  if (kebab) return kebab
  return `skill-${createHash('sha1').update(raw).digest('hex').slice(0, 8)}`
}

function yamlStr(s) {
  return JSON.stringify(String(s || '').replace(/\s+/g, ' ').trim())
}

export function readSkillDoc(key, docsDir = SKILL_DOCS_DIR) {
  const file = path.join(docsDir, `${skillDirName(key)}.md`)
  if (!fs.existsSync(file)) return ''
  return fs.readFileSync(file, 'utf8').trim()
}

export function skillToMarkdown(skill, doc = '') {
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
    ...(doc ? [`\n---\n\n${doc}`] : []),
    '',
  ].join('\n')
}

export function writeSkills(dir = SKILLS_DIR, skills, docsDir = SKILL_DOCS_DIR) {
  let n = 0
  for (const s of skills) {
    if (!s.sys && !s.cap) continue
    const d = path.join(dir, skillDirName(s.key))
    fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, 'SKILL.md'), skillToMarkdown(s, readSkillDoc(s.key, docsDir)))
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
