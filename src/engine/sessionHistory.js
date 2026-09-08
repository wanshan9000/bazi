// 会话历史存储：localStorage 持久化，记录每一次「元氣AI」会话，供用户找回历史会话
// 按登录用户隔离（userScope）：不同账号的历史互不串台；游客使用 base key
import { localKey, sessionKey } from './userScope.js'

const KEY_BASE = 'yqmm_agent_sessions_v1'
// 当前会话标记：sessionStorage 持久化（仅当前标签页），保证刷新/切换视图后
// 在同一会话内继续说话仍归入同一条历史；只有「新建会话」才重置为新历史
const CUR_BASE = 'yqmm_agent_current_session'
const MAX = 30

function key() { return localKey(KEY_BASE) }
function curKey() { return sessionKey(CUR_BASE) }

function safeGet() {
  try {
    const raw = localStorage.getItem(key())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function safeSet(list) {
  try {
    localStorage.setItem(key(), JSON.stringify(list))
  } catch {
    // 超出配额：丢弃最旧的，重试一次
    try {
      localStorage.setItem(key(), JSON.stringify(list.slice(0, Math.floor(list.length / 2))))
    } catch { /* ignore */ }
  }
}

export function loadSessions() {
  return safeGet()
}

export function getSession(id) {
  return safeGet().find(s => s.id === id) || null
}

// 新增或更新会话（同 id 更新，否则插入到最前），并裁剪数量
export function upsertSession(session) {
  const list = safeGet()
  const i = list.findIndex(s => s.id === session.id)
  if (i >= 0) list[i] = session
  else list.unshift(session)
  while (list.length > MAX) list.pop()
  safeSet(list)
  return session
}

export function deleteSession(id) {
  const list = safeGet().filter(s => s.id !== id)
  safeSet(list)
  return list
}

export function clearSessions() {
  safeSet([])
  return []
}

// 清理最早的会话：仅保留最近 keep 条（按列表顺序，新在前旧在后），删除更早的
export function deleteOldestSessions(keep) {
  const list = safeGet()
  const keepN = Math.max(0, Math.floor(keep))
  if (list.length <= keepN) return list
  const next = list.slice(0, keepN)
  safeSet(next)
  return next
}

// 清理指定时间点之前的会话（createdAt 早于 ts 的删除），返回剩余列表
export function pruneSessionsBefore(ts) {
  const list = safeGet()
  const next = list.filter(s => (s.createdAt || 0) >= ts)
  if (next.length !== list.length) safeSet(next)
  return next
}

// —— 当前会话标记：跨刷新/重挂载保持"同一会话 = 同一条历史" ——
export function loadCurrentSession() {
  try {
    const raw = sessionStorage.getItem(curKey())
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveCurrentSession(id, createdAt) {
  try {
    sessionStorage.setItem(curKey(), JSON.stringify({ id, createdAt }))
  } catch { /* ignore */ }
}

export function clearCurrentSession() {
  try {
    sessionStorage.removeItem(curKey())
  } catch { /* ignore */ }
}
