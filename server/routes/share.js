// 报告分享短链 API
import { Router } from 'express'
import { saveShare, getShare } from '../store.js'

const router = Router()

// 限制单次分享内容体量（约 300KB，防滥用）
const MAX_PAYLOAD = 300 * 1024

// 保存分享：body = { payload: <report 的紧凑 JSON 字符串> }
router.post('/share', (req, res) => {
  const payload = req.body && req.body.payload
  if (typeof payload !== 'string' || !payload.trim()) {
    return res.status(400).json({ ok: false, msg: '缺少内容' })
  }
  if (payload.length > MAX_PAYLOAD) {
    return res.status(413).json({ ok: false, msg: '内容过大' })
  }
  try {
    const id = saveShare({ payload: payload.trim() })
    res.json({ ok: true, id })
  } catch (err) {
    res.status(500).json({ ok: false, msg: err.message || '保存失败' })
  }
})

// 读取分享
router.get('/share/:id', (req, res) => {
  const payload = getShare(String(req.params.id))
  if (!payload) {
    return res.status(404).json({ ok: false, msg: '分享不存在或已过期' })
  }
  res.json({ ok: true, payload })
})

export default router
