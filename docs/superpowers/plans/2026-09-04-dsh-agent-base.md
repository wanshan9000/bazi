# 灵枢 Agent 迁移到 dsh 基座 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 DeepSeek Harness（dsh）子进程取代浏览器内手写 agent 编排：命理引擎变成 dsh 工具，Express 转 SSE，React 只渲染。

**Architecture:** `server/routes/agent.js` 通过 `@deepseek-ai/dsh-sdk-client` 常驻一个 `dsh --profile lingshu` 子进程（每个模型路由一个），把 `session.event` 归一化成 SSE 推给浏览器；profile 基于 `dsh-sdk-minimal` 去掉 shell/编辑器，挂本地插件 `dsh-plugin-lingshu-tools`（命理引擎经 Vite lib 打包成 Node bundle）与 SKILL.md 技能目录；前端新组件 `AgentChatDsh.jsx` 走 `/api/agent/chat`，旧 `AgentChat.jsx` 由 `VITE_AGENT_BACKEND=legacy` 保留一个版本。

**Tech Stack:** Node 26（ESM）、Express 5、`@deepseek-ai/dsh@0.1.2-rc.1`、`@deepseek-ai/dsh-sdk-client@0.1.2-rc.1`、`@deepseek-ai/dsh-tools`（defineTool）、Vite 6（lib/ssr 打包引擎）、React 18、`node --test`。

**Spec:** `docs/superpowers/specs/2026-09-04-dsh-agent-base-design.md`

## Global Constraints

