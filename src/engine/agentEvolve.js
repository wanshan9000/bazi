/**
 * Agent 技能自我进化引擎（agentEvolve）
 *
 * 目标：让 AI 根据「真实使用反馈」自主学习、优化技能，而不是靠用户手写自定义技能。
 * 这是"技能生态"的进化闭环：
 *
 *   skillEvolveLog（行为日志）  →  score 打分（判定"是否可信为正确改进"）
 *   →  sandbox（沙盒灰度，与旧版并行比较命中率） →  promote（达标晋升）
 *   →  rollback（命中率回退时自动回滚到上一版）
 *
 * 核心安全护栏（非常重要，绝不可突破）：
 *   进化只能改三类字段：keywords（增补触发词）、desc（能力描述）、cap（能力说明）。
 *   进化绝不触碰：sys（人设指令）、tool（工具绑定）、以及 AGENT_SOUL（灵魂/行为规范/红线）。
 *   即便由 LLM 驱动进化，输出也必须是受限 JSON，并经本模块逐字段校验后才能入库。
 *
 * 存储：纯本地 localStorage，仅 agent 写、用户不可直接编辑（UI 不再暴露自定义技能入口）。
 */

import { BUILTIN_SKILLS } from '../data/skills.js'

const EVOLVE_KEY = 'genki-evolve-store'   // 进化库（agent 可写，用户只读）
const LOG_KEY = 'genki-evolve-log'        // 行为日志（命中/失败/反馈）
const LOG_MAX = 500                       // 最多保留 500 条日志
const GRAY_N = 6                          // 沙盒灰度需要的样本数
const PROMOTE_RATE = 0.5                  // 晋升所需相对命中率（新 ≥ 旧 × 1 + 该提升? 见 promote）

// 允许进化修改的字段白名单（护栏核心）
const EVOLVE_FIELDS = ['keywords', 'desc', 'cap']

/* ---------- 基础读写 ---------- */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
}

/* ================= 1. 行为日志 ================= */

/** 记录一次技能行为。kind: 'hit'命中 | 'fail'工具失败 | 'corr'用户纠正 | 'fb_up'有用 | 'fb_down'不对 */
export function logSkillEvent({ key, kind, q, meta }) {
  const logs = read(LOG_KEY, [])
  logs.push({ key, kind, q: (q || '').slice(0, 80), meta, at: Date.now() })
  write(LOG_KEY, logs.slice(-LOG_MAX))
  // 命中即做一次灰度采样：让进化版本无需用户反馈也能积累样本、自动晋升/淘汰。
  // 命中通常代表该关键词有效（记 ok），失败/差评记 not ok（见 feedbackSample / graySample）。
  if (kind === 'hit') graySample(key, true)
  else if (kind === 'fail') graySample(key, false)
}

/** 读取日志（供调试/进化分析） */
export function getSkillLogs() { return read(LOG_KEY, []) }

/** 清空日志（供设置页"清除学习数据"） */
export function clearSkillLogs() { try { localStorage.removeItem(LOG_KEY) } catch { /* ignore */ } }

/** 按技能聚合的统计：{key, hits, fails, corr, fb_up, fb_down, score} */
export function skillStats(logs) {
  const stats = {}
  for (const l of (logs || read(LOG_KEY, []))) {
    const s = stats[l.key] || (stats[l.key] = { key: l.key, hits: 0, fails: 0, corr: 0, fb_up: 0, fb_down: 0 })
    if (l.kind === 'hit') s.hits++
    else if (l.kind === 'fail') s.fails++
    else if (l.kind === 'corr') s.corr++
    else if (l.kind === 'fb_up') s.fb_up++
    else if (l.kind === 'fb_down') s.fb_down++
  }
  // 综合健康分：正常命中加分，失败/差评/纠正减分
  for (const k in stats) {
    const s = stats[k]
    s.score = s.hits + s.fb_up - s.fails * 2 - s.fb_down * 2 - s.corr
  }
  return stats
}

/* ================= 2. 进化库 ================= */

