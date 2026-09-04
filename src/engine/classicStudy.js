/**
 * 典籍研习引擎（classicStudy · 知识增强层）
 *
 * 目的：当 agent "弄不清楚"时（技能未命中 / 置信度低 / 工具无结果 / 问法生僻），
 * 主动去"学习"——从玄学经典书籍（CLASSIC_LIBRARY）与经典案例（CASE_LIBRARY）
 * 中检索相关内容，作为判断依据注入回答，让判断"有出处、可核对、有案例对照"。
 *
 * 触发条件（uncertaintyScore 综合打分）：
 *   +60  未命中任何技能，但问题明显是命理语境（要懂但没工具/技能）
 *   +40  命中技能但置信度低（分数 < 阈值，边缘命中）
 *   +35  技能工具执行失败 / 无结构化结果
 *   +20  问题包含生僻术语（格局/神煞名），技能关键词未覆盖
 *   >=70 → 进入研习模式
 *
 * 安全护栏：
 *   - 检索不到 → 诚实返回 noBasis=true，绝不编造出处（延续 SAFE 红线）；
 *   - 研习内容是"参考依据"，不改变回答基调，只增强依据与出处。
 */
import { CLASSIC_LIBRARY, classicByTopic } from '../data/classics.js'
import { CASE_LIBRARY, searchCases } from '../data/classicCases.js'

// 常见生僻命理术语（当问题含这些词但技能未命中 → 更需要查书）
const JARGON = [
  '从格', '从财', '从杀', '从儿', '稼穑', '炎上', '润下', '从革', '曲直', '专旺',
  '建禄', '羊刃', '驾杀', '伤官配印', '食神制杀', '杀印相生', '官印相生', '枭印夺食',
  '伤官见官', '天乙贵人', '禄神', '魁罡', '日坐', '孤鸾', '伏吟', '反吟', '岁运并临',
  '化气格', '六合化', '三合', '三会', '夹拱', '拱禄', '拱贵', '进神', '暗禄', '明禄',
  '帝旺', '墓库', '入墓', '空亡', '旬空', '驿马', '桃花', '劫煞', '亡神', '咸池',
  '华盖', '将星', '月德', '天德', '太极贵人', '文昌', '学士', '金舆'
]
// 命理语境词（判断"这像个玄学问题"）
const META_WORDS = ['命', '八字', '紫微', '六爻', '卦', '塔罗', '风水', '黄历', '择日', '姓名', '奇门', '运势', '命盘', '命局', '星盘', '煞', '贵人', '流年', '大运', '格局']

/**
 * 综合不确定度打分（0-100）。分数越高 → 越需要"研习查书"
 * @param {object} ctx { q, skill, plan, toolText, structured }
 */
export function uncertaintyScore(ctx) {
  const { q, skill, toolText, structured } = ctx || {}
  let score = 0
  const text = (q || '').trim()

  // 1) 未命中技能但明显是命理语境
  const metaHits = META_WORDS.filter(w => text.includes(w)).length
  if (!skill) {
    if (metaHits >= 2) score += 75
    else if (metaHits === 1) score += 35
    else if (text.length >= 4) score += 15 // 问得长但没命中 → 可能是生僻问法
  } else {
    // 2) 命中但置信度低（边缘命中）
    if (skill.score < 3) score += 40
    else if (skill.score < 5) score += 20
    // 3) 工具失败 / 无结果 → 只能靠典籍推断
    if (skill.tool && (!toolText || !structured)) score += 35
  }

  // 4) 生僻术语出现但技能关键词没覆盖 → 更依赖查书
  const jargonHits = JARGON.filter(w => text.includes(w)).length
  if (jargonHits > 0) score += 20 + jargonHits * 5

  return Math.min(100, score)
}

/** 由技能/语境推断研习主题（经典库 topic 键） */
function inferTopic(skill, text) {
  if (skill) {
    const map = { bazi: 'geju', liuyao: 'liuyao', ziwei: 'ziwei', qimen: 'qimen', huangli: 'zeri', name: 'name', fengshui: 'fengshui', tarot: 'tarot' }
    if (map[skill.tool]) return map[skill.tool]
    if (skill.tool === 'ziwei') return 'ziwei'
  }
  if (/身强|身弱|强弱/.test(text)) return 'body'
  if (/大运|运势|运程/.test(text)) return 'dayun'
  if (/流年|今年|明年|运势/.test(text)) return 'liunian'
  if (/用神|喜用/.test(text)) return 'yongshen'
  if (/调候|寒|燥/.test(text)) return 'tiaohou'
  if (/五行|金木水火土/.test(text)) return 'wuxing'
  if (/十神|食神|伤官|正官|七杀|正财|偏财|正印|偏印|比肩|劫财/.test(text)) return 'shishen'
  if (/格局|格/.test(text)) return 'geju'
  return 'geju'
}

