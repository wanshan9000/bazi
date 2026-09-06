# Agent 记忆与账号服务端隔离（R2）改造方案

> **进度校订（2026-09-06 · 第二次）**
> - M0 存储作用域隔离：已落地（`src/engine/userScope.js`），并修掉了「旧游客数据被
>   复制进每一个新登录账号」的串号问题 —— 现在只有第一个认领它的账号会继承。
> - M1 服务端账号 + JWT：**已落地**。
>   - `server/jwt.js`（HS256，钉死 alg）、`server/accounts.js`（scrypt 加盐、原子写、
>     损坏另存）、`server/routes/auth.js`（注册/登录/资料/改密/切档/扣积分/注销）。
>   - `/api/agent/*` 改为 `Authorization: Bearer <jwt>` 归属，**不再接受自报的账号 uid**；
>     游客仍可用 `anon:*`，但单桶额度更紧。
>   - 前端 `src/api/auth.js` + `src/data/users.js` 全面走接口，本地只留一份供首屏
>     同步渲染的镜像；401 会就地清 token 并把界面切回未登录。
>   - 老的本地账号在登录时自动迁移（`src/data/legacyMigrate.js`），并把 `::<旧uid>`
>     的存储键改挂到新 uid，避免老用户被锁在门外、本地数据变成孤儿。
> - M2 配额可信：**部分落地**。积分额度与扣减已在服务端（`/auth/credits/consume`，
>   以及 `/agent/chat` 每轮自动扣减、无产出自动退还），客户端改不动余额了。
>   仍未完成的是 `llm.js` 那条 legacy 直连路径的密钥下掉 —— 该文件只服务回退路径，
>   默认路径（dsh）的密钥只在服务器上。
> - M3 支付：**未开始**，且不能只在代码层推进（见下）。`/auth/plan` 目前等于
>   「点一下就升级」，只是把这个动作从 localStorage 挪到了服务端。
>   真实收费必须在服务端插入「下单 → 支付回调验签 → 再改档位」。
> - 会员到期：已生效。新增 `free` 档作为「未订阅/已过期」的落点，
>   `planExpiresAt` 到期即降级，额度随之按 free 算。free 不在 `PLANS` 里，
>   不进购买列表，也不能通过切档接口切进去。
> - 数据备份：`server/backup.js` 定期快照 + 轮转（原子写只防写坏，防不了误删）。
> - 文中提到的 `POST /api/import`：以 `POST /api/agent/sessions/claim` 实现
>   （登录后把 `anon:*` 名下的会话过户给账号），只接受匿名来源。

> 关联：`docs/会员与权限模块-开发盘点.md`（现状基线）、`src/engine/userScope.js`（本地隔离，已完成）
> 一句话目标：把「会话 / 记忆 / 收藏 / 画像」从浏览器 localStorage 迁到现有 Express 后端，按 **token 归属** 天然隔离，获得真正的"不同人对话不串台 + 多设备同步 + 模型密钥不下发"。

---

## 一、现状与边界

### 1.1 本次已完成的本地隔离（M0，已上线验证）

不同账号的数据在**同一浏览器**内已互不串台（`npm run build` 通过）：

| 数据 | 原全局 key | 隔离后 | 文件 |
|---|---|---|---|
| 会话列表 | `yqmm_agent_sessions_v1` | `key::<uid>`（游客用原 key） | `engine/sessionHistory.js` |
| 当前会话标记 | `yqmm_agent_current_session`(sessionStorage) | `key::<uid>` | 同上 |
| 动态事实记忆 | `genki-agent-facts` | `key::<uid>` | `engine/agentMemory.js` |
| 命盘记忆 / 用户画像 | `genki-agent-chart-memory` / `genki-agent-user-profile` | `key::<uid>` | `components/AgentChat.jsx` |
| 命盘收藏 | `genki-chart-collection` | `key::<uid>` | `engine/chartCollection.js` |

保留全局（有意）：游客配额 `qw_free_quota`、技能库与进化日志、模型配置 `genki-agent-config`。

### 1.2 M0 解决不了的问题（R2 的理由）

1. **换设备不同步**：数据锁死在浏览器，换手机/电脑即失忆。
2. **改本地存储即可越权**：`sanmen-users` 里的账号、积分、会员档位全是明文可改的演示实现。
3. **模型密钥裸奔**：`llm.js` 中各家 apiKey 明文存在于 localStorage，任何访问者都能取出。
4. **无服务端审计**：积分/配额无法可信扣减，管理员无任何视角。

---

## 二、目标架构

