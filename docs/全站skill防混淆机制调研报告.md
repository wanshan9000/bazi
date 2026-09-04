# 全站多算命 Skill 防混淆机制调研报告

> 调研目标：全站有子平八字、盲派、紫微斗数、塔罗、六爻、奇门、黄历、风水、取名等多个算命/命理 skill，它们在意图、术语上极易"弄混"。本报告梳理全站究竟靠什么机制防止这些 skill 串场。

## 核心结论（一句话）

全站**不是**靠"一个统一的意图分类步骤"把问题路由到唯一 skill，而是靠一套**多层纵深防护体系**：

```
skill 关键词加权命中（agentSkills）
  → 跨领域加权路由（agentRouter 的 routeIntents）交叉验证
  → 主技能 + 备选技能（planSkills）
  → 工具集收缩（只注入单个领域的工具 schema，从源头杜绝调错工具）
  → system prompt 内硬性隔离声明（领域锁定 + 术语红名单）
```

其中**最硬的一道防串场约束**是：`routeIntents` 锁定单一领域后**只注入该领域的工具 schema**（模型手里根本没有别的工具可用），加上 system prompt 反复声明"八字大运 vs 紫微大限严禁混用"、盲派禁用子平术语。

但**不存在"一个问题只走一个 skill"的绝对硬约束**——复合问题会保留全量工具让模型自主规划，这是设计上保留的缺口。

---

## 1. Skill 定义与分类 —— `src/data/skills.js`

`BUILTIN_SKILLS` 数组，每个 skill 字段：

| 字段 | 作用 |
|---|---|
| `key` | 唯一标识（skill id） |
| `name`/`icon` | 展示 |
| `desc` | 一句话描述（注入"可用技能清单"） |
| `keywords` | **触发/命中关键词**（防混淆核心） |
| `tool` | 绑定工具名（可无） |
| `cap` | 能力说明（【本次技能能力】） |
| `sys` | 系统提示词人设（【主技能专长】） |

Skill 清单：

| key | name | tool | 区分点 |
|---|---|---|---|
| `bazi` | 八字解读 | `bazi` | 子平派，keywords 含"八字/四柱/喜用神/身强身弱/参天八字/精排/真太阳时/节气交接"（原 `cantian-bazi` 已合并入本技能，高精度精排能力统一收纳） |
| `liuyao` | 六爻起卦 | `liuyao` | "六爻/起卦/摇卦/一卦" |
| `tarot` | 塔罗抽牌 | `tarot` | "塔罗/抽牌/牌阵/正位逆位" |
| `huangli` | 黄历择日 | `huangli` | "黄历/宜忌/择日/吉日" |
| `modern_huangli` | 现代幽默黄历 | `modern_huangli` | "沙雕/打工人/程序员/摸鱼" |
| `ziwei` | 紫微斗数 | `ziwei` | "紫微/斗数/十二宫/星曜/四化" |
| `qimen` | 奇门遁甲 | `qimen` | "奇门/遁甲/九宫/值符/八门" |
| `love` | 姻缘感情 | 无 | "姻缘/桃花/感情/婚姻" |
| `wealth` | 财运事业 | 无 | "财运/事业/跳槽/创业" |
| `health` | 健康养生 | 无 | "健康/养生/失眠/体质" |
| `fengshui` | 风水布局 | `fengshui` | "风水/布局/财位/煞气" |
| `name` | 取名开运 | `name` | "取名/起名/改名/名字" |

> **注意**：`mangpai`（盲派）**在** `BUILTIN_SKILLS` 中（独立 skill，`key='mangpai'`，`tool='bazi'` 共享排盘引擎，自带独立 `cap`/`sys`）。它同时保留"流派（school）"机制——完整报告与普通测算中经 `pickSchool` 自动选择（见第 6 节），技能命中与流派选择双轨并行。

---

## 2. Skill 触发/命中机制 —— 三层

### 层 1：旧版单命中 `detectSkill`（skills.js L192）
只按 `enabledSkills` 数组顺序返回**第一个**命中技能，与相关性无关。

### 层 2：新版多技能加权命中 `detectSkills`/`planSkills`（agentSkills.js）
升级为**加权打分**，修正旧逻辑缺陷：
- 长关键词权重高（≥4 字记 3 分，3 字记 2 分）
- 命中位置在开头额外 +1
- **交叉验证**：技能的工具名与领域路由 `routeIntents` 命中一致 → 再 +2

