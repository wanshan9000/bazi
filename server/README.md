# 元气黄历 · 订阅服务部署说明

本后端为前端页面提供**真实订阅能力**：手机短信验证码订阅 + 微信扫码订阅 + 定时推送当日黄历。
纯 Node + Express，无数据库依赖（默认 JSON 文件存储，可直接上线；规模大可换 Redis/MySQL）。

## 快速开始（本地联调）

```bash
# 1. 安装依赖（含后端 express / cors / dotenv）
npm install

# 2. 启动后端（默认 8787 端口，降级模式）
npm run server          # 或 npm run server:dev（改代码自动重启）

# 3. 启动前端
npm run dev             # http://localhost:5173
```

> 降级模式：未配置短信/微信凭证时，验证码会**打印到后端日志**（同时通过接口 `devCode` 返回给前端便于联调），微信走**模拟扫码**。前后端跨域已配置，本地即可完整跑通订阅流程。

## 上线配置

复制 `server/.env.example` 为 `server/.env`，填入真实凭证：

### 短信（二选一）

| 环境变量 | 说明 |
|---|---|
| `SMS_PROVIDER` | `aliyun` 或 `tencent` |
| `SMS_ACCESS_KEY_ID` / `SMS_ACCESS_KEY_SECRET` | 阿里云 AccessKey |
| `SMS_SIGN_NAME` | 短信签名（需已审核通过） |
| `SMS_TEMPLATE_CODE` | 验证码模板 ID |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` / `TENCENT_SDK_APP_ID` | 腾讯云（选 tencent 时） |
| `SMS_CODE_TTL_MIN` / `SMS_COOLDOWN_SEC` | 验证码有效期 / 发送频率限制 |

### 微信（扫码订阅 + 模板消息推送）

| 环境变量 | 说明 |
|---|---|
| `WX_APP_ID` / `WX_APP_SECRET` | 微信**开放平台「网站应用」**凭证 |
| `WX_REDIRECT_URI` | 扫码后回跳地址，需与微信后台「授权回调域」一致，例如 `https://你的域名/api/wechat/callback` |
| `WX_TEMPLATE_ID` | 公众号模板消息 ID（推送当日黄历用） |

### 部署（bazi.keyfocus.cn · 47.97.48.115）

```bash
deploy/deploy.sh                  # 部署当前 HEAD 已提交内容；--ref <ref> 指定版本；--skip-install 跳过 npm ci
```

- 服务器布局：源码 `/opt/bazi`（构建在 `/opt/bazi-staging` 完成再切换），前端静态 `/var/www/bazi`，
  运行时数据 `server/data/`、`server/dsh/home/sessions/`、`server/dsh/skills/_admin/` 部署时保留不覆盖。
- 进程：systemd `bazi.service`（[deploy/bazi.service](../deploy/bazi.service)），账号 `bazi`，监听 `127.0.0.1:8793`，
  env 在 `/etc/bazi/env`（模板 [deploy/env.example](../deploy/env.example)，首次部署前手工创建）。
- 入口：Caddy 站点片段 [deploy/bazi.caddy](../deploy/bazi.caddy) → `/etc/caddy/conf.d/bazi.caddy`，
  主 Caddyfile 末尾 `import conf.d/*.caddy`。⚠ 该机 Caddyfile 归 KeyfocusHub 仓库 `apps/web/deploy/Caddyfile` 管，
  整份覆盖时必须保留 import 那一行。DNS：阿里云 `keyfocus.cn` 下 A 记录 `bazi` → 47.97.48.115。
- 自托管其他机器：`NODE_ENV=production HOST=127.0.0.1 PORT=8793 BASE_URL=https://你的域名 npm run server`，
  `server/data/` 需持久化。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查，返回短信/微信通道状态 |
