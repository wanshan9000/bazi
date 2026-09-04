/**
 * Agent 反思层（ReAct 反思 / Self-Correction · 深化 agent）
 *
 * 借鉴竞品 agent 的「AI 正向引导」定位与 ReAct 最佳实践的
 * 反思（Reflection）环节：在回答生成后做四重自检，让输出
 * 更诚实、正向、安全：
 *
 *  1. reflectRedLine   —— 红线自检（对接 safeGuard，命中越界措辞即标注）
 *  2. reflectCompleteness—— 完整性自检（关键信息缺失即提示补全命盘）
 *  3. reflectTone      —— 正向引导校验（检测恐吓/负面主导，补充积极落点）
 *  4. reflectConfidence—— 不确定性校准（检测"必定/百分之百"过度自信）
 *
 * 返回带反思标记的结果，供前端渲染警示卡 / 提示条。
 */
import { scanRedLine } from './safeGuard.js'

// 恐吓型 / 负面主导措辞
const FEAR_PATTERNS = [
  /大凶(难逃|不可避免|之相|之命)?/, /(此生|这辈子|注定)(倒霉|不顺|失败|孤寡)/,
  /(克|克死|妨)(夫|妻|父母|子女|家人)/, /(永无|难以)(翻身|出头|起色)/,
  /(大灾|大难|横祸)(将|即将|马上)(至|临|来)/, /(非死即伤|灾祸不断|霉运缠身)/,
  /(诸事不宜|万事皆凶|流年大凶)/, /(命中)(带煞|犯忌|不利|大凶)/
]

// 过度自信 / 绝对化断言
const OVERCONFIDENT_PATTERNS = [
  /百分之百/, /千真万确/, /必定(会|要|能)?/, /必然(会)?/, /绝对(会|能|可以)?/,
  /铁定/, /板上钉钉/, /稳了/, /妥妥的(会|能)?/, /一定(会|能|要)?/
]

/**
 * 反思：红线自检
 * @param {string|string[]} text 回答文本
 */
export function reflectRedLine(text) {
  const t = Array.isArray(text) ? text.join('\n') : (text || '')
  const hits = scanRedLine(t)
  return {
    safe: hits.length === 0,
    hits,
    summary: hits.length
      ? `检测到 ${hits.length} 类越界措辞（${hits.map(h => h.label).join('、')}），已做温和化处理，请以理性看待。`
      : null
  }
}

/**
 * 反思：完整性自检
 * @param {object} chart 命盘（可能为空）
 * @param {string|string[]} text 回答
 */
export function reflectCompleteness(chart, text) {
  const t = Array.isArray(text) ? text.join('\n') : (text || '')
  const lacks = []
  if (!chart) lacks.push('尚未排定命盘')
  else {
    if (!t.includes('日主') && !t.includes('日主')) lacks.push('未结合日主分析')
    if (!t.includes('用神') && !chart.dayMasterWx) lacks.push('未标注喜用神')
  }
  return {
    complete: lacks.length === 0,
    lacks,
    summary: lacks.length ? `为更准确，建议补充：${lacks.join('、')}。` : null
  }
}

/**
 * 反思：正向引导校验（检测恐吓型措辞，补充积极落点）
 */
export function reflectTone(text) {
  const t = Array.isArray(text) ? text.join('\n') : (text || '')
  const hits = FEAR_PATTERNS.filter(p => p.test(t))
  return {
    positive: hits.length === 0,
    hits: hits.map(p => p.source),
    summary: hits.length
      ? '命理重在「知命而不认命」，以上为传统命局倾向，真正的转机在你手中：方向、选择与持续努力，远大于命盘本身。'
      : null
  }
}

/**
 * 反思：不确定性校准（检测过度自信措辞）
 */
export function reflectConfidence(text) {
  const t = Array.isArray(text) ? text.join('\n') : (text || '')
  const hits = OVERCONFIDENT_PATTERNS.filter(p => p.test(t))
  return {
    calibrated: hits.length === 0,
    hits: hits.map(p => p.source),
    summary: hits.length
      ? '需要说明：命理推演基于模型与传统经验，本就存在不确定性；上述表述宜视为「倾向」而非「定论」。'
      : null
  }
}

/**
 * 综合反思入口：对回答做四重自检，返回反思报告与可注入的前置/后置提示
 * @param {object} chart 命盘
 * @param {string|string[]} text 回答文本
 */
export function reflectAll(chart, text) {
  const red = reflectRedLine(text)
  const comp = reflectCompleteness(chart, text)
  const tone = reflectTone(text)
  const conf = reflectConfidence(text)

  const banners = []
  if (tone.summary) banners.push({ type: 'tone', text: tone.summary })
  if (conf.summary) banners.push({ type: 'confidence', text: conf.summary })
  if (red.summary) banners.push({ type: 'redline', text: red.summary })

  return {
    red, comp, tone, conf,
    banners,
    hasFlag: banners.length > 0
  }
}