`planSkills` 返回 `{ primary: 主技能, alternatives: 备选, all }`。

### 层 3：跨领域加权路由 `routeIntents`（agentRouter.js）—— 最强防混淆器
把问题对 9 个领域（bazi/ziwei/liuyao/qimen/huangli/tarot/name/fengshui/hehun）按"强 3 / 中 2 / 弱 1"关键词加权打分，返回降序领域意图。

**核心防混淆设计**：bazi 与 ziwei 的"大运/大限"做了显式区分——
- bazi 中权重词：`起运/交运/起运年龄/起运日期`
- ziwei 中权重词：`大限/起限/起限年龄`

避免把紫微"大限"（五行局起限）误当八字"大运"（节气起运）。

---

## 3. 工具注入 —— `src/engine/agentTools.js`

- `TOOL_SCHEMAS` 定义了所有 function-calling schema：`bazi, bazi_report, ziwei, liuyao, qimen, huangli, modern_huangli, tarot, name, fengshui` + 各 `_report` 变体 + `mangpai_report, hehun_report`。
- **每个工具 description 内嵌防混淆声明**，例如：
  - `bazi`：…（注意：紫微的是"大限"按五行局起限，与八字大运不同，勿混用）
  - `ziwei`：…紫微"大限"按五行局起限…与八字"大运"（按节气交运）算法不同，**切勿混用**。
- `runSkillTool(skillKey)` 按 tool 名 switch 分发。`AgentChat.jsx` 用 **`skill.tool`（而非 skill.key）** 分发，所以 `bazi`、`yixue-taishan`、`mangpai` 都设 `tool:'bazi'`，命中后共享同一高精度排盘引擎，只是命中的 `desc/cap/sys` 不同。

---

## 4. 冲突防止（优先级 / 互斥 / 工具收缩）★★★★

最强的"防串场"硬约束在 **AgentChat.jsx LLM 模式的 tools 收缩逻辑（L1488-1519）**：

```js
const _routed = routeIntents(q)          // 领域加权路由
let _tools = TOOL_SCHEMAS                // 默认全量
// 命中"恰好一个"领域，或第一名比第二名高≥2分 → 收缩到该领域工具
if (_routed.length === 1 || (_routed.length > 1 && _routed[0].score - _routed[1].score >= 2)) {
  const narrowed = TOOL_SCHEMAS.filter(...)
  if (narrowed.length) _tools = narrowed // 只注入该领域工具
}
// 未识别领域 → 按命中 skill 收缩
```

同时在 system prompt（L820）硬性声明：
> 【本次可用工具】本问题已识别为单一领域（...）。你只能调用这些工具，不要调用其它领域工具（如用户问八字起运，严禁调用紫微的 ziwei 工具）。

**这是全站最接近"一个问题只走一个 skill"的硬约束**，但仅在"领域路由分数明显领先"时生效。

另有 `enabledSkills` 状态管理（AgentSettings.jsx `toggleSkill`）：默认未启用 qimen/modern_huangli，未启用的技能不参与命中。

---

## 5. System Prompt 构建 —— `buildSystemPrompt`（AgentChat.jsx L743-832）

组装顺序：
1. `AGENT_SOUL`（灵魂/身份/行为规范，最高优先级）
2. 用户画像 + 对话记忆
3. 命盘段：`pickSchool` 自动选子平/盲派，注入对应口径数据
4. 【技能】`skillSystem` 列出所有启用技能
5. 【本次主技能】name+desc+cap
6. 【主技能专长】`skill.sys` + 【优先级锁定】不得覆盖 AGENT_SOUL
7. 【可协同技能】altSkills
8. agentMode 工具说明 + 【本次可用工具】领域锁定 + 【报告工具约束】

**多 skill 共存不互相污染的手段：**
- 每技能只占独立段落。
- 安全护栏：只有内置技能 / `_admin` 的 `sys` 才注入，不可信来源 `sys` 被剥离，防止覆盖灵魂。
- **命盘口径隔离**：盲派分支不注入子平的身强弱/喜忌神概念（`useShen = school !== 'mangpai'`），从数据层面隔离两套体系。

---

## 6. 相似 skill 区分 —— bazi（子平）vs mangpai（盲派）★★★★★（最关键）

