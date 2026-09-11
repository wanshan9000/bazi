import { Router } from 'express'
import { requireAuth } from './auth.js'
import { sharedAccounts } from '../accounts.js'
import { REPORT_TYPES, sharedReportArchive } from '../reportArchive.js'
import { sharedStore } from '../dsh/agentStore.js'

const TYPE_SET = new Set(REPORT_TYPES)

function saveError(result) {
  switch (result.reason) {
    case 'too_large': return { status: 413, msg: '报告内容过大，请精简后重试' }
    case 'limit_reached': return { status: 409, msg: '最多可保存 120 份报告，请先整理不再需要的报告' }
    case 'invalid_type': return { status: 400, msg: '报告类型不正确' }
    default: return { status: 400, msg: '报告内容格式不正确' }
  }
}

function summaryFor(archives, uid, id) {
  return archives.listReports(uid).reports.find(item => item.id === id) || null
}

export function createReportsRouter({
  accounts = sharedAccounts(),
  archives = sharedReportArchive(),
  sessions = sharedStore(),
} = {}) {
  const router = Router()
  const auth = requireAuth(accounts)

  router.get('/reports', auth, (req, res) => {
    const type = String(req.query?.type || '').trim()
    if (type && !TYPE_SET.has(type)) return res.status(400).json({ ok: false, msg: '报告类型不正确' })
    res.json({ ok: true, ...archives.listReports(req.uid, { type }) })
  })

  router.post('/reports', auth, (req, res) => {
    const result = archives.saveReport(req.uid, req.body || {})
    if (!result.ok) {
      const error = saveError(result)
      return res.status(error.status).json({ ok: false, reason: result.reason, msg: error.msg })
    }
    const report = summaryFor(archives, req.uid, result.report.id)
    res.status(result.created ? 201 : 200).json({ ok: true, created: result.created, report })
  })

  router.post('/reports/migrate', auth, (req, res) => {
    const reports = req.body?.reports
    if (!Array.isArray(reports) || reports.length > 40) return res.status(400).json({ ok: false, msg: '旧记录格式不正确' })
    const result = archives.migrateLegacy(req.uid, reports)
    if (!result.ok) return res.status(400).json({ ok: false, msg: '旧记录迁移失败' })
    res.json({ ok: true, migrated: result.migrated, claimed: result.claimed })
  })

  router.get('/reports/:id', auth, (req, res) => {
    const report = archives.getReport(req.uid, req.params.id)
    if (!report) return res.status(404).json({ ok: false, msg: '报告不存在' })
    res.json({ ok: true, report })
  })

  router.post('/reports/:id/sessions', auth, (req, res) => {
    const sessionId = String(req.body?.sessionId || '').trim()
    if (!sessionId || sessionId.length > 100) return res.status(400).json({ ok: false, msg: '会话标识不正确' })
    // store ownership check sits in the archive store; this explicit reference keeps the
    // injected route dependency visible and avoids trusting a browser-supplied session owner.
    if (!sessions.getSession(req.uid, sessionId)) return res.status(404).json({ ok: false, msg: '会话不存在' })
    const result = archives.appendSession(req.uid, req.params.id, sessionId)
    if (!result.ok) return res.status(404).json({ ok: false, msg: result.reason === 'report_not_found' ? '报告不存在' : '会话不存在' })
    res.json({ ok: true, created: result.created, report: summaryFor(archives, req.uid, req.params.id) })
  })

  router.delete('/reports/:id', auth, (req, res) => {
    if (!archives.deleteReport(req.uid, req.params.id)) return res.status(404).json({ ok: false, msg: '报告不存在' })
    res.json({ ok: true })
  })

  return router
}

export default createReportsRouter