| POST | `/api/sms/send-code` | 发送短信验证码（限频） |
| POST | `/api/sms/subscribe` | 短信订阅（校验验证码，绑定八字） |
| GET | `/api/wechat/qr` | 获取微信扫码链接（未配置时返回 mock） |
| GET | `/api/wechat/callback` | 微信授权回调，成功后跳前端订阅页 |
| POST | `/api/wechat/mock-done` | 降级模式模拟扫码完成 |
| GET | `/api/status?token=` | 查询订阅状态 |
| POST | `/api/update` | 更新时段 / 关注生肖 / 开关 |
| POST | `/api/unsubscribe` | 取消订阅 |
| POST | `/api/test-push` | 预览某订阅者的当日推送内容 |
| GET | `/api/admin/list` | 订阅列表（已挂 `requireAdmin`，需 `X-Admin-Token`） |
| POST | `/api/admin/auth` | 管理员登录换令牌（失败有限流） |
| GET | `/api/admin/skills` | 技能列表（未带管理员令牌时不返回 `sys` 人设正文） |
| POST/PUT/DELETE | `/api/admin/skills/:key` | 技能增删改（需管理员令牌） |
| POST | `/api/share` | 保存报告分享短链（按 IP 限流） |
| GET | `/api/share/:id` | 读取分享（超过 TTL 即不可读） |
| POST | `/api/agent/chat` | 元气 AI 对话（SSE 流式） |
| GET | `/api/agent/sessions` | 会话列表（按 `X-Genki-Uid` 隔离） |
| GET | `/api/agent/sessions/:id/messages` | 会话消息镜像 |
| DELETE | `/api/agent/sessions/:id` | 删除会话 |
| GET | `/api/agent/models` | 可用模型路由 |

## 定时推送

后端内置调度器，按订阅者选择的时段（晨起 07:00 / 午间 12:00 / 晚归 21:00）每天推送当日个性化黄历。
推送内容基于订阅者的**真实八字**逐日计算（复用前端引擎），含当日宜忌、与你五行的顺平慎关系、关注生肖运势。
时段可在 `server/.env` 中调整：
`PUSH_MORNING_HHMM=07:00` / `PUSH_NOON_HHMM=12:00` / `PUSH_EVENING_HHMM=21:00`

## 前端接入

前端通过 `src/api/client.js` 调用后端。后端地址默认 `http://localhost:8787`（本地开发；
生产由 systemd 钉在 8793，见上文部署段）。生产用环境变量 `VITE_API_BASE` 指向真实后端。

⚠ `VITE_API_BASE` 只写到**域名**，不要带 `/api` —— 客户端各方法自己会拼 `/api/...`，
写成 `https://你的域名/api` 会得到 `/api/api/...`。同域部署（Caddy 反代 `/api/*`）
可以完全不设这个变量。

```bash
VITE_API_BASE=https://你的域名      # ✅
VITE_API_BASE=https://你的域名/api  # ❌ 会拼出 /api/api
```

## 安全提醒（上线前必读）

- `/api/admin/*` 已统一挂 `requireAdmin`；`ADMIN_PASSWORD` 未设置时管理接口直接 403。
  务必设置一个强口令，**不要沿用 `deploy/env.example` 里的 `change-me`**。
- 生产环境（`NODE_ENV=production`）默认关闭「模拟短信/微信」：未配置真实凭证时
  `/api/sms/send-code` 不再回显验证码，`/api/wechat/mock-done` 直接 503。
  确需在生产联调时才设 `ALLOW_MOCK_CHANNELS=1`。
- 验证码、订阅数据走 HTTPS 传输。
- 短信模板需在服务商后台完成审核；**每日推送与验证码必须是两个不同的模板**
  （见 `SMS_TEMPLATE_CODE` / `SMS_PUSH_TEMPLATE_CODE`）。
- 微信扫码需开放平台认证（企业主体）。
- ⚠ `/api/agent/*` 目前仅凭客户端自报的 `X-Genki-Uid` 归属会话，uid 可伪造。
  已有按 uid 与按 IP 的双层限流兜底，但这不是鉴权 —— 服务端账号 + JWT 见
  `docs/Agent记忆与账号服务端隔离R2改造方案.md`，未落地前不要在此存放敏感内容。

## 元气 AI（dsh 基座）

后端通过 `@deepseek-ai/dsh` 子进程提供 agent 能力，前端走 `/api/agent/chat`（SSE）。

```bash
# 前置：排盘引擎打包产物 server/dsh/plugins/lingshu-tools/dist/engines.mjs
# （不入库，插件工具与技能目录都依赖它）。`npm run build` 会先自动构建它；
# 也可单独跑 `npm run build:engines`；`npm run agent:setup` 在缺失时会自动补建。
npm run build

# 首次：安装插件到 profile、生成技能目录、检查密钥
npm run agent:setup
# 技能正文：BUILTIN_SKILLS.sys 为精炼人设；长文断法（表格/口诀/模板）写在
# server/dsh/skill-docs/<name>.md，改完重跑 `node server/dsh/gen-skills.mjs` 并提交生成的 SKILL.md。
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

前端通过根目录 `.env.example` 中的 `VITE_AGENT_BACKEND=dsh|legacy` 切换新旧编排；`legacy` 时前端回退到浏览器内旧 agent 逻辑，不依赖本节任何后端能力。
