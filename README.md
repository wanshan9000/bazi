# 元氣满满 / 灵枢

随时随地在身边的玄学 AI 助手。八字、紫微、六爻、奇门、黄历、塔罗、取名、风水，
排盘引擎在前端与服务端共用一套，AI 对话由服务端的 DeepSeek Harness（dsh）子进程承载。

线上：https://bazi.keyfocus.cn

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
| `deploy/deploy.sh` | 一键部署到 bazi.keyfocus.cn（发布前会跑测试） |

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
  （返回 503），而不是退化成假流程。本地开发仍走降级模式，验证码打在后端日志里。
  微信推送另有一处选型矛盾：开放平台网站应用拿到的 openid 不能用于公众号模板
  消息接口，两条可选路线写在 `server/wechat.js` 的注释里，选哪条是产品决策。
- **`server/data/` 只有本机快照**（`server/backup.js`，默认每 24 小时一份、留 14 份）。
  那只防误删，不防整机故障 —— 服务器侧仍需把该目录纳入常规备份并挂持久卷。
- **隐私政策与用户协议是占位**，页脚未配置就不显示。上线前需要补真实文本与备案号。
- 命理算法以传统流派口径实现，仅供参考，不构成医疗、投资或法律建议。
