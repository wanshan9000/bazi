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

const EMPTY_DB = () => ({ subscribers: [], verifies: [], shares: [], adminSkills: [], articles: [], refunds: [], complaints: [] })

function load() {
  if (cache) return cache
  ensureFile()
  let raw = null
  try {
    raw = fs.readFileSync(config.storeFile, 'utf-8')
    cache = { ...EMPTY_DB(), ...JSON.parse(raw) }
  } catch (e) {
    // ⚠ 这里原先直接 `cache = { subscribers: [], verifies: [] }` 就算完 ——
    // 解析一失败就静默把整个库当空的，接着任何一次 save() 会把这个空对象写回去，
    // 订阅者、分享、管理技能一次性全没，而且连 shares/adminSkills 两个键都丢了。
    // 现在：先把损坏的文件另存一份再继续，至少数据还能人工捞回来，日志也留痕。
    if (raw != null) {
      const bak = `${config.storeFile}.corrupt-${Date.now()}`
      try {
        fs.writeFileSync(bak, raw)
        console.error(`[store] 数据文件解析失败，已备份到 ${bak}：${e.message}`)
      } catch (e2) {
        console.error(`[store] 数据文件解析失败且备份也失败：${e.message} / ${e2.message}`)
      }
    }
    cache = EMPTY_DB()
  }
  return cache
}

/**
 * 落盘。
 *
 * ⚠ 原实现是对目标文件直接 writeFileSync：写到一半进程被杀（部署重启、OOM）就会
 * 留下一个截断的 JSON，下次 load 解析失败 → 整库当空 → 再一次 save 彻底覆盖。
 * 改为「写同目录临时文件 + rename」。同一文件系统内 rename 是原子的，
 * 读者要么看到旧内容要么看到新内容，不会看到写了一半的中间态。
 */
function save() {
  ensureFile()
  const tmp = `${config.storeFile}.tmp-${process.pid}`
  const data = JSON.stringify(cache, null, 2)
  try {
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, config.storeFile)
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }) } catch { /* ignore */ }
    throw e
  }
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
    attempts: 0,
  }
  // 清除同手机号的旧验证码，避免堆积
  db.verifies = db.verifies.filter(v => v.phone !== phone)
  db.verifies.push(record)
  save()
  return record
}

// 单条验证码允许的错误尝试次数。6 位数字只有 100 万种组合，没有次数限制的话
// 在有效期内脚本几分钟就能枚举完，短信验证形同虚设。
const MAX_VERIFY_ATTEMPTS = 5

// 校验验证码（一次性），成功即失效
export function verifyCode(phone, code) {
  const db = load()
  const v = db.verifies.find(r => r.phone === phone && !r.used)
  if (!v) return { ok: false, reason: 'NO_CODE' }
  if (now() - v.createdAt > v.ttl) return { ok: false, reason: 'EXPIRED' }
  if ((v.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    // 作废这条码，逼对方重新发送（发送侧有冷却，构成整体速率限制）
    v.used = true
    save()
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' }
  }
  if (v.code !== String(code)) {
    v.attempts = (v.attempts || 0) + 1
    save()
    return { ok: false, reason: 'MISMATCH', remaining: MAX_VERIFY_ATTEMPTS - v.attempts }
  }
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
export function findByUserId(userId, channel = '') {
  return load().subscribers.find(s => s.userId === userId && (!channel || s.channel === channel)) || null
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
  db.shares = db.shares.filter(s => now() - s.createdAt < shareTtlMs())
  // 相同内容复用已有短码，避免重复堆积
  const existing = db.shares.find(s => s.payload === report.payload)
  if (existing) return existing.id
  const id = genId()
  db.shares.push({ id, payload: report.payload, createdAt: now() })
  save()
  return id
}

/** 分享有效期（毫秒）。默认 30 天。 */
function shareTtlMs() {
  return config.share?.ttlDays ? config.share.ttlDays * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
}

export function getShare(id) {
  const db = load()
  if (!Array.isArray(db.shares)) return null
  const rec = db.shares.find(s => s.id === id)
  if (!rec) return null
  // ⚠ 过期判断原先只在 saveShare 里做，也就是说「要等到下一个人新建分享」才会清理。
  // 在那之前，一条早该失效的分享仍然照常返回内容，而接口文案却写着「已过期」。
  if (now() - rec.createdAt >= shareTtlMs()) return null
  return rec.payload
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

// ---- 文库文章（后台发布，全站公开阅读）----
function articles() {
  const db = load()
  if (!Array.isArray(db.articles)) db.articles = []
  return db.articles
}

export function listArticles({ publishedOnly = false, includeDeleted = false } = {}) {
  return articles()
    .filter(article => (includeDeleted || article.status !== 'deleted') && (!publishedOnly || article.status === 'published'))
    .slice()
    .sort((a, b) => (b.publishedAt || b.updatedAt || 0) - (a.publishedAt || a.updatedAt || 0))
}

export function findArticle(id) {
  return articles().find(article => article.id === id) || null
}

export function upsertArticle(article) {
  const arr = articles()
  const idx = arr.findIndex(item => item.id === article.id)
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...article, createdAt: arr[idx].createdAt }
  } else {
    arr.push({ ...article, createdAt: now() })
  }
  save()
  return idx >= 0 ? arr[idx] : arr[arr.length - 1]
}

export function deleteArticle(id) {
  const arr = articles()
  const before = arr.length
  const next = arr.filter(article => article.id !== id)
  arr.length = 0
  arr.push(...next)
  save()
  return next.length < before
}

// ---- 会员服务工单（退款 / 投诉）----
function refunds() {
  const db = load()
  if (!Array.isArray(db.refunds)) db.refunds = []
  return db.refunds
}

function complaints() {
  const db = load()
  if (!Array.isArray(db.complaints)) db.complaints = []
  return db.complaints
}

function serviceId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function listRefunds() {
  return refunds().slice().sort((a, b) => b.createdAt - a.createdAt)
}

export function createRefund(record) {
  const item = { id: serviceId('refund'), status: 'pending', createdAt: now(), updatedAt: now(), ...record }
  refunds().push(item)
  save()
  return item
}

export function updateRefund(id, patch) {
  const item = refunds().find(record => record.id === id)
  if (!item) return null
  Object.assign(item, patch, { updatedAt: now() })
  save()
  return item
}

export function listComplaints() {
  return complaints().slice().sort((a, b) => b.createdAt - a.createdAt)
}

export function createComplaint(record) {
  const item = { id: serviceId('complaint'), status: 'open', createdAt: now(), updatedAt: now(), ...record }
  complaints().push(item)
  save()
  return item
}

export function updateComplaint(id, patch) {
  const item = complaints().find(record => record.id === id)
  if (!item) return null
  Object.assign(item, patch, { updatedAt: now() })
  save()
  return item
}
