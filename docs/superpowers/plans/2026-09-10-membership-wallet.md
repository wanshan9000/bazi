# 双钱包会员与订阅体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将站内会员积分升级为服务端权威的“月度积分 + 永久积分”双钱包，并把元气 Agent 改为按咨询主题计费的持续顾问体验。

**Architecture:** `src/engine/membership.js` 定义套餐、周期价格、成本和前端展示函数；`server/accounts.js` 管理账户余额、扣款来源与退款；`server/dsh/agentStore.js` 持久化每个 Agent 咨询主题的轮数和过期状态；各 React 页面显示服务端返回的余额与主题状态。

**Tech Stack:** Node.js、Express、React、Vite、node:test。

**Spec:** `docs/superpowers/specs/2026-09-10-membership-wallet-design.md`

## Global Constraints

- 不接真实支付，不通过前端直接增加会员或点数。
- 已有未提交页面改动必须保留，不能重置工作区。
- 失败或无输出的 Agent 回答必须调用服务端退款。
- 服务端决定余额和扣款，前端缓存只用于即时渲染。
- Agent 咨询主题为 5 点 / 8 个成功回合 / 72 小时；游客有 1 个临时主题、最多 5 个成功回合。
- 同一主题内不重复扣点；无模型输出不扣点也不消耗回合。

---

### Task 1: 会员策略与双钱包服务端

**Files:**
- Modify: `src/engine/membership.js`
- Modify: `server/accounts.js`
- Modify: `server/tests/accounts.test.mjs`
- Modify: `server/tests/auth-route.test.mjs`

**Interfaces:**
- Produces: `getCreditBalance(user)`，返回 `{ monthly, permanent, total }`。
- Produces: `consumeCredit(id, feature)`，返回余额和扣款来源。
- Produces: `refundCredit(id, feature, charge?)`，按原来源退款。

- [ ] 写注册赠点、月度优先扣款、永久补扣、退款来源、到期保留永久点的失败测试。
- [ ] 运行 `npm test -- server/tests/accounts.test.mjs server/tests/auth-route.test.mjs` 确认新增断言失败。
- [ ] 最小实现套餐常量、账户迁移、双钱包扣款/退款和 API 返回字段。
- [ ] 运行相同测试确认通过。

### Task 2: 游客体验与计费前端对齐

**Files:**
- Modify: `src/engine/freeQuota.js`
- Modify: `src/engine/tests/membership-users.test.mjs`
- Modify: `src/components/TarotPage.jsx`
- Modify: `src/components/QimenPage.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `FREE_LIMIT = 4`，仅用于未登录塔罗单牌体验。
- Produces: 前端总积分展示使用 `getCreditBalance`。

- [ ] 写游客塔罗四次、免费档无月度积分、永久点可支付功能的失败测试。
- [ ] 运行相关测试确认失败。
- [ ] 删除奇门游客十次额度并收敛塔罗文案与闸门。
- [ ] 运行相关测试确认通过。

### Task 3: 会员与订阅界面

**Files:**
- Modify: `src/components/MembershipModal.jsx`
- Modify: `src/components/ProfilePage.jsx`
- Modify: `src/components/tests/auth-flow.test.mjs`
- Modify: `src/components/tests/smoke.test.mjs`
- Modify: `src/styles/global.css`（仅按现有组件样式补充需要的布局）

**Interfaces:**
- Consumes: `PLANS`、`POINT_PACKS`、`getCreditBalance(user)`。
- Produces: 会员卡与永久点数包的预览购买入口。

- [ ] 写新版套餐价格、月度/永久余额和点数包入口的失败测试。
- [ ] 运行组件测试确认失败。
- [ ] 实现会员卡、点数包卡、双钱包余额说明和支付预览。
- [ ] 运行组件测试确认通过。

### Task 4: 元气 Agent 咨询主题

**Files:**
- Modify: `src/engine/membership.js`
- Modify: `server/routes/agent.js`
- Modify: `server/dsh/agentStore.js`
- Modify: `server/tests/agent-route.test.mjs`
- Modify: `server/tests/guest-quota.test.mjs`
- Modify: `src/components/AgentChatDsh.jsx`
- Modify: `src/api/agent.js`

**Interfaces:**
- Produces: `FEATURE_COSTS['agent.topic'] === 5`。
- Produces: `session.consultation`，包含 `{ kind, totalRounds, remainingRounds, expiresAt, charge }`。
- Produces: SSE `consultation` 事件与会话列表中的主题摘要。

- [ ] 写游客五轮、付费主题首次成功扣 5 点、主题八轮上限、72 小时到期、失败不扣点和续问不重复扣点的失败测试。
- [ ] 运行 `npm test -- server/tests/agent-route.test.mjs server/tests/guest-quota.test.mjs src/engine/tests/membership-users.test.mjs` 确认新增断言失败。
- [ ] 最小实现服务端主题状态、扣点和续问规则。
- [ ] 更新 Agent 前端的主题余量提示、游客体验与不足积分引导。
- [ ] 运行相同测试确认通过。

### Task 5: 订阅周期与顾问价值展示

**Files:**
- Modify: `src/engine/membership.js`
- Modify: `src/components/MembershipModal.jsx`
- Modify: `src/components/ProfilePage.jsx`
- Modify: `src/components/tests/auth-flow.test.mjs`
- Modify: `src/styles/global.css`

- [ ] 写月付、季付、年付与“咨询主题 / 可追问轮数”展示的失败测试。
- [ ] 更新套餐元数据、支付预览与余额说明；支付仍不得直接改写账号权益。
- [ ] 运行组件测试确认通过。

### Task 6: 全量验证

**Files:**
- Modify: 必要时更新受影响测试期望。

- [ ] 运行 `npm test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `git diff --check`。
- [ ] 在本地页面检查会员弹层与个人中心的移动端和桌面端布局。