/** 读取进化库。结构: { key: { version, active: {...}, prev: {...}, pending: {...}, state: 'active'|'gray' } } */
export function loadEvolveStore() { return read(EVOLVE_KEY, {}) }
function saveEvolveStore(store) { write(EVOLVE_KEY, store) }

/* ================= 3. 打分判定（是否可信为正确改进） ================= */

/**
 * 判定一个"候选进化"是否达到可信门槛。
 * 核心：不能因为"发生过一次"就进化，必须"多次、独立、一致"才采信。
 * @param {object} evo 候选 {key, type:'kw_add'|'desc'|'cap'|'new', value}
 * @param {object} stats 该技能聚合统计
 * @param {object} logs 相关原始日志
 * @returns {{ok:boolean, reason:string, confidence:number}}
 */
export function judgeCandidate(evo, stats, logs) {
  const s = stats || {}
  // 无信号 → 不可进化
  const signals = (s.corr || 0) + (s.fb_down || 0) + (s.fails || 0) + (s.fb_up || 0) + (s.hits || 0)
  if (signals < 3) return { ok: false, reason: '样本量不足（<3）', confidence: 0 }

  let confidence = 0
  let reasons = []

  switch (evo.type) {
    case 'kw_add': { // 新增关键词：用户反复问、但技能当前关键词未覆盖 → 补词
      // 依赖：有≥2条 用户"纠正/追问"或"多次 hit 但命中的不是该关键词" 的独立样本
      const corrLogs = (logs || []).filter(l => l.kind === 'corr' && l.key === evo.key)
      const distinct = new Set(corrLogs.map(l => l.q)).size
      // 置信度：独立纠正样本数归一化
      confidence = Math.min(1, distinct / 3)
      if (distinct >= 2 && evo.value) {
        reasons.push(`检测到 ${distinct} 种不同问法未被该技能关键词覆盖`)
      } else {
        return { ok: false, reason: `纠正样本不足（独立样本 ${distinct}/2）`, confidence }
      }
      break
    }
    case 'desc':
    case 'cap': { // 优化描述/能力：技能多次命中但差评/纠正比例过高，说明描述或能力表达偏差
      const total = (s.hits || 0) + (s.fb_up || 0)
      const bad = (s.fb_down || 0) + (s.corr || 0)
      const badRate = total + bad > 0 ? bad / (total + bad) : 0
      confidence = Math.min(1, badRate)
      if (total + bad >= 4 && badRate >= 0.4 && evo.value) {
        reasons.push(`差评/纠正率 ${(badRate * 100).toFixed(0)}%，描述或能力表达需优化`)
      } else {
        return { ok: false, reason: `差评/纠正率 ${(badRate * 100).toFixed(0)}% 未达 40% 门槛`, confidence }
      }
      break
    }
    case 'new': { // 新增技能：高频"未命中任何技能"的同类问题反复出现
      // 需要调用方统计"未命中"问题，见 trySuggestNewSkill
      const missLogs = (logs || []).filter(l => l.kind === 'corr' && !l.key)
      const distinct = new Set(missLogs.map(l => l.q)).size
      confidence = Math.min(1, distinct / 4)
      if (distinct >= 3 && evo.value && evo.value.name && evo.value.keywords) {
        reasons.push(`检测到 ${distinct} 种未被技能覆盖的同类高频问题`)
      } else {
        return { ok: false, reason: `未命中样本不足（独立 ${distinct}/3）`, confidence }
      }
      break
    }
    default:
      return { ok: false, reason: '未知进化类型', confidence: 0 }
  }
  return { ok: true, reason: reasons.join('；'), confidence }
}

/* ================= 4. 沙盒灰度 + 晋升 + 回滚 ================= */

/**
 * 进入沙盒：把候选进化挂到 pending，进入灰度观察，不立即覆盖 active。
 */
