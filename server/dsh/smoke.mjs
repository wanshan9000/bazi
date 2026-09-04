// npm run agent:smoke：用真实 key 跑一轮"排八字"，断言模型调用了 bazi 工具。无 key 时跳过（exit 0）。
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DshPool, DEFAULT_ROUTE } from './pool.js'
import { installPlugin } from './setup.mjs'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })
if (!process.env.DEEPSEEK_API_KEY) { console.log('[smoke] 无 DEEPSEEK_API_KEY，跳过'); process.exit(0) }

installPlugin()
const pool = new DshPool()
const seen = []
let text = ''
try {
  const r = await pool.run({
    routeKey: process.env.AGENT_DEFAULT_ROUTE || DEFAULT_ROUTE,
    sessionId: `smoke-${Date.now()}`,
    text: '我是 1990 年 5 月 6 日早上 8 点出生的男性，帮我排个八字，简单说说命局。',
    onEvent: e => { seen.push(e.type + (e.name ? ':' + e.name : '')); if (e.type === 'text') text += e.delta },
  })
  console.log('[smoke] 事件：', seen.join(' '))
  console.log('[smoke] 回复：', (r.finalText || text).slice(0, 300))
  if (!seen.includes('tool_call:bazi')) { console.error('[smoke] 失败：模型未调用 bazi'); process.exit(1) }
  if (!/庚午/.test(r.finalText || text)) { console.error('[smoke] 失败：回复未引用四柱'); process.exit(1) }
  console.log('[smoke] 通过')
} finally {
  await pool.close()
}
