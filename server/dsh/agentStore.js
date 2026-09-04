// agent 会话索引 + 消息镜像（JSON 文件，与 store.js 同风格；dsh 自己的 JSONL 是权威日志，这里只做前端展示用）
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const MAX_MESSAGES = 200
const MAX_SESSIONS_PER_USER = 50

export function createAgentStore(file) {
  let db = null
  function load() {
    if (db) return db
    try { db = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { db = { sessions: [], messages: {} } }
    if (!Array.isArray(db.sessions)) db.sessions = []
    if (!db.messages || typeof db.messages !== 'object') db.messages = {}
    return db
  }
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(db, null, 2))
  }
  const own = (uid, id) => load().sessions.find(s => s.uid === uid && s.id === id) || null

  return {
    listSessions(uid) {
      return load().sessions.filter(s => s.uid === uid).sort((a, b) => b.updatedAt - a.updatedAt)
    },
    getSession(uid, id) { return own(uid, id) },
    createSession(uid, { route, title = '新会话', chartKey = null } = {}) {
      const d = load()
      const now = Date.now()
      const s = { id: randomUUID(), uid, route, title, chartKey, createdAt: now, updatedAt: now, messageCount: 0 }
      d.sessions.push(s)
      // 按 updatedAt 排序，删除最旧的会话（mine 是副本，d.sessions 才是真实数据源）
      const mine = d.sessions.filter(x => x.uid === uid).sort((a, b) => a.updatedAt - b.updatedAt)
      while (mine.length > MAX_SESSIONS_PER_USER) { const old = mine.shift(); d.sessions = d.sessions.filter(x => x.id !== old.id); delete d.messages[old.id] }
      save()
      return s
    },
    updateSession(uid, id, patch) {
      const s = own(uid, id)
      if (!s) return null
      Object.assign(s, patch, { updatedAt: Date.now() })
      save()
      return s
    },
    appendMessage(uid, id, msg) {
      const s = own(uid, id)
      if (!s) return null
      const d = load()
      const list = d.messages[id] || (d.messages[id] = [])
      list.push(msg)
      while (list.length > MAX_MESSAGES) list.shift()
      s.messageCount = list.length
      s.updatedAt = Date.now()
      save()
      return msg
    },
    listMessages(uid, id) { return own(uid, id) ? (load().messages[id] || []).slice() : [] },
    deleteSession(uid, id) {
      const d = load()
      const before = d.sessions.length
      d.sessions = d.sessions.filter(s => !(s.uid === uid && s.id === id))
      delete d.messages[id]
      save()
      return d.sessions.length < before
    },
  }
}

let shared = null
export function sharedStore() {
  if (!shared) {
    const here = path.dirname(fileURLToPath(import.meta.url))
    shared = createAgentStore(process.env.AGENT_STORE_FILE || path.join(here, '..', 'data', 'agent_sessions.json'))
  }
  return shared
}