- dsh 版本锁定 `0.1.2-rc.1`（package.json 用精确版本，不带 `^`）。
- dsh 子进程 env 只包含白名单：`PATH`、`HOME`、`DSH_HOME`、`DSH_TELEMETRY_DISABLED=1`、`DEEPSEEK_API_KEY`、`MINIMAX_API_KEY`、`LINGSHU_SKILLS_DIR`、`LINGSHU_ENGINES`。
- dsh 树内不得有 bash/文件/网页/subagent 工具；`sandbox-policy.mode: read-only`。
- 模型输出上限 `maxTokens: 8192`；`llm-deepseek.reasoningEffort: low`。
- 本地插件必须是真实 npm 包（`package.json` 含非空 `name`/`version`、`"type": "module"`），以裸包名 `dsh-plugin-lingshu-tools` 装进 profile；patch 的 `name` 字段是纯字符串，不用 `!!js`。
- 所有服务端新文件放 `server/dsh/` 与 `server/routes/agent.js`；测试用 `node --test`，文件名 `*.test.mjs`。
- 前端用户识别头：`X-Genki-Uid`；游客值为 `anon:<deviceId>`。
- `/api/agent/chat` 的 `text` 长度 ≤ 2000 字；限流 uid+IP 每分钟 20 次。
- 提交信息用英文前缀（feat/fix/test/docs/chore），每个任务至少一次 commit，末尾附 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`。
- 中文注释与文案沿用仓库风格。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `server/dsh/home/profiles/lingshu/package.json` | profile 清单：bundles + 插件依赖 |
| `server/dsh/home/profiles/lingshu/cordis.patch.yml` | 组合树覆盖：禁用 shell、persona、模型路由、插入工具/技能/压缩行 |
| `server/dsh/setup.mjs` | `npm run agent:setup`：初始化 profile、装插件 symlink、生成 SKILL.md、检查 env |
| `server/dsh/plugins/lingshu-tools/package.json` | 插件包声明 |
| `server/dsh/plugins/lingshu-tools/index.js` | `apply(ctx)`：注册全部工具 |
| `server/dsh/plugins/lingshu-tools/birth.js` | 出生参数 → `buildChart` 的共享转换（含农历） |
| `server/dsh/plugins/lingshu-tools/tools/*.js` | 每个工具一个 `defineTool` 定义 |
| `server/dsh/plugins/lingshu-tools/engines.entry.js` | Vite lib 入口：re-export 引擎 |
| `server/dsh/plugins/lingshu-tools/dist/engines.mjs` | 打包产物（gitignore） |
| `server/dsh/persona.md` | 司命人设 |
| `server/dsh/gen-skills.mjs` | `BUILTIN_SKILLS` → `server/dsh/skills/<name>/SKILL.md` |
| `server/dsh/skills/` | 技能目录（生成物提交；`_admin/` gitignore） |
| `server/dsh/events.js` | dsh 通知 → SSE 事件归一化（纯函数） |
| `server/dsh/pool.js` | `DshPool`：按路由持有 `HarnessClient`，run 一轮 |
| `server/dsh/agentStore.js` | `server/data/agent_sessions.json`：uid↔session 索引 + 消息镜像 |
| `server/dsh/smoke.mjs` | 真 key 冒烟 |
| `server/routes/agent.js` | `/api/agent/*` |
| `vite.engines.config.js` | 引擎 lib 打包配置 |
| `src/api/agent.js` | 前端 SSE 客户端 |
| `src/components/agent/ChatParts.jsx` | 从 AgentChat.jsx 抽出的 ThinkBlock/ToolCallsBlock/FeedbackBar/CopyButton/renderAiText/timeNow/fmtSessionTime |
| `src/components/AgentChatDsh.jsx` | 新对话组件（渲染 + SSE 接管） |
| `src/App.jsx` | 按 `VITE_AGENT_BACKEND` 选择组件 |

---

### Task 1: 依赖、profile 骨架与 setup 脚本

**Files:**
- Modify: `package.json`（dependencies、scripts）
- Modify: `.gitignore`
- Create: `server/dsh/home/profiles/lingshu/package.json`
- Create: `server/dsh/home/profiles/lingshu/cordis.patch.yml`
- Create: `server/dsh/plugins/lingshu-tools/package.json`
- Create: `server/dsh/plugins/lingshu-tools/index.js`（空插件，Task 3 填工具）
- Create: `server/dsh/setup.mjs`
- Test: `server/dsh/tests/profile.test.mjs`

**Interfaces:**
- Produces: 可启动的 profile `lingshu`；`npm run agent:setup`；插件包 `dsh-plugin-lingshu-tools` 导出 `{ name, inject, apply }`。

- [ ] **Step 1: 安装依赖并加脚本**

```bash
npm i -E @deepseek-ai/dsh@0.1.2-rc.1 @deepseek-ai/dsh-sdk-client@0.1.2-rc.1 --no-audit --no-fund
```

在 `package.json` 的 `scripts` 中加入：

```json
"agent:setup": "node server/dsh/setup.mjs",
"agent:smoke": "node server/dsh/smoke.mjs",
"build:engines": "vite build --config vite.engines.config.js",
"pretest": "npm run build:engines",
"test": "node --test server/dsh/tests/ server/tests/ src/api/tests/"
```

`.gitignore` 追加：

```
# dsh 运行时
server/dsh/home/sessions/
server/dsh/home/storages/
server/dsh/home/profiles/lingshu/node_modules/
server/dsh/home/profiles/lingshu/package-lock.json
server/dsh/home/profiles/lingshu/.dsh-module-fallback/
server/dsh/plugins/lingshu-tools/dist/
server/dsh/skills/_admin/
```

- [ ] **Step 2: 写插件包骨架**

`server/dsh/plugins/lingshu-tools/package.json`：

```json
{
  "name": "dsh-plugin-lingshu-tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "index.js",
  "exports": "./index.js"
}
```

`server/dsh/plugins/lingshu-tools/index.js`：

```js
// dsh 插件：把灵枢命理引擎注册为模型可调用的工具
export const name = 'lingshu-tools'
export const inject = ['tools']

export function apply(ctx) {
  // Task 3 起在此逐个 ctx.tools.register(...)
  console.error('[lingshu-tools] 已挂载')
}
```

- [ ] **Step 3: 写 profile 清单与 patch**

`server/dsh/home/profiles/lingshu/package.json`：

```json
{
  "name": "dsh-profile-lingshu",
  "private": true,
  "dependencies": {},
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-sdk-minimal"],
      "patchReload": "startup"
    }
  }
}
```

`server/dsh/home/profiles/lingshu/cordis.patch.yml`：

```yaml
# 灵枢 agent profile：基于 dsh-sdk-minimal（独立树，无 dsh-base），
# 去掉 shell/编辑器/pty，只保留模型 + 会话 + 命理工具 + 技能。
# 注意：patch 会整体替换目标行的 config，需要保留的字段必须重述。
- id: sdk-app-startup
  config:
    profile: lingshu

# ── 去掉一切可执行/写文件能力 ──
- id: terminal-bash
  disabled: true
- id: terminal-pwsh
  disabled: true
- id: persistent-bash
  disabled: true
- id: persistent-pwsh
  disabled: true
- id: str-replace-editor
  disabled: true
- id: pty
  disabled: true
- id: sandbox-policy
  config:
    mode: read-only
    workspaceRoot: !!js process.cwd()

# ── 人设：不要 coding agent 身份与 runtime 上下文 ──
- id: system-prompt
  config:
    includeHarnessIdentity: false
    includeRuntimeContext: false
    persona: !!js process.env.LINGSHU_PERSONA ?? '你是「司命」，玄学命理助手。'

# ── 模型：DeepSeek 官方 ──
- id: llm-deepseek
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
    reasoningEffort: low
    maxTokens: 8192
    defaultContextWindow: 1000000
    streamIdleTimeoutMs: 300000

- insert:
    # 备选模型：MiniMax（OpenAI 兼容网关）
    - id: llm-pi-ai
      name: '@deepseek-ai/dsh-llm-pi-ai'
      config:
        providers:
          minimax:
            displayName: MiniMax
            apiKeyEnv: MINIMAX_API_KEY
            api: openai-completions
            baseURL: https://api.minimaxi.com/v1
            models:
              - id: MiniMax-M2.7
                name: MiniMax M2.7
                contextWindow: 1000000
                reasoningEfforts: false

    # 命理工具
    - id: lingshu-tools
      name: 'dsh-plugin-lingshu-tools'

    # 技能：只扫我们自己的目录
    - id: skill
      name: '@deepseek-ai/dsh-skill'
    - id: skill-filesystem
      name: '@deepseek-ai/dsh-skill-filesystem'
      config:
        includeDefaultRoots: false
        customSkillDirs: !!js [process.env.LINGSHU_SKILLS_DIR, process.env.LINGSHU_SKILLS_DIR + '/_admin']
    - id: tool-skill
      name: '@deepseek-ai/dsh-tool-skill'

    # 长会话压缩（Task 1 Step 6 验证能否挂载；挂不上则删除这三行）
    - id: token-meter
      name: '@deepseek-ai/dsh-token-meter'
    - id: compaction-basic
      name: '@deepseek-ai/dsh-compaction-basic'
    - id: tool-result-pruner
      name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
      config:
        thresholdChars: 8192
        headChars: 4096
        tailChars: 1024
```

- [ ] **Step 4: 写 setup 脚本**

`server/dsh/setup.mjs`：

```js
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
```

- [ ] **Step 5: 写 profile 启动测试**

`server/dsh/tests/profile.test.mjs`：

```js
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
  assert.match(out, /name: 'dsh-plugin-lingshu-tools'/)
  assert.match(out, /name: '@deepseek-ai\/dsh-skill-filesystem'/)
  assert.match(out, /id: persistent-bash\n\s+name: [^\n]+\n\s+disabled: true/)
  assert.match(out, /id: str-replace-editor\n\s+name: [^\n]+\n\s+disabled: true/)
  assert.match(out, /mode: read-only/)
})
```

- [ ] **Step 6: 运行测试，并验证树能真正启动**

```bash
node --test server/dsh/tests/profile.test.mjs
```
Expected: PASS。

再验证启动（initialize 握手成功即为通过；假 key 足够）：

```bash
cd server/dsh/home/profiles/lingshu && printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"cwd":"/tmp","provider":"deepseek-official","model":"deepseek-v4-flash"}}' | DSH_HOME=$PWD/../.. DSH_TELEMETRY_DISABLED=1 DEEPSEEK_API_KEY=sk-x LINGSHU_SKILLS_DIR=$PWD/../../../skills ../../../../../node_modules/.bin/dsh --profile lingshu 2>err.log | head -1; cat err.log | head -20
```
Expected: stdout 一行含 `"deepseek-harness-sdk-runtime"`；stderr 含 `[lingshu-tools] 已挂载`，且**无** `plugin tree failed to load`。
若 stderr 报 `token-meter`/`compaction-basic`/`tool-result-pruner` 某行缺少服务无法加载：删除 patch 中该三行，并在 `docs/superpowers/specs/2026-09-04-dsh-agent-base-design.md` §14 追加一句"compaction 三行在 sdk-minimal 树上不可挂载，本期省略"。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore server/dsh
git commit -m "feat(agent): scaffold dsh lingshu profile and tools plugin package"
```

---

### Task 2: 命理引擎打包成 Node bundle

**Files:**
- Create: `vite.engines.config.js`
- Create: `server/dsh/plugins/lingshu-tools/engines.entry.js`
- Test: `server/dsh/tests/engines.test.mjs`

**Interfaces:**
- Produces: `server/dsh/plugins/lingshu-tools/dist/engines.mjs`，导出 `buildChart, buildBaziFull, buildFusedHuangli, buildZiwei, buildLiuyaoPan, buildQimenFull, buildDaily, drawCards, interpretTarot, analyzeName, recommendName, analyzeFengshui, buildWuyunliuqi, buildReport, buildMangpaiContext, lunarToSolar, BUILTIN_SKILLS`。

- [ ] **Step 1: 写入口**

`server/dsh/plugins/lingshu-tools/engines.entry.js`：

```js
// Vite lib 入口：把浏览器侧引擎打成一份 Node 可 import 的 ESM bundle。
// 浏览器全局兜底：个别数据模块在函数内引用 localStorage，Node 下给一个内存实现。
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map()
  globalThis.localStorage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)) },
    removeItem: k => { mem.delete(k) },
    clear: () => mem.clear(),
  }
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis

export { buildChart } from '../../../../src/engine/bazi.js'
export { buildBaziFull, buildFusedHuangli } from '../../../../src/engine/cantian.js'
export { buildZiwei } from '../../../../src/engine/ziwei.js'
export { buildLiuyaoPan } from '../../../../src/engine/liuyao.js'
export { buildQimenFull } from '../../../../src/engine/qimen.js'
export { buildDaily } from '../../../../src/engine/huangli.js'
export { drawCards, interpret as interpretTarot } from '../../../../src/data/tarot.js'
export { analyzeName, recommendName } from '../../../../src/engine/nameAnalysis.js'
export { analyzeFengshui } from '../../../../src/engine/fengshui.js'
export { buildWuyunliuqi } from '../../../../src/engine/wuyunliuqi.js'
export { buildReport } from '../../../../src/engine/reports.js'
export { buildMangpaiContext } from '../../../../src/engine/mangpaiContext.js'
export { lunarToSolar } from '../../../../src/utils/lunar.js'
export { BUILTIN_SKILLS } from '../../../../src/data/skills.js'
```

- [ ] **Step 2: 写 Vite 配置**

`vite.engines.config.js`：

```js
// 命理引擎 → Node bundle（供 dsh 插件使用）。ssr 模式：不做浏览器 polyfill、保留 node 内置模块。
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  build: {
    ssr: true,
    outDir: 'server/dsh/plugins/lingshu-tools/dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: path.resolve('server/dsh/plugins/lingshu-tools/engines.entry.js'),
      output: { format: 'es', entryFileNames: 'engines.mjs' },
    },
  },
  ssr: {
    // 把所有依赖一起打进去（含发 .ts 源码的 bigfishmarquis-qimen），产物零外部依赖
    noExternal: true,
  },
})
```

- [ ] **Step 3: 写测试**

`server/dsh/tests/engines.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../plugins/lingshu-tools/dist/engines.mjs')

test('buildChart 在 Node 下可用且四柱稳定', () => {
  const c = E.buildChart(1990, 5, 6, 8, '男')
  assert.equal(c.pillars.length, 4)
  assert.equal(c.pillars.map(p => p.gan + p.zhi).join(' '), '庚午 辛巳 癸卯 丙辰')
})

test('奇门与统一报告引擎可加载（曾因 .ts 源码在 Node 下失败）', () => {
  assert.equal(typeof E.buildQimenFull, 'function')
  const rep = E.buildReport('bazi', E.buildChart(1990, 5, 6, 8, '男'), {})
  assert.equal(rep.ok, true)
  assert.match(rep.markdown, /庚午/)
})

test('塔罗抽牌不依赖浏览器 localStorage', () => {
  const r = E.drawCards('single', 42)
  assert.equal(r.cards.length, 1)
})
```

- [ ] **Step 4: 打包并跑测试**

```bash
npm run build:engines && node --test server/dsh/tests/engines.test.mjs
```
Expected: 打包成功，3 个测试 PASS。若打包报某模块引用浏览器全局（如 `document`），在 `engines.entry.js` 顶部按同样方式补空实现；若报 `.ts` 解析失败，在 `vite.engines.config.js` 的 `ssr.noExternal` 保持 `true` 并追加 `esbuild: { target: 'node20' }`。
若四柱断言值与实际不符（引擎口径差异），以实际输出为准修正测试中的期望字符串，并在提交信息里注明。

- [ ] **Step 5: Commit**

```bash
git add vite.engines.config.js server/dsh/plugins/lingshu-tools/engines.entry.js server/dsh/tests/engines.test.mjs
git commit -m "feat(agent): bundle divination engines for Node via vite lib build"
```

---

### Task 3: `bazi` 工具与出生参数转换

**Files:**
- Create: `server/dsh/plugins/lingshu-tools/birth.js`
- Create: `server/dsh/plugins/lingshu-tools/tools/bazi.js`
- Modify: `server/dsh/plugins/lingshu-tools/index.js`
- Test: `server/dsh/tests/tools-bazi.test.mjs`

**Interfaces:**
- Produces: `birth.js` 导出 `BIRTH_PARAMS`（defineTool 参数片段）与 `chartFromArgs(E, args) → chart`；`tools/bazi.js` 导出 `makeBaziTool(E) → ToolDefinition`；`index.js` 从 `process.env.LINGSHU_ENGINES` 动态 import 引擎。

- [ ] **Step 1: 写出生参数共享模块**

`server/dsh/plugins/lingshu-tools/birth.js`：

```js
// 出生参数：所有排盘类工具共用。模型必须显式给出，不再依赖前端闭包里的命盘。
export const BIRTH_PARAMS = {
  year: { type: 'integer', required: true, description: '出生年（四位）' },
  month: { type: 'integer', required: true, description: '出生月 1-12' },
  day: { type: 'integer', required: true, description: '出生日 1-31' },
  hour: { type: 'integer', required: true, description: '出生小时 0-23；用户只知道时辰时取时辰中点（如午时→12）；完全不知则传 12 并在回答中说明' },
  gender: { type: 'string', required: true, enum: ['男', '女'], description: '性别' },
  calendar: { type: 'string', enum: ['solar', 'lunar'], description: '年月日是公历(solar)还是农历(lunar)，默认公历' },
  leapMonth: { type: 'boolean', description: '农历闰月时为 true' },
}

export function chartFromArgs(E, args) {
  let { year, month, day } = args
  if (args.calendar === 'lunar') ({ year, month, day } = E.lunarToSolar(year, month, day, !!args.leapMonth))
  const chart = E.buildChart(year, month, day, args.hour ?? 12, args.gender)
  if (!chart || !chart.pillars || chart.pillars.length !== 4) throw new Error('排盘失败：出生信息无效')
  return chart
}

export function birthLine(chart) {
  return `${chart.gender === '女' ? '坤造' : '乾造'} ${chart.year}年${chart.month}月${chart.day}日 ${chart.hour ?? 12}时（公历）`
}
```

- [ ] **Step 2: 写失败测试**

`server/dsh/tests/tools-bazi.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeBaziTool } from '../plugins/lingshu-tools/tools/bazi.js'

const E = await import('../plugins/lingshu-tools/dist/engines.mjs')
const exec = { signal: new AbortController().signal }

test('bazi 工具：公历输入返回四柱与大运', async () => {
  const tool = makeBaziTool(E)
  assert.equal(tool.name, 'bazi')
  const out = await tool.execute({ year: 1990, month: 5, day: 6, hour: 8, gender: '男' }, exec)
  assert.match(out, /庚午/)
  assert.match(out, /大运/)
  assert.match(out, /乾造 1990年5月6日 8时/)
})

test('bazi 工具：农历输入先转公历', async () => {
  const tool = makeBaziTool(E)
  const out = await tool.execute({ year: 1990, month: 4, day: 12, hour: 8, gender: '男', calendar: 'lunar' }, exec)
  assert.match(out, /1990年5月6日/)
})

test('bazi 工具：盲派流派附做功要点且不含子平术语段', async () => {
  const tool = makeBaziTool(E)
  const out = await tool.execute({ year: 1990, month: 5, day: 6, hour: 8, gender: '男', school: 'mangpai' }, exec)
  assert.match(out, /盲派/)
})
```

- [ ] **Step 3: 运行测试确认失败**

```bash
node --test server/dsh/tests/tools-bazi.test.mjs
```
Expected: FAIL（找不到 `../plugins/lingshu-tools/tools/bazi.js`）。

- [ ] **Step 4: 实现 bazi 工具**

`server/dsh/plugins/lingshu-tools/tools/bazi.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BIRTH_PARAMS, chartFromArgs, birthLine } from '../birth.js'

const SYSTEM_NOTE = '【体系声明·必须遵守】八字大运按节气交运（阳男阴女顺排、阴男阳女逆排），起运日期/起运年龄以此处数据为准；紫微大限按五行局起限，是另一套算法，两者数字严禁混用、严禁编造。'

export function makeBaziTool(E) {
  return defineTool({
    name: 'bazi',
    description: '按出生年月日时与性别排八字四柱，返回四柱、十神、藏干、纳音、空亡、神煞、身强弱、喜用神、大运（含起运日期/起运年龄）。回答八字命局、五行喜忌、流年大运、几岁起运时调用。school=mangpai 时附盲派做功要点（体用宾主/根基/做功）。',
    parameters: {
      ...BIRTH_PARAMS,
      school: { type: 'string', enum: ['ziping', 'mangpai'], description: '流派：子平(默认)或盲派' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const chart = chartFromArgs(E, args)
      const segs = [`【命主】${birthLine(chart)}`, E.buildBaziFull(chart)]
      if (chart.daYunList && chart.daYunList.length) {
        const cur = chart.daYunList.find(d => d.isNow)
        segs.push(`【八字大运】起运 ${chart.qiYunText || `${chart.qiYunAge} 岁`}（${chart.qiYunDate || ''}）。当前大运：${cur ? `${cur.g}${cur.z}（${cur.startAge}-${cur.endAge} 岁，${cur.start}-${cur.end}）` : '见上表'}。`)
      }
      if (args.school === 'mangpai') {
        segs.push('【盲派做功要点】', E.buildMangpaiContext(chart))
      }
      segs.push(SYSTEM_NOTE)
      return segs.join('\n')
    },
  })
}
```

`server/dsh/plugins/lingshu-tools/index.js` 改为：

```js
// dsh 插件：把灵枢命理引擎注册为模型可调用的工具
import { makeBaziTool } from './tools/bazi.js'

export const name = 'lingshu-tools'
export const inject = ['tools']

async function loadEngines() {
  const file = process.env.LINGSHU_ENGINES
  if (!file) throw new Error('lingshu-tools: 缺少 LINGSHU_ENGINES（engines.mjs 路径）')
  return import(file)
}

export const TOOL_FACTORIES = [makeBaziTool]

export async function apply(ctx) {
  const E = await loadEngines()
  for (const make of TOOL_FACTORIES) {
    const tool = make(E)
    ctx.effect(() => ctx.tools.register(tool), `lingshu.${tool.name}`)
  }
  console.error('[lingshu-tools] 已注册工具：', ctx.tools.schemas().map(t => t.name).join(','))
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
node --test server/dsh/tests/tools-bazi.test.mjs
```
Expected: 3 PASS。若 `buildMangpaiContext(chart)` 返回对象而非字符串（查看 `src/engine/mangpaiContext.js` 的返回值），改为 `JSON.stringify` 前先取其 `text` 字段或拼接其字段。

- [ ] **Step 6: 验证插件在 dsh 树中真的注册了工具**

```bash
cd server/dsh/home/profiles/lingshu && printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"cwd":"/tmp","provider":"deepseek-official","model":"deepseek-v4-flash"}}' | DSH_HOME=$PWD/../.. DSH_TELEMETRY_DISABLED=1 DEEPSEEK_API_KEY=sk-x LINGSHU_SKILLS_DIR=$PWD/../../../skills LINGSHU_ENGINES=$PWD/../../../plugins/lingshu-tools/dist/engines.mjs ../../../../../node_modules/.bin/dsh --profile lingshu 2>&1 >/dev/null | grep lingshu-tools
```
Expected: `[lingshu-tools] 已注册工具： bazi`（skill 工具也可能出现在列表里）。

- [ ] **Step 7: Commit**

```bash
git add server/dsh/plugins/lingshu-tools server/dsh/tests/tools-bazi.test.mjs
git commit -m "feat(agent): register bazi tool with explicit birth parameters"
```

---

### Task 4: 其余排盘工具

**Files:**
- Create: `server/dsh/plugins/lingshu-tools/tools/ziwei.js`、`liuyao.js`、`qimen.js`、`huangli.js`、`tarot.js`、`name.js`、`fengshui.js`、`wuyunliuqi.js`
- Modify: `server/dsh/plugins/lingshu-tools/index.js`（TOOL_FACTORIES）
- Test: `server/dsh/tests/tools-misc.test.mjs`

**Interfaces:**
- Consumes: `BIRTH_PARAMS`、`chartFromArgs(E, args)`、`birthLine(chart)`。
- Produces: `makeZiweiTool, makeLiuyaoTool, makeQimenTool, makeHuangliTool, makeModernHuangliTool, makeTarotTool, makeNameTool, makeFengshuiTool, makeWuyunliuqiTool`，均 `(E) → ToolDefinition`。

- [ ] **Step 1: 写失败测试**

`server/dsh/tests/tools-misc.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOL_FACTORIES } from '../plugins/lingshu-tools/index.js'

const E = await import('../plugins/lingshu-tools/dist/engines.mjs')
const exec = { signal: new AbortController().signal }
const tools = Object.fromEntries(TOOL_FACTORIES.map(f => { const t = f(E); return [t.name, t] }))
const birth = { year: 1990, month: 5, day: 6, hour: 8, gender: '男' }

test('注册了全部 10 个基础工具', () => {
  assert.deepEqual(Object.keys(tools).sort(), ['bazi', 'fengshui', 'huangli', 'liuyao', 'modern_huangli', 'name', 'qimen', 'tarot', 'wuyunliuqi', 'ziwei'])
})

test('ziwei 返回十二宫', async () => {
  assert.match(await tools.ziwei.execute(birth, exec), /命宫/)
})
test('liuyao 起卦返回卦名', async () => {
  assert.match(await tools.liuyao.execute({ question: '这次跳槽如何' }, exec), /卦/)
})
test('qimen 排盘', async () => {
  assert.match(await tools.qimen.execute({ datetime: '2026-09-04 10:00' }, exec), /值符|九宫|八门/)
})
test('huangli 指定日期', async () => {
  assert.match(await tools.huangli.execute({ date: '2026-09-04' }, exec), /宜|忌/)
})
test('modern_huangli', async () => {
  assert.match(await tools.modern_huangli.execute({ date: '2026-09-04', scenario: 'worker' }, exec), /宜|忌/)
})
test('tarot 三张牌', async () => {
  assert.match(await tools.tarot.execute({ spread: 'three', question: '感情' }, exec), /正位|逆位/)
})
test('name 分析具体名字', async () => {
  assert.match(await tools.name.execute({ fullName: '王小明', ...birth }, exec), /五格/)
})
test('name 推荐名字', async () => {
  assert.match(await tools.name.execute({ surname: '王', ...birth }, exec), /推荐/)
})
test('fengshui 需要门向', async () => {
  const out = await tools.fengshui.execute({ door: '东', rooms: [{ name: '主卧', dir: '北' }], ...birth }, exec)
  assert.match(out, /风水布局分析/)
})
test('wuyunliuqi', async () => {
  assert.match(await tools.wuyunliuqi.execute(birth, exec), /中运|司天/)
})
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test server/dsh/tests/tools-misc.test.mjs
```
Expected: FAIL（第一个断言只有 `bazi`）。

- [ ] **Step 3: 实现各工具**

`tools/ziwei.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BIRTH_PARAMS, chartFromArgs, birthLine } from '../birth.js'

export function makeZiweiTool(E) {
  return defineTool({
    name: 'ziwei',
    description: '按出生年月日时与性别排紫微斗数命盘：命宫总格、十二宫主星、四化、大限（按五行局起限）。问紫微、十二宫、星曜、大限时调用。注意紫微"大限"与八字"大运"是两套算法，不可混用。',
    parameters: { ...BIRTH_PARAMS, targetDate: { type: 'string', description: '流年/流月目标日期 YYYY-MM-DD，可省略' } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const chart = chartFromArgs(E, args)
      return `【命主】${birthLine(chart)}\n${E.buildZiwei(chart, args.targetDate ? new Date(args.targetDate) : undefined)}`
    },
  })
}
```

`tools/liuyao.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'

export function makeLiuyaoTool(E) {
  return defineTool({
    name: 'liuyao',
    description: '就一件具体事随机起一卦（六爻纳甲装卦），返回本卦/变卦、动爻、世应、六亲。用户问"某事要不要做/会怎样/帮我起一卦"时调用；用户报了三个数字时传 n1 n2 n3。',
    parameters: {
      question: { type: 'string', required: true, description: '所问之事' },
      n1: { type: 'integer' }, n2: { type: 'integer' }, n3: { type: 'integer' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      return `【所问】${args.question}\n${E.buildLiuyaoPan({ n1: args.n1, n2: args.n2, n3: args.n3, question: args.question })}`
    },
  })
}
```

`tools/qimen.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'

export function makeQimenTool(E) {
  return defineTool({
    name: 'qimen',
    description: '奇门遁甲排盘（时家+日家+月家+年家）。问奇门、九宫、八门、值符值使、择时方位时调用。',
    parameters: { datetime: { type: 'string', description: '起局时间 YYYY-MM-DD HH:mm，省略为现在' } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const d = args.datetime ? new Date(args.datetime.replace(' ', 'T')) : new Date()
      if (Number.isNaN(d.getTime())) throw new Error('datetime 格式应为 YYYY-MM-DD HH:mm')
      return E.buildQimenFull(d)
    },
  })
}
```

`tools/huangli.js`（两个工具）：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BIRTH_PARAMS, chartFromArgs } from '../birth.js'

const OPTIONAL_BIRTH = Object.fromEntries(Object.entries(BIRTH_PARAMS).map(([k, v]) => [k, { ...v, required: undefined }]))
function today() { const t = new Date(); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}` }
function toLocalDate(s) { const p = String(s).split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1) }

export function makeHuangliTool(E) {
  return defineTool({
    name: 'huangli',
    description: '查某天老黄历宜忌、吉神凶煞、冲煞，可结合命主八字给开运建议。问黄历、宜忌、吉日、搬家开业嫁娶择日时调用。',
    parameters: { date: { type: 'string', description: 'YYYY-MM-DD，省略为今天' }, scenario: { type: 'string', description: '场景：worker/student/boss 等，可省略' }, ...OPTIONAL_BIRTH },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const dateStr = args.date || today()
      const chart = args.year && args.month && args.day && args.gender ? chartFromArgs(E, args) : null
      const d = E.buildDaily(toLocalDate(dateStr), chart)
      const extra = {}
      if (d.action) extra.action = d.action
      if (d.tips) extra.tips = d.tips
      return E.buildFusedHuangli(dateStr, args.scenario, extra)
    },
  })
}

export function makeModernHuangliTool(E) {
  return defineTool({
    name: 'modern_huangli',
    description: '现代幽默黄历（打工人/学生/老板视角的宜忌，娱乐向）。用户说沙雕黄历、打工人黄历、摸鱼宜忌时调用。',
    parameters: { date: { type: 'string', description: 'YYYY-MM-DD，省略为今天' }, scenario: { type: 'string', description: 'worker/student/boss' } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) { return E.buildFusedHuangli(args.date || today(), args.scenario) },
  })
}
```

`tools/tarot.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'

export function makeTarotTool(E) {
  return defineTool({
    name: 'tarot',
    description: '抽塔罗牌并给牌意（single 单张 / three 三张过去现在未来）。用户要抽牌、看塔罗、感情抉择指引时调用。',
    parameters: { spread: { type: 'string', enum: ['single', 'three'], description: '牌阵，默认 single' }, question: { type: 'string', description: '所问之事' } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const result = E.drawCards(args.spread || 'single', Date.now())
      if (!result) throw new Error('塔罗牌阵加载失败')
      const interp = E.interpretTarot(result, args.question || '')
      const lines = ['【塔罗抽牌结果】', ...result.cards.map((c, i) => `第${i + 1}张：${c.name}（${c.reversed ? '逆位' : '正位'}）｜关键词：${(c.kw || []).join('、')}`)]
      if (interp?.summary) lines.push(interp.summary)
      if (interp?.perCard) interp.perCard.forEach((p, i) => lines.push(`牌${i + 1}牌意：${p.text}`))
      if (interp?.suggestion) lines.push(`行动建议：${interp.suggestion}`)
      return lines.join('\n')
    },
  })
}
```

`tools/name.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BIRTH_PARAMS, chartFromArgs } from '../birth.js'

const OPTIONAL_BIRTH = Object.fromEntries(Object.entries(BIRTH_PARAMS).map(([k, v]) => [k, { ...v, required: undefined }]))

export function makeNameTool(E) {
  return defineTool({
    name: 'name',
    description: '姓名五格三才分析（给 fullName）或结合八字喜用推荐名字（给 surname + 出生信息）。问取名、改名、名字好不好时调用。',
    parameters: { fullName: { type: 'string', description: '要分析的完整姓名' }, surname: { type: 'string', description: '推荐名字时的姓氏' }, ...OPTIONAL_BIRTH },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const chart = args.year && args.month && args.day && args.gender ? chartFromArgs(E, args) : null
      if (args.fullName) {
        const a = E.analyzeName({ fullName: args.fullName, surname: args.surname, chart })
        const grid = a.grid.map(g => `${g.name}${g.num}画（${g.luck.category}）`).join('、')
        return [`【姓名五格分析】${args.fullName}`, `五格：${grid}`, `三才${a.sanCai.tian}${a.sanCai.ren}${a.sanCai.di}（${a.sanCai.verdict}）`, `评分：${a.score}（${a.grade}）`, a.summaryText].join('\n')
      }
      if (!args.surname) throw new Error('请提供 fullName（分析）或 surname（推荐）')
      const recs = E.recommendName(chart || {}, args.surname)
      if (!recs.length) throw new Error('无法生成推荐，请补充出生信息')
      return ['【取名推荐】（结合八字喜用神）', ...recs.map(r => `${r.input.fullName}｜${r.score}分｜${r.grid.map(x => `${x.name}${x.num}`).join(' ')}｜${r.sanCai.verdict}`)].join('\n')
    },
  })
}
```

`tools/fengshui.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BIRTH_PARAMS, chartFromArgs } from '../birth.js'

const OPTIONAL_BIRTH = Object.fromEntries(Object.entries(BIRTH_PARAMS).map(([k, v]) => [k, { ...v, required: undefined }]))

export function makeFengshuiTool(E) {
  return defineTool({
    name: 'fengshui',
    description: '八宅风水 + 五行房间布局分析。用户描述户型（大门朝向、各房间方位）并问风水、财位、煞气、摆件时调用。',
    parameters: {
      door: { type: 'string', required: true, description: '大门朝向：东/南/西/北/东南/东北/西南/西北' },
      rooms: { type: 'array', items: { type: 'object', properties: { name: { type: 'string', required: true }, dir: { type: 'string', required: true } }, additionalProperties: false }, description: '房间列表，如 [{name:"主卧",dir:"北"}]' },
      ...OPTIONAL_BIRTH,
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const layout = { door: args.door }
      for (const r of args.rooms || []) layout[r.name] = r.dir
      const chart = args.year && args.month && args.day && args.gender ? chartFromArgs(E, args) : null
      const res = E.analyzeFengshui({ layout, birthInfo: chart })
      const segs = [`【风水布局分析】门向${args.door}`, `喜用神：${res.favorable.join('、')}｜忌神：${res.avoid.join('、')}`]
      if (res.luckyDirs?.length) segs.push(`四吉方：${res.luckyDirs.join('、')}`)
      if (res.rooms?.length) { segs.push('', '【逐空间分析】'); for (const r of res.rooms) segs.push(`${r.name}（${r.dir}，五行${r.wuxing}）：${r.score}分。${r.tips.join('；')}`) }
      if (res.overall) segs.push('', `【总评】${res.overall}`)
      return segs.join('\n')
    },
  })
}
```

`tools/wuyunliuqi.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BIRTH_PARAMS, chartFromArgs, birthLine } from '../birth.js'

export function makeWuyunliuqiTool(E) {
  return defineTool({
    name: 'wuyunliuqi',
    description: '按出生年干支排五运六气（中运/司天在泉/主客气/客运）并按属相判六大体质，给养生建议。问体质、五运六气、健康调理时调用；不做医疗诊断。',
    parameters: { ...BIRTH_PARAMS },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const chart = chartFromArgs(E, args)
      return `【命主】${birthLine(chart)}\n${E.buildWuyunliuqi(chart).text}`
    },
  })
}
```

`index.js` 的工厂列表改为：

```js
import { makeBaziTool } from './tools/bazi.js'
import { makeZiweiTool } from './tools/ziwei.js'
import { makeLiuyaoTool } from './tools/liuyao.js'
import { makeQimenTool } from './tools/qimen.js'
import { makeHuangliTool, makeModernHuangliTool } from './tools/huangli.js'
import { makeTarotTool } from './tools/tarot.js'
import { makeNameTool } from './tools/name.js'
import { makeFengshuiTool } from './tools/fengshui.js'
import { makeWuyunliuqiTool } from './tools/wuyunliuqi.js'

export const TOOL_FACTORIES = [
  makeBaziTool, makeZiweiTool, makeLiuyaoTool, makeQimenTool, makeHuangliTool, makeModernHuangliTool,
  makeTarotTool, makeNameTool, makeFengshuiTool, makeWuyunliuqiTool,
]
```

- [ ] **Step 4: 跑测试**

```bash
node --test server/dsh/tests/tools-misc.test.mjs
```
Expected: 全部 PASS。如某引擎返回对象而非字符串（例如 `buildZiwei` 返回结构体），查看 `src/engine/agentTools.js` 中对应 `toolXxx` 如何转文本并照搬；如 `required: undefined` 被 defineTool 拒绝，把 `OPTIONAL_BIRTH` 改为逐字段删除 `required` 键（`const { required, ...rest } = v`）。

- [ ] **Step 5: Commit**

```bash
git add server/dsh/plugins/lingshu-tools server/dsh/tests/tools-misc.test.mjs
git commit -m "feat(agent): add ziwei/liuyao/qimen/huangli/tarot/name/fengshui/wuyunliuqi tools"
```

---

### Task 5: `report` 工具

**Files:**
- Create: `server/dsh/plugins/lingshu-tools/tools/report.js`
- Modify: `server/dsh/plugins/lingshu-tools/index.js`
- Test: `server/dsh/tests/tools-report.test.mjs`

**Interfaces:**
- Produces: 工具 `report`，参数 `type` ∈ `bazi|mangpai|ziwei|liuyao|qimen|huangli|tarot|name|fengshui|hehun|zejiri|consult`；返回 Markdown，第一行固定 `# <标题>`。前端按工具名 `report` 识别报告卡片（见 Task 7 `kind`）。

- [ ] **Step 1: 写失败测试**

`server/dsh/tests/tools-report.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeReportTool } from '../plugins/lingshu-tools/tools/report.js'

const E = await import('../plugins/lingshu-tools/dist/engines.mjs')
const exec = { signal: new AbortController().signal }
const birth = { year: 1990, month: 5, day: 6, hour: 8, gender: '男' }

test('report bazi 返回以标题开头的 Markdown', async () => {
  const out = await makeReportTool(E).execute({ type: 'bazi', ...birth }, exec)
  assert.match(out, /^# /)
  assert.match(out, /庚午/)
})

test('report hehun 需要 partner', async () => {
  const t = makeReportTool(E)
  await assert.rejects(() => t.execute({ type: 'hehun', ...birth }, exec), /partner/)
  const out = await t.execute({ type: 'hehun', ...birth, partner: { year: 1992, month: 8, day: 1, hour: 10, gender: '女' } }, exec)
  assert.match(out, /合婚|婚配/)
})

test('report 未知类型报错', async () => {
  await assert.rejects(() => makeReportTool(E).execute({ type: 'xxx', ...birth }, exec))
})
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test server/dsh/tests/tools-report.test.mjs
```
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

`server/dsh/plugins/lingshu-tools/tools/report.js`：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BIRTH_PARAMS, chartFromArgs } from '../birth.js'

const TYPES = ['bazi', 'mangpai', 'ziwei', 'liuyao', 'qimen', 'huangli', 'tarot', 'name', 'fengshui', 'hehun', 'zejiri', 'consult']
const NEED_BIRTH = new Set(['bazi', 'mangpai', 'ziwei', 'hehun', 'zejiri', 'consult', 'name'])
const OPTIONAL_BIRTH = Object.fromEntries(Object.entries(BIRTH_PARAMS).map(([k, v]) => { const { required, ...rest } = v; return [k, rest] }))

export function makeReportTool(E) {
  return defineTool({
    name: 'report',
    description: '生成完整测算报告（Markdown，前端会渲染成报告卡片）。仅当用户明确要"报告/完整解读/详解"时调用；普通提问用对应排盘工具即可。type：bazi 子平八字、mangpai 盲派、ziwei 紫微、liuyao 六爻、qimen 奇门、huangli 黄历、tarot 塔罗、name 取名、fengshui 风水、hehun 合婚（需 partner）、zejiri 择日（purpose）、consult 多流派会诊。',
    parameters: {
      type: { type: 'string', required: true, enum: TYPES },
      ...OPTIONAL_BIRTH,
      partner: { type: 'object', additionalProperties: false, properties: { ...OPTIONAL_BIRTH }, description: '合婚对方出生信息' },
      question: { type: 'string', description: '六爻所问之事' },
      date: { type: 'string', description: 'YYYY-MM-DD（黄历/奇门/紫微流年）' },
      purpose: { type: 'string', description: '择日目的：marry/move/open 等' },
      fullName: { type: 'string' }, surname: { type: 'string' },
      door: { type: 'string' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      if (!TYPES.includes(args.type)) throw new Error(`未知报告类型：${args.type}`)
      const hasBirth = args.year && args.month && args.day && args.gender
      if (NEED_BIRTH.has(args.type) && !hasBirth) throw new Error(`${args.type} 报告需要出生年月日时与性别`)
      const chart = hasBirth ? chartFromArgs(E, args) : null
      const extra = { question: args.question, date: args.date, purpose: args.purpose, fullName: args.fullName, surname: args.surname }
      if (args.type === 'hehun') {
        if (!args.partner || !args.partner.year) throw new Error('合婚需要 partner 出生信息')
        extra.partner = chartFromArgs(E, args.partner)
      }
      if (args.type === 'fengshui') extra.layout = { door: args.door }
      const rep = E.buildReport(args.type, chart, extra)
      if (!rep.ok) throw new Error(`报告生成失败：${rep.error}`)
      return `# ${rep.title || '测算报告'}\n\n${rep.markdown}`
    },
  })
}
```

`index.js`：在 `TOOL_FACTORIES` 末尾追加 `makeReportTool`（并 import）。

- [ ] **Step 4: 跑测试**

```bash
node --test server/dsh/tests/tools-report.test.mjs server/dsh/tests/tools-misc.test.mjs
```
Expected: PASS（`tools-misc` 第一个断言的列表需追加 `'report'`，更新该断言）。若 `buildHehunReport(chart, partner)` 期望 `partner` 是原始出生对象而非 chart（查 `src/engine/hehunReport.js` 开头），按其期望传参。

- [ ] **Step 5: Commit**

```bash
git add server/dsh/plugins/lingshu-tools server/dsh/tests
git commit -m "feat(agent): add unified report tool"
```

---

### Task 6: 人设与技能目录

**Files:**
- Create: `server/dsh/persona.md`
- Create: `server/dsh/gen-skills.mjs`
- Create: `server/dsh/skills/*/SKILL.md`（生成物）
- Modify: `server/routes/skills.js`（保存/删除时同步 `_admin/`）
- Test: `server/dsh/tests/skills.test.mjs`

**Interfaces:**
- Produces: `gen-skills.mjs` 导出 `skillToMarkdown(skill) → string`、`writeSkills(dir)`；`server/dsh/adminSkills.js` 导出 `syncAdminSkill(skill)`、`removeAdminSkill(key)`；persona 文本由 `pool.js` 读 `persona.md` 后经 env `LINGSHU_PERSONA` 传入。

- [ ] **Step 1: 写 persona**

`server/dsh/persona.md`：把 `src/data/knowledge.js` 中 `AGENT_SOUL` 模板字符串的内容原样复制进来（从"【身份核心 · 你是谁】"到最后一条红线），然后在末尾追加：

```
【工具使用规约】
· 凡涉排盘、起卦、择日、抽牌、取名、风水、五运六气，必须先调用对应工具，基于返回的真实数据作答；绝不凭记忆排盘。
· 用户未给出出生年月日时与性别时，先礼貌询问，不要猜测，不要空调工具。
· 本次会话中已经为同一命主排过盘，后续追问直接引用之前工具返回的数据，不要重复调用同一工具。
· 用户明确要"报告/完整解读/详解"才调用 report；普通提问用排盘工具即可。
· 会话中若出现「当前缘主命盘」一行，那是用户在页面上选定的命盘，默认以它为命主。
· 需要某一流派或领域的专门断法时，先用 skill 工具加载对应技能（如 mangpai、ziwei）再作答。
```

- [ ] **Step 2: 写失败测试**

`server/dsh/tests/skills.test.mjs`：

```js
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
```

- [ ] **Step 3: 运行确认失败**

```bash
node --test server/dsh/tests/skills.test.mjs
```
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现生成器与管理同步**

`server/dsh/gen-skills.mjs`：

```js
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
```

`server/dsh/adminSkills.js`：

```js
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
```

`server/routes/skills.js`：找到调用 `upsertSkill(...)` 的处理函数，在其成功后加 `syncAdminSkill(saved)`；找到调用 `deleteSkill(key)` 的处理函数，在成功后加 `removeAdminSkill(key)`；文件顶部 `import { syncAdminSkill, removeAdminSkill } from '../dsh/adminSkills.js'`。两处都包 `try/catch`，失败只 `console.warn`，不影响接口返回。

- [ ] **Step 5: 跑测试并生成技能目录**

```bash
node --test server/dsh/tests/skills.test.mjs && node server/dsh/gen-skills.mjs && ls server/dsh/skills
```
Expected: PASS；目录列出 bazi、mangpai、ziwei、liuyao、tarot、huangli、modern-huangli、qimen、love、wealth、health、fengshui、name、yixue-taishan、wuyunliuqi 等。

- [ ] **Step 6: Commit**

```bash
git add server/dsh/persona.md server/dsh/gen-skills.mjs server/dsh/adminSkills.js server/dsh/skills server/routes/skills.js server/dsh/tests/skills.test.mjs
git commit -m "feat(agent): persona and SKILL.md skill catalog for dsh"
```

---

### Task 7: 事件归一化 `events.js`

**Files:**
- Create: `server/dsh/events.js`
- Test: `server/dsh/tests/events.test.mjs`

**Interfaces:**
- Produces: `normalize(notification) → SseEvent | null`，SseEvent ∈
  `{type:'text', delta}` | `{type:'reasoning', delta}` | `{type:'tool_call', name, args}` | `{type:'tool_result', name, ok, text, kind}` | `{type:'message', text, usage?}` | `{type:'title', title}` | `{type:'done', reason}` | `{type:'error', code, message}` | `{type:'status', status}`；
  `isIdle(notification, sessionId) → boolean`。

- [ ] **Step 1: 写失败测试**

`server/dsh/tests/events.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, isIdle } from '../events.js'

