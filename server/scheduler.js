// 定时推送：按订阅者选择的时段(晨起/午间/晚归)每天推送当日黄历。
// 短信通道 + 微信模板消息双通道，可独立开关。
import { config } from './config.js'
import { listSubscribers } from './store.js'
import { buildPushContent } from './huangli.js'
import { sendDailyPush } from './sms.js'
import { sendWxTemplate } from './wechat.js'

let started = false
const log = (...a) => console.log('[推送]', ...a)

function parseHHMM(str) {
  const [h, m] = String(str).split(':').map(Number)
  return h * 60 + (m || 0)
}

function slotTimeInMin() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function minuteUntil(hhmm) {
  const target = parseHHMM(hhmm)
  let diff = target - slotTimeInMin()
  if (diff < 0) diff += 24 * 60
  return diff * 60 * 1000
}

// 每个用户一次推送任务
async function pushSubscriber(sub) {
  try {
    const content = buildPushContent(sub)
    if (sub.channel === 'sms' && sub.phone && sub.enabled !== false) {
      await sendDailyPush(sub, content.text)
      log('短信推送 OK →', sub.phone)
    } else if (sub.channel === 'wechat' && sub.openid && sub.enabled !== false) {
      await sendWxTemplate(sub, content)
      log('微信推送 OK →', sub.openid)
    }
  } catch (e) {
    log('推送失败 →', sub.channel, sub.phone || sub.openid, e.message)
  }
}

function scheduleSlot(slotKey) {
  const hhmm = config.scheduler.slots[slotKey]
  if (!hhmm) return
  const delay = minuteUntil(hhmm)
  setTimeout(() => {
    log(`开始推送时段 [${slotKey}] ${hhmm}`)
    const subs = listSubscribers().filter(s => s.enabled !== false && s.time === slotKey)
    for (const s of subs) pushSubscriber(s)
    scheduleSlot(slotKey) // 每天循环
  }, delay)
}

export function startScheduler() {
  if (started) return
  started = true
  log('定时推送已启动。时段:', config.scheduler.slots)
  scheduleSlot('morning')
  scheduleSlot('noon')
  scheduleSlot('evening')
}
