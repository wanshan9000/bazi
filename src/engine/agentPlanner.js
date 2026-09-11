/**
 * Agent 规划器（本地 ReAct 规划层 · 深化 agent）
 *
 * 借鉴竞品 agent（starloom 单入口自动路由 / xuanxue 多工具编排）
 * 与 ReAct 最佳实践（规划-执行-观察），补齐当前架构短板：
 *  当前 detectIntent 只返回「单个意图」，遇到复合问题（"财运和健康"、
 *  "今年感情和事业"）只能匹配其一，无法多领域组合分析。
 *
 * 本规划器：
 *  1. planIntents() —— 从复合问题拆解出「多个」意图
 *  2. buildPlan()   —— 生成有序执行计划
 *  3. executePlan() —— 逐个执行并合并为结构化回答
 *
 * 纯本地实现，不依赖 API key，离线可用。
 */
import { INTENTS } from '../data/knowledge.js'
import { generateReply, buildContext } from './chat.js'
import { routeIntents } from './agentRouter.js'

// 意图 → 小标题（回答分段的导航标签）
const INTENT_TITLE = {
  career: '事业',
  wealth: '财运',
  love: '感情',
  health: '健康',
  luck: '流年',
  study: '学业',
  name: '命名',
  date: '择日',
  fengshui: '风水',
  ziwei: '紫微',
  divine: '六爻',
  bazi: '八字',
  qimen: '奇门',
  tarot: '塔罗'
}

const COMPOSITE_INTENTS = ['career', 'wealth', 'love', 'health', 'luck', 'study']

// 强信号词（与 chat.js 一致，避免循环 import）
const STRONG_HINTS = {
  career: ['事业', '职业', '跳槽', '升职', '创业', '转行', '工作', '职场', 'offer'],
  wealth: ['财运', '发财', '赚钱', '投资', '破财', '收入', '暴富', '副业'],
  love: ['感情', '恋爱', '婚姻', '对象', '桃花', '分手', '复合', '结婚', '相亲', '伴侣', '姻缘'],
  health: ['健康', '身体', '生病', '失眠', '养生', '体检', '亚健康'],
  luck: ['运势', '流年', '今年', '明年', '本命年', '犯太岁', '吉凶'],
  study: ['学业', '考试', '考研', '升学', '考公', '面试', '成绩', '读书']
}

/**
 * 从复合问题拆解出多个意图（有序、去重）
 *
 * 融合两套路由：
 *  A. 跨领域加权路由（agentRouter，复用 TOOL_SCHEMAS）→ 覆盖工具域
 *  B. 生活领域强信号词（wealth/love/health 等）          → 覆盖人生议题
 *
 * @param {string} q 用户问题
 * @returns {string[]} 意图 key 数组（如 ['wealth','health']）
 */
export function planIntents(q) {
  if (!q) return []
  const found = []
  const seen = new Set()

  // A. 加权路由（TOOL_SCHEMAS 驱动）：工具域 → 意图
  for (const r of routeIntents(q)) {
    if (DOMAIN_TO_INTENT[r.domain] && !seen.has(DOMAIN_TO_INTENT[r.domain])) {
      const k = DOMAIN_TO_INTENT[r.domain]
      seen.add(k); found.push(k)
    }
  }

  // B. 生活领域强信号（财运/健康/感情等）
  for (const [key, words] of Object.entries(STRONG_HINTS)) {
    if (words.some(w => q.includes(w)) && !seen.has(key)) {
      seen.add(key); found.push(key)
    }
  }

  // C. 若无任何命中，回退到 INTENTS 关键词模糊匹配
  if (!found.length) {
    for (const intent of INTENTS) {
      const hits = intent.keywords.filter(kw => q.includes(kw)).length
      if (hits > 0 && COMPOSITE_INTENTS.includes(intent.key) && !seen.has(intent.key)) {
        seen.add(intent.key); found.push(intent.key)
      }
    }
  }

  // 最多返回 3 个意图
  return found.slice(0, 3)
}

// 工具域 → 规划器意图（工具域在生活议题上的收敛）
const DOMAIN_TO_INTENT = {
  bazi: 'bazi', chenggu: 'bazi', ziwei: 'ziwei', liuyao: 'divine', qimen: 'qimen',
  huangli: 'luck', tarot: 'tarot', name: 'name', fengshui: 'fengshui', hehun: 'love'
}

/**
 * 判断是否为「可规划的多领域复合问题」
 */
export function isCompositeQuery(q) {
  return planIntents(q).length >= 2
}

/**
 * 构建执行计划
 * @param {object} chart 命盘
 * @param {string} q 用户问题
 */
export function buildPlan(chart, q) {
  const intents = planIntents(q)
  if (!intents.length) return null
  const title = intents.map(k => INTENT_TITLE[k] || k).join(' + ')
  const steps = intents.map(intent => ({
    intent,
    title: INTENT_TITLE[intent] || intent,
    gen: () => generateReply(chart, `${INTENT_TITLE[intent] || intent} 怎么样`)
  }))
  return { intents, title, steps }
}

/**
 * 执行计划，合并多领域结果为结构化回答
 * @param {object} chart 命盘
 * @param {object} plan buildPlan 的返回
 * @returns {string[]} 合并后的回答分段
 */
export function executePlan(chart, plan) {
  if (!chart || !plan || !plan.steps.length) return []
  const ctx = buildContext(chart)
  const segments = []

  segments.push(`好，我为你综合分析「${plan.title}」这几个方面，结合你的命局（${ctx.dayMaster}日主 · ${ctx.dayMasterWx}）一起看：`)

  for (const step of plan.steps) {
    const parts = step.gen()
    const cleaned = (parts || [])
      .filter(t => t && t.length > 4)
      .join('\n')
    segments.push(`【${step.title}】\n${cleaned}`)
  }

  segments.push(`以上是这几个方面的综合分析。命理只是参考，具体走向还要看你的行动与选择——愿你顺势而为，心里有数，脚下有路。`)

  return segments
}
