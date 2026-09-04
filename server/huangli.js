// 服务端黄历生成：复用前端纯 JS 引擎（src/engine/huangli.js + src/engine/bazi.js）。
// 用于每日定时推送时计算订阅者当日的个性化黄历。
import { buildDaily } from '../src/engine/huangli.js'
import { buildChart } from '../src/engine/bazi.js'

// 组装订阅者生日 → chart
export function chartFromSubscriber(sub) {
  if (!sub.birth) return null
  const b = sub.birth
  return buildChart(b.year, b.month, b.day, b.hour, b.gender)
}

// 生成当日推送文本
export function buildPushContent(sub) {
  const chart = chartFromSubscriber(sub)
  const today = new Date()
  const d = buildDaily(today, chart)
  const mode = d.action?.mode || '顺势而为'
  const relation = d.relation === '顺' ? '顺' : d.relation === '慎' ? '慎' : '平'
  const yi = (d.yi || []).slice(0, 3).join('、')
  const ji = (d.ji || []).slice(0, 3).join('、')
  const fav = sub.favZodiac && sub.favZodiac.length
    ? ` 关注生肖「${sub.favZodiac.join('、')}」今日运势: ${d.theme}`
    : ''
  const summary = `今日${relation}·宜${yi}${ji ? '·忌' + ji : ''}。${d.action?.body || ''}${fav}`

  return {
    title: `${d.date} 今日黄历`,
    mode,
    relation,
    summary,
    tip: d.theme,
    text: `【元气黄历】${d.date} ${d.week}。今日五行与你${relation}，宜${yi}，忌${ji}。${d.action?.head || ''}${fav}`,
  }
}
