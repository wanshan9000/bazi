// npm run agent:setup：把插件装进 profile（symlink）、生成技能目录、检查环境变量
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(here, '..', '..')
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

// 引擎打包产物：插件的所有排盘工具和 gen-skills 的内置技能表都从它导入，
// 是 dsh 侧一切功能的前置。dist/ 不入库，所以部署机上第一次 setup 必须先构建。
export function buildEngines() {
  execFileSync('npm', ['run', 'build:engines', '--silent'], { cwd: REPO_ROOT, stdio: 'inherit' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(path.join(SKILLS_DIR, '_admin'), { recursive: true })
  if (!fs.existsSync(ENGINES_FILE)) {
    console.log('[agent:setup] 未找到引擎打包产物，先构建：npm run build:engines')
    buildEngines()
  }
  installPlugin()
  let skillsOk = true
  try {
    await import('./gen-skills.mjs')
  } catch (e) {
    // 技能目录生成失败 = 模型没有任何 SKILL.md 可加载，等于装了个哑巴 agent。
    // 这里绝不能只是 warn 后打印“完成”，必须让 CI/部署脚本看到非零退出码。
    skillsOk = false
    process.exitCode = 1
    console.error('[agent:setup] 技能目录生成失败：', (e && e.message) || e)
    if (e && e.stack) console.error(e.stack)
  }
  const missing = checkEnv()
  if (missing.length) console.warn(`[agent:setup] server/.env 缺少：${missing.join(', ')}`)
  if (skillsOk) console.log('[agent:setup] 完成。profile:', PROFILE_DIR)
  else console.error('[agent:setup] 未完成：请先修复上面的技能生成错误，再重试 npm run agent:setup。')
}