```
┌─ 浏览器（Vite 前端）─────────────────────┐
│ 页面/组件 ──► engine/agentCore（纯 JS 编排）│
│    │                                       │
│    ▼                                       │
│ engine/userStore.js  ← 统一存储接口        │
│  ├─ local 实现（现状, VITE_STORAGE=local）  │
│  └─ remote 实现（VITE_STORAGE=remote)      │
└───────┬────────────────────────────────────┘
        │ fetch (Bearer JWT)
┌───────▼────────────────── server/ 现有 Express ────────────┐
│  routes/auth.js        注册/登录/微信/me（复用短信+微信能力）│
│  routes/memory.js      画像/命盘/动态事实                    │
│  routes/sessions.js    会话头+消息（分页）                   │
│  routes/collections.js 命盘收藏                              │
│  routes/agent.js       LLM 流式代理 + 积分扣减（二期）        │
│  store.js 延续 JSON 文件模式（可平滑换 SQLite/MySQL）        │
└─────────────────────────────────────────────────────────────┘
```

**隔离原理差异**：M0 靠 `key::<uid>` 字符串防君子；R2 由后端从 token 解出 `uid`，存储天然按用户归属——**客户端拿不到别人的 key**，改不了自己的额度。

---

## 三、数据模型（沿用 store.js JSON 文件模式，单文件约 6 个）

| 集合 | 文件 | 关键字段 |
|---|---|---|
| users | `server/data/users.json` | `id, account, nick, passHash(scrypt/bcrypt), avatar, plan, planExpiresAt, credits, createdAt` |
| sessions | `server/data/sessions.json` | `id, uid, title, createdAt, updatedAt, mode` |
| messages | `server/data/messages.json` | `id, sessionId, uid, role, parts, tokens, at` |
| memories | `server/data/memories.json` | `uid, chart, profile, facts[]`（三段合一，均可为 null） |
| collections | `server/data/collections.json` | `uid, items[]`（结构同 `chartCollection.js`） |
| credit_logs | `server/data/credit_logs.json` | `uid, delta, reason, at`（积分审计，可选） |

> 推荐一次性替换现前端 key：`sanmen-users`（users）、`yqmm_agent_sessions_v1`（sessions）、`genki-agent-*`（memories/collections）。
> 与现有订阅数据 `server/data/subscribers.json` 互不干扰，另存一文件。

---

## 四、API 设计

统一前缀 `/api`，鉴权头 `Authorization: Bearer <jwt>`（或 HttpOnly Cookie）。均校验 `uid` 由 token 决定，**请求体不传 uid**。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | `{account, pass, nick}` → `{token, user}` |
| POST | `/api/auth/login` | `{account, pass}` → `{token, user}` |
| POST | `/api/auth/wechat` | 沿用现微信扫码流（`server/routes` + `RegisterPage`），openid 换 token |
| GET | `/api/auth/me` | 当前用户信息（含 credits/plan） |
| PUT | `/api/auth/me` | 改昵称/头像 |
| PATCH | `/api/auth/password` | 需旧密码 |
| GET/PUT | `/api/memory/profile` | 用户画像 |
| GET/PUT/DELETE | `/api/memory/chart` | 命盘记忆（DELETE=清空重来） |
| GET/PUT | `/api/memory/facts` | 动态事实（PUT 全量覆盖，幂等） |
| GET | `/api/collections` | 收藏列表 |
| POST/DELETE | `/api/collections/:id` | 收藏 / 取消 |
| GET | `/api/sessions` | 会话头（按 updatedAt 倒序，≤30） |
| POST | `/api/sessions` | 建会话 `{title, mode}` |
| PUT/DELETE | `/api/sessions/:id` | 改名 / 删除（级联删消息） |
| GET | `/api/sessions/:id/messages` | 拉取消息（分页 / after=id 增量） |
| POST | `/api/agent/chat` | 二期：流式 SSE，服务端组装 system+记忆+调模型+扣积分 |

### 关键接口语义

- 写内存接口是**全量 PUT**（前端本来就整存整取），天然幂等、好迁移。
- `POST /api/agent/chat` 服务端职责：读该用户 memories → 组装 system → 转发 `llm.js`（复用到 Node）→ SSE 流回 → 按 `tokens` 从 `credits` 扣减。**游客**（无 token）走限频的 `deviceId` 配额，或直接要求登录（产品口径）。
- `DELETE /api/auth/me`（注销账号）应连坐清掉该 uid 全部集合，满足隐私合规。

---

## 五、鉴权与安全

1. **口令存储**：服务端 `scrypt`/`bcrypt` 加盐哈希（现有前端 djb2 仅 demo，不得直接搬）。
2. **JWT**：`jsonwebtoken`，`expiresIn 7d`，密钥进 `server/.env`（`JWT_SECRET`）。
3. **CSRF/XSS**：token 走 `Authorization` 头即可豁免 Cookie 类 CSRF；如用 Cookie 需 `HttpOnly + SameSite=Lax + CSRF token`。
4. **限流**：`/api/auth/*` 登录限 5 次/15 分钟/账号+IP；`/api/agent/chat` 按账号+IP 限流（防刷爆积分）。
5. **CORS**：沿用 `config.allowedOrigins`，生产收紧为真实域名。
6. **HTTPS**：全部接口走 TLS；apiKey 只存在于服务端 env（如 `LLM_API_KEY_*`）。
7. `/api/admin/*`：现有订阅管理接口**上线前必须加管理员鉴权**（README 已警示）。

