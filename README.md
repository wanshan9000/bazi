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
| [server/](server/) | Express 后端：订阅推送、分享短链、管理后台、agent SSE |
| [server/dsh/](server/dsh/) | dsh agent 基座：进程池、工具插件、技能目录 |
| [deploy/](deploy/) | 部署脚本、systemd unit、Caddy 站点片段 |
| [docs/](docs/) | 设计方案与开发盘点 |

后端与部署的详细说明见 [server/README.md](server/README.md)。

## 当前状态与已知限制

- **账号与会员是浏览器本地实现**。用户、积分、会员档位都存在 localStorage，
  「支付」是模拟的。换设备无法登录，能改本地存储的人也能改自己的档位。
  服务端化方案见 [docs/Agent记忆与账号服务端隔离R2改造方案.md](docs/Agent记忆与账号服务端隔离R2改造方案.md)。
- **`/api/agent/*` 只凭 `X-Genki-Uid` 请求头归属会话**，该头可伪造。
  已有按 uid 与按 IP 的双层限流兜底，但那是限流不是鉴权；在服务端账号 + JWT
  落地之前，不要在 AI 会话里存放敏感内容。
- **短信 / 微信需要真实凭证**。未配置时生产环境会直接关闭这两条通道
  （返回 503），而不是退化成假流程。本地开发仍走降级模式，验证码打在后端日志里。
- 命理算法以传统流派口径实现，仅供参考，不构成医疗、投资或法律建议。
