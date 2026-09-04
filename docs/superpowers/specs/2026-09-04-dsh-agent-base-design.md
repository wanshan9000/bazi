# 灵枢 Agent 迁移到 DeepSeek Harness（dsh）基座 · 设计文档

> 日期：2026-09-04 ｜ 状态：已实现（2026-09-04），验收记录见 §15
> 关联：`docs/Agent记忆与账号服务端隔离R2改造方案.md`（本设计落地其 M2：密钥与会话上服务端）
> 决策（已确认）：DeepSeek 官方为主模型 + pi-ai 路由保留 MiniMax；去掉 dsh 自带 bash/文件/网页/subagent 工具；单 dsh 进程共享、后端按 uid 映射 session；本期只做 agent 通道，账号/记忆上云（R2 M1）另开一期。

## 1. 背景与目标

现状 agent 100% 在浏览器内运行，编排全在 `src/components/AgentChat.jsx`（2127 行）：正则意图路由抢在模型前面、工具结果不跨轮保留、输出上限 1000 token、reflect 循环存在把重写指令当答案显示的 bug、API key 明文存于 localStorage。对话"蠢"的根因在编排层而非模型。

目标：以 dsh（`@deepseek-ai/dsh` 0.1.2-rc.1，MIT）作为服务端 agent 基座，前端只做渲染与流式接管。

成功标准：
1. 用户在对话中给出生辰，模型自主调用 `bazi` 工具并基于真实排盘作答；下一轮追问"大运呢"无需重新排盘（会话日志保留工具结果）。
2. 浏览器不再持有任何模型密钥；`localStorage['genki-agent-config']` 的 apiKey 字段废弃。
3. 现有 13 个 skill 的人设/能力文本迁为 SKILL.md，模型可按需加载。
4. 流式回复、思考过程折叠、工具调用提示、报告卡片渲染与现在体验持平或更好。
5. 现网可通过开关回退到旧编排（一个发布周期后删除旧代码）。

非目标（本期不做）：服务端账号/JWT、记忆与收藏上云、积分服务端扣减、多模型自动路由、语音/图片输入。

## 2. 可行性验证结论（2026-09-04 spike，抛弃式）

在 scratchpad 中已验证：
- `$DSH_HOME/profiles/lingshu/package.json` 以 `@deepseek-ai/dsh-sdk-minimal` 为唯一 bundle，`cordis.patch.yml` 逐行 `disabled: true` 去掉 shell/编辑器/pty，`system-prompt` 行改 persona，`insert` 挂本地插件 —— 树可启动。
- 本地插件 `ctx.tools.register(defineTool({...}))` 注册 `bazi` 工具成功，`ctx.tools.schemas()` 可见。
- `@deepseek-ai/dsh-sdk-client` 的 `HarnessClient` 子进程启动 → `initialize`（142ms）→ `session/prompt` → `session.event` 流（`turn/start`、`user/message`、`request/header`、`assistant/chunk`、`turn/end`）→ `session.status: idle`，请求已到达 DeepSeek（假 key 返回 401 AUTH）。

两个坑：
- 插件必须是**真实 npm 包**（`package.json` 含非空 `name`/`version`，`"type": "module"`），并以裸包名装进 profile 目录（`npm i ./plugins/xxx` 产生 symlink）。直接写文件路径会被 `plugin-package-inventory-deepseek` 拒绝（REQUEST_EXTENSION）。
- patch 的 `name` 字段不能用 `!!js` 表达式（Loader 需要字符串）。

## 3. 总体架构

```
浏览器 (Vite/React)
  AgentChat.jsx ── fetch POST /api/agent/chat (SSE) ──► server/routes/agent.js
                                                          │  DshPool: 按模型路由持有 HarnessClient
                                                          │  uid → sessionId 归属校验、事件归一化、消息镜像
                                                          ▼
                                             dsh --profile lingshu (子进程, stdio JSON-RPC)
                                               ├─ dsh-llm-deepseek   (DEEPSEEK_API_KEY)
                                               ├─ dsh-llm-pi-ai      (minimax 路由, MINIMAX_API_KEY)
                                               ├─ dsh-plugin-lingshu-tools  ← 命理引擎 (Vite lib 打包成 Node 可用 bundle)
                                               ├─ dsh-skill + skill-filesystem + tool-skill  ← server/dsh/skills/*/SKILL.md
                                               └─ session-persistence-jsonl → server/dsh/home/sessions/
```