const ev = (type, data) => ({ method: 'session.event', params: { sessionId: 's1', event: { type, seq: 1, time: 0, data } } })

test('text-delta → text', () => {
  assert.deepEqual(normalize(ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '你好' } })), { type: 'text', delta: '你好' })
})
test('reasoning-delta → reasoning', () => {
  assert.deepEqual(normalize(ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: '想' } })), { type: 'reasoning', delta: '想' })
})
test('其他 chunk 忽略', () => {
  assert.equal(normalize(ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'block-start', index: 0, blockType: 'text' } })), null)
})
test('tool/call 解析参数', () => {
  assert.deepEqual(normalize(ev('tool/call', { turn: 1, step: 1, callId: 'c1', name: 'bazi', arguments: '{"year":1990}' })), { type: 'tool_call', name: 'bazi', args: { year: 1990 } })
})
test('tool/result 报告类', () => {
  const n = normalize(ev('tool/result', { turn: 1, step: 1, message: { role: 'user', content: [{ type: 'tool-result', callId: 'c1', name: 'report', isError: false, content: [{ type: 'text', text: '# 报告' }] }], source: { kind: 'tool', name: 'report', callId: 'c1' } } }))
  assert.equal(n.type, 'tool_result'); assert.equal(n.kind, 'report'); assert.equal(n.ok, true); assert.equal(n.text, '# 报告')
})
test('turn/end 成功与失败', () => {
  assert.deepEqual(normalize(ev('turn/end', { turn: 1, reason: { kind: 'completed' } })), { type: 'done', reason: 'completed' })
  assert.deepEqual(normalize(ev('turn/end', { turn: 1, reason: { kind: 'error', error: { code: 'AUTH', message: 'bad key' } } })), { type: 'error', code: 'AUTH', message: 'bad key' })
})
test('session/title', () => {
  assert.deepEqual(normalize(ev('session/title', { title: '排八字', messageSeqs: [1], source: { kind: 'fallback' } })), { type: 'title', title: '排八字' })
})
test('assistant/message 带 usage', () => {
  const n = normalize(ev('assistant/message', { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '断语' }] }, usage: { inputTokens: 10, outputTokens: 5 } }))
  assert.deepEqual(n, { type: 'message', text: '断语', usage: { inputTokens: 10, outputTokens: 5 } })
})
test('isIdle 只认本会话', () => {
  assert.equal(isIdle({ method: 'session.status', params: { sessionId: 's1', status: 'idle' } }, 's1'), true)
  assert.equal(isIdle({ method: 'session.status', params: { sessionId: 's2', status: 'idle' } }, 's1'), false)
})
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test server/dsh/tests/events.test.mjs
```
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

`server/dsh/events.js`：

```js
// dsh 通知 → 前端 SSE 事件（纯函数，无副作用）
const TOOL_NAME_CN = {
  bazi: '八字排盘', ziwei: '紫微排盘', liuyao: '六爻起卦', qimen: '奇门排盘', huangli: '黄历查询',
  modern_huangli: '幽默黄历', tarot: '塔罗抽牌', name: '姓名分析', fengshui: '风水分析', wuyunliuqi: '五运六气',
  report: '测算报告', skill: '加载技能',
}
export { TOOL_NAME_CN }

