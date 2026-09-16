import { config, googleConfigured } from './config.js'

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export function googleAuthUrl(state) {
  if (!googleConfigured()) return null
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTHORIZE_URL}?${params}`
}

export async function exchangeGoogleCode(code) {
  if (!googleConfigured()) throw new Error('GOOGLE_NOT_CONFIGURED')
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenResponse.json().catch(() => null)
  if (!tokenResponse.ok || !tokens?.access_token) throw new Error('GOOGLE_TOKEN_EXCHANGE_FAILED')

  // 用户资料仅通过刚由 Google 授权服务器签发的 access token 获取；不信任浏览器回传的邮箱。
  const userResponse = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  const profile = await userResponse.json().catch(() => null)
  if (!userResponse.ok || !profile?.sub || !profile?.email || profile.email_verified !== true) {
    throw new Error('GOOGLE_PROFILE_NOT_VERIFIED')
  }
  return {
    sub: String(profile.sub),
    email: String(profile.email).trim().toLowerCase(),
    name: String(profile.name || profile.given_name || '').trim(),
  }
}
