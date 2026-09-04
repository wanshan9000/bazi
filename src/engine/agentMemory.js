/**
 * Agent 动态事实记忆（上下文记忆 · 补充层）
 *
 * 已有记忆：
 *  - 命盘记忆（chart-memory）     ：记住排盘结果，跨会话复用
 *  - 静态用户画像（user-profile） ：称呼/职业/婚恋/关注点（自我介绍类）
 *
 * 本模块补齐【动态事实记忆】：
 *  用户在一次次的提问中会提到"我下个月结婚""我准备跳槽到互联网""家里刚生了二胎"
 *  这类一次性计划/事件/偏好。它们不是身份属性，但会影响后续所有回答。
 *  本模块用本地规则持续提取这类动态事实，去重持久化，跨会话生效，
 *  并在 system prompt 中复述，让 AI 真正"记得"用户提到的人生事件。
 *
 * 设计：规则轻量、纯本地、无 LLM 依赖；与静态画像互补不冲突。
 */
import { localKey } from './userScope.js'

const FACTS_BASE = 'genki-agent-facts' // 按用户隔离：base::<userId>
const factsKey = () => localKey(FACTS_BASE)
const FACTS_MAX = 60           // 最多记住 60 条动态事实
const FACTS_MAX_AGE = 180 * 24 * 3600 * 1000 // 180 天

// 时间词（用于拼接"时间+动作"）
const TIME_WORDS = ['下个月', '下星期', '下周', '下礼拜', '下年', '明年', '后年', '今年', '这月', '这个月', '近期', '最近', '下个月底', '上半年', '下半年', '年底', '年末', '年初', '明年初', '今年底']
// 事件动词（当规则命中，取"时间词+动词+目标"完整短语）
const EVENT_VERBS = ['结婚', '订婚', '领证', '办婚礼', '怀孕', '生二胎', '生三胎', '生宝宝', '搬家', '换工作', '跳槽', '辞职', '入职', '退休', '离婚', '考研', '考公', '考试', '买房', '购房', '创业', '开店', '做生意', '做生意开店']

// 事实类型 → 提取规则（捕获整个有意义短语，含时间/目标）
const FACT_RULES = [
  // 计划：下个月/明年 + 要/准备 + 动作(+目标)
  { type: 'plan', label: '计划', re: /((?:下|这|明|后)(?:个月|周|星期|年|天|礼拜)|今年|明年|近期|最近)(?:我)?(?:要|准备|打算|想)?(结婚|订婚|领证|办婚礼|搬家|换工作|跳槽|辞职|入职|退休|离婚|考研|考公|考试|买房|购房|创业|开店)/ },
  { type: 'plan', label: '计划', re: /我(?:打算|准备|计划|想|要)((?:去|换|做|买|找|参加|跳槽到|去考|开一家|做点)[^，。,.、！？\s]{2,14})/ },
  // 事件：我快要/马上 + 结婚 等
  { type: 'event', label: '事件', re: /我(?:快要|马上|就要|快)?(结婚|订婚|领证|办婚礼)/ },
  { type: 'event', label: '事件', re: /(?:刚|刚刚|正在)?(?:怀孕|生了?(?:个)?(?:宝宝|二胎|三胎)|待产|搬家|换工作|跳槽|辞职|入职|退休|离婚)/ },
  { type: 'event', label: '事件', re: /(?:家里|我)(?:刚)?(?:生了?(?:个)?(?:宝宝|二胎|三胎|小孩))/ },
  // 职业意向
  { type: 'job', label: '职业', re: /(?:最近|现在|目前)?(?:转行|转型|想当|想做)([^，。,.、！？\s]{2,8})(?:职业|工作|方向)?/ },
  // 偏好
  { type: 'pref', label: '偏好', re: /我(?:比较|更)?(?:喜欢|偏爱|倾向于)([^，。,.、！？\s]{2,10})/ },
  { type: 'pref', label: '偏好', re: /不(?:喜欢|太能接受|考虑)([^，。,.、！？\s]{2,8})/ },
  // 关系
  { type: 'rel', label: '关系', re: /我和(?:对象|男朋友|女朋友|老公|老婆|未婚夫|未婚妻)[^，。,.、！？\s]{0,4}?(?:在|准备|打算|要)?(?:一起|结婚|异地|分手|冷战|买房)/ },
]

