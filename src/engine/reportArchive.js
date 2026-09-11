const REPORT_TYPES = new Set(['bazi', 'ziwei', 'qimen', 'huangli', 'tarot', 'chenggu', 'name', 'fengshui', 'horoscope', 'chart'])
const CHART_FIELDS = ['year', 'month', 'day', 'hour', 'gender']
const TYPE_LABEL = {
  bazi: '八字报告', ziwei: '紫微斗数报告', qimen: '奇门遁甲报告', huangli: '黄历报告', tarot: '塔罗解读',
  chenggu: '称骨论命', name: '姓名测算', fengshui: '风水分析', horoscope: '星座运势', chart: '基础命盘记录',
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function jsonCopy(value) {
  if (value == null) return null
  try { return JSON.parse(JSON.stringify(value)) } catch { return null }
}

function cleanText(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function cleanChart(value) {
  if (!plainObject(value)) return null
  const chart = {}
  for (const field of CHART_FIELDS) {
    if (value[field] === undefined || value[field] === null || value[field] === '') continue
    if (field === 'gender') {
      const gender = String(value[field]).trim()
      if (gender === '男' || gender === '女') chart.gender = gender
      continue
    }
    const number = Number(value[field])
    if (Number.isFinite(number)) chart[field] = Math.trunc(number)
  }
  return Object.keys(chart).length ? chart : null
}

function cleanFacts(values) {
  if (!Array.isArray(values)) return []
  return values
    .map(value => cleanText(value, 120))
    .filter(value => value && value.length < 120)
    .slice(0, 12)
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!plainObject(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
}

function hash(text) {
  let result = 2166136261
  for (const char of String(text)) {
    result ^= char.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}

function derivedSummary(result) {
  if (!plainObject(result)) return ''
  return cleanText(result.summary || result.summaryText || result.sub || result.markdown || '', 180)
}

/** 把当前完成的报告转换成服务端允许保存的 JSON 草稿。 */
export function createArchiveDraft({ type, title, summary, result = null, chart = null, facts = [], createdAt = Date.now(), clientKey = '' } = {}) {
  const normalizedType = REPORT_TYPES.has(type) ? type : 'chart'
  const fullResult = jsonCopy(result)
  const safeChart = cleanChart(chart)
  const safeTitle = cleanText(title || TYPE_LABEL[normalizedType], 100) || TYPE_LABEL[normalizedType]
  const safeSummary = cleanText(summary || derivedSummary(fullResult), 180)
  const safeFacts = cleanFacts(facts)
  const time = Number.isFinite(Number(createdAt)) ? Math.trunc(Number(createdAt)) : Date.now()
  const fingerprint = hash(JSON.stringify(stable({ type: normalizedType, title: safeTitle, chart: safeChart, result: fullResult, createdAt: time })))
  return {
    clientKey: cleanText(clientKey, 160) || `${normalizedType}:${fingerprint}`,
    type: normalizedType,
    title: safeTitle,
    summary: safeSummary,
    report: fullResult,
    chart: safeChart,
    facts: safeFacts,
    createdAt: time,
  }
}

function localList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

function legacyChartDraft(entry) {
  const chart = cleanChart(entry)
  if (!chart?.year || !chart?.month || !chart?.day) return null
  const pillars = Array.isArray(entry.pillars) ? entry.pillars.map(value => cleanText(value, 18)).filter(Boolean).slice(0, 4) : []
  const label = `${chart.year}-${String(chart.month).padStart(2, '0')}-${String(chart.day).padStart(2, '0')}`
  const facts = [
    entry.name ? `对象：${cleanText(entry.name, 40)}` : '',
    entry.dayMaster ? `日主：${cleanText(entry.dayMaster, 12)}` : '',
    pillars.length ? `四柱：${pillars.join(' · ')}` : '',
  ].filter(Boolean)
  return createArchiveDraft({
    type: 'chart',
    title: `基础命盘记录 · ${label}`,
    summary: cleanText([entry.name, entry.dayMaster ? `${entry.dayMaster}日主` : '基础四柱'].filter(Boolean).join(' · '), 180),
    result: null,
    chart,
    facts,
    createdAt: entry.id,
    clientKey: `legacy:chart:${hash(JSON.stringify(stable({ chart, facts })))}`,
  })
}

function legacyTarotDraft(entry) {
  if (!plainObject(entry) || !Array.isArray(entry.cards) || !entry.cards.length) return null
  const cards = entry.cards.slice(0, 10).map(card => ({
    id: cleanText(card?.id, 32), name: cleanText(card?.name, 40), reversed: Boolean(card?.reversed),
  })).filter(card => card.id || card.name)
  if (!cards.length) return null
  const spreadName = cleanText(entry.spreadName || '塔罗解读', 50)
  const question = cleanText(entry.question, 200)
  const summary = cleanText(entry.summary, 180)
  const facts = [
    `牌阵：${spreadName}`,
    question ? `所问：${question}` : '',
    `抽牌：${cards.map(card => `${card.name}${card.reversed ? '（逆位）' : ''}`).join('、')}`,
  ].filter(Boolean)
  const result = { spreadId: cleanText(entry.spreadId, 32), spreadName, question, cards, summary }
  return createArchiveDraft({
    type: 'tarot',
    title: `塔罗 · ${spreadName}`,
    summary,
    result,
    facts,
    createdAt: entry.id,
    clientKey: `legacy:tarot:${hash(JSON.stringify(stable(result)))}`,
  })
}

/** 只读取旧版两类明确的浏览器记录；不会上传任何其它 localStorage 内容。 */
export function legacyArchiveDrafts() {
  // 旧版 localStorage 只有出生要素、抽牌或摘要，没有完整的可恢复结果。
  // 不将它们伪装为报告，也不再上传到账号档案。
  return []
}