### 盲派：独立 skill（tool 共享）+ 八字体系内部的"流派（school）"双轨
- `BUILTIN_SKILLS` 中 `mangpai` 是**独立 skill**（`key='mangpai'`）：keywords 含"盲派/做功/体用宾主/三秒定太极/财官到位/墓库/应期"等，`tool='bazi'`（共享排盘引擎），自带独立 `cap`/`sys`（盲派做功体系 v14）。
- `REPORT_SKILL`：`mangpai: 'mangpai'`（盲派报告读盲派技能）；`bazi: 'yixue-taishan'`（子平报告读易学-泰山技能）。
- `TOOL_SCHEMAS` 只有 `mangpai_report`，无独立 `mangpai` 排盘工具（排盘走 `bazi`）。

### 流派区分逻辑（AgentChat.jsx）
- 普通测算：`pickSchool(chart)` 自动选流派，`schoolRef` 记录用户显式指定（"盲派/盲师派"→mangpai，"子平/传统派"→ziping）。
- 完整报告：`reportTypeOf` —— "子平报告"→bazi，"盲派报告"→mangpai；泛词"完整报告"→`full_ask`（反问用户要子平还是盲派）。

### 自动流派选择 `pickSchool`（mangpaiContext.js L107-115）
```js
const zp = zipingSignals(chart)   // 子平明确度
const mp = mangpaiSignals(chart)  // 盲派明确度
if (mp.score >= 52 && mp.score > zp.score + 5) return { school: 'mangpai', ... }
return { school: 'ziping', ... }  // 默认子平
```
**阈值：盲派必须 ≥52 且比子平高 5+ 分才切盲派**，否则默认子平，避免无意义切换。

### 两派措辞区分（AgentChat.jsx L1119-1157）—— 最典型的"相似 skill 防混淆"手段
完整报告的 system 里，对 `school === 'mangpai'` 注入一段**极强的"禁用子平概念"红名单**：
> 盲派要诀：…通篇不得出现以下子平派概念：
> ①身强/身弱/日主旺/扶抑/平衡
> ②喜用神/忌神/用神到位（须改说"做功目标到位/财官到位"）
> ③正官格/七杀格/正财格…格局清纯
> ④须说"官杀"统称不可拆"正官、七杀"
> ⑤方位/颜色/五行补缺
> ⑥"帮身""身弱无依"
> 遇到上述一律转写为盲派表达：身弱→"体虚、根基偏轻"；喜用神→"做功目标（财官）"；从格→"借势顺势"…

### cap/desc/sys 措辞区分
- bazi cap 明确写"八字命理（**子平派**）…衡日主强弱、取用神…"
- mangpai 是独立 skill：`cap` 明确"盲派命理（做功体系 v14）…通篇禁用子平身强弱/喜用神概念"，`sys` 内嵌盲派五阶段闭环与术语红名单；盲派口径同时经 `buildMangpaiContext` 注入"做功/根基/效率/财富格局"数据，不涉及身强弱。

---

## 7. 潜在缺口与完善度评估

**机制相对完善**（多层纵深防御），但仍有三处缺口：

1. **复合问题无硬隔离**：当 `routeIntents` 命中多个领域且分数接近，`_tools` 收缩条件不满足 → **保留全量 TOOL_SCHEMAS 让模型自主选择**，依赖 LLM 判断，存在调错工具/串场可能。此时【本次可用工具】领域锁定声明也不会注入。

2. **`bazi` 与 `yixue-taishan` 关键词可能同时命中**：两者 `tool` 都是 'bazi'。问"用真太阳时精排、取用神"这类同时含两者关键词的问题时，靠加权分数裁决，两套 `sys` 可能都注入、口径打架（所幸两者都是子平派，口径一致，风险低）。

3. **`detectSkill`（旧接口）兜底仍"按数组顺序取第一个"**（AgentChat.jsx L1451）：当 `planSkills` 返回空时回退旧接口，与 `enabledSkills` 数组顺序强相关，可能被顺序误判（不过该兜底分支较少触发）。

### 最强有效防线总结
`routeIntents` 领域锁定 → 工具集收缩（只注入单领域 tool schema）+ system prompt 领域声明 → 八字大运/紫微大限显式词表区分 → 盲派/子平术语红名单隔离。

**真正兜底"绝不串场"的硬约束，是"只给模型暴露它该用的那个工具"，而非依赖 LLM 自律。**
