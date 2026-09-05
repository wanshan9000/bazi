// 元气黄历 · 订阅后端入口
import express from 'express'
import cors from 'cors'
import { config, smsConfigured, wechatConfigured } from './config.js'
import { startScheduler } from './scheduler.js'
import subscribeRouter from './routes/subscribe.js'
import shareRouter from './routes/share.js'
import skillsRouter from './routes/skills.js'
import agentRouter from './routes/agent.js'
import { sharedPool } from './dsh/pool.js'

const app = express()
app.use(express.json())
app.use(cors({ origin: config.allowedOrigins, credentials: true }))

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    sms: smsConfigured() ? 'configured' : 'local(mock)',
    wechat: wechatConfigured() ? 'configured' : 'local(mock)',
    time: new Date().toISOString(),
  })
})

app.use('/api', subscribeRouter)
app.use('/api', shareRouter)
app.use('/api', skillsRouter)
app.use('/api', agentRouter())

app.use((err, _req, res, _next) => {
  console.error('ERR', err)
  res.status(500).json({ ok: false, msg: err.message || '服务器错误' })
})

app.listen(config.port, config.host, () => {
  console.log('\n==================================================')
  console.log('  元气黄历订阅服务已启动')
  console.log(`  http://${config.host}:${config.port}`)
  console.log('--------------------------------------------------')
  console.log(`  短信通道: ${smsConfigured() ? config.sms.provider.toUpperCase() : '本地降级(mock)'}`)
  console.log(`  微信通道: ${wechatConfigured() ? '已配置' : '本地降级(mock)'}`)
  console.log('==================================================\n')

  startScheduler()
})

// 退出时回收 dsh 子进程
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await sharedPool().close(); process.exit(0) })
