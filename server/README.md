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

### 部署

```bash
NODE_ENV=production BASE_URL=https://你的域名 PORT=8080 npm run server
```

推荐用 **PM2** / **Docker** 守护进程。`server/data/subscribers.json` 为订阅数据，需持久化（挂载卷）。

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
| GET | `/api/admin/list` | 订阅列表（**生产请加鉴权**） |

## 定时推送

后端内置调度器，按订阅者选择的时段（晨起 07:00 / 午间 12:00 / 晚归 21:00）每天推送当日个性化黄历。
推送内容基于订阅者的**真实八字**逐日计算（复用前端引擎），含当日宜忌、与你五行的顺平慎关系、关注生肖运势。
时段可在 `server/.env` 中调整：
`PUSH_MORNING_HHMM=07:00` / `PUSH_NOON_HHMM=12:00` / `PUSH_EVENING_HHMM=21:00`

## 前端接入

前端通过 `src/api/client.js` 调用后端。后端地址默认 `http://localhost:8787`，
生产环境用环境变量 `VITE_API_BASE` 指向真实后端，例如 `VITE_API_BASE=https://你的域名/api`。

## 安全提醒（上线前必读）

- `/api/admin/list` 仅用于调试，**上线务必加登录鉴权**或移除。
- 验证码、订阅数据走 HTTPS 传输。
- 短信模板需在服务商后台完成审核。
- 微信扫码需开放平台认证（企业主体）。

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
