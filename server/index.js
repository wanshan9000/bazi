// 元氣黄历 · 订阅后端入口
import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config, smsConfigured, wechatConfigured } from './config.js'
import { startScheduler } from './scheduler.js'
import subscribeRouter from './routes/subscribe.js'
import shareRouter from './routes/share.js'
import skillsRouter from './routes/skills.js'
import articlesRouter from './routes/articles.js'
import membershipsRouter from './routes/memberships.js'
import securityRouter from './routes/security.js'
import agentRouter from './routes/agent.js'
import { createAuthRouter } from './routes/auth.js'
import { sharedPool } from './dsh/pool.js'
import { sharedStore } from './dsh/agentStore.js'
import { startBackups } from './backup.js'
import { ipRateLimit } from './rateLimit.js'
import { sharedSecurityGuard } from './security.js'

const app = express()
// 生产由 Caddy 反代到 127.0.0.1，不声明信任代理的话 req.ip 恒为 127.0.0.1，
// 所有按 IP 的限流会退化成"全站共用一个桶"。'loopback' 只信任本机代理，
// 公网客户端伪造 X-Forwarded-For 也不会被采信。
app.set('trust proxy', config.trustProxy)
// 默认上限 100KB 小于 share 路由自定的 300KB —— 大报告分享在到达路由前就被
// body-parser 拒掉，返回的还是 500 而不是那条「内容过大」的提示。上限统一到 400KB，
// 留出 JSON 转义的余量，具体的业务上限仍由各路由自己判。
app.use(express.json({ limit: '400kb' }))
app.use(cors({ origin: config.allowedOrigins, credentials: true }))
// API 不提供可嵌入的页面或嗅探内容，明确声明这些浏览器安全边界。
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cache-Control', 'no-store')
  next()
})

// 健康检查。
// ⚠ 此前只无脑返回 ok:true，不看 agent 通道 —— 部署脚本拿它验活、监控拿它判断
// 存活，结果 DEEPSEEK_API_KEY 没配、引擎产物没打包这类「AI 全站不可用」的故障
// 一律照样报健康。现在把 agent 依赖的两个前置条件也纳入，并在不满足时降级为 503，
// 让部署与监控能真的发现问题。
app.get('/api/health', (_req, res) => {
  const modelKey = Boolean(process.env.DEEPSEEK_API_KEY || process.env.MINIMAX_API_KEY)
  const enginesBundle = fs.existsSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'dsh', 'plugins', 'lingshu-tools', 'dist', 'engines.mjs'),
  )
  const agentReady = modelKey && enginesBundle
  res.status(agentReady ? 200 : 503).json({
    ok: agentReady,
    sms: smsConfigured() ? 'configured' : 'local(mock)',
    wechat: wechatConfigured() ? 'configured' : 'local(mock)',
    agent: agentReady ? 'ready' : 'unavailable',
    agentDetail: agentReady ? undefined : {
      modelKey: modelKey ? 'ok' : 'missing',            // 缺 DEEPSEEK_API_KEY / MINIMAX_API_KEY
      enginesBundle: enginesBundle ? 'ok' : 'missing',  // 缺 npm run build:engines 的产物
    },
    time: new Date().toISOString(),
  })
})

// 健康检查放在此前，避免监控本身占用业务限额。登录、短信和 AI 接口仍有更严规则。
// 风险封禁也放在业务前：被判定为异常的来源不应再消耗任何验证码或模型额度。
app.use('/api', sharedSecurityGuard().middleware)
app.use('/api', ipRateLimit({ windowMs: 60 * 1000, max: config.security.apiIpPerMinute }))

// 账号与鉴权。注销时连坐清掉该用户的 AI 会话与消息（隐私合规）。
app.use('/api', createAuthRouter({
  onRemoveUser: uid => sharedStore().deleteAllSessions(uid),
}))
app.use('/api', subscribeRouter)
app.use('/api', shareRouter)
app.use('/api', skillsRouter)
app.use('/api', articlesRouter)
app.use('/api', membershipsRouter)
app.use('/api', securityRouter)
app.use('/api', agentRouter())

// 兜底错误处理。
// ⚠ 此前把 err.message 原样回给客户端，且一律 500 —— body-parser 的
// entity.too.large / 非法 JSON 都是客户端错误，却报成服务端故障，
// 错误文本还可能带出内部路径。现在按类型给状态码，细节只进日志。
app.use((err, _req, res, _next) => {
  console.error('ERR', err)
  if (res.headersSent) return
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, msg: '内容过大' })
  }
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ ok: false, msg: '请求格式不正确' })
  }
  res.status(500).json({ ok: false, msg: '服务器错误' })
})

app.listen(config.port, config.host, () => {
  console.log('\n==================================================')
  console.log('  元氣黄历订阅服务已启动')
  console.log(`  http://${config.host}:${config.port}`)
  console.log('--------------------------------------------------')
  console.log(`  短信通道: ${smsConfigured() ? config.sms.provider.toUpperCase() : '本地降级(mock)'}`)
  console.log(`  微信通道: ${wechatConfigured() ? '已配置' : '本地降级(mock)'}`)
  console.log('==================================================\n')

  startScheduler()
  startBackups()
})

// 退出时回收 dsh 子进程
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await sharedPool().close(); process.exit(0) })
