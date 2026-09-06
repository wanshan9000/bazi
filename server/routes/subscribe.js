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
// ⚠ 验证码不能用 Math.random：它不是密码学安全的，输出可预测。
// 短信验证码是账号绑定的唯一凭据，必须走 CSPRNG。
const genCode = () => String(crypto.randomInt(100000, 1000000))
const genToken = () => crypto.randomBytes(24).toString('hex')

/**
 * 「本地降级」能力是否允许在当前环境暴露。
 *
 * ⚠ 此前 devCode 回显与 /wechat/mock-done 只看「有没有配凭证」：生产上只要没配
 * 短信/微信，公网任何人都能拿到任意手机号的验证码、或凭空写入一条微信订阅。
 * 现在加一道环境闸门 —— 非 production 才允许降级；生产未配置凭证时接口直接
 * 返回 503，宁可功能不可用，也不要开着一个假流程收集真实手机号。
 * 需要在生产做联调时显式设 ALLOW_MOCK_CHANNELS=1。
 */
function mockAllowed() {
  return config.allowMockChannels
}

function mockDisabled(res) {
  return res.status(503).json({
    ok: false,
    msg: '短信/微信通道未配置，该功能暂不可用',
  })
}

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
  // devCode 只在允许降级的环境回显，生产绝不把验证码交给客户端
  res.json({ ok: true, msg: '验证码已发送', devCode: smsConfigured() || !mockAllowed() ? undefined : code })
})

// ---- 2. 短信验证码订阅（首次创建） ----
router.post('/sms/subscribe', async (req, res) => {
  const { phone, code, birth, time, favZodiac = [] } = req.body
  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ ok: false, msg: '手机号格式不正确' })
  if (!code) return res.status(400).json({ ok: false, msg: '请输入验证码' })

  const v = verifyCode(phone, code)
  if (!v.ok) {
    const reasonMsg = v.reason === 'EXPIRED' ? '验证码已过期，请重新获取'
      : v.reason === 'NO_CODE' ? '请先获取验证码'
      : v.reason === 'TOO_MANY_ATTEMPTS' ? '验证码错误次数过多，请重新获取'
      : '验证码错误'
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

// OAuth state：签发时记下，回调时校验并作废（一次性）。
// ⚠ 此前 state 只是生成后原样带走，回调完全不看它 —— 等于没有 CSRF 防护，
// 攻击者可以诱导受害者的浏览器带着自己的授权 code 打回调，把攻击者的微信号
// 绑到受害者的会话上。
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000
const oauthStates = new Map() // state -> expiresAt

function issueState() {
  const now = Date.now()
  for (const [k, exp] of oauthStates) if (exp < now) oauthStates.delete(k)
  const state = crypto.randomBytes(16).toString('hex')
  oauthStates.set(state, now + OAUTH_STATE_TTL_MS)
  return state
}

function consumeState(state) {
  if (!state || typeof state !== 'string') return false
  const exp = oauthStates.get(state)
  if (!exp) return false
  oauthStates.delete(state) // 一次性
  return exp >= Date.now()
}

// ---- 3. 微信扫码：获取二维码链接 ----
router.get('/wechat/qr', (req, res) => {
  const state = issueState()
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
  const feBase = (config.deploy?.baseUrl || config.allowedOrigins[0] || 'http://localhost:5173').replace(/\/$/, '')
  if (!consumeState(state)) {
    return res.redirect(`${feBase}/#/huangli?wechat=state_invalid`)
  }
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
    // 跳转回前端订阅页。
    // ⚠ 原先跳的是 `#/subscribed` —— 前端 HASH_VIEWS 里根本没有这个视图，
    // 用户扫完码落到一个空白页，订阅其实已经成功了却毫无反馈。
    // 现在跳到真实存在的黄历/订阅页，并用 query 参数让页面给出结果提示。
    res.redirect(`${feBase}/#/huangli?wechat=ok&token=${encodeURIComponent(token)}`)
  } catch (e) {
    console.error('[wechat/callback] 授权失败', e)
    // 错误详情不外泄，只给用户一个可理解的结果
    res.redirect(`${feBase}/#/huangli?wechat=failed`)
  }
})

// ---- 5. 微信模拟扫码完成（降级模式联调用） ----
router.post('/wechat/mock-done', (req, res) => {
  // 生产必须关掉：这个接口不校验任何东西，可以为任意手机号伪造一条微信订阅，
  // 而 openid 由手机号确定性派生，等于还能顶掉别人已有的订阅。
  if (!mockAllowed()) return mockDisabled(res)
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

// ---- 6b. 凭手机号 + 短信验证码找回订阅令牌 ----
// ⚠ 订阅令牌此前只存在浏览器 localStorage 里：换个设备、清一次缓存，用户就再也
// 无法查看、修改或退订自己的订阅，只能一直收推送。这条接口用同一套验证码流程
// 重新验明身份后把令牌交还给本人。
router.post('/sms/recover', (req, res) => {
  const phone = String(req.body?.phone || '').trim()
  const code = req.body?.code
  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ ok: false, msg: '手机号格式不正确' })
  if (!code) return res.status(400).json({ ok: false, msg: '请输入验证码' })

  const v = verifyCode(phone, code)
  if (!v.ok) {
    const msg = v.reason === 'EXPIRED' ? '验证码已过期，请重新获取'
      : v.reason === 'NO_CODE' ? '请先获取验证码'
      : v.reason === 'TOO_MANY_ATTEMPTS' ? '验证码错误次数过多，请重新获取'
      : '验证码错误'
    return res.status(400).json({ ok: false, msg })
  }

  const sub = findByPhone(phone)
  if (!sub) return res.status(404).json({ ok: false, msg: '该手机号没有订阅记录' })
  res.json({ ok: true, token: sub.token, data: { time: sub.time, favZodiac: sub.favZodiac, enabled: sub.enabled } })
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
