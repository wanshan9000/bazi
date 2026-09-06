// agent 会话索引 + 消息镜像（JSON 文件，与 store.js 同风格；dsh 自己的 JSONL 是权威日志，这里只做前端展示用）
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { DSH_HOME } from './setup.mjs'

/**
 * 删除 dsh 侧该会话的日志目录。
 *
 * ⚠ 删会话此前只清了这份镜像索引，dsh 自己的 session.jsonl（里面是完整对话正文
 * 与命盘）一个都没删：用户点了「删除」，数据其实还在盘上；而且随着会话不断新建
 * 与淘汰，这个目录只增不减，磁盘无界增长。
 *
 * 目录布局：<DSH_HOME>/sessions/<profile-key>/<sessionId>/session.jsonl
 * profile-key 由 dsh 依 profile 路径生成，这里不做假设，直接逐个 profile 目录找。
 */
function removeDshSessionDir(sessionId) {
  if (!sessionId) return
  const root = path.join(DSH_HOME, 'sessions')
  let profiles
  try { profiles = fs.readdirSync(root, { withFileTypes: true }) } catch { return }
  for (const p of profiles) {
    if (!p.isDirectory()) continue
    const dir = path.join(root, p.name, sessionId)
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    } catch (e) {
      // 删不掉不该影响主流程（会话索引已经删了），但要留痕以便排查磁盘占用
      console.error(`[agentStore] 清理 dsh 会话目录失败 ${dir}: ${e.message}`)
    }
  }
}

const MAX_MESSAGES = 200
const MAX_SESSIONS_PER_USER = 50

export function createAgentStore(file) {
  let db = null
  function load() {
    if (db) return db
    let raw = null
    try {
      raw = fs.readFileSync(file, 'utf8')
      db = JSON.parse(raw)
    } catch (e) {
      // 文件不存在是正常的首次启动；能读到内容却解析不了，说明文件坏了 ——
      // 此前这里静默当空库，随后任何一次 save() 就把全部会话覆盖没了。
      // 先备份再继续，数据至少还能人工捞回来。
      if (raw != null) {
        const bak = `${file}.corrupt-${Date.now()}`
        try {
          fs.writeFileSync(bak, raw)
          console.error(`[agentStore] 会话索引解析失败，已备份到 ${bak}：${e.message}`)
        } catch (e2) {
          console.error(`[agentStore] 会话索引解析失败且备份也失败：${e.message} / ${e2.message}`)
        }
      }
      db = { sessions: [], messages: {} }
    }
    if (!Array.isArray(db.sessions)) db.sessions = []
    if (!db.messages || typeof db.messages !== 'object') db.messages = {}
    return db
  }
  // 临时文件 + rename：整文件覆盖写到一半被杀会留下截断的 JSON，
  // 下次启动解析失败就等于全量会话丢光。rename 在同一文件系统内是原子的。
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp-${process.pid}`
    try {
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
      fs.renameSync(tmp, file)
    } catch (e) {
      try { fs.rmSync(tmp, { force: true }) } catch { /* ignore */ }
      throw e
    }
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
      while (mine.length > MAX_SESSIONS_PER_USER) {
        const old = mine.shift()
        d.sessions = d.sessions.filter(x => x.id !== old.id)
        delete d.messages[old.id]
        removeDshSessionDir(old.id) // 淘汰旧会话时，dsh 侧的日志也要一起清
      }
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
    /**
     * 把 fromUid 名下的会话整体过户给 toUid。
     * 用于「游客聊了一阵子再登录」：不这么做的话，uid 从 anon:xxx 变成账号 id 之后，
     * 之前的会话就再也看不到了，用户以为聊天记录丢了。
     * 只允许从匿名 uid 认领，避免变成一个把别人会话搬走的接口。
     */
    claimSessions(fromUid, toUid) {
      if (!fromUid || !toUid || fromUid === toUid) return 0
      if (!String(fromUid).startsWith('anon:')) return 0
      const d = load()
      let n = 0
      for (const s of d.sessions) {
        if (s.uid === fromUid) { s.uid = toUid; n++ }
      }
      if (n) save()
      return n
    },
    /** 注销账号时连坐清除该用户的全部会话与消息（隐私合规要求） */
    deleteAllSessions(uid) {
      if (!uid) return 0
      const d = load()
      const mine = d.sessions.filter(s => s.uid === uid)
      if (!mine.length) return 0
      d.sessions = d.sessions.filter(s => s.uid !== uid)
      for (const s of mine) {
        delete d.messages[s.id]
        removeDshSessionDir(s.id)
      }
      save()
      return mine.length
    },
    deleteSession(uid, id) {
      const d = load()
      const before = d.sessions.length
      d.sessions = d.sessions.filter(s => !(s.uid === uid && s.id === id))
      const removed = d.sessions.length < before
      // 只有确实删掉了「本人的」会话才清消息：否则任何人只要猜到 id
      // 就能把别人的消息镜像删空（会话仍在，历史却没了）。
      if (!removed) return false
      delete d.messages[id]
      save()
      removeDshSessionDir(id) // 用户点了删除，dsh 侧的完整对话日志也必须删掉
      return true
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