export function stageEvolution(evo) {
  const store = loadEvolveStore()
  const item = store[evo.key] || { version: 0, active: null, prev: null, pending: null, state: 'none', gray: { hits: 0, fails: 0 } }
  item.pending = {
    ...evo,
    value: evo.value,
    stagedAt: Date.now(),
    gray: { total: 0, ok: 0 } // 沙盒观察计数
  }
  item.state = item.active ? 'gray' : 'pending'
  store[evo.key] = item
  saveEvolveStore(store)
  return item
}

/**
 * 沙盒一次采样：进化版本被使用时调用，记录命中/失败。
 * 达到 GRAY_N 次后判定是否晋升。
 * @returns {'promote'|'reject'|'observe'}
 */
export function graySample(key, ok) {
  const store = loadEvolveStore()
  const item = store[key]
  if (!item || !item.pending) return 'observe'
  item.pending.gray.total++
  if (ok) item.pending.gray.ok++
  const g = item.pending.gray
  saveEvolveStore(store)
  if (g.total < GRAY_N) return 'observe'
  // 判定：沙盒内 ok 比例 >= PROMOTE_RATE 才晋升
  const rate = g.ok / g.total
  if (rate >= PROMOTE_RATE) {
    // 晋升：当前 active 存入 prev，pending 晋升为 active
    item.prev = item.active ? { ...item.active, version: item.version } : null
    item.active = { ...item.pending, version: ++item.version }
    delete item.active.gray
    item.pending = null
    item.state = 'active'
    saveEvolveStore(store)
    return 'promote'
  } else {
    // 不达标：丢弃 pending，保留旧版
    item.pending = null
    item.state = item.active ? 'active' : 'none'
    saveEvolveStore(store)
    return 'reject'
  }
}

/**
 * 命中率回退检测：若进化后的 active 命中率显著低于上一版，自动回滚。
 * 由命中采样触发。@returns {boolean} 是否发生回滚
 */
export function checkRollback(key, recentOk, recentTotal) {
  const store = loadEvolveStore()
  const item = store[key]
  if (!item || !item.prev) return false
  if (recentTotal < GRAY_N) return false
  const curRate = recentOk / recentTotal
  const prevRate = (item.prev.grayOk != null ? item.prev.grayOk / Math.max(1, item.prev.grayTotal) : 0.6)
  if (curRate < prevRate - 0.3) { // 明显低于旧版 → 回滚
    const oldActive = item.prev
    item.prev = item.active ? { ...item.active, version: item.version } : null
    item.active = oldActive
    saveEvolveStore(store)
    return true
  }
  return false
}

/* ================= 4.5 自动进化（规则驱动，无 LLM 依赖） ================= */

// 记录每次自动进化触发的时间戳，做节流
const AUTO_KEY = 'genki-evolve-auto-last'
const AUTO_MIN_LOGS = 6      // 至少积累 6 条日志才跑一次
const AUTO_GAP_MS = 5 * 60 * 1000 // 两次自动进化至少间隔 5 分钟

/** 高频纠正词 → 关键词增补候选 */
function collectKeywordCandidates(logs, stats) {
  const out = []
  // 对每个技能：收集"纠正"日志里出现的独立问句
  const byKey = {}
  for (const l of (logs || [])) {
    if (l.kind === 'corr' && l.key && l.q) {
      (byKey[l.key] = byKey[l.key] || new Set()).add(l.q)
    }
  }
  for (const key in byKey) {
    const qs = [...byKey[key]].slice(0, 3)
    const st = stats[key]
    if (qs.length >= 2) {
      out.push({ key, type: 'kw_add', value: { keywords: qs }, reason: `${qs.length} 种纠正问法` })
    }
  }
  return out
}

/** 差评/纠正率高的技能 → desc/cap 优化候选（仅标记，具体新文案可由 LLM 后续生成，此处用规则占位） */
function collectDescCandidates(logs, stats) {
  const out = []
  for (const key in stats) {
    const s = stats[key]
    const total = (s.hits || 0) + (s.fb_up || 0)
    const bad = (s.fb_down || 0) + (s.corr || 0)
    if (total + bad >= 4 && bad / (total + bad) >= 0.4) {
      out.push({ key, type: 'desc', value: { desc: null }, reason: `差评/纠正率 ${(bad * 100 / (total + bad)).toFixed(0)}%` })
    }
  }
  return out
}

