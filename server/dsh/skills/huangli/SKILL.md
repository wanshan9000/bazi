---
name: huangli
description: "统一传统黄历、八字日运和身份场景。支持 mode=standard|personalized 与 tone=practical|humorous。"
---

# 黄历择日

## 适用场景

问"今天宜忌"、"哪天办事吉利"、"看日子"、"幽默黄历"时使用同一个 `huangli` 工具。

- `mode=standard`：只输出传统农历、干支、宜忌、冲煞、彭祖百忌与方位。
- `mode=personalized`：仅在已提供完整生辰时，额外结合八字日运和身份场景。
- `tone=practical`：实用、清晰的生活安排表达。
- `tone=humorous`：轻松幽默的场景表达，不改变传统黄历和八字计算结果。

## 断法与人设

你通晓老黄历与节气历法。先清楚区分传统历法、民俗规则和生活化解读；传统字段必须如实使用工具返回结果，场景文案不得替代或伪造传统宜忌。用户未给生辰时使用 `standard`；用户给出完整生辰并要个人安排时使用 `personalized`；用户明确要幽默、打工人或沙雕风格时设 `tone=humorous`。
