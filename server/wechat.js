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
  const token = await getAccessToken()
  const body = {
    touser: sub.openid,
    template_id: config.wechat.templateId,
    page: 'pages/index/index',
    data: {
      thing1: { value: (content.title || '今日黄历').slice(0, 20) },
      thing2: { value: content.summary.slice(0, 20) },
      thing3: { value: (content.tip || '').slice(0, 20) },
    },
  }
  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.errcode && json.errcode !== 0) throw new Error(`微信模板消息失败: ${JSON.stringify(json)}`)
  return json
}

// 模拟微信扫码登录（降级模式）：生成一个稳定的 mock openid
export function mockOpenid(phone) {
  const seed = `mock-${phone}-${config.wechat.appId || 'dev'}`
  return 'mock_' + crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16)
}

export function generateState() {
  return crypto.randomBytes(12).toString('hex')
}
