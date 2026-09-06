/* ============ 已购记录（按「用户 + 功能 + 命盘」去重扣费） ============
 *
 * 背景：八字/紫微完整命书的扣费写在组件的 useEffect 里，"这次已经扣过了"只记在
 * 一个 useRef 上。useRef 随组件挂载重置，用户返回首页再点回来就是一次全新挂载 →
 * 同一张命盘的同一份报告被反复扣 8 积分，用户完全看不出钱是怎么没的。
 *
 * 正确的口径是：一份报告 = 一次消费。对同一个用户、同一张命盘、同一个功能，
 * 只在第一次生成时扣分，之后无论重进多少次页面、跨不跨会话，都直接放行。
 *
 * 记录存在 localStorage（与用户体系同为本地演示实现）。服务端化时这张表应当
 * 随积分余额一起搬到后端，由服务端校验，否则清掉本地存储即可白嫖。
 */

const KEY = 'sanmen-entitlements'
const MAX_ENTRIES = 500

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : null
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

function write(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch { /* 隐私模式等写不进去：退化成「每次都扣」以外的行为不做保证 */ }
}

/** 命盘身份：出生要素唯一确定一张盘。chart 为空时返回 null（无盘不计费）。 */
export function chartKeyOf(chart) {
  if (!chart) return null
  const { year, month, day, hour, gender } = chart
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}-${hour ?? 12}-${gender || '男'}`
}

function entryKey(userId, featureKey, chartKey) {
  return `${userId}|${featureKey}|${chartKey}`
}

/** 该用户是否已为这张盘的这个功能付过费 */
export function hasPaid(userId, featureKey, chart) {
  const chartKey = chartKeyOf(chart)
  if (!userId || !chartKey) return false
  return !!read()[entryKey(userId, featureKey, chartKey)]
}

/** 记下一次成功扣费。超出上限时按写入时间淘汰最旧的记录。 */
export function markPaid(userId, featureKey, chart) {
  const chartKey = chartKeyOf(chart)
  if (!userId || !chartKey) return
  const map = read()
  map[entryKey(userId, featureKey, chartKey)] = Date.now()
  const keys = Object.keys(map)
  if (keys.length > MAX_ENTRIES) {
    keys.sort((a, b) => map[a] - map[b])
    for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[k]
  }
  write(map)
}

/** 退出登录/切换账号时清理（仅测试与账号注销用，正常流程不需要） */
export function clearPaid(userId) {
  if (!userId) return
  const map = read()
  for (const k of Object.keys(map)) if (k.startsWith(`${userId}|`)) delete map[k]
  write(map)
}
