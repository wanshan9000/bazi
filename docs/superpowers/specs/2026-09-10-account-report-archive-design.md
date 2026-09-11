# 账号报告档案设计

## 目标

让登录用户能够长期保存、浏览、恢复和删除自己的测算结果；从报告页进入元气 AI 的咨询会话可回到对应报告。旧版浏览器本地的命盘与塔罗记录在首次登录后仅迁移一次。

## 范围

首期覆盖八字、紫微、奇门、黄历、塔罗、称骨、姓名、风水、星座的已生成结果。所有记录均按账号隔离；游客仍可体验页面，但不写入账号档案，登录后仅迁移现有本地历史。

## 数据模型

服务端在独立的 `report_archives.json` 中维护两类数据：

- `reports[]`：完整报告或基础命盘记录。
- `migrationClaims{}`：`userId -> true`，确保每个账号的本地迁移只执行一次。

一份报告的结构为：

```js
{
  id: 'uuid',
  userId: '账号 id',
  type: 'bazi | ziwei | qimen | huangli | tarot | chenggu | name | fengshui | horoscope | chart',
  title: '用户可见标题',
  summary: '列表摘要（最多 180 字）',
  report: { /* 可被 ReportView 直接渲染的完整结果；基础命盘记录为 null */ },
  source: 'live | legacy-local',
  chart: { /* 必要的出生或命盘上下文，经过字段白名单裁剪 */ } | null,
  facts: ['可显示的关键字段'],
  agentSessionIds: ['关联会话 id'],
  createdAt: 0,
  updatedAt: 0
}
```

完整报告正文和恢复用的数据保存在 `report`；列表接口不返回完整 `report`，避免个人中心首屏载入过大。每个用户最多保存 120 份报告，超出时拒绝新增并提示先整理；不自动删除用户数据。

## 服务端

新增 `server/reportArchive.js`，使用现有 JSON 原子写入模式，提供：

- `saveReport(userId, payload)`：校验类型、大小、文本字段和归属，写入一份新档案。
- `listReports(userId, { type })`：返回列表摘要、类型计数和关联会话数量。
- `getReport(userId, reportId)`：只返回本人的完整报告。
- `deleteReport(userId, reportId)`：删除报告本身；不删除 `agentSessionIds` 指向的会话。
- `appendSession(userId, reportId, sessionId)`：将一条已属于该账号的会话关联到报告。
- `migrateLegacy(userId, reports)`：仅在该账号尚未迁移时接收白名单格式的本地历史并保存；成功后登记迁移标记。
- `deleteAllReports(userId)`：账号注销时清理该账号的所有档案和迁移标记。

新增 `server/routes/reports.js`。所有接口使用既有 `requireAuth`：

- `GET /api/reports?type=`：我的报告列表和分类计数。
- `GET /api/reports/:id`：单份完整报告。
- `POST /api/reports`：保存当前生成的报告。
- `POST /api/reports/migrate`：一次性迁移浏览器旧记录。
- `POST /api/reports/:id/sessions`：关联一条自己的 Agent 会话。
- `DELETE /api/reports/:id`：删除一份报告。

请求体上限沿用全局 400KB，同时路由层为单份报告设定 240KB 上限。报告读取、删除和会话关联均以服务端 `req.uid` 作为唯一归属依据，绝不相信前端传入的账号 ID。

`server/index.js` 注册报告路由；账号注销回调同时调用 `deleteAllReports(uid)` 与现有的 `deleteAllSessions(uid)`。

## 前端数据流

新增 `src/api/reports.js`，封装列表、详情、保存、迁移、删除与会话关联调用，并使用现有 Bearer 身份头。

新增 `src/engine/reportArchive.js`：

- 将每种结果页的结果规范化为可保存的 `ArchiveDraft`。
- 按类型提取标题、摘要、关键字段与可恢复的页面状态。
- 裁剪列表文案和迁移数据；任何未识别字段不上传。
- 将本地 `sanmen-history`、`sanmen-tarot-history` 转为基础命盘和塔罗历史草稿。

结果页在“完整结果首次准备好”时对已登录用户调用保存接口；网络失败不会影响当次阅读，仅显示一次轻提示并允许后续重试。保存采用稳定的客户端去重键，避免同一次生成因重渲染创建多份档案。

`openReportAgent` 增加 `reportId`。报告页发起咨询时，Agent 页面会以该 ID 作为会话来源；服务端创建会话后，前端调用关联接口。若关联请求失败，不阻断聊天，会话仍保存到现有“会话历史”。

## “我的报告”界面与入口

个人中心统计区替换为可点击的“我的报告”入口；进入后按“全部、命盘、塔罗、黄历、其他”筛选，以时间倒序展示类型、标题、摘要、生成时间和关联对话数量。

点击报告：恢复到只读报告详情，并提供“咨询元气 AI”“查看关联会话”“删除报告”“返回个人中心”。删除前二次确认；删除成功后回到列表并刷新计数。会话历史仍可独立访问，因此报告删除不会删除聊天正文。

底部导航后续新增“我的”时，该入口指向同一个人中心；未登录用户进入登录页。桌面顶栏继续使用现有头像入口，不增加重复文字导航。

## 旧本地记录迁移

登录成功或刷新账号资料后执行一次迁移：

- `sanmen-history`：转为 `chart` 类型的基础命盘记录，保留出生要素、四柱和日主等已有字段；不伪造完整解读正文。
- `sanmen-tarot-history`：转为 `tarot` 类型，保留牌阵、问题、抽牌和历史摘要；不重新随机抽牌。

迁移请求只提交本机现有数据，成功后保留本地副本作为离线回退；服务端迁移标记阻止重复导入。多台设备的历史可各自迁移，但由服务端内容指纹去重相同记录。

## 错误与隐私

- 未登录访问报告 API 返回 401；前端跳转登录。
- 访问、删除、关联不属于自己的报告返回 404，避免泄漏 ID 是否存在。
- 对话只能关联同账号会话；删除报告不会改变会话。
- 账号注销的回调先清报告再清会话；任一步失败记录错误，账号删除流程不留下可读取档案。
- 不保存前端未列入白名单的本地存储内容。

## 验证

测试覆盖：

1. 报告保存、列表、详情、删除和账号隔离。
2. 非法/过大报告与伪造所属会话被拒绝。
3. 删除报告不删除关联会话；账号注销同时清报告与会话。
4. 旧命盘/塔罗迁移的去重与一次性语义。
5. 八字、塔罗至少各一页在登录后生成完整档案；报告页咨询写入关联。
6. 个人中心“我的报告”入口、分类筛选、恢复、删除确认和未登录引导。
7. 全量 `npm test`、`npm run build` 与 `git diff --check`。
