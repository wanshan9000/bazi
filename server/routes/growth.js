// 增长激励：奖励必须由服务端记账，浏览器不能自行增加积分。
import { Router } from 'express'
import { sharedAccounts } from '../accounts.js'
import { requireAuth } from './auth.js'

export function createGrowthRouter({ accounts = sharedAccounts() } = {}) {
  const router = Router()
  const auth = requireAuth(accounts)

  router.post('/growth/share-reward', auth, (req, res) => {
    const result = accounts.grantShareReward(req.uid, req.body?.eventId, req.body?.source)
    if (!result.ok) {
      const status = result.reason === 'invalid_event' ? 400 : 404
      return res.status(status).json({ ok: false, reason: result.reason, msg: '分享奖励请求无效' })
    }
    return res.json({
      ok: true,
      rewarded: result.rewarded,
      reason: result.reason,
      credits: result.credits || 0,
      user: result.user,
    })
  })

  return router
}

export default createGrowthRouter
