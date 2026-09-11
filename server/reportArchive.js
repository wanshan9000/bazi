import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'

export const REPORT_TYPES = Object.freeze([
  'bazi', 'ziwei', 'qimen', 'huangli', 'tarot', 'chenggu', 'name', 'fengshui', 'horoscope', 'chart',
])

const TYPE_SET = new Set(REPORT_TYPES)
const MAX_REPORTS_PER_USER = 120
const MAX_REPORT_BYTES = 240 * 1024
const MAX_TITLE = 100
const MAX_SUMMARY = 180
const MAX_CLIENT_KEY = 160
const MAX_FACTS = 12
const MAX_FACT = 120
const CHART_FIELDS = ['year', 'month', 'day', 'hour', 'gender']

const EMPTY_DB = () => ({ reports: [], migrationClaims: {} })

function jsonClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function cleanString(value, max) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text && text.length <= max ? text : ''
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function cleanChart(value) {
  if (!isPlainObject(value)) return null
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

function cleanFacts(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => cleanString(item, MAX_FACT))
    .filter(Boolean)
    .slice(0, MAX_FACTS)
}

// 归档只在能够恢复为当时完整阅读页时才进入「我的报告」。
// 旧浏览器里仅存生辰、抽牌名或摘要的记录不能补写成报告，保留在数据文件中但不展示。
export function isCompleteReport(type, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  if (type === 'bazi' || type === 'ziwei' || type === 'qimen') return Array.isArray(payload.sections) && payload.sections.length > 0
  if (type === 'huangli') return Boolean(payload.date && payload.real && payload.scene)
  if (type === 'tarot') return Boolean(payload.spread && Array.isArray(payload.cards) && payload.cards.length && payload.interpretation)
  if (type === 'chenggu') return Boolean(payload.summary && payload.classic && Array.isArray(payload.lines))
  if (type === 'name') return Boolean(payload.analysis || (Array.isArray(payload.recommendations) && payload.recommendations.length))
  if (type === 'fengshui') return Boolean(payload.door && Array.isArray(payload.rooms))
  if (type === 'horoscope') return Boolean(payload.sign && payload.today)
  return false
}

function normalizeDraft(draft, { source = 'live' } = {}) {
  if (!isPlainObject(draft)) return { ok: false, reason: 'invalid_payload' }
  const type = String(draft.type || '')
  if (!TYPE_SET.has(type)) return { ok: false, reason: 'invalid_type' }
  const clientKey = cleanString(draft.clientKey, MAX_CLIENT_KEY)
  if (!clientKey) return { ok: false, reason: 'invalid_client_key' }
  const title = cleanString(draft.title, MAX_TITLE)
  if (!title) return { ok: false, reason: 'invalid_title' }
  const rawSummary = typeof draft.summary === 'string' ? draft.summary.trim() : ''
  if (rawSummary.length > MAX_SUMMARY) return { ok: false, reason: 'invalid_summary' }
  if (draft.report !== null && draft.report !== undefined && !isPlainObject(draft.report) && !Array.isArray(draft.report)) {
    return { ok: false, reason: 'invalid_report' }
  }

  const normalized = {
    clientKey,
    type,
    title,
    summary: rawSummary,
    report: draft.report == null ? null : jsonClone(draft.report),
    source: source === 'legacy-local' ? 'legacy-local' : 'live',
    chart: cleanChart(draft.chart),
    facts: cleanFacts(draft.facts),
    createdAt: Number.isFinite(Number(draft.createdAt)) ? Math.trunc(Number(draft.createdAt)) : Date.now(),
  }
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_REPORT_BYTES) return { ok: false, reason: 'too_large' }
  return { ok: true, draft: normalized }
}

function reportSummary(report) {
  const { report: _fullReport, userId: _userId, clientKey: _clientKey, ...summary } = report
  return jsonClone({ ...summary, isComplete: isCompleteReport(report.type, report.report), sessionCount: Array.isArray(report.agentSessionIds) ? report.agentSessionIds.length : 0 })
}

