// 极简 HS256 JWT：签发 / 校验。
//
// 为什么不引 jsonwebtoken：这里只需要 HS256 的签发与校验，用 node:crypto 写完
// 不到 60 行，且这条路径是全站鉴权的根，依赖越少越好审。
//
// 安全要点（写在这里是因为每一条都被踩过）：
//   · 只接受 alg=HS256。绝不能读 header.alg 再照着它选算法 —— 那就是经典的
//     alg=none / alg 混淆漏洞：攻击者把 alg 改成 none 并去掉签名即可伪造任意身份。
//   · 签名比较用 timingSafeEqual，不用 ===。
//   · exp 必检；iat 也签进去，便于将来做「某时刻前签发的一律失效」。
import crypto from 'node:crypto'

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest()
}

/** 签发 token。payload 里不要放敏感信息（JWT 只签名，不加密）。 */
export function signJwt(payload, secret, { expiresInSec = 7 * 86400 } = {}) {
  if (!secret) throw new Error('缺少 JWT 密钥')
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresInSec }
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const data = `${head}.${b64url(JSON.stringify(body))}`
  return `${data}.${b64url(hmac(secret, data))}`
}

/**
 * 校验 token。合法返回 payload，任何问题一律返回 null（不区分原因，
 * 免得把「签名错」和「已过期」的差别暴露给调用方去做探测）。
 */
export function verifyJwt(token, secret) {
  if (typeof token !== 'string' || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, body, sig] = parts

  let header
  try { header = JSON.parse(b64urlDecode(head).toString('utf8')) } catch { return null }
  // 只认 HS256。不照着 header 选算法，见文件头注释。
  if (!header || header.alg !== 'HS256' || (header.typ && header.typ !== 'JWT')) return null

  const expected = hmac(secret, `${head}.${body}`)
  const actual = b64urlDecode(sig)
  if (actual.length !== expected.length) return null
  if (!crypto.timingSafeEqual(actual, expected)) return null

  let payload
  try { payload = JSON.parse(b64urlDecode(body).toString('utf8')) } catch { return null }
  if (!payload || typeof payload !== 'object') return null

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp <= now) return null
  // 允许 60 秒的时钟偏移：多台机器之间差几秒很常见，不该把用户挡在门外。
  if (typeof payload.iat === 'number' && payload.iat > now + 60) return null

  return payload
}
