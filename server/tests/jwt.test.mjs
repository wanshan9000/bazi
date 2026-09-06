// JWT 的回归测试。这几条对应的是「一旦写错就等于全站没有鉴权」的经典坑。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signJwt, verifyJwt } from '../jwt.js'

const SECRET = 'test-secret-please-be-long-enough-0123456789'

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

test('签发的 token 能被同一密钥验回，payload 原样带回', () => {
  const t = signJwt({ sub: 'u1' }, SECRET)
  const p = verifyJwt(t, SECRET)
  assert.equal(p.sub, 'u1')
  assert.equal(typeof p.exp, 'number')
  assert.equal(typeof p.iat, 'number')
})

test('换一个密钥就验不过（签名真的参与了校验）', () => {
  const t = signJwt({ sub: 'u1' }, SECRET)
  assert.equal(verifyJwt(t, SECRET + 'x'), null)
})

// 这是 JWT 最著名的坑：照着 header.alg 选算法，攻击者把 alg 改成 none
// 并去掉签名就能伪造任意身份。实现里必须钉死 HS256。
test('alg=none 的伪造 token 必须拒绝', () => {
  const forged = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })}.`
  assert.equal(verifyJwt(forged, SECRET), null)
})

test('篡改 payload 后签名对不上', () => {
  const t = signJwt({ sub: 'u1' }, SECRET)
  const [h, , s] = t.split('.')
  const tampered = `${h}.${b64url({ sub: 'u-victim', exp: Math.floor(Date.now() / 1000) + 3600 })}.${s}`
  assert.equal(verifyJwt(tampered, SECRET), null)
})

test('过期的 token 拒绝', () => {
  const t = signJwt({ sub: 'u1' }, SECRET, { expiresInSec: -1 })
  assert.equal(verifyJwt(t, SECRET), null)
})

test('畸形输入不抛异常，一律返回 null', () => {
  for (const bad of ['', 'a.b', 'a.b.c.d', 'not-a-token', null, undefined, 123, {}]) {
    assert.equal(verifyJwt(bad, SECRET), null, `输入 ${JSON.stringify(bad)} 应返回 null`)
  }
  // 没有密钥时也不能放行
  assert.equal(verifyJwt(signJwt({ sub: 'u1' }, SECRET), ''), null)
})

test('签名长度不同不得因 timingSafeEqual 抛异常', () => {
  const t = signJwt({ sub: 'u1' }, SECRET)
  const [h, b] = t.split('.')
  assert.equal(verifyJwt(`${h}.${b}.AAAA`, SECRET), null)
})