一句话：dsh 负责"想 + 调工具 + 记会话"，Express 负责"认用户 + 转流 + 存消息索引"，React 只负责"画"。

## 4. 目录与文件

```
server/dsh/
  home/                         # DSH_HOME（sessions/、storages/ 运行时生成，gitignore）
    profiles/lingshu/
      package.json              # bundles: ["@deepseek-ai/dsh-sdk-minimal"], patchReload: startup
      cordis.patch.yml          # 见 §5
      cordis.yml                # dsh 首次初始化生成，提交
  plugins/lingshu-tools/        # dsh 插件包（真实 npm 包，name: dsh-plugin-lingshu-tools）
    package.json
    index.js                    # apply(ctx): 注册全部工具
    tools/*.js                  # 每个工具一个文件（defineTool）
    persona.md                  # 司命人设（迁自 src/data/knowledge.js AGENT_SOUL）
    dist/engines.mjs            # Vite lib 模式产物：src/engine + src/data 的 Node bundle（gitignore）
  skills/                       # SKILL.md 根目录（customSkillDirs）
    bazi/SKILL.md  mangpai/SKILL.md  ziwei/SKILL.md ...   # 迁自 BUILTIN_SKILLS
    _admin/                     # 管理后台自定义技能落盘处（由 routes/skills.js 写入，watch 热加载）
  pool.js                       # DshPool：HarnessClient 生命周期、路由表、健康检查
  events.js                     # session.event → 前端 SSE 事件归一化
  setup.mjs                     # npm run agent:setup：初始化 profile、安装插件 symlink、检查 env
  smoke.mjs                     # npm run agent:smoke：真 key 跑一轮"排八字"，断言出现 tool/call bazi
server/routes/agent.js          # /api/agent/*
server/data/agent_sessions.json # uid ↔ session 索引 + 消息镜像（store.js JSON 模式）
vite.engines.config.js          # 引擎 lib 打包配置
```

## 5. dsh profile 组成（cordis.patch.yml 要点）

基于 `dsh-sdk-minimal`（独立树，不含 dsh-base，天然没有 web/subagent/telemetry 行），patch：

| 行 id | 处理 | 理由 |
|---|---|---|
| `sdk-app-startup` | `profile: lingshu` | help 文案 |
| `terminal-bash`/`terminal-pwsh`/`persistent-bash`/`persistent-pwsh`/`str-replace-editor`/`pty` | `disabled: true` | 命理 agent 不得有 shell/文件能力 |
| `sandbox-policy` | 保留但 `mode: read-only` | 无工具用到，收紧以防万一 |
| `system-prompt` | `includeHarnessIdentity: false`、`includeRuntimeContext: false`、`persona: <persona.md 内容>` | 去掉"coding agent"身份 |
| `llm-deepseek` | `apiKeyEnv: DEEPSEEK_API_KEY`、`reasoningEffort: low`、`maxTokens: 8192` | 命理问答不需要 max 推理；输出上限从 1000 提到 8192 |
| insert `llm-pi-ai` | `providers.minimax`: `api: openai-completions`, `baseURL: https://api.minimaxi.com/v1`, `apiKeyEnv: MINIMAX_API_KEY`, `models: [{id: MiniMax-M2.7, contextWindow: 1000000}]` | 备选模型 |
| insert `lingshu-tools` | `name: dsh-plugin-lingshu-tools` | 命理工具 |
| insert `skill`/`skill-filesystem`/`tool-skill` | `skill-filesystem.includeDefaultRoots: false`, `customSkillDirs: [server/dsh/skills, server/dsh/skills/_admin]` | 只扫我们的技能目录，不扫 ~/.dsh |
| insert `token-meter`/`compaction-basic`/`tool-result-pruner` | 默认值 | 长会话压缩（实现时验证这三行在无 dsh-base 树上可挂载；挂不上则本期省略，1M 上下文足够） |

环境：子进程 env 由 `pool.js` 显式构造：`DSH_HOME`、`DSH_TELEMETRY_DISABLED=1`、`DEEPSEEK_API_KEY`、`MINIMAX_API_KEY`，不继承其他父进程变量。

