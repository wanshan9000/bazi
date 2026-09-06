// 定时推送：按订阅者选择的时段(晨起/午间/晚归)每天推送当日黄历。
// 短信通道 + 微信模板消息双通道，可独立开关。
import { config } from './config.js'
import { listSubscribers } from './store.js'
import { buildPushContent } from './huangli.js'
import { sendDailyPush } from './sms.js'
import { sendWxTemplate } from './wechat.js'

let started = false
const timers = new Map()
const log = (...a) => console.log('[推送]', ...a)

/**
 * 下一次该时段触发的绝对时刻。
 *
 * ⚠ 必须严格落在 `from` 之后。早先版本按"距离目标还有几分钟"算延时，命中当分钟时
 * 差值为 0 → setTimeout(0) 立刻回调 → 回调末尾又重新排程、差值仍是 0，于是在目标
 * 那一分钟里空转重入，把该时段的订阅者连环推送成百上千次（真实短信通道下就是账单事故）。
 * 用绝对时刻算，且 `<=` 时推到明天，就不可能再排出 0 延时。
 */
export function nextRunAt(hhmm, from = new Date()) {
  const [h, m] = String(hhmm).split(':').map(Number)
  const at = new Date(from)
  at.setHours(h || 0, m || 0, 0, 0)
  if (at.getTime() <= from.getTime()) at.setDate(at.getDate() + 1)
  return at
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
  const at = nextRunAt(hhmm)
  const t = setTimeout(() => {
    log(`开始推送时段 [${slotKey}] ${hhmm}`)
    const subs = listSubscribers().filter(s => s.enabled !== false && s.time === slotKey)
    for (const s of subs) pushSubscriber(s)
    scheduleSlot(slotKey) // 每天循环
  }, at.getTime() - Date.now())
  // 定时器不应把进程钉住：没有别的活儿时让 node 正常退出。
  if (typeof t.unref === 'function') t.unref()
  timers.set(slotKey, t)
  log(`时段 [${slotKey}] 下次推送：${at.toLocaleString('zh-CN')}`)
}

export function startScheduler() {
  if (started) return
  started = true
  log('定时推送已启动。时段:', config.scheduler.slots)
  scheduleSlot('morning')
  scheduleSlot('noon')
  scheduleSlot('evening')
}

export function stopScheduler() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  started = false
}
