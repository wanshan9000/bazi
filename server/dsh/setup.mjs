// npm run agent:setup：把插件装进 profile（symlink）、生成技能目录、检查环境变量
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
export const DSH_HOME = path.join(here, 'home')
export const PROFILE_DIR = path.join(DSH_HOME, 'profiles', 'lingshu')
export const PLUGIN_DIR = path.join(here, 'plugins', 'lingshu-tools')
export const SKILLS_DIR = path.join(here, 'skills')
export const ENGINES_FILE = path.join(PLUGIN_DIR, 'dist', 'engines.mjs')
export const PERSONA_FILE = path.join(here, 'persona.md')

export function installPlugin() {
  const link = path.join(PROFILE_DIR, 'node_modules', 'dsh-plugin-lingshu-tools')
  if (fs.existsSync(link)) return
  execFileSync('npm', ['i', '--no-audit', '--no-fund', '--silent', PLUGIN_DIR], { cwd: PROFILE_DIR, stdio: 'inherit' })
}

export function checkEnv() {
  dotenv.config({ path: path.join(here, '..', '.env') })
  const missing = ['DEEPSEEK_API_KEY'].filter(k => !process.env[k])
  return missing
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(path.join(SKILLS_DIR, '_admin'), { recursive: true })
  installPlugin()
  try {
    await import('./gen-skills.mjs')
  } catch (e) {
    console.warn('[agent:setup] 技能目录未生成（gen-skills.mjs 尚不存在或失败）：', e.message)
  }
  const missing = checkEnv()
  if (missing.length) console.warn(`[agent:setup] server/.env 缺少：${missing.join(', ')}`)
  console.log('[agent:setup] 完成。profile:', PROFILE_DIR)
}