function textOf(blocks) {
  return (blocks || []).filter(b => b && b.type === 'text').map(b => b.text).join('')
}

function safeJson(s) {
  try { return JSON.parse(s) } catch { return { raw: String(s) } }
}

export function normalize(n) {
  if (!n || n.method !== 'session.event') return null
  const e = n.params && n.params.event
  if (!e) return null
  const d = e.data || {}
  switch (e.type) {
    case 'assistant/chunk': {
      const c = d.chunk || {}
      if (c.type === 'text-delta') return { type: 'text', delta: c.text }
      if (c.type === 'reasoning-delta') return { type: 'reasoning', delta: c.text }
      return null
    }
    case 'tool/call':
      return { type: 'tool_call', name: d.name, args: safeJson(d.arguments) }
    case 'tool/result': {
      const block = d.message && d.message.content && d.message.content[0]
      const name = (block && block.name) || (d.message && d.message.source && d.message.source.name) || 'tool'
      const ok = !(d.error || (block && block.isError))
      const text = block ? textOf(block.content) : ''
      return { type: 'tool_result', name, ok, text, kind: name === 'report' ? 'report' : 'data' }
    }
    case 'assistant/message': {
      const out = { type: 'message', text: textOf(d.message && d.message.content) }
      if (d.usage) out.usage = d.usage
      return out
    }
    case 'session/title':
      return { type: 'title', title: d.title }
    case 'turn/end': {
      const r = d.reason || {}
      if (r.kind === 'error') return { type: 'error', code: r.error?.code || 'ERROR', message: r.error?.message || '模型请求失败' }
      return { type: 'done', reason: r.kind || 'completed' }
    }
    default:
      return null
  }
}

