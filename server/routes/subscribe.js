// 订阅相关 API 路由
import { Router } from 'express'
import crypto from 'crypto'
import { config, smsConfigured } from '../config.js'
import {
  createVerify, verifyCode, lastSendAt,
  findByPhone, findByOpenid, findByToken,
  upsertSubscriber, updateSubscriber, deleteSubscriber, listSubscribers,
} from '../store.js'
import { sendVerifySms } from '../sms.js'
import { qrAuthUrl, exchangeCode, mockOpenid } from '../wechat.js'
import { chartFromSubscriber, buildPushContent } from '../huangli.js'
import { requireAdmin } from '../adminAuth.js'

const router = Router()
const genCode = () => String(Math.floor(100000 + Math.random() * 900000))
const genToken = () => crypto.randomBytes(24).toString('hex')

// 生成订阅号唯一 token（用于取消订阅、查状态）
function freshToken() { return genToken() }

// ---- 1. 发送短信验证码 ----
router.post('/sms/send-code', async (req, res) => {
  const phone = String(req.body.phone || '').trim()
  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ ok: false, msg: '手机号格式不正确' })

  const last = lastSendAt(phone)
  if (last && Date.now() - last < config.sms.sendCooldownSec * 1000) {
    const wait = Math.ceil((config.sms.sendCooldownSec * 1000 - (Date.now() - last)) / 1000)
    return res.status(429).json({ ok: false, msg: `发送过于频繁，请 ${wait} 秒后再试`, wait })
  }

  const code = genCode()
  createVerify(phone, code)
  try {
    await sendVerifySms(phone, code)
  } catch (e) {
    return res.status(500).json({ ok: false, msg: e.message })
  }
  res.json({ ok: true, msg: '验证码已发送', devCode: smsConfigured() ? undefined : code })
})

// ---- 2. 短信验证码订阅（首次创建） ----
router.post('/sms/subscribe', async (req, res) => {
  const { phone, code, birth, time, favZodiac = [] } = req.body
  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ ok: false, msg: '手机号格式不正确' })
  if (!code) return res.status(400).json({ ok: false, msg: '请输入验证码' })

  const v = verifyCode(phone, code)
  if (!v.ok) {
    const reasonMsg = v.reason === 'EXPIRED' ? '验证码已过期，请重新获取' : v.reason === 'NO_CODE' ? '请先获取验证码' : '验证码错误'
    return res.status(400).json({ ok: false, msg: reasonMsg })
  }

  // 记录八字信息（可选）
  let birthNorm = null
  if (birth && birth.year && birth.month && birth.day) {
    birthNorm = {
      year: Number(birth.year), month: Number(birth.month), day: Number(birth.day),
      hour: Number(birth.hour ?? 12), gender: birth.gender ?? 'm',
    }
  }

  const sub = upsertSubscriber({
    channel: 'sms',
    phone,
    birth: birthNorm,
    time: time || 'morning',
    favZodiac,
    enabled: true,
    token: freshToken(),
  })

  res.json({ ok: true, msg: '订阅成功', token: sub.token })
})

// ---- 3. 微信扫码：获取二维码链接 ----
router.get('/wechat/qr', (req, res) => {
  const state = crypto.randomBytes(12).toString('hex')
  const url = qrAuthUrl(state)
  if (!url) {
    // 降级模式：返回模拟的"扫码确认"信息
    return res.json({
      ok: true,
      mock: true,
      state,
      qrText: '（当前为开发降级模式，未配置微信）',
      tip: '生产环境配置 WX_APP_ID / WX_APP_SECRET / WX_REDIRECT_URI 后此处显示真实二维码',
    })
  }
  res.json({ ok: true, mock: false, url, state })
})

// ---- 4. 微信网页授权回调（扫码后跳转） ----
router.get('/wechat/callback', async (req, res) => {
  const { code, state } = req.query
  try {
    const info = await exchangeCode(code)
    const existing = findByOpenid(info.openid)
    const token = existing?.token || freshToken()
    upsertSubscriber({
      channel: 'wechat',
      openid: info.openid,
      unionid: info.unionid,
      time: 'morning',
      enabled: true,
      token,
    })
    // 跳转回前端订阅成功页
    const feBase = (config.allowedOrigins[0] || 'http://localhost:5173').replace(/\/$/, '')
    res.redirect(`${feBase}/#/subscribed?token=${token}&openid=${info.openid}`)
  } catch (e) {
    res.status(400).send('微信授权失败: ' + e.message)
  }
})

// ---- 5. 微信模拟扫码完成（降级模式联调用） ----
router.post('/wechat/mock-done', (req, res) => {
  const { phone, state, birth, time, favZodiac = [] } = req.body
  const openid = mockOpenid(phone || '00000000000')
  const token = freshToken()
  upsertSubscriber({
    channel: 'wechat',
    openid,
    phone: phone || undefined,
    birth: birth ? { year: Number(birth.year), month: Number(birth.month), day: Number(birth.day), hour: Number(birth.hour ?? 12), gender: birth.gender ?? 'm' } : null,
    time: time || 'morning',
    favZodiac,
    enabled: true,
    token,
  })
  res.json({ ok: true, token, openid })
})

// ---- 6. 订阅状态查询 ----
router.get('/status', (req, res) => {
  const token = req.query.token
  const sub = findByToken(token)
  if (!sub) return res.status(404).json({ ok: false, msg: '未找到订阅' })
  const { phone, openid, channel, time, favZodiac, enabled, birth } = sub
  res.json({ ok: true, data: { phone, openid, channel, time, favZodiac, enabled, birth } })
})

// ---- 7. 更新订阅偏好（时段/关注生肖/开/关） ----
router.post('/update', (req, res) => {
  const { token, time, favZodiac, enabled } = req.body
  const sub = findByToken(token)
  if (!sub) return res.status(404).json({ ok: false, msg: '未找到订阅' })
  const patch = {}
  if (time) patch.time = time
  if (Array.isArray(favZodiac)) patch.favZodiac = favZodiac
  if (typeof enabled === 'boolean') patch.enabled = enabled
  updateSubscriber(s => s.token === token, patch)
  res.json({ ok: true, msg: '已更新' })
})

// ---- 8. 取消订阅 ----
router.post('/unsubscribe', (req, res) => {
  const { token } = req.body
  const ok = deleteSubscriber(s => s.token === token)
  res.json({ ok, msg: ok ? '已取消订阅' : '未找到订阅' })
})

// ---- 9. 测试推送（手动触发一次当前黄历推送）----
router.post('/test-push', (req, res) => {
  const { token } = req.body
  const sub = findByToken(token)
  if (!sub) return res.status(404).json({ ok: false, msg: '未找到订阅' })
  const content = buildPushContent(sub)
  // 仅返回文本，实际推送由 scheduler 或显式调用完成
  res.json({ ok: true, content, preview: content.text })
})

// ---- 10. 管理员：列出订阅（含手机号/令牌，必须鉴权）----
router.get('/admin/list', requireAdmin, (_req, res) => {
  res.json({ ok: true, data: listSubscribers().map(({ token, phone, openid, channel, time, favZodiac, enabled }) => ({ token, phone, openid, channel, time, favZodiac, enabled })) })
})

export default router
