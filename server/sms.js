// 短信发送：阿里云 / 腾讯云 双支持，未配置凭证时降级为「本地日志 + console」。
// 生产环境按需选择 provider，并填入对应密钥。
import { config, smsConfigured } from './config.js'

// ---- 阿里云 SMS ----
async function sendAliyun(phone, templateCode, params) {
  const { default: crypto } = await import('crypto')
  const { accessKeyId, accessKeySecret, signName, region } = config.sms
  const pm = new URLSearchParams()
  const seed = {
    Action: 'SendSms',
    Version: '2017-05-25',
    RegionId: region,
    PhoneNumbers: phone,
    SignName: signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify(params),
  }
  const all = { ...seed, AccessKeyId: accessKeyId, Format: 'JSON', SignatureMethod: 'HMAC-SHA1', SignatureVersion: '1.0', Timestamp: new Date().toISOString(), SignatureNonce: String(Math.random() * 1e16) }
  const sorted = Object.keys(all).sort()
  const canonical = sorted.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(all[k])}`).join('&')
  const stringToSign = `GET&%2F&${encodeURIComponent(canonical)}`
  const signature = crypto.createHmac('sha1', accessKeySecret + '&').update(stringToSign).digest('base64')
  pm.set('AccessKeyId', accessKeyId)
  for (const k of sorted) pm.set(k, all[k])
  pm.set('Signature', signature)
  const res = await fetch(`https://dysmsapi.aliyuncs.com/?${pm.toString()}`, { method: 'GET' })
  const json = await res.json()
  if (json.Code && json.Code !== 'OK') throw new Error(`阿里云短信失败: ${json.Code} ${json.Message}`)
  return json
}

// ---- 腾讯云 SMS ----
async function sendTencent(phone, templateId, params) {
  const { tencentSecretId, tencentSecretKey, tencentSdkAppId, signName } = config.sms
  const { default: crypto } = await import('crypto')

  const service = 'sms'
  const host = 'sms.tencentcloudapi.com'
  const version = '2021-01-11'
  const action = 'SendSms'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

  const payload = {
    PhoneNumberSet: [phone],
    SmsSdkAppId: tencentSdkAppId,
    SignName: signName,
    TemplateId: templateId,
    TemplateParamSet: Object.values(params),
  }

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Host: host,
    'X-TC-Action': action,
    'X-TC-Version': version,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Region': 'ap-guangzhou',
  }
  const payloadStr = JSON.stringify(payload)
  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:${headers['Content-Type']}\nhost:${host}\n`,
    'content-type;host',
    crypto.createHash('sha256').update(payloadStr).digest('hex'),
  ].join('\n')
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonical = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonical}`
  const kDate = crypto.createHmac('sha256', `TC3${tencentSecretKey}`).update(date).digest()
  const kService = crypto.createHmac('sha256', kDate).update(service).digest()
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest()
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')
  headers.Authorization = `TC3-HMAC-SHA256 Credential=${tencentSecretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`

  const res = await fetch(`https://${host}/`, { method: 'POST', headers, body: payloadStr })
  const json = await res.json()
  if (json.Response?.Error) throw new Error(`腾讯云短信失败: ${json.Response.Error.Code} ${json.Response.Error.Message}`)
  return json
}

// ---- 本地降级：把验证码打印到日志，方便开发联调 ----
function sendLocal(phone, code, kind) {
  const msg = `[本地短信·降级] → ${phone}\n  内容: ${kind === 'verify' ? `您的验证码是 ${code}，${config.sms.codeTtlMin} 分钟内有效。` : ''}${code || ''}`
  console.log('\n' + msg + '\n')
  return { RequestId: `local-${Date.now()}` }
}

// 发送验证码短信
export async function sendVerifySms(phone, code) {
  if (!smsConfigured()) return sendLocal(phone, code, 'verify')
  const { provider, templateCode } = config.sms
  if (provider === 'aliyun') return sendAliyun(phone, templateCode, { code })
  if (provider === 'tencent') return sendTencent(phone, templateCode, { code })
  return sendLocal(phone, code, 'verify')
}

// 推送订阅用户当日黄历
export async function sendDailyPush(sub, text, { type = 'daily' } = {}) {
  if (!smsConfigured()) return sendLocal(sub.phone, `${text}`, type)
  // ⚠ 用推送专用模板，不能复用验证码模板：验证码模板只声明了 {code} 一个变量，
  // 拿它发黄历正文会被服务商以「模板变量不匹配」整批拒掉 —— 而且是配置了真实
  // 通道之后才会暴露，本地降级模式永远测不出来。
  const { provider, pushTemplateCode } = config.sms
  if (!pushTemplateCode) {
    throw new Error('未配置每日推送短信模板（SMS_PUSH_TEMPLATE_CODE）')
  }
  const param = { text, time: new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16) }
  if (provider === 'aliyun') return sendAliyun(sub.phone, pushTemplateCode, param)
  if (provider === 'tencent') return sendTencent(sub.phone, pushTemplateCode, param)
  return sendLocal(sub.phone, text, type)
}