/**
 * 综合研习：经典原文 + 案例对照 + 出处。
 * @param {object} ctx { q, skill, plan, toolText, structured }
 * @returns {{ need: boolean, score, classics: Array, cases: Array, topic, noBasis: boolean, note }}
 */
export function buildStudyContext(ctx) {
  const { q } = ctx || {}
  const text = (q || '').trim()
  const score = uncertaintyScore(ctx)
  const need = score >= 70

  // 经典检索：主题命中优先，其次全文关键词；点名典籍时跨主题补检
  const topic = inferTopic(ctx.skill, text)
  let classicPool = classicByTopic(topic)
  // 若问题点名了某部典籍（如"子平真诠"），把该书的全部条目并入候选池，
  // 命中该书原文比"方法论总纲"更贴题（加权分使其优先）。
  if (classicPool.length) {
    // 典籍名去除书名号后比对，兼容用户不带《》的说法
    const strip = s => String(s || '').replace(/[《》\s]/g, '')
    const named = CLASSIC_LIBRARY.filter(c => c.book && text.includes(strip(c.book)))
    if (named.length) {
      const seen = new Set(classicPool.map(c => c.id))
      for (const c of named) if (!seen.has(c.id)) classicPool.push(c)
    }
  }
  const classics = []
  if (classicPool.length) {
    // 按"原文/释义是否含问题中的词"精选 1-2 条
    const scored = classicPool.map(c => {
      const hay = `${c.text} ${c.meaning}`
      let s = 0
      const tokens = text.split(/[？?。，,.！!、\s]/).filter(t => t.length >= 2)
      for (const t of tokens) if (hay.includes(t)) s += 1
      // 明确点名典籍/篇章 → 该书条目加权，避免被方法论总纲覆盖
      const book = String(c.book || '').replace(/[《》\s]/g, '')
      const chapter = c.chapter || ''
      if (book && text.includes(book)) s += 3
      if (chapter && text.includes(chapter)) s += 2
      return { ...c, score: s }
    }).sort((a, b) => b.score - a.score)
    if (scored[0].score > 0) {
      classics.push(...scored.slice(0, 2))
    } else {
      // 无具体原文命中 → 优先注入"方法论总纲"（method-*，次第/红线），
      // 保证 agent 按子平经典次第作答；其次兜底首条原文。
      const methods = classicPool.filter(c => String(c.id).startsWith('method-'))
      classics.push(...(methods.length ? methods.slice(0, 2) : scored.slice(0, 1)))
    }
  }

  // 案例检索
  const sysMap = { bazi: 'bazi', liuyao: 'liuyao', ziwei: 'ziwei', qimen: 'qimen', huangli: 'huangli', name: 'name', fengshui: 'fengshui', tarot: 'tarot' }
  const sys = ctx.skill && sysMap[ctx.skill.tool] ? sysMap[ctx.skill.tool] : null
  const cases = searchCases(text, sys).slice(0, 2)

  const noBasis = classics.length === 0 && cases.length === 0

  return {
    need, score, topic,
    classics, cases,
    noBasis,
    note: need
      ? (noBasis
        ? '此问在当前典籍与案例库中暂无直接对应条文，以下依据命理通则作答，仅供参考。'
        : `此问依据经典与案例研习后作答，出处见下，可自行核对。`)
      : null
  }
}

/** 渲染"典籍研习"可注入 system 的文本块（LLM 模式用） */
export function buildStudySystem(study) {
  if (!study || !study.need) return ''
  const lines = []
  lines.push('【典籍研习·参考依据】以下是检索到的经典原文与案例，请据此佐证你的判断（引用时标注出处，勿超出其含义）：')
  for (const c of study.classics) {
    lines.push(`· ${c.book}·${c.chapter || c.source || ''}：「${c.text}」释义：${c.meaning}`)
  }
  for (const c of study.cases) {
    lines.push(`· 案例（${c.book}·${c.source}）：${c.title}——情境：${c.situation} 断语：${c.judgment} 依据：「${c.basis}」`)
  }
  if (!study.classics.length && !study.cases.length) {
    lines.push('· 当前典籍与案例库暂无直接对应，请诚实说明"依据命理通则作答"，不要编造出处。')
  }
  return lines.join('\n')
}

/** 渲染本地模式可追加的研习段落（数组分段） */
export function buildStudySection(study) {
  if (!study || !study.need) return []
  const lines = []
  if (study.noBasis) {
    return ['📖 典籍研习：此问暂未检索到直接对应的典籍条文或案例，以上为命理通则分析，仅供参考。']
  }
  lines.push('📖 典籍研习 · 有据可查：')
  for (const c of study.classics) {
    lines.push(`《${c.book}·${c.chapter || ''}》：「${c.text}」——${c.meaning}`)
  }
  for (const c of study.cases) {
    lines.push(`📚 案例对照（${c.book}·${c.source}）：${c.title}。${c.judgment}（依据：「${c.basis}」）`)
  }
  lines.push('以上出处均可自行核对，仅供参考。')
  return lines
}

export { CLASSIC_LIBRARY, CASE_LIBRARY }
