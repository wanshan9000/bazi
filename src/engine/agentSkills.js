/**
 * Agent 技能加权路由（深化 skill 调用能力）
 *
 * 现状缺口：skills.js 的 detectSkill 只返回"第一个"命中的技能（按 enabledSkills
 * 数组顺序），与相关性无关；技能工具结果也只是纯文本注入，与领域路由脱节。
 *
 * 本模块升级为【多技能加权命中】：
 *  - 对每个启用技能做关键词加权打分（长词高权重 / 前置词高权重）
 *  - 与跨领域加权路由（agentRouter）交叉验证：技能的工具若与领域路由命中一致则加分
 *  - 返回排序后的多技能 + 主技能裁决 + 结构化工具回传
 *
 * 与 skillByKey / loadCustomSkills 兼容，可直接替换 detectSkill 调用。
 */
import { skillByKey, allSkills, BUILTIN_SKILLS } from '../data/skills.js'
import { routeIntents } from './agentRouter.js'
import { runToolStructured, toolToSummary } from './agentToolsR.js'
import { evolvedSkill } from './agentEvolve.js'

// 技能关键词权重（供加权打分）
function keywordWeight(kw) {
  if (kw.length >= 4) return 3   // 长关键词（如"奇门遁甲""开运方位"）强信号
  if (kw.length === 3) return 2
  return 1
}

/**
 * 多技能加权命中（替代 detectSkill 单命中）
 * @param {string} text 用户输入
 * @param {string[]} enabledSkills 已启用技能 key
 * @param {object[]} customSkills 自定义技能
 * @returns {Array<{key,name,desc,tool,score,hits:Array}>} 按分数降序
 */
export function detectSkills(text, enabledSkills, customSkills) {
  if (!enabledSkills || !enabledSkills.length) return []
  const q = (text || '').trim()
  if (!q) return []

  // 技能池：基础技能 + agent 自我进化（evolvedSkill 合并进化库的 keywords/desc/cap，
  // 仅白名单字段可被进化覆盖，绝不触碰 sys/tool/灵魂）。
  const pool = enabledSkills
    .map(k => skillByKey(k, customSkills))
    .filter(Boolean)
    .map(s => evolvedSkill(s.key, s))

  // 领域路由（用于交叉验证）
  const routedDomains = new Set(routeIntents(q).map(r => r.domain))

  const results = []
  for (const s of pool) {
    if (!s.keywords || !s.keywords.length) continue
    let score = 0
    const hits = []
    for (const kw of s.keywords) {
      if (!kw) continue
      const idx = q.indexOf(kw)
      if (idx !== -1) {
        score += keywordWeight(kw) + (idx === 0 ? 1 : 0) // 前置词额外 +1
        hits.push(kw)
      }
    }
    if (score === 0) continue

    // 交叉验证：技能工具与领域路由命中一致 → 加分
    if (s.tool && routedDomains.has(s.tool)) score += 2

    // 安全护栏：
    //  - 内置技能：sys 由开发者在 skills.js 精心维护，可信，允许注入。
    //  - 管理后台导入的技能（来自 loadCustomSkills，需管理员口令/服务端鉴权）：管理员审核过，
    //    视为可信，允许注入 sys（注入处仍附带「优先级锁定」，不得覆盖 AGENT_SOUL）。
    //  - 其余自定义/不可信来源的 sys 一律剥离，只保留路由/工具/名称/描述能力，
    //    避免注入任意人设指令覆盖 AGENT_SOUL（灵魂/行为规范）边界。
    const trusted = BUILTIN_SKILLS.some(b => b.key === s.key) || Boolean(s._admin)
    results.push({
      key: s.key, name: s.name, desc: s.desc, icon: s.icon,
      tool: s.tool, sys: trusted ? s.sys : undefined, cap: s.cap, score, hits: hits.slice(0, 5)
    })
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * 主技能裁决 + 返回结构化规划
 *
 * 防混淆/防串场加固：对命中结果做「同 tool 互斥去重」。
 * 例：bazi 与 yixue-taishan 均绑定 tool='bazi'（共用同一排盘引擎），当问题同时命中
 * 两者关键词时，只保留分数最高的那个作为代表，其余同 tool 技能从 alternatives 剔除，
 * 避免同一口径的两套 sys/cap 同时注入造成裁决歧义与冗余。
 * @returns {{primary: object|null, alternatives: Array, all: Array}}
 */
export function planSkills(text, enabledSkills, customSkills, { top = 3 } = {}) {
  const ranked = detectSkills(text, enabledSkills, customSkills)
  // 同 tool 互斥：按分数降序，每个 tool 只保留第一个（最高分）命中项
  const seenTool = new Set()
  const deduped = ranked.filter(s => {
    if (!s.tool) return true
    if (seenTool.has(s.tool)) return false
    seenTool.add(s.tool)
    return true
  })
  return {
    primary: deduped[0] || null,
    alternatives: deduped.slice(1, top),
    all: ranked
  }
}

/**
 * 结构化执行主技能工具（复用 agentToolsR）
 * @param {object} primary 主技能对象
 * @param {object} chart 命盘
 * @returns {{structured: object|null, summary: string}}
 */
export function runSkillStructured(primary, chart) {
  if (!primary || !primary.tool) return { structured: null, summary: '' }
  const structured = runToolStructured(primary.tool, {}, chart)
  return { structured, summary: toolToSummary(structured) }
}

/**
 * 保留旧接口：返回分数最高的单个技能（向后兼容 detectSkill）
 */
export function detectSkillCompat(text, enabledSkills, customSkills) {
  const ranked = detectSkills(text, enabledSkills, customSkills)
  return ranked[0] || null
}

/**
 * 检查是否命中任何技能（供判断是否进入技能工具流程）
 */
export function hasSkill(text, enabledSkills, customSkills) {
  return detectSkills(text, enabledSkills, customSkills).length > 0
}

/** 暴露全技能清单（供 UI 统计） */
export function skillPool(customSkills) {
  return allSkills(customSkills)
}
