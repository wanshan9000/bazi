import { Router } from 'express'
import { requireAdmin } from '../adminAuth.js'
import { sharedSecurityGuard } from '../security.js'

const router = Router()

router.get('/admin/security', requireAdmin, (_req, res) => {
  res.json({ ok: true, data: sharedSecurityGuard().snapshot() })
})

router.post('/admin/security/blocks/:fingerprint', requireAdmin, (req, res) => {
  const result = sharedSecurityGuard().block(req.params.fingerprint, {
    minutes: req.body?.minutes,
    reason: req.body?.reason,
  })
  res.status(result.ok ? 201 : 400).json(result)
})

router.delete('/admin/security/blocks/:fingerprint', requireAdmin, (req, res) => {
  const ok = sharedSecurityGuard().unblock(req.params.fingerprint)
  res.status(ok ? 200 : 404).json(ok ? { ok: true, msg: '已解除封禁' } : { ok: false, msg: '未找到该封禁记录' })
})

export default router