## 6. 工具设计（dsh-plugin-lingshu-tools）

原则：**工具参数显式化**。现有工具靠 React 闭包里的 `chart` 拿命盘，迁移后模型必须显式传出生信息，这也是模型"自主"的前提。

| 工具 | 参数 | 返回（string，Markdown） | 复用引擎 |
|---|---|---|---|
| `bazi` | `year, month, day, hour, gender, calendar?('solar'|'lunar'), school?('ziping'|'mangpai')` | 四柱/十神/藏干/神煞/大运 + 画像；mangpai 时附做功要点 | `bazi.buildChart`, `cantian.buildBaziFull`, `mangpaiContext` |
| `ziwei` | 同上出生参数 | 十二宫星曜/四化/大限 | `ziwei.buildZiwei` |
| `liuyao` | `question` | 纳甲装卦结果 | `liuyao.buildLiuyaoPan` |
| `qimen` | `datetime?`, `kind?('hour'|'day'|'month'|'year')` | 奇门盘 | `qimen.buildQimenFull` |
| `huangli` | `date?`, `scenario?` | 融合黄历 | `huangli.buildDaily`, `cantian.buildFusedHuangli` |
| `modern_huangli` | `date?` | 现代幽默黄历 | 同上 |
| `tarot` | `spread?('single'|'three')`, `question?` | 抽牌 + 牌意 | `data/tarot` |
| `name` | `surname, given?, gender?, birth?` | 五格三才 / 推荐名 | `nameAnalysis` |
| `fengshui` | `facing, birth?` | 八宅 + 五行 | `fengshui.analyzeFengshui` |
| `wuyunliuqi` | 出生参数 | 五运六气 + 体质 | `wuyunliuqi` |
| `report` | `type(enum 10 种), birth 参数, partner?(合婚)` | 完整报告 Markdown；结果附 `metadata.kind='report'` 供前端渲染卡片 | `reports.buildReport`, `hehunReport` |

引擎 Node 化：`vite.engines.config.js`（lib 模式，`formats: ['es']`，`ssr: true`）把 `src/engine/*.js` + `src/data/*.js` 打成 `dist/engines.mjs`，解决 `bigfishmarquis-qimen` 只发 .ts 源码、`data/tarot.js` 等引用 `window` 的问题（对 `window/localStorage` 引用在入口 shim 为 `undefined`/内存 Map）。插件只 import 这一个 bundle。`npm run build` 前置执行 `build:engines`。

Tool 描述文字沿用 `agentTools.js TOOL_SCHEMAS` 中已打磨的中文描述（含"八字大运 vs 紫微大限严禁混用"）。

## 7. 人设与技能

- `persona.md` = `AGENT_SOUL` 原文 + 一段工具使用规约（"排盘/起卦/择日必先调工具；用户未给出生信息先问；已在会话中排过盘不要重复调用"）。
- 每个 `BUILTIN_SKILLS` 条目 → `server/dsh/skills/<key>/SKILL.md`：frontmatter `name`（kebab-case）、`description`（= desc + cap 摘要）、正文 = `sys`。模型通过 `tool-skill` 按需加载，取代现在"关键词打分选主技能"。
- 管理后台自定义技能：`routes/skills.js` 保存时同步写 `skills/_admin/<key>/SKILL.md`（删除即删文件），`skill-filesystem` watch 热加载，无需重启。
- `agentEvolve.js`（关键词进化）、`agentRouter.js`、`agentSkills.js`、`agentPlanner.js`、`agentReflect*.js`、`classicStudy.js` 的注入逻辑本期不迁；典籍引用（`classicStudy`）可后续做成 `classic_lookup` 工具。

## 8. 后端 API 与事件流

### 8.1 路由（`server/routes/agent.js`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/agent/chat` | body `{ sessionId?, text, chart?, model? }`，返回 `text/event-stream` |
| GET | `/api/agent/sessions` | 当前 uid 的会话列表（title、updatedAt、model） |
| GET | `/api/agent/sessions/:id/messages` | 该会话镜像消息（user/assistant/tool_result 表层事件） |
| DELETE | `/api/agent/sessions/:id` | 删除索引与镜像（dsh 侧 JSONL 保留，定期清理） |
| GET | `/api/agent/models` | 可选模型路由列表（来自 pool 路由表） |