export function createReportArchiveStore(file, { sessions = null } = {}) {
  let db = null

  function load() {
    if (db) return db
    let raw = null
    try {
      if (!fs.existsSync(file)) {
        db = EMPTY_DB()
        return db
      }
      raw = fs.readFileSync(file, 'utf8')
      const parsed = JSON.parse(raw)
      db = { ...EMPTY_DB(), ...parsed }
    } catch (error) {
      if (raw != null) {
        try { fs.writeFileSync(`${file}.corrupt-${Date.now()}`, raw) } catch { /* preserve the original failure */ }
        console.error(`[reportArchive] 报告档案解析失败，已保留损坏副本：${error.message}`)
      }
      db = EMPTY_DB()
    }
    if (!Array.isArray(db.reports)) db.reports = []
    if (!db.migrationClaims || typeof db.migrationClaims !== 'object') db.migrationClaims = {}
    return db
  }

  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp-${process.pid}`
    try {
      fs.writeFileSync(tmp, JSON.stringify(load(), null, 2), { mode: 0o600 })
      fs.renameSync(tmp, file)
    } catch (error) {
      try { fs.rmSync(tmp, { force: true }) } catch { /* ignore cleanup failure */ }
      throw error
    }
  }

  function own(userId, reportId) {
    return load().reports.find(item => item.userId === userId && item.id === reportId) || null
  }

  function saveReport(userId, payload, options = {}) {
    const normalized = normalizeDraft(payload, options)
    if (!normalized.ok) return normalized
    const draft = normalized.draft
    const existing = load().reports.find(item => item.userId === userId && item.clientKey === draft.clientKey)
    if (existing) return { ok: true, created: false, report: jsonClone(existing) }
    const mine = load().reports.filter(item => item.userId === userId)
    if (mine.length >= MAX_REPORTS_PER_USER) return { ok: false, reason: 'limit_reached' }
    const now = Date.now()
    const record = {
      id: randomUUID(),
      userId,
      ...draft,
      agentSessionIds: [],
      updatedAt: now,
    }
    load().reports.push(record)
    save()
    return { ok: true, created: true, report: jsonClone(record) }
  }

  function listReports(userId, { type = '' } = {}) {
    const acceptedType = TYPE_SET.has(type) ? type : ''
    const mine = load().reports.filter(item => item.userId === userId && isCompleteReport(item.type, item.report))
    const counts = Object.fromEntries(REPORT_TYPES.map(key => [key, 0]))
    for (const item of mine) counts[item.type] = (counts[item.type] || 0) + 1
    const reports = mine
      .filter(item => !acceptedType || item.type === acceptedType)
      .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)
      .map(reportSummary)
    return { reports, counts }
  }

  function getReport(userId, reportId) {
    const report = own(userId, reportId)
    return report ? jsonClone(report) : null
  }

  function deleteReport(userId, reportId) {
    const current = own(userId, reportId)
    if (!current) return false
    const data = load()
    data.reports = data.reports.filter(item => item !== current)
    save()
    return true
  }

  function appendSession(userId, reportId, sessionId) {
    const report = own(userId, reportId)
    if (!report) return { ok: false, reason: 'report_not_found' }
    const session = sessions?.getSession?.(userId, sessionId)
    if (!session) return { ok: false, reason: 'session_not_found' }
    if (!report.agentSessionIds.includes(sessionId)) {
      report.agentSessionIds.push(sessionId)
      report.updatedAt = Date.now()
      save()
      return { ok: true, created: true, report: jsonClone(report) }
    }
    return { ok: true, created: false, report: jsonClone(report) }
  }

  function migrateLegacy(userId, drafts) {
    const data = load()
    if (data.migrationClaims[userId]) return { ok: true, migrated: 0, claimed: true }
    let migrated = 0
    const source = Array.isArray(drafts) ? drafts : []
    for (const draft of source) {
      const saved = saveReport(userId, draft, { source: 'legacy-local' })
      if (saved.ok && saved.created) migrated++
    }
    data.migrationClaims[userId] = true
    save()
    return { ok: true, migrated, claimed: false }
  }

  function deleteAllReports(userId) {
    const data = load()
    const before = data.reports.length
    data.reports = data.reports.filter(item => item.userId !== userId)
    delete data.migrationClaims[userId]
    const removed = before - data.reports.length
    if (removed || !data.migrationClaims[userId]) save()
    return removed
  }

  return { saveReport, listReports, getReport, deleteReport, appendSession, migrateLegacy, deleteAllReports }
}

let shared = null

export function sharedReportArchive(options = {}) {
  if (!shared) {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const file = config.reports?.file || path.join(here, 'data', 'report_archives.json')
    shared = createReportArchiveStore(file, options)
  }
  return shared
}