// 明显的占位/低信息词，排除提取噪音
const NOISE = /^(呢|吧|吗|啊|我|你|他|她|这个|那个|这样|那样|的话|之后|以后|现在|最近|时候|情况|问题|一下|一点|有|什么|怎么|如何|多少|哪里|几|办|改|看|去|想|做|买|找|的|了|过)$/

function loadFacts() {
  try {
    const raw = localStorage.getItem(factsKey())
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const now = Date.now()
    return arr.filter(f => now - (f.at || 0) <= FACTS_MAX_AGE)
  } catch { return [] }
}

function saveFacts(facts) {
  try {
    localStorage.setItem(factsKey(), JSON.stringify(facts.slice(-FACTS_MAX)))
  } catch { /* ignore */ }
}

// 清理提取出的 value：去噪词、去句末标点、去冗余助词
function cleanValue(v) {
  if (!v) return ''
  let s = v.replace(/[，。,.、！？\s]$/, '').trim()
  s = s.replace(/^(我|家里|你|他们|我们)/, '').trim()
  if (NOISE.test(s)) return ''
  return s
}

/**
 * 从一条用户输入提取动态事实
 * @param {string} q 用户输入
 * @returns {Array<{type,label,value,raw}>}
 */
export function extractFacts(q) {
  if (!q) return []
  const out = []
  const seen = new Set()
  for (const rule of FACT_RULES) {
    const m = q.match(rule.re)
    if (!m) continue
    let value = (m[1] && m[2]) ? m[1] + m[2] : (m[1] || m[0])
    value = cleanValue(value)
    if (!value || value.length < 2 || seen.has(value)) continue
    // 时间词 + 动作 但缺目标时，尽量补全到句末
    if (m[2]) {
      const after = q.slice(q.indexOf(m[0]) + m[0].length).match(/^[^，。,.、！？]{0,10}/)?.[0] || ''
      if (after && /(?:互联网|公司|工作|单位|房产|楼盘|项目|行业|方向|深造)/.test(after) && !seen.has(value + after)) {
        value = cleanValue(value + after)
      }
    }
    seen.add(value)
    out.push({ type: rule.type, label: rule.label, value, raw: q })
  }
  return dedupFacts(out)
}

// 同类动作去重：若已存在含同一动词的更完整 value，则跳过仅动词的重复提取
const DEDUP_VERBS = ['跳槽', '搬家', '换工作', '辞职', '结婚', '买房', '考研', '考公', '生二胎', '生宝宝']
function dedupFacts(out) {
  const res = []
  for (const f of out) {
    const verb = DEDUP_VERBS.find(v => f.value.includes(v))
    if (verb && res.some(x => x.value.includes(verb) && x.value.length >= f.value.length)) continue
    res.push(f)
  }
  return res
}

/**
 * 增量吸收一条输入：去重并入持久化存储
 * @returns {{added:Array, facts:Array}}
 */
export function addFacts(q) {
  const newFacts = extractFacts(q)
  if (!newFacts.length) return { added: [], facts: loadFacts() }
  let facts = loadFacts()
  let added = []
  for (const f of newFacts) {
    const dup = facts.some(x => x.value === f.value)
    if (!dup) { facts.push({ ...f, at: Date.now() }); added.push(f) }
  }
  if (added.length) saveFacts(facts)
  return { added, facts }
}

/**
 * 渲染为 system prompt 的一句话（跨会话复述用户记住的动态事实）
 */
export function memoryLine() {
  const facts = loadFacts()
  if (!facts.length) return ''
  const recent = facts.slice(-8) // 只复述最近 8 条，避免过长
  const items = recent.map(f => {
    if (f.type === 'plan') return `计划${f.value}`
    if (f.type === 'event') return `近期${f.value}`
    if (f.type === 'job') return `职业意向${f.value}`
    if (f.type === 'pref') return `偏好${f.value}`
    if (f.type === 'rel') return `关系${f.value}`
    return f.value
  })
  return `记得你${items.join('、')}。`
}

/**
 * 供 UI 展示的记忆条目（调试/设置页可见）
 */
export function getFacts() {
  return loadFacts()
}

/** 清空动态事实（供设置页"清除记忆"） */
export function clearFacts() {
  try { localStorage.removeItem(factsKey()) } catch { /* ignore */ }
}
