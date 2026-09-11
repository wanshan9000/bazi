// 微信能力：网页登录授权只用于账号登录；每日提醒则使用公众号临时关注码、
// 关注/扫码事件回调与公众号模板消息。两条链路的 openid 不可互换。
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { config, wechatConfigured, wechatTemplateConfigured } from './config.js'

const TOKEN_FILE = config.wechat.tokenCacheFile

let tokenCache = null

async function readToken() {
  if (tokenCache) return tokenCache
  try {
    tokenCache = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'))
  } catch { tokenCache = null }
  return tokenCache
}

async function writeToken(data) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data))
  tokenCache = data
}

// 获取全局 access_token（用于发送模板消息）
async function getAccessToken(force = false) {
  if (!wechatConfigured()) return null
  const cache = await readToken()
  if (!force && cache && cache.access_token && Date.now() < cache.expires_at - 300000) {
    return cache.access_token
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wechat.appId}&secret=${config.wechat.appSecret}`
  const res = await fetch(url)
  const json = await res.json()
  if (json.access_token) {
    await writeToken({ access_token: json.access_token, expires_at: Date.now() + json.expires_in * 1000 })
    return json.access_token
  }
  throw new Error(`微信 access_token 获取失败: ${JSON.stringify(json)}`)
}

// 创建公众号临时关注码。scene 会在公众号的 subscribe / SCAN 回调事件里原样带回，
// 服务端据此把公众号 openid 绑定到已登录的站内账号；它不是网页登录 OAuth 二维码。
export async function createOfficialFollowQr(scene) {
  if (!wechatTemplateConfigured()) throw new Error('公众号模板消息通道尚未完成配置')
  const token = await getAccessToken()
  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expire_seconds: 600,
      action_name: 'QR_STR_SCENE',
      action_info: { scene: { scene_str: scene } },
    }),
  })
  const json = await res.json()
  if (!json.ticket) throw new Error(`公众号关注码创建失败: ${JSON.stringify(json)}`)
  return {
    qrUrl: `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(json.ticket)}`,
    expiresIn: Number(json.expire_seconds || 600),
  }
}

// 生成网页授权扫码链接（微信网页应用）
export function qrAuthUrl(state) {
  if (!wechatConfigured()) return null
  const redirect = encodeURIComponent(config.wechat.redirectUri)
  return `https://open.weixin.qq.com/connect/qrconnect?appid=${config.wechat.appId}&redirect_uri=${redirect}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`
}

// 用 code 换取用户 openid（网页授权）
export async function exchangeCode(code) {
  if (!wechatConfigured()) {
    // 降级：从 state 里带出的 mock openid
    throw new Error('WECHAT_NOT_CONFIGURED')
  }
  const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.wechat.appId}&secret=${config.wechat.appSecret}&code=${code}&grant_type=authorization_code`
  const res = await fetch(url)
  const json = await res.json()
  if (json.errcode) throw new Error(`微信 OAuth 失败: ${JSON.stringify(json)}`)
  return { openid: json.openid, access_token: json.access_token, unionid: json.unionid, nickname: null }
}

// 发送模板消息推送当日黄历
export async function sendWxTemplate(sub, content) {
  if (!wechatTemplateConfigured()) throw new Error('公众号模板消息通道尚未完成配置')
  const token = await getAccessToken()

  // 公众号模板消息的 data 字段名由模板本身定义（经典形态是
  // first / keyword1..n / remark），不是固定的。用 WX_TEMPLATE_FIELDS 让部署方
  // 按自己审核通过的模板配置映射，默认给一套最常见的。
  //
  // ⚠ 原实现用的是**小程序订阅消息**的字段形态（page + thing1/thing2/thing3）去调
  // **公众号模板消息**接口，两者根本不是一套协议，真实通道下必然被拒。
  const fields = config.wechat.templateFields || {
    first: '今日黄历已送达',
    keyword1: content.title || '今日黄历',
    keyword2: content.summary || '',
    remark: content.tip || '',
  }
  const data = {}
  for (const [k, v] of Object.entries(fields)) {
    // 允许配置里写 "{title}" 这样的占位符，从 content 取值
    const raw = typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (_, key) => content[key] ?? '') : String(v ?? '')
    data[k] = { value: raw.slice(0, 200) }
  }

  const body = {
    touser: sub.openid,
    template_id: config.wechat.templateId,
    url: config.deploy?.baseUrl || undefined,
    data,
  }
  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.errcode && json.errcode !== 0) {
    // 43004 / 40003：openid 不属于该公众号。见下方「openid 归属」说明。
    throw new Error(`微信模板消息失败: ${JSON.stringify(json)}`)
  }
  return json
}

/*
 * ⚠ openid 归属问题
 *
 * 现在的扫码走的是**开放平台「网站应用」**授权（qrAuthUrl 用 snsapi_login），
 * 拿到的 openid 属于「该网站应用」这个主体；而 sendWxTemplate 调用的是
 * **公众号**的模板消息接口，它只认「该公众号」下的 openid。两个 openid
 * 处在不同命名空间，直接拿前者去发后者的模板消息会被拒（errcode 40003/43004）。
 *
 * 每日提醒已采用公众号临时关注码 + subscribe / SCAN 事件回调的方案：回调取得的
 * openid 才会被写入 wechat 订阅并用于模板消息。网页登录 OAuth 仍可供账号登录使用，
 * 但绝不能把它拿来做公众号推送。
 */

// 模拟微信扫码登录（降级模式）：生成一个稳定的 mock openid
export function mockOpenid(phone) {
  const seed = `mock-${phone}-${config.wechat.appId || 'dev'}`
  return 'mock_' + crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16)
}

export function generateState() {
  return crypto.randomBytes(12).toString('hex')
}