---

## 六、前端改造路径（单一 adapter，逐模块切换）

### 6.1 新增 `src/engine/userStore.js`

```js
// 统一存储接口：local（现状）/ remote（上云）两套实现
export const STORE = import.meta.env.VITE_STORAGE === 'remote' ? remoteStore : localStore
// localStore：内部调用现 userScope.localKey(base)（M0 成果直接复用）
// remoteStore：async get(base) → GET /api/memory/...; set/remove 同理
```

各模块只需把「读 `localStorage` + 字符串 key」改为调 `userStore.get/set` 语义化 API（见 6.2），**业务零感知**。

### 6.2 调用点改造清单

| 模块 | 现在 | 改为 |
|---|---|---|
| `sessionHistory.js` | `safeGet/safeSet` | `userStore.listSessions / upsert`（远程自动过滤 uid） |
| `AgentChat.jsx` | `loadUserProfile/saveChartMemory` 等 5 处 | `userStore.getProfile / putChart / ...` |
| `agentMemory.js` | `loadFacts/saveFacts` | `userStore.getFacts/putFacts` |
| `chartCollection.js` | `listCollection` 等 | `userStore.getCollection/putCollection` |
| `users.js` 登录态 | `getSession()` 读 localStorage | `auth` 模块：`login/register` 走 API，`getSession` 返回服务端 user + token |

### 6.3 引擎可复用性判断（二期关键）

`AgentChat.jsx` 中的 agent 编排（路由/规划/反思/记忆注入）目前与 React 组件耦合。上云前先抽 `engine/agentCore.js`（纯 JS：接收 `{messages, memories, skills, llm}` → 返回本轮 reply/toolCalls/tokens），组件只做渲染与流式接管。该 core 两端共用：前端直连（local 模式）与 `POST /api/agent/chat`（remote 模式）同构，避免两套逻辑漂移。

---

## 七、迁移与兼容

1. **账号迁移**：可选脚本读 `localStorage['sanmen-users']` → 逐个 `POST /api/auth/register`（密码哈希不可逆，demo 账号需重置密码或直接失效）。
2. **数据搬运**：脚本按 `base::<uid>` 模式扫出全部旧 key → 按 uid 写入对应集合 → 本地保留一份 `export.json` 后清理。
3. **降级开关**：`VITE_STORAGE=local` 可随时回退，改造可分批合入主干，**不打断现有用户**。
4. **游客**：继续用本地 quota（无需账号的行为数据留在设备）；引导注册后自动上传当前收藏/会话（调 `POST /api/import` 一次性合并，防丢）。

---

## 八、里程碑拆分（每步可独立上线）

- **M1 · 身份与记忆上云**（核心隔离目标达成）
  `routes/auth.js` + `routes/memory.js|collections.js|sessions.js` + `userStore` remote 实现 + 前端 auth 切换。验收：A/B 两账号两台设备，数据互不可见且可同步。
- **M2 · 配额可信与模型代理**
  `routes/agent.js` SSE 代理 + credits 服务端扣减 + 游客限频；前端 `llm.js` 密钥下掉，统一走 `/api/agent/chat`。
- **M3 · 档位支付闭环**（与会员盘点 D6–D9 汇合）
  `users.planExpiresAt` 生效 + 订单接口 + 支付模拟 → Profile/落点页面展示真实到期与续费；`/api/admin` 加管理员鉴权与用户/订单/审计查询。

---

## 九、上线安全检查清单

- [x] `server/.env` 配置 `JWT_SECRET`（未配时自动生成随机密钥存到 `data/.jwt-secret`，
      单机可用；多实例必须显式配同一个值），密钥不进代码库
- [x] `/api/admin/*` 增加管理员鉴权（口令 + 失败限流）
- [x] 登录/聊天接口限流；全站 HTTPS（Caddy）
- [x] 注销账号 API 连坐清除用户数据（账号 + AI 会话与消息）
- [x] CORS 白名单收窄；`dist/` 由 Caddy 托管并开启 TLS
- [x] 数据文件目录 `server/data/` 定期快照（`server/backup.js`）
- [ ] `server/data/` 挂持久卷 —— 需要服务器侧操作，代码这边管不到

---

## 十、工作量与风险

| 项 | 估时 | 风险 |
|---|---|---|
| M1 后端四组路由 + 前端 adapter + auth 切换 | 2–3 人日 | 低（无算法重构，纯搬移） |
| M2 agentCore 抽取 + SSE 代理 + 积分 | 3–5 人日 | 中（需两端同构验证、流式中断重试） |
| M3 支付档位（依赖 D6–D9 口径） | 2–4 人日 | 中（产品口径未定） |
| 密码/密钥安全改造 | 含在 M1/M2 | 低但不可省 |

**建议起步**：直接开工 M1 —— 它独立解决"不串台 + 多设备 + 管理员视角"三个最高价值缺口，且不动 agent 编排算法。
