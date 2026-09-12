// 后端统一配置：全部通过环境变量注入，未配置时进入「本地降级模式」便于开发演示。
import dotenv from 'dotenv'
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 加载 server/.env（若有）
dotenv.config({ path: path.join(__dirname, '.env') })
// 本机凭据覆盖层：与 .env 一样受 Git 忽略，便于本地密钥不混入共享配置。
dotenv.config({ path: path.join(__dirname, '.env.local') })

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
    signName: env.SMS_SIGN_NAME || '元氣黄历',
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
    // 微信公众平台服务器配置中的 Token。公众号关注/扫码事件需经由回调验签后
    // 绑定站内账号；未配置时不应对外声称模板消息可用。
    webhookToken: env.WX_WEBHOOK_TOKEN || '',
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

  // ---- 账号与鉴权（R2 M1）----
  auth: {
    // 账号库（与订阅数据分文件存放，互不干扰）
    accountsFile: env.ACCOUNTS_FILE || path.join(__dirname, 'data', 'accounts.json'),
    // JWT 密钥。未配 JWT_SECRET 时自动生成并持久化到 data/.jwt-secret，
    // 见 resolveJwtSecret()。绝不内置默认值 —— 硬编码密钥等于没有鉴权。
    jwtSecret: env.JWT_SECRET || '',
    secretFile: env.JWT_SECRET_FILE || path.join(__dirname, 'data', '.jwt-secret'),
    // 登录态有效期（天）
    tokenTtlDays: Number(env.AUTH_TOKEN_TTL_DAYS || 7),
    // 登录/注册限流：同一「账号+IP」在窗口内的失败次数上限
    loginWindowMin: Number(env.AUTH_LOGIN_WINDOW_MIN || 15),
    loginMaxAttempts: Number(env.AUTH_LOGIN_MAX_ATTEMPTS || 5),
    registerWindowMin: Number(env.AUTH_REGISTER_WINDOW_MIN || 60),
    registerMaxAttempts: Number(env.AUTH_REGISTER_MAX_ATTEMPTS || 5),
  },

  // ---- 账号报告档案 ----
  reports: {
    // 与账号、订阅和 AI 会话分文件保存，便于按用户独立清理与备份。
    file: env.REPORT_ARCHIVE_FILE || path.join(__dirname, 'data', 'report_archives.json'),
  },

  security: {
    apiIpPerMinute: Number(env.API_IP_PER_MINUTE || 180),
    smsIpPerHour: Number(env.SMS_IP_PER_HOUR || 12),
    // 生产注册必须通过 Turnstile（或兼容供应商）人机校验。开发环境默认关闭，避免
    // 本地没有公网回调时无法联调；生产如未填密钥会拒绝注册，而不是静默放行。
    captchaRequired: env.CAPTCHA_REQUIRED === '1' || env.NODE_ENV === 'production',
    captchaSecret: env.TURNSTILE_SECRET_KEY || '',
    captchaVerifyUrl: env.TURNSTILE_VERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    // 订阅验证码的发送与校验分别限流，防止撞库者跳过发送接口直接撞六码。
    smsVerifyIpPerHour: Number(env.SMS_VERIFY_IP_PER_HOUR || 30),
    subscriptionIpPerHour: Number(env.SUBSCRIPTION_IP_PER_HOUR || 12),
    // 单个用户或来源最多同时跑一轮模型，避免用多个新会话并发消耗模型资源。
    agentInFlightPerUser: Number(env.AGENT_INFLIGHT_PER_USER || 1),
    agentInFlightPerIp: Number(env.AGENT_INFLIGHT_PER_IP || 2),
    // 风险事件保留来源 HMAC 指纹，不保存明文 IP；累计异常后自动短时封禁。
    riskStoreFile: env.RISK_STORE_FILE || path.join(__dirname, 'data', 'security.json'),
    riskWindowMin: Number(env.RISK_WINDOW_MIN || 30),
    riskBlockThreshold: Number(env.RISK_BLOCK_THRESHOLD || 12),
    riskBlockMinutes: Number(env.RISK_BLOCK_MINUTES || 60),
    riskManualBlockMinutes: Number(env.RISK_MANUAL_BLOCK_MINUTES || 1440),
    riskEventKeep: Number(env.RISK_EVENT_KEEP || 500),
    // 未接支付回调前，禁止用户自行调用 /auth/plan 升级；本地演示时可显式打开。
    allowUnpaidPlanChanges: env.ALLOW_UNPAID_PLAN_CHANGES === '1',
  },

  // ---- 游客免费额度（服务端记账，按来源 IP）----
  guest: {
    // 每 IP 每天的免费 token 上限。游客标识是客户端自报的，只有按 IP 记账才拦得住。
    dailyTokens: Number(env.GUEST_DAILY_TOKENS || 50000),
    quotaFile: env.GUEST_QUOTA_FILE || path.join(__dirname, 'data', 'guest_quota.json'),
  },

  // ---- 数据备份 ----
  backup: {
    dir: env.BACKUP_DIR || path.join(__dirname, 'data', 'backups'),
    // 每日快照保留份数
    keep: Number(env.BACKUP_KEEP || 14),
    // 快照间隔（小时）。0 表示关闭。
    intervalHours: Number(env.BACKUP_INTERVAL_HOURS || 24),
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

// 「网页扫码登录」和「公众号模板消息提醒」是两条不同通道。后者除了凭证还需要
// 关注入口和受微信验签的事件回调，缺一项都无法把公众号 openid 正确绑定给用户。
export const wechatTemplateConfigured = () => Boolean(
  wechatConfigured()
  && config.wechat.templateId
  && config.wechat.webhookToken,
)

/**
 * 取 JWT 密钥。
 *
 * 优先用 JWT_SECRET 环境变量。没配时**不能**退回某个硬编码常量 —— 那等于把
 * 签名密钥公开在代码库里，任何人都能自签一个 token 冒充任意账号。
 * 这里改为在 data/ 下生成一个随机密钥并持久化（0600）：
 *   · 随机 → 没人能预测；
 *   · 持久化 → 重启不会把所有人踢下线（每次随机会导致 token 全失效）。
 * 生产仍建议显式配置 JWT_SECRET，便于多实例共享与轮换。
 */
let cachedSecret = null
export function resolveJwtSecret() {
  if (cachedSecret) return cachedSecret
  if (config.auth.jwtSecret) { cachedSecret = config.auth.jwtSecret; return cachedSecret }
  const file = config.auth.secretFile
  try {
    if (fs.existsSync(file)) {
      const v = fs.readFileSync(file, 'utf-8').trim()
      if (v.length >= 32) { cachedSecret = v; return cachedSecret }
    }
  } catch { /* 读不到就重新生成 */ }
  const generated = crypto.randomBytes(48).toString('base64url')
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, generated, { mode: 0o600 })
    console.warn(`[auth] 未配置 JWT_SECRET，已生成随机密钥并保存到 ${file}（生产建议显式配置）`)
  } catch (e) {
    console.warn(`[auth] 未配置 JWT_SECRET 且密钥文件写入失败（${e.message}），本次启动使用内存密钥，重启后登录态会失效`)
  }
  cachedSecret = generated
  return cachedSecret
}