/**
 * 自动进化主入口：扫描日志 → 生成候选 → 判定门槛 → 进入沙盒灰度。
 * 由对话流程异步、节流调用（见 AgentChat.send 末尾）。
 * @returns {Array} 本次进入沙盒的候选清单
 */
export function runAutoEvolution(logs, force = false) {
  // 节流：避免每次对话都跑（手动触发可传 force=true 绕过）
  const now = Date.now()
  if (!force) {
    try {
      const last = Number(localStorage.getItem(AUTO_KEY) || 0)
      if (now - last < AUTO_GAP_MS) return []
    } catch { /* ignore */ }
  }
  logs = logs || read(LOG_KEY, [])
  if (logs.length < AUTO_MIN_LOGS && !force) return []
  try { localStorage.setItem(AUTO_KEY, String(now)) } catch { /* ignore */ }

  const stats = skillStats(logs)
  const candidates = [...collectKeywordCandidates(logs, stats), ...collectDescCandidates(logs, stats)]

  const staged = []
  for (const c of candidates) {
    const j = judgeCandidate(c, stats[c.key], logs)
    if (j.ok) {
      const item = stageEvolution(c)
      staged.push({ key: c.key, type: c.type, reason: j.reason, confidence: j.confidence, state: item.state })
    }
  }
  return staged
}

/**
 * 用户在 AI 回答上的反馈（👍/👎）也应能触发一次轻量进化采样。
 * 若该技能已有正在灰度（pending）的进化版本，采样一次。
 */
export function feedbackSample(key, kind) {
  return graySample(key, kind === 'up')
}

/* ================= 5. 供技能路由使用 ================= */

/**
 * 把进化库合并进技能池（进化 keyword 增补 / desc / cap 覆盖 active 版本），
 * 返回"进化后的技能"，供 detectSkills / planSkills 使用。
 * @param {string} key 技能 key
 * @param {object} base 内置/原始技能
 */
export function evolvedSkill(key, base) {
  const store = loadEvolveStore()
  const item = store[key]
  if (!item || !item.active) return base
  const act = item.active
  const out = { ...base }
  // 仅允许白名单字段被进化覆盖
  if (EVOLVE_FIELDS.includes('keywords') && act.value && act.value.keywords) {
    out.keywords = [...new Set([...(base.keywords || []), ...act.value.keywords])]
  }
  if (act.value && typeof act.value.desc === 'string' && act.value.desc) out.desc = act.value.desc
  if (act.value && typeof act.value.cap === 'string' && act.value.cap) out.cap = act.value.cap
  out.__evolved = true
  return out
}

/**
 * 获取"进化后的全部技能列表"（用于替代 allSkills(customSkills)）。
 * @param {object[]} baseSkills 基础技能（BUILTIN_SKILLS 或当前池）
 */
export function allEvolvedSkills(baseSkills = BUILTIN_SKILLS) {
  return baseSkills.map(s => evolvedSkill(s.key, s))
}

/**
 * 把 `loadCustomSkills` 收口到进化库（兼容旧签名），
 * 让现有 detectSkills / planSkills / skillByKey 无感切换：
 * 普通用户手写自定义技能已关闭，此处返回的是 agent 自我进化出的技能（仅白名单字段）。
 */
export function loadEvolvedSkills() {
  return allEvolvedSkills()
}

/** 供 UI 查看进化状态 */
export function getEvolveStatus() {
  const store = loadEvolveStore()
  const logs = read(LOG_KEY, [])
  return {
    store,
    stats: skillStats(logs),
    logCount: logs.length
  }
}

/** 清空进化库（供设置页"重置学习"） */
export function clearEvolveStore() { try { localStorage.removeItem(EVOLVE_KEY) } catch { /* ignore */ } }