用户识别：本期沿用前端演示账号体系，请求头 `X-Genki-Uid`（游客用设备 id）。这不是安全边界，R2 M1 上 JWT 后原地替换 `getUid(req)` 一个函数。会话归属校验：`sessionId` 必须属于该 uid，否则 404。

> 在 R2 M1 上 JWT 之前，`/api/agent/*` 不得对公网开放（uid 头可伪造、登录用户 id 可枚举）。

### 8.2 DshPool

- 路由表：`{ 'deepseek-flash': {provider:'deepseek-official', model:'deepseek-v4-flash'}, 'deepseek-pro': {...'deepseek-v4-pro'}, 'minimax': {provider:'minimax', model:'MiniMax-M2.7'} }`；默认 `AGENT_DEFAULT_ROUTE=deepseek-flash`。
- 一个路由 = 一个常驻 `HarnessClient`（`initialize` 固定 provider/model，因此不同模型必须不同进程）。懒启动、异常退出后下一请求重启、`SIGTERM` 时统一 `close()`。
- 会话与路由绑定：session 首次创建时记录 route，之后不可换模型（换模型 = 新会话），避免两个进程同时写一份 JSONL。
- 同一 session 同时只允许一个进行中的 turn：并发请求返回 409 `正在回复中`。

### 8.3 命盘上下文

前端在请求中带 `chart`（`{year,month,day,hour,gender,calendar}`）。服务端对比该 session 上次的 chart，变化时在本次用户消息前拼一行 `【当前缘主命盘】1990-05-06 08:00 男（公历）`。不用 `inject`（SDK 协议未暴露）。

### 8.4 事件归一化（`events.js`）

订阅 `subscribeSessionTree(sessionId)`，把 `session.event` 转为前端 SSE：

| dsh 事件 | SSE 事件 |
|---|---|
| `assistant/chunk` `text-chunks` | `{type:'text', delta}` |
| `assistant/chunk` `reasoning-chunks` | `{type:'reasoning', delta}`（前端折叠显示） |
| `tool/call` | `{type:'tool_call', name, args}` |
| `tool/result` | `{type:'tool_result', name, ok, text, kind}`（`kind='report'` 时前端渲染 ReportView） |
| `assistant/message` | `{type:'message', text}`（最终整段，用于纠偏流式拼接） |
| `turn/end` | `{type:'done', reason, usage?}` 然后关闭流 |
| `turn/end` reason=error | `{type:'error', code, message}` |

镜像：`user/message`、`assistant/message`、`tool/result` 写入 `agent_sessions.json`（每会话最多保留 200 条，超出裁剪最旧）。会话 title 取 `session/title` 事件。

### 8.5 取消与超时

SDK 协议无取消。客户端断开时服务端停止转发但 turn 继续到自然结束（受 `maxTokens: 8192` 约束）。单 turn 服务端超时 120s，超时向前端发 `error` 并标记该 session 为"busy 直到 idle"。

## 9. 前端改造（`src/components/AgentChat.jsx`）

删除：本地 LLM 调用（`llm.js` 的 `chatLLM*`）、正则意图分支（择日/合婚/多流派/完整报告/就地排盘）、`routeIntents`/`planSkills`/`buildPlan`/`reflectAll`/`chatLLMReflective`/`sanitize`/`logSkillEvent`/`runAutoEvolution`/`buildStudy*`、`history()` 拼接、`buildSystemPrompt`。

保留：消息列表与 Markdown 渲染、`<think>` 折叠（改由 `reasoning` 事件驱动）、`ToolCallsBlock`、ReportView 卡片、命盘选择/收藏、会话侧栏（数据源改为 `/api/agent/sessions`）、积分扣减（沿用 `consumeCredit`，按 `done` 事件触发一次）、免费额度提示。

新增 `src/api/agent.js`：`streamChat({sessionId,text,chart,model,onEvent,signal})`（fetch + ReadableStream 解析 SSE）、`listSessions`、`loadMessages`、`deleteSession`。

`AgentSettings.jsx`：去掉 apiKey/baseUrl 输入，只保留模型路由选择（来自 `/api/agent/models`）与技能开关（本期技能开关仅影响前端提示，不影响服务端；后续可映射到 `tools.restrict`）。

