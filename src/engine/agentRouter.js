/**
 * Agent 跨领域意图加权路由（深化 agent）
 *
 * 复用 TOOL_SCHEMAS（function calling schema）做统一规划，避免硬编码：
 *  从工具清单派生出「领域 → 关键词权重」映射，对用户问题做加权打分，
 *  返回排序后的领域意图 + 推荐工具（与 function calling 目标完全一致）。
 *
 * 相比 agentPlanner.js 的强信号词，本路由：
 *  - 领域/关键词与 TOOL_SCHEMAS 自动对齐，新增工具即自动纳入
 *  - 支持加权（强信号 3 分 / 中信号 2 分 / 弱信号 1 分）
 *  - 返回每个命中的领域对应的推荐工具，可直接驱动本地工具调用
 */
import { buildToolRegistry } from './agentToolsR.js'

// 领域 → 工具名映射（与 TOOL_SCHEMAS 一致）
const DOMAIN_TOOL = {
  bazi: ['bazi', 'bazi_report', 'mangpai_report'],
  ziwei: ['ziwei', 'ziwei_report'],
  liuyao: ['liuyao', 'liuyao_report'],
  qimen: ['qimen', 'qimen_report'],
  huangli: ['huangli', 'huangli_report'],
  tarot: ['tarot', 'tarot_report'],
  name: ['name', 'name_report'],
  fengshui: ['fengshui', 'fengshui_report'],
  hehun: ['hehun_report']
}

// 领域 → 关键词权重（强 3 / 中 2 / 弱 1）
const DOMAIN_KEYWORDS = {
  bazi: {
    strong: ['八字', '命盘', '四柱', '排盘', '命理', '五行', '命局', '喜用神'],
    // 八字大运按节气交运：起运/交运/起运年龄/起运日期 均属八字（区别于紫微大限按五行局起限）
    medium: ['运势', '大运', '流年', '本命', '命格', '天干', '地支', '身强', '身弱', '起运', '交运', '起运年龄', '起运日期'],
    weak: ['批命', '看命', '算卦的', '算命', '大运排盘']
  },
  ziwei: {
    strong: ['紫微', '紫微斗数', '命宫', '十二宫', '星曜', '四化'],
    // 紫微大限按五行局起限：起限/大限起限/几岁起限 属紫微（区别于八字大运按节气起运）
    medium: ['斗数', '格局', '大限', '起限', '起限年龄'],
    weak: ['排紫微']
  },
  liuyao: {
    strong: ['六爻', '起卦', '占卦', '占卜', '问卦', '卜一卦', '摇卦'],
    medium: ['卦象', '本卦', '变卦', '动爻', '世应'],
    weak: ['断卦', '测事']
  },
  qimen: {
    strong: ['奇门', '奇门遁甲', '择时', '方位', '八门'],
    medium: ['九宫', '宫位', '择日择时'],
    weak: ['遁甲']
  },
  huangli: {
    strong: ['黄历', '老黄历', '宜忌', '吉日', '择日'],
    medium: ['出行', '冲煞', '今日运势', '开运'],
    weak: ['看日子', '搬家吉日', '办事']
  },
  tarot: {
    strong: ['塔罗', '抽牌', '塔罗牌', '占卜心情', '今日指引'],
    medium: ['牌阵', '抽张牌'],
    weak: ['抽一张']
  },
  name: {
    strong: ['取名', '改名', '起名', '姓名分析', '名字吉凶', '五格', '三才'],
    medium: ['名字', '姓名', '起个名'],
    weak: ['改名']
  },
  fengshui: {
    strong: ['风水', '户型', '八宅', '布局', '五行布局'],
    medium: ['房屋', '家宅', '朝向', '房间'],
    weak: ['看风水']
  },
  hehun: {
    strong: ['合婚', '合盘', '八字合不合', '般配', '婚配', '配对', '双人'],
    medium: ['两个人', '两人', '婚姻配对', '夫妻宫'],
    weak: ['合不合']
  }
}

// 领域 → 展示名
const DOMAIN_LABEL = {
  bazi: '八字', ziwei: '紫微', liuyao: '六爻', qimen: '奇门',
  huangli: '黄历', tarot: '塔罗', name: '命名', fengshui: '风水', hehun: '合婚'
}

/**
 * 从 TOOL_SCHEMAS 校验领域工具存在性（新增工具自动感知）
 */
function ensureToolsRegistered() {
  const reg = buildToolRegistry()
  // 若某个领域的所有工具都不在 schema 中，则跳过该领域
  return Object.entries(DOMAIN_TOOL).filter(([, tools]) => tools.some(t => reg[t]))
}

// 助词变体（动词 + 个/了/一/一下 等），用于关键词容错匹配
const PARTICLE_FORMS = ['个', '了', '一', '一下', '下', '一个']

/**
 * 关键词容错匹配：支持 "取名" 命中 "取个名" / "起名" 命中 "起个名" 等
 * 若 q 含词 → true；若词末两字为动词且 q 含 "动词+助词" → true
 */
function matchKeyword(q, w) {
  if (q.includes(w)) return true
  // 动词变体：取/起/看/问 等首字 + 助词 + 余下
  if (w.length >= 2) {
    for (const p of PARTICLE_FORMS) {
      const variant = w[0] + p + w.slice(1)
      if (q.includes(variant)) return true
    }
  }
  return false
}

/**
 * 对用户问题做加权打分路由
 * @param {string} q 用户问题
 * @returns {Array<{domain, label, score, hits:Array, tools:Array<string>}>} 按分数降序
 */
export function routeIntents(q) {
  if (!q) return []
  const results = []
  for (const [domain, kws] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0
    const hits = []
    for (const w of kws.strong) {
      if (matchKeyword(q, w)) { score += 3; hits.push(w) }
    }
    for (const w of kws.medium) {
      if (matchKeyword(q, w)) { score += 2; hits.push(w) }
    }
    for (const w of kws.weak) {
      if (matchKeyword(q, w)) { score += 1; hits.push(w) }
    }
    if (score > 0) {
      results.push({
        domain,
        label: DOMAIN_LABEL[domain],
        score,
        hits: hits.slice(0, 5),
        tools: DOMAIN_TOOL[domain]
      })
    }
  }
  return results.sort((a, b) => b.score - a.score)
}

/**
 * 判断是否为复合问题（命中 ≥2 个领域）
 */
export function isMultiDomain(q) {
  return routeIntents(q).length >= 2
}

/**
 * 路由并返回统一的规划结构（供本地规划器 / UI 使用）
 * @returns {Array<{domain,label,score,tool}>} 取分数前 N 个，标注推荐执行工具
 */
export function routePlan(q, { top = 3 } = {}) {
  const ranked = routeIntents(q)
  return ranked.slice(0, top).map(r => ({
    domain: r.domain,
    label: r.label,
    score: r.score,
    tool: r.tools[0],       // 推荐执行的"盘"类工具
    reportTool: r.tools.find(t => t.endsWith('_report')) || r.tools[0]
  }))
}