export function isIdle(n, sessionId) {
  return !!n && n.method === 'session.status' && n.params && n.params.sessionId === sessionId && n.params.status === 'idle'
}
```

- [ ] **Step 4: 跑测试**

```bash
node --test server/dsh/tests/events.test.mjs
```
Expected: PASS。实现前先核对真实结构：打开 `node_modules/@deepseek-ai/dsh-llm/lib/types/types.d.ts` 搜 `ToolResultBlock`，确认字段名是否为 `name`/`isError`/`content`；若不同，同步修改 `normalize` 与测试。

- [ ] **Step 5: Commit**

```bash
git add server/dsh/events.js server/dsh/tests/events.test.mjs
git commit -m "feat(agent): normalize dsh session events into SSE events"
```

---

### Task 8: `DshPool`

**Files:**
- Create: `server/dsh/pool.js`
- Test: `server/dsh/tests/pool.test.mjs`

**Interfaces:**
- Consumes: `normalize`, `isIdle`（Task 7）；`DSH_HOME, PROFILE_DIR, SKILLS_DIR, ENGINES_FILE, PERSONA_FILE`（Task 1）。
- Produces: `ROUTES`（`{ key: { provider, model, label } }`）、`DEFAULT_ROUTE`、`class DshPool { constructor({ createClient? }) ; run({ routeKey, sessionId, text, onEvent, signal }) → Promise<{ finalText, usage, title }> ; isBusy(sessionId) ; close() }`。`createClient(routeKey)` 可注入（测试用 fake）。

- [ ] **Step 1: 写失败测试（fake client）**

`server/dsh/tests/pool.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DshPool, ROUTES, DEFAULT_ROUTE } from '../pool.js'

function fakeClient(script) {
  // script(sessionId) → 通知数组，按序回放
  const queue = []
  let closed = false
  return {
    calls: { init: 0, prompts: [] },
    async start() {},
    async initialize(p) { this.calls.init++; return { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.0.1' } } },
    async prompt(sessionId, blocks) { this.calls.prompts.push({ sessionId, blocks }); queue.push(...script(sessionId)); return 'msg-1' },
    subscribeSessionTree() {
      return {
        next: async () => { if (closed) throw new Error('closed'); const n = queue.shift(); if (!n) return new Promise(() => {}); return n },
        close() { closed = true },
      }
    },
    async close() { closed = true },
  }
}

const ev = (sid, type, data) => ({ method: 'session.event', params: { sessionId: sid, event: { type, seq: 1, time: 0, data } } })
const idle = sid => ({ method: 'session.status', params: { sessionId: sid, status: 'idle' } })

test('run 收集文本并在 idle 结束', async () => {
  const client = fakeClient(sid => [
    ev(sid, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '你' } }),
    ev(sid, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '好' } }),
    ev(sid, 'assistant/message', { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '你好' }] }, usage: { inputTokens: 1, outputTokens: 2 } }),
    ev(sid, 'turn/end', { turn: 1, reason: { kind: 'completed' } }),
    idle(sid),
  ])
  const pool = new DshPool({ createClient: () => client })
  const got = []
  const r = await pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's1', text: '嗨', onEvent: e => got.push(e) })
  assert.equal(r.finalText, '你好')
  assert.deepEqual(r.usage, { inputTokens: 1, outputTokens: 2 })
  assert.equal(got.filter(e => e.type === 'text').length, 2)
  assert.equal(client.calls.init, 1)
  assert.equal(client.calls.prompts[0].blocks[0].text, '嗨')
})

test('同一 session 并发 run 被拒绝', async () => {
  const client = fakeClient(sid => [])
  const pool = new DshPool({ createClient: () => client })
  const p = pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's2', text: 'a', onEvent: () => {} })
  assert.equal(pool.isBusy('s2'), true)
  await assert.rejects(() => pool.run({ routeKey: DEFAULT_ROUTE, sessionId: 's2', text: 'b', onEvent: () => {} }), /BUSY/)
  await pool.close()
  await p.catch(() => {})
})

test('未知路由报错', async () => {
  const pool = new DshPool({ createClient: () => fakeClient(() => []) })
  await assert.rejects(() => pool.run({ routeKey: 'nope', sessionId: 's3', text: 'a', onEvent: () => {} }), /UNKNOWN_ROUTE/)
})

test('ROUTES 含默认路由', () => {
  assert.ok(ROUTES[DEFAULT_ROUTE])
})
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test server/dsh/tests/pool.test.mjs
```
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

`server/dsh/pool.js`：

```js
// DshPool：每个模型路由常驻一个 dsh 子进程（HarnessClient），负责初始化、跑一轮、异常重启。
import fs from 'node:fs'
import { HarnessClient } from '@deepseek-ai/dsh-sdk-client'
import { normalize, isIdle } from './events.js'
import { DSH_HOME, PROFILE_DIR, SKILLS_DIR, ENGINES_FILE, PERSONA_FILE } from './setup.mjs'

export const ROUTES = {
  'deepseek-flash': { provider: 'deepseek-official', model: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  'deepseek-pro': { provider: 'deepseek-official', model: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  'minimax': { provider: 'minimax', model: 'MiniMax-M2.7', label: 'MiniMax M2.7' },
}
export const DEFAULT_ROUTE = process.env.AGENT_DEFAULT_ROUTE || 'deepseek-flash'
const MAX_TOKENS = 8192
const TURN_TIMEOUT_MS = 120000

function childEnv() {
  const persona = fs.existsSync(PERSONA_FILE) ? fs.readFileSync(PERSONA_FILE, 'utf8') : ''
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DSH_HOME,
    DSH_TELEMETRY_DISABLED: '1',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || '',
    LINGSHU_SKILLS_DIR: SKILLS_DIR,
    LINGSHU_ENGINES: ENGINES_FILE,
    LINGSHU_PERSONA: persona,
  }
}

function defaultCreateClient() {
  return new HarnessClient({ profile: 'lingshu', dshHome: DSH_HOME, processCwd: PROFILE_DIR, env: childEnv(), initializeTimeoutMs: 20000 })
}

export class DshPool {
  constructor({ createClient = defaultCreateClient } = {}) {
    this.createClient = createClient
    this.clients = new Map()   // routeKey → { client, ready: Promise }
    this.busy = new Set()      // sessionId
  }

  isBusy(sessionId) { return this.busy.has(sessionId) }

  async client(routeKey) {
    const route = ROUTES[routeKey]
    if (!route) { const e = new Error(`未知模型路由 ${routeKey}`); e.code = 'UNKNOWN_ROUTE'; throw e }
    let entry = this.clients.get(routeKey)
    if (!entry) {
      const client = this.createClient(routeKey)
      const ready = (async () => {
        await client.start()
        await client.initialize({ cwd: PROFILE_DIR, provider: route.provider, model: route.model, maxTokens: MAX_TOKENS })
        return client
      })()
      entry = { client, ready }
      this.clients.set(routeKey, entry)
      ready.catch(() => this.clients.delete(routeKey))
    }
    return entry.ready
  }

  async run({ routeKey, sessionId, text, onEvent, signal }) {
    if (this.busy.has(sessionId)) { const e = new Error('该会话正在回复中'); e.code = 'BUSY'; throw e }
    this.busy.add(sessionId)
    let sub = null
    try {
      const client = await this.client(routeKey)
      sub = client.subscribeSessionTree(sessionId)
      await client.prompt(sessionId, [{ type: 'text', text }])
      let finalText = ''
      let usage = null
      let title = null
      const deadline = Date.now() + TURN_TIMEOUT_MS
      while (true) {
        if (signal && signal.aborted) break
        const remain = deadline - Date.now()
        if (remain <= 0) { const e = new Error('回复超时'); e.code = 'TIMEOUT'; throw e }
        const n = await Promise.race([sub.next(), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('回复超时'), { code: 'TIMEOUT' })), remain))])
        if (isIdle(n, sessionId)) break
        const e = normalize(n)
        if (!e) continue
        if (e.type === 'message') { finalText = e.text || finalText; if (e.usage) usage = e.usage }
        if (e.type === 'title') title = e.title
        onEvent(e)
      }
      return { finalText, usage, title }
    } catch (err) {
      // 子进程死亡：丢弃该路由客户端，下次请求重启
      if (err && (err.name === 'TransportClosedError' || err.code === 'TIMEOUT')) this.clients.delete(routeKey)
      throw err
    } finally {
      if (sub) sub.close()
      this.busy.delete(sessionId)
    }
  }

  async close() {
    const all = [...this.clients.values()]
    this.clients.clear()
    await Promise.allSettled(all.map(async e => { try { const c = await e.ready; await c.close() } catch { /* 忽略 */ } }))
  }
}

let shared = null
export function sharedPool() { if (!shared) shared = new DshPool(); return shared }
```

- [ ] **Step 4: 跑测试**

```bash
node --test server/dsh/tests/pool.test.mjs
```
Expected: 4 PASS。

- [ ] **Step 5: Commit**

```bash
git add server/dsh/pool.js server/dsh/tests/pool.test.mjs
git commit -m "feat(agent): DshPool manages per-route dsh subprocesses"
```

---

### Task 9: 会话索引存储 `agentStore.js`

**Files:**
- Create: `server/dsh/agentStore.js`
- Test: `server/dsh/tests/agentStore.test.mjs`

**Interfaces:**
- Produces: `createAgentStore(file) → { listSessions(uid), getSession(uid, id), createSession(uid, { route, title }) → session, updateSession(uid, id, patch), appendMessage(uid, id, msg), listMessages(uid, id), deleteSession(uid, id) }`；`session = { id, uid, route, title, chartKey, createdAt, updatedAt, messageCount }`；`msg = { role: 'user'|'ai'|'tool', text, kind?, name?, time }`；每会话最多 200 条消息；`sharedStore()` 使用 `server/data/agent_sessions.json`。

- [ ] **Step 1: 写失败测试**

`server/dsh/tests/agentStore.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAgentStore } from '../agentStore.js'

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'as-')), 'agent_sessions.json')

test('创建/列出/按 uid 隔离', () => {
  const s = createAgentStore(tmp())
  const a = s.createSession('u1', { route: 'deepseek-flash', title: 'A' })
  s.createSession('u2', { route: 'deepseek-flash', title: 'B' })
  assert.equal(s.listSessions('u1').length, 1)
  assert.equal(s.getSession('u2', a.id), null)
  assert.equal(s.getSession('u1', a.id).title, 'A')
})

test('消息镜像上限 200 且更新 updatedAt', () => {
  const s = createAgentStore(tmp())
  const a = s.createSession('u1', { route: 'deepseek-flash' })
  for (let i = 0; i < 205; i++) s.appendMessage('u1', a.id, { role: 'user', text: `m${i}`, time: 't' })
  const msgs = s.listMessages('u1', a.id)
  assert.equal(msgs.length, 200)
  assert.equal(msgs[0].text, 'm5')
  assert.equal(s.getSession('u1', a.id).messageCount, 200)
})

test('删除会话', () => {
  const s = createAgentStore(tmp())
  const a = s.createSession('u1', { route: 'deepseek-flash' })
  assert.equal(s.deleteSession('u1', a.id), true)
  assert.equal(s.listSessions('u1').length, 0)
})

test('持久化到文件', () => {
  const f = tmp()
  const a = createAgentStore(f).createSession('u1', { route: 'deepseek-flash', title: 'X' })
  assert.equal(createAgentStore(f).getSession('u1', a.id).title, 'X')
})
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test server/dsh/tests/agentStore.test.mjs
```
Expected: FAIL。

- [ ] **Step 3: 实现**

`server/dsh/agentStore.js`：

```js
// agent 会话索引 + 消息镜像（JSON 文件，与 store.js 同风格；dsh 自己的 JSONL 是权威日志，这里只做前端展示用）
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const MAX_MESSAGES = 200
const MAX_SESSIONS_PER_USER = 50