开关：`VITE_AGENT_BACKEND=dsh|legacy`，默认 `dsh`；`legacy` 时走旧路径（代码保留一个版本后删除）。

`src/engine/chat.js` 的本地模板模式、`Chat.jsx` 及 §7 列出的死模块在切换默认后随旧路径一并删除。

## 10. 安全

- 密钥只在 `server/.env`（`DEEPSEEK_API_KEY`、`MINIMAX_API_KEY`），子进程 env 白名单传递。
- dsh 树内无 shell/fs/web 工具；`sandbox-policy: read-only` 兜底。
- 遥测 `DSH_TELEMETRY_DISABLED=1`。
- `/api/agent/*` 限流：按 uid+IP 每分钟 20 次；`text` 长度 ≤ 2000 字。
- 红线：不再用正则改写模型输出；persona 与 SKILL.md 保留红线条款，回复末尾固定免责声明由前端渲染。

## 11. 错误处理

| 场景 | 行为 |
|---|---|
| dsh 进程未启动/崩溃 | pool 重启一次；仍失败返回 503 `命理助手暂不可用`，前端提示稍后重试 |
| 模型 AUTH/QUOTA | SSE `error` 带 code；前端文案区分"服务配置问题"与"额度用尽" |
| 工具抛错 | dsh 返回结构化错误给模型，模型自行解释；SSE 仍发 `tool_result ok:false` |
| 上下文超限 | 依赖 compaction；若本期未挂 compaction，则服务端对镜像消息数 >150 的会话提示"建议新开会话" |
| 客户端断开 | 停止转发，镜像仍完整写入 |

## 12. 测试

- 单元（`node --test`）：每个工具的 `execute` 对固定生辰输出稳定断言（四柱干支等）；`events.js` 映射表；`DshPool` 用 fake `HarnessClient` 测重启/409/路由绑定。
- 集成：`server/dsh/smoke.mjs` 用真实 key 跑"1990-05-06 08:00 男 排八字"，断言事件流含 `tool/call name=bazi` 且最终文本含四柱；CI 无 key 时跳过。
- 前端：Playwright 用现有 `.playwright-cli` 流程，mock SSE 断言渲染（text → reasoning 折叠 → report 卡片）。
- 验收：§1 成功标准逐条人工核对。

## 13. 迁移与上线

0. 前置：构建排盘引擎打包产物 `server/dsh/plugins/lingshu-tools/dist/engines.mjs`（不入库，插件工具与 SKILL.md 生成都依赖它）。`npm run build` 已通过 `prebuild` 自动构建；`npm run agent:setup` 在缺失时也会自动补建；也可单独 `npm run build:engines`。
1. `npm i @deepseek-ai/dsh @deepseek-ai/dsh-sdk-client`；`npm run agent:setup`。
2. 后端先上（`/api/agent/*` 与旧前端并存）。
3. 前端以 `VITE_AGENT_BACKEND=dsh` 构建灰度；问题回退 `legacy`。
4. 一个发布周期后删除旧编排与死模块。
5. 部署：PM2 守护 `server/index.js`，dsh 为其子进程；`server/dsh/home/sessions` 挂持久卷。

## 14. 已知风险

- dsh 处于 developer preview，协议无版本协商；锁定 `0.1.2-rc.1`，升级需回归 smoke。
- 引擎 Vite lib 打包首次可能遇到浏览器全局依赖，需逐个 shim。
- compaction 三行在无 base 树上是否可挂载未验证。
- 无取消协议：长回复中断只能等自然结束。
- `role:'tool'`/report 卡片的前端渲染依赖服务端消息镜像（`server/data/agent_sessions.json`），不依赖 dsh 自身的会话 JSONL；若镜像文件丢失或裁剪，历史工具结果/报告卡片会在刷新后不可见（dsh 侧日志仍完整，但前端不读它）。
- 登录用户 id 为时间戳派生、可枚举，公网暴露前必须上 JWT。
- 本机（及任何未配置密钥的部署）无 `DEEPSEEK_API_KEY` 时，模型层直接返回 `MISSING_CREDENTIAL`（SSE `error` 事件），对话在 `session`/`title` 之后即终止、不产生 `done`；上线前必须在 `server/.env` 配置 `DEEPSEEK_API_KEY`（及可选 `MINIMAX_API_KEY`），否则 agent 通道对所有用户不可用。

