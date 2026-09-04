// 订阅存储：基于 JSON 文件的轻量持久化，便于直接部署上线。
// 若要上生产大规模使用，可替换为 Redis / MySQL / MongoDB，接口保持一致。
import fs from 'fs'
import path from 'path'
import { config } from './config.js'

let cache = null

function ensureFile() {
  if (!fs.existsSync(config.storeFile)) {
    fs.mkdirSync(path.dirname(config.storeFile), { recursive: true })
    fs.writeFileSync(config.storeFile, JSON.stringify({ subscribers: [], verifies: [], shares: [] }, null, 2))
  }
}

function load() {
  if (cache) return cache
  ensureFile()
  try {
    cache = JSON.parse(fs.readFileSync(config.storeFile, 'utf-8'))
  } catch {
    cache = { subscribers: [], verifies: [] }
  }
  return cache
}

function save() {
  ensureFile()
  fs.writeFileSync(config.storeFile, JSON.stringify(cache, null, 2))
}

const now = () => Date.now()

// ---- 验证码 ----
export function createVerify(phone, code) {
  const db = load()
  const record = {
    phone,
    code,
    createdAt: now(),
    ttl: config.sms.codeTtlMin * 60 * 1000,
    used: false,
  }
  // 清除同手机号的旧验证码，避免堆积
  db.verifies = db.verifies.filter(v => v.phone !== phone)
  db.verifies.push(record)
  save()
  return record
}

// 校验验证码（一次性），成功即失效
export function verifyCode(phone, code) {
  const db = load()
  const v = db.verifies.find(r => r.phone === phone && !r.used)
  if (!v) return { ok: false, reason: 'NO_CODE' }
  if (now() - v.createdAt > v.ttl) return { ok: false, reason: 'EXPIRED' }
  if (v.code !== String(code)) return { ok: false, reason: 'MISMATCH' }
  v.used = true
  save()
  return { ok: true }
}

// 发送频率限制：距上次发送不足 cooldown 秒则拒绝
export function lastSendAt(phone) {
  const db = load()
  const v = db.verifies.find(r => r.phone === phone)
  return v ? v.createdAt : 0
}

// ---- 订阅者 ----
export function findByPhone(phone) {
  return load().subscribers.find(s => s.channel === 'sms' && s.phone === phone) || null
}
export function findByOpenid(openid) {
  return load().subscribers.find(s => s.channel === 'wechat' && s.openid === openid) || null
}
export function findByToken(token) {
  return load().subscribers.find(s => s.token === token) || null
}

export function listSubscribers() {
  return load().subscribers
}

export function upsertSubscriber(sub) {
  const db = load()
  const idx = db.subscribers.findIndex(
    s => (sub.channel === 'sms' ? s.phone === sub.phone : s.openid === sub.openid)
  )
  if (idx >= 0) {
    db.subscribers[idx] = { ...db.subscribers[idx], ...sub }
  } else {
    db.subscribers.push({ ...sub, createdAt: now() })
  }
  save()
  return idx >= 0 ? db.subscribers[idx] : db.subscribers[db.subscribers.length - 1]
}

export function updateSubscriber(predicate, patch) {
  const db = load()
  const sub = db.subscribers.find(predicate)
  if (!sub) return null
  Object.assign(sub, patch)
  save()
  return sub
}

export function deleteSubscriber(predicate) {
  const db = load()
  const before = db.subscribers.length
  db.subscribers = db.subscribers.filter(s => !predicate(s))
  save()
  return db.subscribers.length < before
}

// ---- 报告分享（短链）----
// 短 ID 仅用 [0-9a-z]，避免 URL 中出现歧义字符
const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'
function genId(len = 7) {
  let id = ''
  for (let i = 0; i < len; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]
  return id
}

export function saveShare(report) {
  const db = load()
  if (!Array.isArray(db.shares)) db.shares = []
  // 清理过期分享（默认 30 天）
  const ttl = config.share?.ttlDays ? config.share.ttlDays * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
  db.shares = db.shares.filter(s => now() - s.createdAt < ttl)
  // 相同内容复用已有短码，避免重复堆积
  const existing = db.shares.find(s => s.payload === report.payload)
  if (existing) return existing.id
  const id = genId()
  db.shares.push({ id, payload: report.payload, createdAt: now() })
  save()
  return id
}

export function getShare(id) {
  const db = load()
  if (!Array.isArray(db.shares)) return null
  const rec = db.shares.find(s => s.id === id)
  return rec ? rec.payload : null
}

// ---- 管理后台：自定义技能（管理员导入，全站共享）----
function skills() {
  const db = load()
  if (!Array.isArray(db.adminSkills)) db.adminSkills = []
  return db.adminSkills
}

export function listSkills() {
  return skills().slice()
}

export function findSkill(key) {
  return skills().find(s => s.key === key) || null
}

// upsert：存在同 key 则整体覆盖（保留 createdAt），否则新增
export function upsertSkill(skill) {
  const arr = skills()
  const idx = arr.findIndex(s => s.key === skill.key)
  if (idx >= 0) {
    arr[idx] = { ...skill, createdAt: arr[idx].createdAt }
  } else {
    arr.push({ ...skill, createdAt: now() })
  }
  save()
  return idx >= 0 ? arr[idx] : arr[arr.length - 1]
}

export function deleteSkill(key) {
  const arr = skills()
  const before = arr.length
  // 原地改写，避免破坏 cache 引用
  const next = arr.filter(s => s.key !== key)
  arr.length = 0
  arr.push(...next)
  save()
  return next.length < before
}
