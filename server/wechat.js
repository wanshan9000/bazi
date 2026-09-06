// 微信扫码订阅：网页授权(网页应用/公众号扫码)+模板消息推送。
// 未配置 appId/appSecret 时降级为「模拟微信」，便于开发联调。
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { config, wechatConfigured } from './config.js'

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
  if (!wechatConfigured()) {
    console.log(`\n[本地微信·降级] → openid=${sub.openid}\n  推送内容: ${content}\n`)
    return { RequestId: `local-wx-${Date.now()}` }
  }
  if (!config.wechat.templateId) {
    throw new Error('未配置微信模板消息 ID（WX_TEMPLATE_ID）')
  }
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
 * ⚠ openid 归属问题（配置真实通道前必须先想清楚）
 *
 * 现在的扫码走的是**开放平台「网站应用」**授权（qrAuthUrl 用 snsapi_login），
 * 拿到的 openid 属于「该网站应用」这个主体；而 sendWxTemplate 调用的是
 * **公众号**的模板消息接口，它只认「该公众号」下的 openid。两个 openid
 * 处在不同命名空间，直接拿前者去发后者的模板消息会被拒（errcode 40003/43004）。
 *
 * 两条可行路线，二选一：
 *   A. 全走公众号：改用公众号网页授权（snsapi_userinfo）取 openid，用户需先关注公众号。
 *   B. 走开放平台 + unionid 映射：网站应用与公众号绑定到同一个开放平台账号，
 *      通过 unionid 找到该用户在公众号下的 openid，再用它发模板消息。
 *
 * 在选定之前，微信推送不具备上线条件 —— 本地降级模式下打日志是能跑通的，
 * 但那条路径永远暴露不出这个问题。
 */

// 模拟微信扫码登录（降级模式）：生成一个稳定的 mock openid
export function mockOpenid(phone) {
  const seed = `mock-${phone}-${config.wechat.appId || 'dev'}`
  return 'mock_' + crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16)
}

export function generateState() {
  return crypto.randomBytes(12).toString('hex')
}