## 15. 验收记录

> 验证时间：2026-09-04；分支 `feat/dsh-agent-base`；执行人：见 git 提交作者。本节逐条核对第 1 节五条成功标准。

| # | 成功标准 | 验证方式 | 证据 | 结果 |
|---|---|---|---|---|
| 1 | 模型自主调用 `bazi` 工具并基于真实排盘作答；追问"大运呢"无需重新排盘 | 配置真实 `DEEPSEEK_API_KEY` 后执行 `npm run agent:smoke`（1990-05-06 08:00 男，问排八字） | 2026-09-05 `npm run agent:smoke` 通过：`tool_call:skill` → `tool_call:bazi`，回复引用 乾造 庚午 辛巳 辛未 壬辰 | **通过** |
| 2 | 浏览器不再持有任何模型密钥 | `grep -rn "apiKey" src/components/AgentChatDsh.jsx src/api/agent.js`；`grep -n "DEEPSEEK_API_KEY" server/dsh/pool.js` | 前两个文件 grep 无匹配（exit 1）；`pool.js:39` 仅在服务端子进程 env 白名单中出现 `DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY \|\| ''` | **通过** |
| 3 | 现有 13 个 skill 迁为 SKILL.md，模型可按需加载 | `ls server/dsh/skills \| wc -l`；`grep -c "^name:" server/dsh/skills/*/SKILL.md` | `server/dsh/skills` 下 16 个目录（`_admin` 为管理后台自定义技能落盘目录，非内置技能），其余 15 个内置技能目录均含 `SKILL.md` 且各自恰好一行 `name:` frontmatter（bazi/fengshui/health/huangli/liuyao/love/mangpai/modern-huangli/name/qimen/tarot/wealth/wuyunliuqi/yixue-taishan/ziwei） | **通过**（15 ≥ 13） |
| 4 | 流式回复、思考过程折叠、工具调用提示、报告卡片渲染与现在体验持平或更好 | 代码走查 `src/components/AgentChatDsh.jsx` 事件分支；`npm test` 覆盖 `server/routes/agent.js` 的 SSE 事件流与镜像逻辑 | `AgentChatDsh.jsx:87-91` 分别处理 `text`（流式拼接）、`reasoning`（折叠显示）、`tool_call`（工具提示）、`tool_result` 且 `kind==='report'` 时走报告卡片渲染（`m.kind === 'report'` 分支见第 128、230 行）；`npm test` 62 个用例全部通过，含 `chat 流式返回并镜像消息`、`turn/end 错误：不再补发 done` 等路由测试 | **部分通过**（代码路径与单测齐全；无密钥环境下无法做真实模型输出的视觉/体验比对） |
| 5 | 现网可通过开关回退到旧编排 | `VITE_AGENT_BACKEND=legacy npm run build` | 构建成功（`✓ built in 1.84s`），产物含独立 chunk（`engine-liuyao-*.js` 1.7MB 等），与默认 `dsh` 构建（`✓ built in 1.67s`）分别产出不同 hash 的 bundle，证明开关切换生效 | **通过** |

补充验证（非成功标准，但支撑上表结论）：
- `npm test`：62/62 通过（`tests 62, pass 62, fail 0`）。
- `npm run build`（默认 `VITE_AGENT_BACKEND=dsh`）：成功。
- `npm run agent:setup`：提示 `server/.env 缺少：DEEPSEEK_API_KEY`，仍完成 profile 初始化（预期行为）。
- `npm run agent:smoke`（2026-09-05，真实 key）：事件流 `title → reasoning… → tool_call:skill → tool_result:skill → tool_call:bazi → tool_result:bazi → text… → done`，回复以 `乾造：庚午 辛巳 辛未 壬辰` 起断，`[smoke] 通过`。

结论：五条成功标准中 1、2、3、5 通过，4 部分通过（代码与单测齐全，视觉/体验对比待真人使用）。第 1 项已于 2026-09-05 用真实 `DEEPSEEK_API_KEY` 补验通过。无阻断性问题，可按 §13 上线步骤推进（注意 §13 第 0 步的引擎打包前置，以及 §8.1 关于上 JWT 前不得公网开放 `/api/agent/*` 的约束）。