export function createAgentStore(file) {
  let db = null
  function load() {
    if (db) return db
    try { db = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { db = { sessions: [], messages: {} } }
    if (!Array.isArray(db.sessions)) db.sessions = []
    if (!db.messages || typeof db.messages !== 'object') db.messages = {}
    return db
  }
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(db, null, 2))
  }
  const own = (uid, id) => load().sessions.find(s => s.uid === uid && s.id === id) || null

  return {
    listSessions(uid) {
      return load().sessions.filter(s => s.uid === uid).sort((a, b) => b.updatedAt - a.updatedAt)
    },
    getSession(uid, id) { return own(uid, id) },
    createSession(uid, { route, title = '新会话', chartKey = null } = {}) {
      const d = load()
      const now = Date.now()
      const s = { id: randomUUID(), uid, route, title, chartKey, createdAt: now, updatedAt: now, messageCount: 0 }
      d.sessions.push(s)
      // 超出上限时裁掉该用户最旧的会话
      const mine = d.sessions.filter(x => x.uid === uid).sort((a, b) => a.updatedAt - b.updatedAt)
      while (mine.length > MAX_SESSIONS_PER_USER) { const old = mine.shift(); d.sessions = d.sessions.filter(x => x.id !== old.id); delete d.messages[old.id] }
      save()
      return s
    },
    updateSession(uid, id, patch) {
      const s = own(uid, id)
      if (!s) return null
      Object.assign(s, patch, { updatedAt: Date.now() })
      save()
      return s
    },
    appendMessage(uid, id, msg) {
      const s = own(uid, id)
      if (!s) return null
      const d = load()
      const list = d.messages[id] || (d.messages[id] = [])
      list.push(msg)
      while (list.length > MAX_MESSAGES) list.shift()
      s.messageCount = list.length
      s.updatedAt = Date.now()
      save()
      return msg
    },
    listMessages(uid, id) { return own(uid, id) ? (load().messages[id] || []).slice() : [] },
    deleteSession(uid, id) {
      const d = load()
      const before = d.sessions.length
      d.sessions = d.sessions.filter(s => !(s.uid === uid && s.id === id))
      delete d.messages[id]
      save()
      return d.sessions.length < before
    },
  }
}

let shared = null
export function sharedStore() {
  if (!shared) {
    const here = path.dirname(fileURLToPath(import.meta.url))
    shared = createAgentStore(process.env.AGENT_STORE_FILE || path.join(here, '..', 'data', 'agent_sessions.json'))
  }
  return shared
}
```

- [ ] **Step 4: 跑测试**

```bash
node --test server/dsh/tests/agentStore.test.mjs
```
Expected: 4 PASS。

- [ ] **Step 5: Commit**

```bash
git add server/dsh/agentStore.js server/dsh/tests/agentStore.test.mjs
git commit -m "feat(agent): per-user agent session index and message mirror"
```

---

### Task 10: `/api/agent/*` 路由与冒烟脚本

**Files:**
- Create: `server/routes/agent.js`
- Create: `server/dsh/smoke.mjs`
- Modify: `server/index.js`
- Modify: `server/.env.example`
- Test: `server/tests/agent-route.test.mjs`

**Interfaces:**
- Consumes: `DshPool.run`, `ROUTES`, `DEFAULT_ROUTE`（Task 8）；`createAgentStore`（Task 9）；`TOOL_NAME_CN`（Task 7）。
- Produces: `createAgentRouter({ pool, store }) → express.Router`；HTTP 契约：
  - `POST /api/agent/chat` body `{ sessionId?, text, chart?, route? }` → SSE，每条 `data: <json>\n\n`，首条 `{type:'session', sessionId, route}`，其后为 Task 7 事件，末尾 `done` 或 `error`。
  - `GET /api/agent/sessions` → `{ ok, sessions }`
  - `GET /api/agent/sessions/:id/messages` → `{ ok, session, messages }`
  - `DELETE /api/agent/sessions/:id` → `{ ok }`
  - `GET /api/agent/models` → `{ ok, routes: [{ key, label, model }], default }`
  - uid 来自请求头 `x-genki-uid`，缺失则 400。

- [ ] **Step 1: 写失败测试（fake pool）**

`server/tests/agent-route.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAgentRouter } from '../routes/agent.js'
import { createAgentStore } from '../dsh/agentStore.js'

function fakePool(events) {
  return {
    isBusy: () => false,
    async run({ onEvent }) { for (const e of events) onEvent(e); return { finalText: events.filter(e => e.type === 'text').map(e => e.delta).join(''), usage: null, title: null } },
  }
}

async function listen(app) {
  return new Promise(res => { const srv = app.listen(0, () => res({ srv, base: `http://127.0.0.1:${srv.address().port}` })) })
}

function mkApp(pool) {
  const store = createAgentStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ar-')), 'db.json'))
  const app = express()
  app.use(express.json())
  app.use('/api', createAgentRouter({ pool, store }))
  return { app, store }
}

test('chat 流式返回并镜像消息', async () => {
  const { app, store } = mkApp(fakePool([{ type: 'text', delta: '你' }, { type: 'text', delta: '好' }, { type: 'done', reason: 'completed' }]))
  const { srv, base } = await listen(app)
  try {
    const res = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-genki-uid': 'u1' }, body: JSON.stringify({ text: '嗨' }) })
    assert.equal(res.headers.get('content-type').split(';')[0], 'text/event-stream')
    const body = await res.text()
    const frames = body.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    assert.equal(frames[0].type, 'session')
    assert.equal(frames.at(-1).type, 'done')
    const msgs = store.listMessages('u1', frames[0].sessionId)
    assert.deepEqual(msgs.map(m => [m.role, m.text]), [['user', '嗨'], ['ai', '你好']])
  } finally { srv.close() }
})

test('缺 uid → 400；text 超长 → 400', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    const r1 = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x' }) })
    assert.equal(r1.status, 400)
    const r2 = await fetch(`${base}/api/agent/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-genki-uid': 'u1' }, body: JSON.stringify({ text: 'x'.repeat(2001) }) })
    assert.equal(r2.status, 400)
  } finally { srv.close() }
})

test('sessions 列表/消息/删除按 uid 隔离', async () => {
  const { app, store } = mkApp(fakePool([]))
  const s = store.createSession('u1', { route: 'deepseek-flash', title: 'T' })
  const { srv, base } = await listen(app)
  try {
    const l = await (await fetch(`${base}/api/agent/sessions`, { headers: { 'x-genki-uid': 'u1' } })).json()
    assert.equal(l.sessions.length, 1)
    const other = await fetch(`${base}/api/agent/sessions/${s.id}/messages`, { headers: { 'x-genki-uid': 'u2' } })
    assert.equal(other.status, 404)
    const del = await (await fetch(`${base}/api/agent/sessions/${s.id}`, { method: 'DELETE', headers: { 'x-genki-uid': 'u1' } })).json()
    assert.equal(del.ok, true)
  } finally { srv.close() }
})

test('models 列表', async () => {
  const { app } = mkApp(fakePool([]))
  const { srv, base } = await listen(app)
  try {
    const m = await (await fetch(`${base}/api/agent/models`)).json()
    assert.ok(m.routes.find(r => r.key === 'deepseek-flash'))
  } finally { srv.close() }
})
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test server/tests/agent-route.test.mjs
```
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现路由**

`server/routes/agent.js`：

```js
// /api/agent/*：把 dsh 子进程的会话事件以 SSE 转给前端；uid 来自 X-Genki-Uid（R2 M1 上 JWT 后替换 getUid）
import { Router } from 'express'
import { ROUTES, DEFAULT_ROUTE, sharedPool } from '../dsh/pool.js'
import { sharedStore } from '../dsh/agentStore.js'
import { TOOL_NAME_CN } from '../dsh/events.js'

const MAX_TEXT = 2000
const RATE_LIMIT = 20 // 次/分钟/uid+IP

function getUid(req) {
  const uid = String(req.get('x-genki-uid') || '').trim()
  return uid && uid.length <= 80 ? uid : null
}

function chartKeyOf(chart) {
  if (!chart || !chart.year || !chart.month || !chart.day || !chart.gender) return null
  return `${chart.year}-${chart.month}-${chart.day}-${chart.hour ?? 12}-${chart.gender}`
}

function chartLine(chart) {
  return `【当前缘主命盘】${chart.year}年${chart.month}月${chart.day}日 ${chart.hour ?? 12}时 ${chart.gender}（公历）`
}

function timeNow() { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }

export function createAgentRouter({ pool = sharedPool(), store = sharedStore() } = {}) {
  const r = Router()
  const hits = new Map() // `${uid}|${ip}` → { count, resetAt }

  function rateLimited(uid, ip) {
    const k = `${uid}|${ip}`
    const now = Date.now()
    const h = hits.get(k)
    if (!h || h.resetAt < now) { hits.set(k, { count: 1, resetAt: now + 60000 }); return false }
    h.count++
    return h.count > RATE_LIMIT
  }

  r.use('/agent', (req, res, next) => {
    if (req.path === '/models') return next()
    const uid = getUid(req)
    if (!uid) return res.status(400).json({ ok: false, msg: '缺少用户标识' })
    req.uid = uid
    next()
  })

  r.get('/agent/models', (_req, res) => {
    res.json({ ok: true, default: DEFAULT_ROUTE, routes: Object.entries(ROUTES).map(([key, v]) => ({ key, label: v.label, model: v.model })) })
  })

  r.get('/agent/sessions', (req, res) => {
    res.json({ ok: true, sessions: store.listSessions(req.uid) })
  })

  r.get('/agent/sessions/:id/messages', (req, res) => {
    const s = store.getSession(req.uid, req.params.id)
    if (!s) return res.status(404).json({ ok: false, msg: '会话不存在' })
    res.json({ ok: true, session: s, messages: store.listMessages(req.uid, s.id) })
  })

  r.delete('/agent/sessions/:id', (req, res) => {
    res.json({ ok: store.deleteSession(req.uid, req.params.id) })
  })

  r.post('/agent/chat', async (req, res) => {
    const { sessionId, text, chart, route } = req.body || {}
    const q = String(text || '').trim()
    if (!q) return res.status(400).json({ ok: false, msg: '内容为空' })
    if (q.length > MAX_TEXT) return res.status(400).json({ ok: false, msg: `内容过长（≤${MAX_TEXT} 字）` })
    if (rateLimited(req.uid, req.ip)) return res.status(429).json({ ok: false, msg: '请求太频繁，请稍后再试' })

    let session = sessionId ? store.getSession(req.uid, sessionId) : null
    if (sessionId && !session) return res.status(404).json({ ok: false, msg: '会话不存在' })
    if (!session) {
      const routeKey = ROUTES[route] ? route : DEFAULT_ROUTE
      session = store.createSession(req.uid, { route: routeKey, title: q.slice(0, 14) })
    }
    if (pool.isBusy(session.id)) return res.status(409).json({ ok: false, msg: '正在回复中，请稍候' })

    // 命盘变化时把命盘行拼到用户消息前
    const ck = chartKeyOf(chart)
    let prompt = q
    if (ck && ck !== session.chartKey) { prompt = `${chartLine(chart)}\n${q}`; store.updateSession(req.uid, session.id, { chartKey: ck }) }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    const send = e => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`) }
    send({ type: 'session', sessionId: session.id, route: session.route })

    store.appendMessage(req.uid, session.id, { role: 'user', text: q, time: timeNow() })
    const ac = new AbortController()
    req.on('close', () => ac.abort())
    const tools = []
    try {
      const result = await pool.run({
        routeKey: session.route, sessionId: session.id, text: prompt, signal: ac.signal,
        onEvent: e => {
          if (e.type === 'tool_call') tools.push(TOOL_NAME_CN[e.name] || e.name)
          if (e.type === 'tool_result' && e.kind === 'report') store.appendMessage(req.uid, session.id, { role: 'ai', kind: 'report', name: e.name, text: e.text, time: timeNow() })
          if (e.type === 'title' && session.title.length <= 14) store.updateSession(req.uid, session.id, { title: e.title })
          if (e.type !== 'message' && e.type !== 'done') send(e) // done 由下方统一发（带 usage）
        },
      })
      if (tools.length) store.appendMessage(req.uid, session.id, { role: 'tool', text: tools.join('、'), time: timeNow() })
      if (result.finalText) store.appendMessage(req.uid, session.id, { role: 'ai', text: result.finalText, time: timeNow() })
      send({ type: 'done', reason: 'completed', usage: result.usage || undefined })
    } catch (err) {
      const code = err?.code || err?.name || 'ERROR'
      const message = code === 'TIMEOUT' ? '回复超时，请重试' : code === 'TransportClosedError' ? '命理助手暂不可用，请稍后重试' : (err?.message || '服务异常')
      send({ type: 'error', code, message })
    } finally {
      res.end()
    }
  })

  return r
}

export default createAgentRouter
```

`server/index.js`：`import agentRouter from './routes/agent.js'`，在 `app.use('/api', skillsRouter)` 后加 `app.use('/api', agentRouter())`；在文件末尾加：

```js
// 退出时回收 dsh 子进程
import { sharedPool } from './dsh/pool.js'
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await sharedPool().close(); process.exit(0) })
```

`server/.env.example` 追加：

```
# ---- 元气 AI（dsh 基座）----
DEEPSEEK_API_KEY=
MINIMAX_API_KEY=
AGENT_DEFAULT_ROUTE=deepseek-flash
```

- [ ] **Step 4: 跑测试**

```bash
node --test server/tests/agent-route.test.mjs
```
Expected: 4 PASS。（`server/index.js` 顶层 `app.listen` 不会被测试触发，因为测试只 import `routes/agent.js`。）

- [ ] **Step 5: 写冒烟脚本**

`server/dsh/smoke.mjs`：

```js
// npm run agent:smoke：用真实 key 跑一轮"排八字"，断言模型调用了 bazi 工具。无 key 时跳过（exit 0）。
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DshPool, DEFAULT_ROUTE } from './pool.js'
import { installPlugin } from './setup.mjs'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })
if (!process.env.DEEPSEEK_API_KEY) { console.log('[smoke] 无 DEEPSEEK_API_KEY，跳过'); process.exit(0) }

installPlugin()
const pool = new DshPool()
const seen = []
let text = ''
try {
  const r = await pool.run({
    routeKey: process.env.AGENT_DEFAULT_ROUTE || DEFAULT_ROUTE,
    sessionId: `smoke-${Date.now()}`,
    text: '我是 1990 年 5 月 6 日早上 8 点出生的男性，帮我排个八字，简单说说命局。',
    onEvent: e => { seen.push(e.type + (e.name ? ':' + e.name : '')); if (e.type === 'text') text += e.delta },
  })
  console.log('[smoke] 事件：', seen.join(' '))
  console.log('[smoke] 回复：', (r.finalText || text).slice(0, 300))
  if (!seen.includes('tool_call:bazi')) { console.error('[smoke] 失败：模型未调用 bazi'); process.exit(1) }
  if (!/庚午/.test(r.finalText || text)) { console.error('[smoke] 失败：回复未引用四柱'); process.exit(1) }
  console.log('[smoke] 通过')
} finally {
  await pool.close()
}
```

- [ ] **Step 6: 跑冒烟（有 key 才能验证）**

```bash
npm run agent:setup && npm run agent:smoke
```
Expected：有 `DEEPSEEK_API_KEY` 时输出 `[smoke] 通过`；无 key 时 `[smoke] 无 DEEPSEEK_API_KEY，跳过`。若失败于 `MISSING_CREDENTIAL`/`AUTH`，检查 `server/.env`；若模型没调工具，先看 `[lingshu-tools] 已注册工具` 日志是否出现，再检查 persona 是否传入（`LINGSHU_PERSONA`）。

- [ ] **Step 7: Commit**

```bash
git add server/routes/agent.js server/index.js server/.env.example server/dsh/smoke.mjs server/tests/agent-route.test.mjs
git commit -m "feat(agent): SSE chat route over DshPool with session index"
```

---

### Task 11: 前端 SSE 客户端 `src/api/agent.js`

**Files:**
- Create: `src/api/agent.js`
- Test: `src/api/tests/agent.test.mjs`

**Interfaces:**
- Produces: `parseSseChunks()`（增量解析器：`feed(text) → events[]`）；`streamChat({ sessionId, text, chart, route, onEvent, signal }) → Promise<void>`；`listSessions()`, `loadMessages(id)`, `deleteSession(id)`, `listModels()`；`uidHeader()` 返回 `{ 'X-Genki-Uid': ... }`（登录用户为 `currentUid()`，游客为 `anon:<deviceId>`，deviceId 存 `localStorage['genki-device-id']`）。

- [ ] **Step 1: 写失败测试（纯解析器）**

`src/api/tests/agent.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSseChunks } from '../agent.js'

test('按 \\n\\n 分帧，跨块拼接', () => {
  const p = parseSseChunks()
  assert.deepEqual(p.feed('data: {"type":"text","delta":"你"}\n\ndata: {"ty'), [{ type: 'text', delta: '你' }])
  assert.deepEqual(p.feed('pe":"done"}\n\n'), [{ type: 'done' }])
})

test('忽略非 JSON 行', () => {
  const p = parseSseChunks()
  assert.deepEqual(p.feed(': ping\n\n'), [])
})
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test src/api/tests/agent.test.mjs
```
Expected: FAIL。注意：`src/api/agent.js` 会 import `userScope.js`（依赖 localStorage）——把 `parseSseChunks` 写成不依赖任何浏览器全局的纯函数，并把 `userScope` 的 import 改为在 `uidHeader()` 内动态获取（见实现）。

- [ ] **Step 3: 实现**

`src/api/agent.js`：

```js
// 元气 AI 前端客户端：POST /api/agent/chat（SSE）+ 会话接口
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || ''

export function parseSseChunks() {
  let buf = ''
  return {
    feed(text) {
      buf += text
      const out = []
      let idx
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try { out.push(JSON.parse(line.slice(6))) } catch { /* 忽略坏帧 */ }
        }
      }
      return out
    },
  }
}

