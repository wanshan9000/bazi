// 后端统一配置：全部通过环境变量注入，未配置时进入「本地降级模式」便于开发演示。
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 加载 server/.env（若有）
dotenv.config({ path: path.join(__dirname, '.env') })

const env = process.env

export const config = {
  port: Number(env.PORT || 8787),
  // 监听地址。生产由 Caddy 反代，钉成 127.0.0.1 不让 API 直接暴露公网；本地默认全网卡便于手机联调。
  host: env.HOST || '0.0.0.0',

  // Express 的 trust proxy 设置。默认 'loopback'：只把本机反代（Caddy）送来的
  // X-Forwarded-For 当真，从而让 req.ip 拿到访客真实 IP，按 IP 的限流才有意义。
  trustProxy: env.TRUST_PROXY || 'loopback',

  // 是否本地降级模式（未配置短信/微信凭证时自动为 true）
  devMode: env.NODE_ENV !== 'production',

  // 是否允许「模拟短信/微信」这类降级能力对外可用。
  // 生产默认关闭：否则未配置凭证时，公网任何人都能取到任意手机号的验证码、
  // 或凭空写入一条微信订阅。确需在生产联调时显式设 ALLOW_MOCK_CHANNELS=1。
  allowMockChannels: env.ALLOW_MOCK_CHANNELS === '1' || env.NODE_ENV !== 'production',

  // 前端来源（CORS）。本地联调常开多个 vite 端口(5173/5178/5179…)，
  // 生产仅放行 ALLOWED_ORIGINS 指定的域名。
  allowedOrigins: (env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5178,http://localhost:5179').split(',').map(s => s.trim()),

  // 订阅数据文件
  storeFile: env.STORE_FILE || path.join(__dirname, 'data', 'subscribers.json'),

  // ---- 短信 ----
  sms: {
    provider: env.SMS_PROVIDER || 'local', // aliyun | tencent | local
    accessKeyId: env.SMS_ACCESS_KEY_ID || '',
    accessKeySecret: env.SMS_ACCESS_KEY_SECRET || '',
    signName: env.SMS_SIGN_NAME || '元气黄历',
    // 验证码模板
    templateCode: env.SMS_TEMPLATE_CODE || '',
    // ⚠ 每日推送必须用**另一个**已审核的模板：验证码模板的变量只有 {code}，
    // 拿它去发黄历正文，服务商会直接以「模板变量不匹配」拒掉。
    // 未单独配置时回落到验证码模板，仅为不破坏本地降级演示。
    pushTemplateCode: env.SMS_PUSH_TEMPLATE_CODE || env.SMS_TEMPLATE_CODE || '',
    templateParam: env.SMS_TEMPLATE_PARAM || '{code}',
    region: env.SMS_REGION || 'cn-hangzhou',
    // 腾讯云专用
    tencentSecretId: env.TENCENT_SECRET_ID || '',
    tencentSecretKey: env.TENCENT_SECRET_KEY || '',
    tencentSdkAppId: env.TENCENT_SDK_APP_ID || '',
    // 验证码有效期(分)
    codeTtlMin: Number(env.SMS_CODE_TTL_MIN || 5),
    // 同一手机号发送频率限制(秒)
    sendCooldownSec: Number(env.SMS_COOLDOWN_SEC || 60),
  },

  // ---- 微信 ----
  wechat: {
    // 模板消息字段映射（JSON）。公众号模板消息的字段名由模板自身定义，
    // 值里可以用 {title} / {summary} / {tip} 占位符引用推送内容。
    // 例：WX_TEMPLATE_FIELDS={"first":"今日黄历","keyword1":"{title}","remark":"{tip}"}
    templateFields: (() => {
      if (!env.WX_TEMPLATE_FIELDS) return null
      try { return JSON.parse(env.WX_TEMPLATE_FIELDS) } catch { return null }
    })(),
    appId: env.WX_APP_ID || '',
    appSecret: env.WX_APP_SECRET || '',
    // 扫码成功后的跳转回调地址
    redirectUri: env.WX_REDIRECT_URI || '',
    // 公众号/开放平台模板消息(推送用)
    templateId: env.WX_TEMPLATE_ID || '',
    // 微信 access_token 缓存文件
    tokenCacheFile: env.WX_TOKEN_CACHE || path.join(__dirname, 'data', 'wx_token.json'),
  },

  // ---- 定时推送 ----
  scheduler: {
    // 默认推送时段（分钟，24h），对应前端 morning/noon/evening
    slots: {
      morning: env.PUSH_MORNING_HHMM || '07:00',
      noon: env.PUSH_NOON_HHMM || '12:00',
      evening: env.PUSH_EVENING_HHMM || '21:00',
    },
    timezone: env.TZ || 'Asia/Shanghai',
  },

  // ---- 部署 ----
  deploy: {
    // 生产环境后端对外地址（用于生成微信回调/订阅状态页链接）
    baseUrl: env.BASE_URL || `http://localhost:${env.PORT || 8787}`,
  },

  // ---- 报告分享 ----
  share: {
    // 分享短链有效期（天），到期自动清理
    ttlDays: Number(env.SHARE_TTL_DAYS || 30),
  },

  // ---- 管理后台 ----
  admin: {
    // 管理后台密码（环境变量 ADMIN_PASSWORD）。配置后，技能的新增/修改/删除/导入
    // 需先通过密码换取会话令牌；未配置时写操作一律拒绝（防未授权注入）。
    password: env.ADMIN_PASSWORD || '',
    // 会话令牌有效期（小时）
    tokenTtlHours: Number(env.ADMIN_TOKEN_TTL_HOURS || 24),
  },
}

// 判断短信是否已配置真实凭证
export const smsConfigured = () =>
  (config.sms.provider === 'aliyun' && config.sms.accessKeyId && config.sms.accessKeySecret) ||
  (config.sms.provider === 'tencent' && config.sms.tencentSecretId && config.sms.tencentSecretKey)

// 判断微信是否已配置
export const wechatConfigured = () => Boolean(config.wechat.appId && config.wechat.appSecret)
