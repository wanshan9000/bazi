// 命盘收藏管理：localStorage 存已收藏的命盘，可切换/查看/对比
// 借鉴 taibu 等多盘管理思路，让用户能保存多个命盘（自己/家人/朋友）持续对话
// 按登录用户隔离（userScope）：不同账号的收藏互不串台
import { localKey } from './userScope.js'

const COLLECTION_BASE = 'genki-chart-collection'
const MAX_ITEMS = 12

// 读取已收藏命盘
export function listCollection() {
  try {
    const raw = localStorage.getItem(localKey(COLLECTION_BASE))
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

// 添加/更新收藏。chart 为 buildChart 结果
export function saveToCollection(chart, label) {
  if (!chart || !chart.pillars || chart.pillars.length !== 4) return false
  const list = listCollection()
  const item = {
    id: `${chart.year}-${chart.month}-${chart.day}-${chart.hour ?? 12}-${chart.gender}-${label || ''}`,
    label: label || defaultLabel(chart),
    year: chart.year, month: chart.month, day: chart.day,
    hour: chart.hour ?? 12, gender: chart.gender,
    savedAt: Date.now()
  }
  // 去重（同 id 不重复添加）
  const filtered = list.filter(it => it.id !== item.id)
  filtered.unshift(item)
  if (filtered.length > MAX_ITEMS) filtered.length = MAX_ITEMS
  try { localStorage.setItem(localKey(COLLECTION_BASE), JSON.stringify(filtered)) } catch { return false }
  return true
}

// 从收藏中删除
export function removeFromCollection(id) {
  const list = listCollection().filter(it => it.id !== id)
  try { localStorage.setItem(localKey(COLLECTION_BASE), JSON.stringify(list)) } catch { return false }
  return true
}

// 查找某命盘是否已收藏
export function isInCollection(chart) {
  if (!chart) return null
  const id = `${chart.year}-${chart.month}-${chart.day}-${chart.hour ?? 12}-${chart.gender}`
  return listCollection().find(it => it.id === id) || null
}

function defaultLabel(chart) {
  return `${chart.gender === '女' ? '女' : '男'}·${chart.year}年${chart.month}月${chart.day}日`
}

export default { listCollection, saveToCollection, removeFromCollection, isInCollection }