function deviceId() {
  try {
    let id = localStorage.getItem('genki-device-id')
    if (!id) { id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem('genki-device-id', id) }
    return id
  } catch { return 'nostorage' }
}

export function uidHeader(currentUid) {
  const uid = typeof currentUid === 'function' ? currentUid() : 'anon'
  return { 'X-Genki-Uid': uid && uid !== 'anon' ? uid : `anon:${deviceId()}` }
}

async function json(path, options = {}, currentUid) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...uidHeader(currentUid), ...(options.headers || {}) } })
  const body = await res.json().catch(() => ({ ok: false, msg: '响应解析失败' }))
  if (!res.ok && !body.ok) throw new Error(body.msg || `请求失败(${res.status})`)
  return body
}

export function createAgentApi(currentUid) {
  return {
    listModels: () => json('/api/agent/models', {}, currentUid),
    listSessions: () => json('/api/agent/sessions', {}, currentUid),
    loadMessages: id => json(`/api/agent/sessions/${id}/messages`, {}, currentUid),
    deleteSession: id => json(`/api/agent/sessions/${id}`, { method: 'DELETE' }, currentUid),
    async streamChat({ sessionId, text, chart, route, onEvent, signal }) {
      const res = await fetch(`${BASE}/api/agent/chat`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', ...uidHeader(currentUid) },
        body: JSON.stringify({ sessionId, text, chart, route }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.msg || `请求失败(${res.status})`)
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      const parser = parseSseChunks()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        for (const e of parser.feed(dec.decode(value, { stream: true }))) onEvent(e)
      }
    },
  }
}
```

- [ ] **Step 4: 跑测试**

```bash
node --test src/api/tests/agent.test.mjs
```
Expected: 2 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/api/agent.js src/api/tests/agent.test.mjs
git commit -m "feat(agent): frontend SSE client for /api/agent"
```

---

### Task 12: 抽出共享 UI 片段 `ChatParts.jsx`

**Files:**
- Create: `src/components/agent/ChatParts.jsx`
- Modify: `src/components/AgentChat.jsx`（删除被抽出的定义，改为 import）

**Interfaces:**
- Produces: 具名导出 `ThinkBlock, ToolCallsBlock, FeedbackBar, CopyButton, renderAiText, timeNow, fmtSessionTime, QUICK`，签名与 AgentChat.jsx 中现有定义完全一致。

- [ ] **Step 1: 移动代码**

把 `src/components/AgentChat.jsx` 中以下定义**剪切**到 `src/components/agent/ChatParts.jsx`，每个加 `export`：`FeedbackBar`（约 L38-55）、`CopyButton`（约 L57-82）、`ThinkBlock`（约 L84-122）、`ToolCallsBlock`（约 L123-146）、`renderAiText`（约 L148-220）、`QUICK`（约 L319-332）、`timeNow`（约 L334-336）、`fmtSessionTime`（约 L353-366）。`ChatParts.jsx` 顶部：

```jsx
import { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '../../utils/markdown.jsx'
```

`AgentChat.jsx` 顶部加：

```js
import { ThinkBlock, ToolCallsBlock, FeedbackBar, CopyButton, renderAiText, timeNow, fmtSessionTime, QUICK } from './agent/ChatParts.jsx'
```

- [ ] **Step 2: 验证构建与旧组件行为不变**

```bash
npm run build 2>&1 | tail -5
```
Expected: 构建成功，无 "is not defined"/"already declared" 报错。再 `npm run dev` 打开 http://localhost:5173 进入元气 AI 页面，发一句"今年运势"，确认思考块/工具块渲染正常。

- [ ] **Step 3: Commit**

```bash
git add src/components/agent/ChatParts.jsx src/components/AgentChat.jsx
git commit -m "refactor(agent): extract shared chat UI parts"
```

---

### Task 13: 新组件 `AgentChatDsh.jsx` 与开关

**Files:**
- Create: `src/components/AgentChatDsh.jsx`
- Modify: `src/App.jsx:513-530`（AgentPage 选择组件）
- Modify: `.env.example`（根目录；若不存在则创建）

**Interfaces:**
- Consumes: `createAgentApi(currentUid)`（Task 11）、ChatParts（Task 12）、`currentUid`（`src/engine/userScope.js`）、`listCollection/saveToCollection/removeFromCollection`（`src/engine/chartCollection.js`）、`buildChart`（`src/engine/bazi.js`）、`consumeCredit`（`src/data/users.js`）、`loadQuota/addAgentTokens/isAgentOverQuota/tokensToCredits`（`src/engine/freeQuota.js`）、`ReportView`、`renderMarkdown`。
- Produces: `AgentChatDsh({ chart, seedQuery, user, onRequireLogin, onUpgrade })`，props 与 `AgentChat` 一致。

- [ ] **Step 1: 写组件**

`src/components/AgentChatDsh.jsx`：

