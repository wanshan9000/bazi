# 元氣满满 / 灵枢

随时随地在身边的玄学 AI 助手。八字、紫微、六爻、奇门、黄历、塔罗、取名、风水，
排盘引擎在前端与服务端共用一套，AI 对话由服务端的 DeepSeek Harness（dsh）子进程承载。

线上：https://keymm.me

## 搜索收录

生产站唯一规范域名是 `https://keymm.me`。公开功能页可直接访问 `/bazi`、`/ziwei`、`/huangli`、`/ai-bazi`、`/tarot`、`/fengshui`、`/name`、`/wenku`、中文八字入门 `/learn/bazi-basics` 与英文 BaZi 指南 `/learn/bazi-four-pillars`；旧的 `#/` 地址仍兼容。

- `https://keymm.me/robots.txt` 允许公开页面抓取，禁止 API、登录、账户、报告与管理页。
- `npm run build` 会为所有公开页面生成独立 HTML。Caddy 会优先返回这些静态页，React 加载后再接管交互，因此不执行 JavaScript 的抓取器仍能读取正文、title、description、canonical 和 JSON-LD；中英文 BaZi 指南均提供 `Article`、`FAQPage` 与 `WebApplication` 结构化数据。
- `https://keymm.me/sitemap.xml` 列出首页和核心公开落地页；发布后在 Google Search Console 与百度搜索资源平台分别添加 `keymm.me` 域名资源，完成验证并提交此地址。
- `https://keymm.me/llms.txt` 提供面向 AI 检索器的公开资源索引。它是补充说明，不替代可抓取正文、结构化数据、真实产品质量或第三方引用。
- 不要为排名批量生成同质化或无实际内容的页面；持续发布有作者、日期、事实来源和实际解读价值的文库文章。微信公众号搜一搜与普通网页收录是两套体系，仍需通过已认证公众号或小程序发布原创内容。

## 快速开始

```bash
npm install
npm run dev        # 前端 http://localhost:5173
npm run server     # 后端 http://localhost:8787（另开一个终端）
```

首次跑 AI 对话还需要：

```bash
cp server/.env.example server/.env   # 填入 DEEPSEEK_API_KEY
npm run build:engines                # 生成服务端工具依赖的引擎产物
npm run agent:setup                  # 装插件到 dsh profile、生成技能目录
npm run agent:smoke                  # 真 key 冒烟（可选）
```

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm test` | 全部单测（`pretest` 会先构建引擎产物） |
| `npm run build` | 构建前端（`prebuild` 会先构建引擎产物） |
| `npm run build:engines` | 只构建服务端工具用的引擎 bundle |
| `npm run server:dev` | 后端热重启 |
| `deploy/deploy.sh` | 一键部署到 keymm.me（发布前会跑测试） |

## 目录

| 路径 | 内容 |
|---|---|
| [src/engine/](src/engine/) | 排盘与报告引擎（八字、紫微、奇门、六爻、黄历、姓名、风水…） |
| [src/components/](src/components/) | React 页面与组件 |
| [server/](server/) | Express 后端：账号鉴权、订阅推送、分享短链、管理后台、agent SSE |
| [server/dsh/](server/dsh/) | dsh agent 基座：进程池、工具插件、技能目录 |
| [deploy/](deploy/) | 部署脚本、systemd unit、Caddy 站点片段 |
| [src/test/](src/test/) | 测试引导：esbuild 加载钩子（JSX/TS）、jsdom、渲染助手 |
| [docs/](docs/) | 设计方案与开发盘点 |

后端与部署的详细说明见 [server/README.md](server/README.md)。

## 账号与鉴权

账号在服务端（`server/accounts.js`），登录态是服务端签发的 JWT：

- 口令用 scrypt 加盐散列；账号库原子写，解析失败会另存备份而不是当空库继续跑。
- `/api/agent/*` 按 `Authorization: Bearer <jwt>` 归属，**不接受自报的账号 uid**。
  游客可用 `anon:<设备标识>`，但单桶限流额度更紧。
- 会员档位与积分余额由服务端持有并扣减，客户端改本地存储只会让自己看到假数字。
- 游客可以不登录直接用 AI（免费体验），额度按**来源 IP** 在服务端记账，
  默认每天 5 万 token（约 7 轮，`GUEST_DAILY_TOKENS` 可调）。不按自报的游客标识记 ——
  那个清一次站点数据就重置了。
- `JWT_SECRET` 未配置时会自动生成一个随机密钥存到 `server/data/.jwt-secret`
  （单机可用）；多实例部署必须显式配同一个值，否则 A 机签的 token B 机不认。

之前存在 localStorage 里的老账号，会在登录时用输入的口令校验旧散列后自动迁到
服务端，并把 `::<旧uid>` 的存储键改挂到新 uid，不会被锁在门外或丢掉本地数据。

## 当前状态与已知限制

- **没有接支付**。`/api/auth/plan` 目前等于「点一下就升级」——相比之前只是把这个
  动作从 localStorage 挪到了服务端，档位因此不可篡改，但仍然不收钱。
  真实收费必须在服务端插入「下单 → 支付回调验签 → 再改档位」。
- **会员权益只有积分额度这一个差别**。定价页写的精读文章、流年/节气推送、
  1v1 精批、专属客服、优先体验目前都没有对应实现。到期降级已经生效
  （落到不可购买的 `free` 档，额度按 100 积分算）。
- **短信 / 微信需要真实凭证**。未配置时生产环境会直接关闭这两条通道
  （返回 503），而不是退化成假流程。本地开发的短信验证码仅用于联调。
  公众号提醒还需配置 `WX_TEMPLATE_ID`、`WX_WEBHOOK_TOKEN`，并在微信公众平台把
  `https://你的域名/api/wechat/official/callback` 配为服务器地址。页面会为已登录用户
  生成一次性关注码，公众号的关注/扫码事件回调完成账号绑定；不会再拿网页登录的
  `openid` 去发送公众号模板消息。
- **`server/data/` 只有本机快照**（`server/backup.js`，默认每 24 小时一份、留 14 份）。
  那只防误删，不防整机故障 —— 服务器侧仍需把该目录纳入常规备份并挂持久卷。
- **用户协议与隐私政策**已由站内页面提供；上线前仍必须在前端环境变量中填写真实的 `VITE_LEGAL_ENTITY`、`VITE_CONTACT_EMAIL`，并补齐实际备案号。
- 命理算法以传统流派口径实现，仅供参考，不构成医疗、投资或法律建议。
