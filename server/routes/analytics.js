import { Router } from 'express'
import { requireAdmin } from '../adminAuth.js'
import { analyticsSummary, recordAnalyticsEvent } from '../store.js'

const router = Router()
const EVENTS = new Set([
  'page_view',
  'bazi_calculator_opened',
  'guide_calculator_opened',
  'bazi_chart_created',
  'agent_consult_opened',
  'chart_summary_share_opened',
  'chart_summary_share_completed',
  'chart_summary_link_copied',
  'agent_summary_share_opened',
  'agent_summary_share_completed',
  'agent_summary_link_copied',
])

router.post('/analytics/events', (req, res) => {
  const event = String(req.body?.event || '')
  if (!EVENTS.has(event)) return res.status(400).json({ ok: false, msg: '不支持的事件' })
  recordAnalyticsEvent({
    event,
    page: req.body?.page,
    locale: req.body?.locale,
    source: req.body?.source,
    medium: req.body?.medium,
    campaign: req.body?.campaign,
    content: req.body?.content,
  })
  res.status(204).end()
})

router.get('/admin/analytics', requireAdmin, (req, res) => {
  const days = Math.max(7, Math.min(90, Number(req.query.days) || 30))
  res.json({ ok: true, data: analyticsSummary(days) })
})

export default router