```jsx
// 元气 AI · dsh 基座版：只做渲染与流式接管，编排/工具/记忆全在服务端 dsh
import { useEffect, useRef, useState } from 'react'
import { createAgentApi } from '../api/agent.js'
import { currentUid } from '../engine/userScope.js'
import { buildChart } from '../engine/bazi.js'
import { listCollection, saveToCollection, removeFromCollection } from '../engine/chartCollection.js'
import { consumeCredit } from '../data/users.js'
import { loadQuota, addAgentTokens, tokensToCredits, isAgentOverQuota } from '../engine/freeQuota.js'
import ReportView from './ReportView.jsx'
import { renderMarkdown } from '../utils/markdown.jsx'
import { ThinkBlock, ToolCallsBlock, CopyButton, renderAiText, timeNow, fmtSessionTime, QUICK } from './agent/ChatParts.jsx'

const api = createAgentApi(currentUid)
const ROUTE_KEY = 'genki-agent-route'
const OPENING = ['我是「司命」。八字、紫微、六爻、奇门、黄历、塔罗、取名、风水，心有所问，尽管开口。', '把出生年月日时和性别告诉我，我先为你排盘；也可以直接问今年运势、事业、姻缘。']

function chartMeta(c) { return c ? { year: c.year, month: c.month, day: c.day, hour: c.hour ?? 12, gender: c.gender } : null }
function chartLabel(c) { return `${c.gender === '女' ? '坤造' : '乾造'} · ${c.year}年${c.month}月${c.day}日${c.hour ? ` ${c.hour}时` : ''}` }

export default function AgentChatDsh({ chart: chartProp, seedQuery, user, onRequireLogin, onUpgrade }) {
  const [messages, setMessages] = useState(() => OPENING.map((text, i) => ({ id: `boot-${i}`, role: 'ai', text, time: timeNow(), _counted: true })))
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [activeChart, setActiveChart] = useState(() => chartProp || null)
  const [sessionId, setSessionId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [collection, setCollection] = useState(() => listCollection())
  const [showCollection, setShowCollection] = useState(false)
  const [models, setModels] = useState({ routes: [], default: null })
  const [route, setRoute] = useState(() => { try { return localStorage.getItem(ROUTE_KEY) || null } catch { return null } })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [agentTokens, setAgentTokens] = useState(0)
  const [quotaDismissed, setQuotaDismissed] = useState(false)
  const scrollRef = useRef(null)
  const abortRef = useRef(null)
  const booted = useRef(false)

  useEffect(() => { setAgentTokens(loadQuota().agentTokens || 0) }, [])
  useEffect(() => { api.listModels().then(m => setModels({ routes: m.routes || [], default: m.default })).catch(() => {}) }, [])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages, typing])
  useEffect(() => {
    if (!pickerOpen) return
    const close = () => setPickerOpen(false)
    const t = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', close) }
  }, [pickerOpen])

  // 计费：每条完成的 AI 回复扣 1 积分（登录）或累加 token 估算（游客），与旧组件口径一致
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'ai' || last.streaming || last._counted || !last.text) return
    if (user) {
      const res = consumeCredit(user.id, 'agent.chat')
      if (!res.ok && res.reason === 'insufficient' && onUpgrade) onUpgrade()
    } else {
      const n = addAgentTokens(Math.ceil(last.text.length / 3))
      setAgentTokens(n)
      if (isAgentOverQuota(n)) setQuotaDismissed(false)
    }
    setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, _counted: true } : m))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user])

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    if (seedQuery) send(seedQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchLast = fn => setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'ai' && m.streaming ? fn(m) : m))

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || typing) return
    setInput('')
    setTyping(true)
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q, time: timeNow() }, { id: `a-${Date.now()}`, role: 'ai', text: '', reasoning: '', tools: [], streaming: true, time: timeNow() }])
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await api.streamChat({
        sessionId, text: q, chart: chartMeta(activeChart), route: route || models.default || undefined, signal: ac.signal,
        onEvent: e => {
          switch (e.type) {
            case 'session': if (!sessionId) setSessionId(e.sessionId); break
            case 'text': patchLast(m => ({ ...m, text: m.text + e.delta })); break
            case 'reasoning': patchLast(m => ({ ...m, reasoning: (m.reasoning || '') + e.delta })); break
            case 'tool_call': patchLast(m => ({ ...m, tools: [...m.tools, e.name] })); break
            case 'tool_result':
              if (e.kind === 'report') {
                // 报告卡片插在流式气泡之前
                setMessages(prev => { const last = prev[prev.length - 1]; return [...prev.slice(0, -1), { id: `r-${Date.now()}`, role: 'ai', kind: 'report', report: { title: (e.text.match(/^# (.+)$/m) || [])[1] || '测算报告', markdown: e.text }, time: timeNow(), _counted: true }, last] })
              }
              break
            case 'error': patchLast(m => ({ ...m, text: m.text || `⚠️ ${e.message}`, streaming: false })); break
            case 'done': patchLast(m => ({ ...m, streaming: false })); break
            default: break
          }
        },
      })
    } catch (err) {
      patchLast(m => ({ ...m, text: m.text || `⚠️ ${err.message || '网络异常'}`, streaming: false }))
    } finally {
      patchLast(m => ({ ...m, streaming: false }))
      setTyping(false)
      abortRef.current = null
    }
  }

  const newChat = () => {
    if (abortRef.current) abortRef.current.abort()
    setSessionId(null)
    setActiveChart(null)
    setShowHistory(false)
    setInput('')
    setMessages(OPENING.map((text, i) => ({ id: `boot-${Date.now()}-${i}`, role: 'ai', text, time: timeNow(), _counted: true })))
  }

  const openHistory = async () => {
    try { const r = await api.listSessions(); setSessions(r.sessions || []) } catch { setSessions([]) }
    setShowHistory(true)
  }

  const restore = async (s) => {
    try {
      const r = await api.loadMessages(s.id)
      setMessages((r.messages || []).map((m, i) => m.kind === 'report'
        ? { id: `h-${i}`, role: 'ai', kind: 'report', report: { title: (m.text.match(/^# (.+)$/m) || [])[1] || '测算报告', markdown: m.text }, time: m.time, _counted: true }
        : { id: `h-${i}`, role: m.role, text: m.text, time: m.time, _counted: true }))
      setSessionId(s.id)
      if (s.chartKey) { const [y, mo, d, h, g] = s.chartKey.split('-'); try { setActiveChart(buildChart(+y, +mo, +d, +h, g)) } catch { /* 忽略 */ } }
    } catch { /* 忽略 */ }
    setShowHistory(false)
  }

  const del = async (id) => {
    try { await api.deleteSession(id) } catch { /* 忽略 */ }
    setSessions(prev => prev.filter(s => s.id !== id))
    if (sessionId === id) newChat()
  }

  const refreshCollection = () => setCollection(listCollection())
  const saveCurrentChart = () => {
    if (!activeChart) { window.alert('当前还没有命盘，请先提供出生信息排盘后再收藏。'); return }
    const label = window.prompt('为这个命盘起个名字（如：我自己、妈妈、孩子）：', chartLabel(activeChart))
    if (label === null) return
    saveToCollection(activeChart, label.trim())
    refreshCollection()
  }
  const switchToCollected = (it) => {
    try { setActiveChart(buildChart(it.year, it.month, it.day, it.hour, it.gender)); setSessionId(null); setShowCollection(false) } catch { /* 忽略 */ }
  }
  const pickRoute = (key) => { setRoute(key); try { localStorage.setItem(ROUTE_KEY, key) } catch { /* 忽略 */ } setPickerOpen(false); setSessionId(null) }
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const routeLabel = (models.routes.find(r => r.key === (route || models.default)) || {}).label || '司命'

  return (
    <div className="agent-page-inner">
      <div className="agent-head">
        <div className="agent-avatar">司</div>
        <div className="agent-head-main">
          <div className="agent-head-top">
            {activeChart ? <div className="current-chart-chip"><span className="current-chart-txt">{chartLabel(activeChart)}</span></div> : <div className="name">司命 Agent</div>}
          </div>
        </div>
        <div className="agent-head-actions">
          <button className="agent-btn" onClick={newChat} title="新会话" aria-label="新会话">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button className="agent-btn" onClick={openHistory} title="会话历史" aria-label="会话历史">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 3" /></svg>
          </button>
          <button className="agent-btn" onClick={() => { refreshCollection(); setShowCollection(true) }} title="我的命盘" aria-label="我的命盘">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.1 6.3 7 1-5.1 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9L2 9.3l7-1L12 2z" /></svg>
            {collection.length > 0 && <span className="agent-btn-badge">{collection.length}</span>}
          </button>
        </div>

        {showHistory && (
          <div className="session-drawer">
            <div className="session-drawer-head">
              <div className="session-drawer-titles"><span className="session-drawer-title">会话历史</span><span className="session-drawer-sub">共 {sessions.length} 次 · 点击恢复</span></div>
              <div className="session-drawer-ops"><button className="session-close-btn" onClick={() => setShowHistory(false)}>关闭</button></div>
            </div>
            <div className="session-list">
              {sessions.length === 0 ? <div className="session-empty">暂无历史会话，聊两句就会自动记录。</div> : sessions.map(s => (
                <div key={s.id} className={`session-item ${s.id === sessionId ? 'active' : ''}`} onClick={() => restore(s)}>
                  <div className="session-item-body">
                    <div className="session-item-title">{s.title}</div>
                    <div className="session-item-meta"><span>{s.messageCount} 条消息</span><span>{fmtSessionTime(s.updatedAt)}</span></div>
                  </div>
                  <button className="session-del" onClick={e => { e.stopPropagation(); del(s.id) }} title="删除" aria-label="删除会话">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showCollection && (
          <div className="session-drawer">
            <div className="session-drawer-head">
              <div className="session-drawer-titles"><span className="session-drawer-title">我的命盘</span><span className="session-drawer-sub">共 {collection.length} 个 · 点击切换</span></div>
              <div className="session-drawer-ops"><button className="session-clear-btn" onClick={saveCurrentChart}>＋ 收藏当前</button><button className="session-close-btn" onClick={() => setShowCollection(false)}>关闭</button></div>
            </div>
            <div className="session-list">
              {collection.length === 0 ? <div className="session-empty">还没有收藏的命盘。先排一个盘，点「＋收藏当前」保存。</div> : collection.map(it => (
                <div key={it.id} className="session-item" onClick={() => switchToCollected(it)}>
                  <div className="session-item-body">
                    <div className="session-item-title">⭐ {it.label}</div>
                    <div className="session-item-meta"><span className="session-pillar">{chartLabel(it)}</span><span>{fmtSessionTime(it.savedAt)} 收藏</span></div>
                  </div>
                  <button className="session-del" onClick={e => { e.stopPropagation(); removeFromCollection(it.id); refreshCollection() }} title="取消收藏" aria-label="取消收藏">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="avatar">{m.role === 'ai' ? '司' : '我'}</div>
            <div style={{ maxWidth: '100%' }}>
              {m.kind === 'report' ? (
                <>
                  <div className="bubble bubble-report-md">
                    <div className="report-md-title">{m.report.title}</div>
                    <div className="report-md-body">{renderMarkdown(m.report.markdown)}</div>
                  </div>
                  <div className="msg-actions"><CopyButton text={m.report.markdown} title="复制报告全文" /></div>
                </>
              ) : (
                <div className={`bubble ${m.streaming ? 'bubble-streaming' : ''}`}>
                  {m.reasoning ? <ThinkBlock content={m.reasoning} streaming={!!m.streaming && !m.text} /> : null}
                  {m.tools && m.tools.length > 0 ? <ToolCallsBlock names={m.tools.join('、')} /> : null}
                  {m.streaming && !m.text ? (
                    <span className="typing"><i /><i /><i /></span>
                  ) : (
                    <>{renderAiText(m.text, !!m.streaming)}{m.streaming && <span className="stream-cursor">▍</span>}</>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="quick-grid">
        <div className="quick-block">
          <div className="quick-label">快捷问答</div>
          <div className="quick-row">{QUICK.map(q => <button key={q} className="quick-chip quick-ask" onClick={() => send(q)}>{q}</button>)}</div>
        </div>
      </div>

      <div className="chat-input-bar">
        <textarea className="chat-input" rows={1} placeholder={`问司命任何问题…（${routeLabel}）`} value={input}
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px' }}
          onKeyDown={handleKey} style={{ maxHeight: 110 }} />
        <div className="input-status-wrap">
          <button type="button" className="input-status-dot on" onClick={() => setPickerOpen(v => !v)} title="切换模型" aria-label="切换模型" />
          {pickerOpen && (
            <div className="model-picker" onClick={e => e.stopPropagation()}>
              <div className="model-picker-title">切换模型（新会话生效）</div>
              {models.routes.map(r => (
                <button key={r.key} type="button" className={`model-picker-item ${r.key === (route || models.default) ? 'active' : ''}`} onClick={() => pickRoute(r.key)}>
                  <span className={`model-picker-dot ${r.key === (route || models.default) ? 'on' : ''}`} />
                  <span className="model-picker-name">{r.label}</span>
                  <span className="model-picker-model">{r.model}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="send-btn" onClick={() => send()} disabled={typing || !input.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" /></svg>
        </button>
      </div>

      {!user && isAgentOverQuota(agentTokens) && !quotaDismissed && (
        <div className="quota-modal-mask" onClick={() => setQuotaDismissed(true)}>
          <div className="quota-modal" onClick={e => e.stopPropagation()}>
            <div className="qm-icon">💎</div>
            <h3>积分已用完 · 订阅会员继续对话</h3>
            <p>游客已累计消耗 <b>{tokensToCredits(agentTokens).toFixed(1)}</b> / 100 积分。注册/登录成为会员，即可继续对话。</p>
            <div className="qm-actions">
              <button className="qm-btn primary" onClick={() => onRequireLogin && onRequireLogin('agent')}>立即订阅会员</button>
              <button className="qm-btn ghost" onClick={() => setQuotaDismissed(true)}>我知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: App.jsx 开关**

`src/App.jsx`：在 `import AgentChat from './components/AgentChat.jsx'` 后加 `import AgentChatDsh from './components/AgentChatDsh.jsx'`，并加：

```js
// VITE_AGENT_BACKEND=legacy 时走旧浏览器内编排；默认 dsh 基座
const AgentChatImpl = import.meta.env.VITE_AGENT_BACKEND === 'legacy' ? AgentChat : AgentChatDsh
```

`AgentPage` 内 `<AgentChat key=... />` 改为 `<AgentChatImpl key=... />`（其余 props 不变）。

根目录 `.env.example`（新建）：

```
# 元气 AI 前端：dsh（默认）| legacy（回退旧编排）
VITE_AGENT_BACKEND=dsh
```

- [ ] **Step 3: 构建与联调**

```bash
npm run build 2>&1 | tail -3
```
Expected: 构建成功。然后两个终端：`npm run server` 与 `npm run dev`，打开元气 AI 页面：
1. 输入"我是 1990 年 5 月 6 日早上 8 点出生的男性，帮我排八字" → 看到工具块"八字排盘"、正文引用庚午等干支。
2. 追问"那我几岁起运" → 不再出现工具块，答案与上一条一致。
3. 输入"给我出一份子平八字报告" → 出现报告卡片。
4. 点"会话历史"能看到并恢复该会话。
5. `VITE_AGENT_BACKEND=legacy npm run dev` → 旧组件仍可用。

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentChatDsh.jsx src/App.jsx .env.example
git commit -m "feat(agent): AgentChatDsh renders /api/agent SSE stream; backend switch"
```

---

### Task 14: 文档、全量验证与收尾

**Files:**
- Modify: `server/README.md`
- Modify: `docs/superpowers/specs/2026-09-04-dsh-agent-base-design.md`（如 Task 1/7 有口径修正）

- [ ] **Step 1: 补部署文档**

`server/README.md` 末尾追加一节：

```markdown
## 元气 AI（dsh 基座）

后端通过 `@deepseek-ai/dsh` 子进程提供 agent 能力，前端走 `/api/agent/chat`（SSE）。

```bash
# 首次：安装插件到 profile、生成技能目录、检查密钥
npm run agent:setup
# 冒烟（需 server/.env 里的 DEEPSEEK_API_KEY）
npm run agent:smoke
```

| 环境变量 | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek 官方密钥（必填） |
| `MINIMAX_API_KEY` | MiniMax 备选模型（可选） |
| `AGENT_DEFAULT_ROUTE` | 默认路由：`deepseek-flash` / `deepseek-pro` / `minimax` |
| `AGENT_STORE_FILE` | 会话索引文件，默认 `server/data/agent_sessions.json` |

运行时数据：`server/dsh/home/sessions/`（dsh 会话日志，需挂持久卷）。密钥只在服务端，子进程 env 白名单传递，遥测已关闭。
```

- [ ] **Step 2: 全量测试与构建**

```bash
npm test 2>&1 | tail -15 && npm run build 2>&1 | tail -3 && npm run agent:smoke
```
Expected: 所有 `node --test` 套件 PASS；构建成功；冒烟通过或因无 key 跳过。

- [ ] **Step 3: 对照 spec §1 成功标准逐条核对并记录**

在 `docs/superpowers/specs/2026-09-04-dsh-agent-base-design.md` 顶部把"状态：待评审"改为"状态：已实现（YYYY-MM-DD）"，并在 §14 之后追加"## 15. 验收记录"，逐条写明 §1 五条标准的验证方式与结果（含未通过项）。

- [ ] **Step 4: Commit**

```bash
git add server/README.md docs/superpowers/specs/2026-09-04-dsh-agent-base-design.md
git commit -m "docs(agent): dsh deployment notes and acceptance record"
```
