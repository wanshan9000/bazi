// 报告分享短链 API
import { Router } from 'express'
import { saveShare, getShare } from '../store.js'

const router = Router()

// 限制单次分享内容体量（约 300KB，防滥用）
const MAX_PAYLOAD = 300 * 1024

// 写入限流：这个接口不需要鉴权（任何人看完报告都能生成短链），但也因此可以被
// 无限调用 —— 每条最多 300KB，全部追加进与订阅同一个 JSON 文件里，并且每次写入
// 都要整文件重写。没有闸门的话，几百次请求就能把数据文件顶到几十兆，
// 之后每一次订阅操作都要重写这么大的文件。
const WINDOW_MS = 60 * 1000
const MAX_PER_WINDOW = 10
const hits = new Map() // ip -> { count, resetAt }

function writeLimited(ip) {
  const now = Date.now()
  for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k)
  const h = hits.get(ip)
  if (!h || h.resetAt < now) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false }
  h.count++
  return h.count > MAX_PER_WINDOW
}

// 保存分享：body = { payload: <report 的紧凑 JSON 字符串> }
router.post('/share', (req, res) => {
  if (writeLimited(req.ip)) {
    return res.status(429).json({ ok: false, msg: '操作过于频繁，请稍后再试' })
  }
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
    // err.message 可能带出数据文件路径，不回给客户端
    console.error('[share] 保存失败', err)
    res.status(500).json({ ok: false, msg: '保存失败，请稍后重试' })
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
