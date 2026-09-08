// 统一风控：将各路由自己的限流结果收敛成可处置的风险事件。
//
// 这里只记录经 HMAC 处理后的来源指纹，不把访客 IP 写进业务数据文件。它并不替代
// CDN/WAF 的 DDoS 防护，但能拦住注册、验证码、模型接口上的持续脚本滥用，并让
// 管理员有证据可查、有入口可解除误封。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config, resolveJwtSecret } from './config.js'

const EMPTY_DB = () => ({ blocks: [], events: [] })

function actionOf(pathname = '') {
  if (pathname === '/auth/register') return '注册'
  if (pathname === '/auth/login' || pathname === '/admin/auth') return '登录'
  if (pathname.startsWith('/auth/plan')) return '订阅开通'
  if (pathname.startsWith('/sms/')) return '短信订阅'
  if (pathname.startsWith('/wechat/')) return '微信订阅'
  if (pathname.startsWith('/agent/chat')) return 'AI 对话'
  if (pathname.startsWith('/share')) return '报告分享'
  return '接口访问'
}

function reasonOf(status) {
  if (status === 429) return '触发频率限制'
  if (status === 401) return '鉴权失败'
  if (status === 403) return '权限或安全策略拒绝'
  if (status === 413) return '提交内容过大'
  if (status >= 400) return '请求校验失败'
  return ''
}

function scoreOf({ path, status }) {
  if (status === 429) return 3
  if (status === 413) return 3
  if (status === 401 && (path === '/auth/login' || path === '/admin/auth')) return 2
  if (status === 400 && (path.startsWith('/sms/') || path === '/auth/register')) return 1
  if (status === 409 && path === '/agent/chat') return 1
  return 0
}

export function createSecurityGuard(options = {}) {
  const file = options.file || config.security.riskStoreFile
  const now = options.now || (() => Date.now())
  const blockThreshold = options.blockThreshold || config.security.riskBlockThreshold
  const strikeWindowMs = (options.strikeWindowMin || config.security.riskWindowMin) * 60000
  const blockMs = (options.blockMinutes || config.security.riskBlockMinutes) * 60000
  const keepEvents = options.keepEvents || config.security.riskEventKeep
  const secret = options.secret || resolveJwtSecret()
  const strikes = new Map()
  let cache = null

  function fingerprint(ip) {
    // 指纹只能用来和下一次请求比对，离开签名密钥就不能倒推真实 IP。
    return crypto.createHmac('sha256', secret).update(String(ip || 'unknown')).digest('hex').slice(0, 16)
  }

  function load() {
    if (cache) return cache
    try {
      if (!fs.existsSync(file)) { cache = EMPTY_DB(); return cache }
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
      cache = { ...EMPTY_DB(), ...parsed }
      if (!Array.isArray(cache.blocks)) cache.blocks = []
      if (!Array.isArray(cache.events)) cache.events = []
    } catch (error) {
      // 风控日志出问题不能让正常业务无法运行，但必须留下恢复线索。
      console.error('[security] 风控数据读取失败，将使用空记录：', error.message)
      cache = EMPTY_DB()
    }
    return cache
  }

  function save() {
    const db = load()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp-${process.pid}`
    try {
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, file)
    } catch (error) {
      try { fs.rmSync(tmp, { force: true }) } catch { /* ignore */ }
      console.error('[security] 风控数据写入失败：', error.message)
    }
  }

  function clean(timestamp = now()) {
    const db = load()
    const before = db.blocks.length
    db.blocks = db.blocks.filter(item => item.expiresAt > timestamp)
    // 安全事件只保留最近一段，不能因探测流量让 JSON 文件无限增长。
    if (db.events.length > keepEvents) db.events = db.events.slice(-keepEvents)
    if (db.blocks.length !== before) save()
  }

  function addEvent(event) {
    const db = load()
    db.events.push({ id: crypto.randomBytes(8).toString('hex'), at: now(), ...event })
    if (db.events.length > keepEvents) db.events = db.events.slice(-keepEvents)
    save()
  }

  function activeBlock(source) {
    clean()
    return load().blocks.find(item => item.fingerprint === source && item.expiresAt > now()) || null
  }

  function block(fingerprintValue, { minutes = config.security.riskManualBlockMinutes, reason = '管理员临时封禁' } = {}) {
    const source = String(fingerprintValue || '').trim()
    if (!/^[a-f0-9]{16}$/.test(source)) return { ok: false, msg: '来源指纹无效' }
    const duration = Math.max(1, Math.min(Number(minutes) || 0, 7 * 24 * 60))
    const db = load()
    const item = {
      fingerprint: source,
      reason: String(reason || '管理员临时封禁').trim().slice(0, 120),
      createdAt: now(),
      expiresAt: now() + duration * 60000,
      manual: true,
    }
    const index = db.blocks.findIndex(existing => existing.fingerprint === source)
    if (index >= 0) db.blocks[index] = item
    else db.blocks.push(item)
    addEvent({ type: 'manual_block', fingerprint: source, action: '人工处置', status: 403, reason: item.reason })
    return { ok: true, block: item }
  }

  function unblock(fingerprintValue) {
    const source = String(fingerprintValue || '').trim()
    const db = load()
    const before = db.blocks.length
    db.blocks = db.blocks.filter(item => item.fingerprint !== source)
    if (before === db.blocks.length) return false
    addEvent({ type: 'manual_unblock', fingerprint: source, action: '人工处置', status: 200, reason: '已解除封禁' })
    return true
  }

  function note({ ip, path, status, userId = '' }) {
    const score = scoreOf({ path, status })
    if (!score) return
    const source = fingerprint(ip)
    const timestamp = now()
    for (const [key, rec] of strikes) if (rec.resetAt <= timestamp) strikes.delete(key)
    const rec = strikes.get(source)
    const next = !rec || rec.resetAt <= timestamp
      ? { score, resetAt: timestamp + strikeWindowMs }
      : { score: rec.score + score, resetAt: rec.resetAt }
    strikes.set(source, next)
    addEvent({ type: 'risk', fingerprint: source, action: actionOf(path), path, status, reason: reasonOf(status), score, userId: userId || undefined })

    if (next.score < blockThreshold || activeBlock(source)) return
    const db = load()
    const autoBlock = {
      fingerprint: source,
      reason: `${actionOf(path)}持续异常，已自动保护`,
      createdAt: timestamp,
      expiresAt: timestamp + blockMs,
      manual: false,
    }
    db.blocks = db.blocks.filter(item => item.fingerprint !== source)
    db.blocks.push(autoBlock)
    db.events.push({ id: crypto.randomBytes(8).toString('hex'), at: timestamp, type: 'auto_block', fingerprint: source, action: actionOf(path), path, status: 403, reason: autoBlock.reason, score: next.score })
    if (db.events.length > keepEvents) db.events = db.events.slice(-keepEvents)
    save()
  }

  function middleware(req, res, next) {
    // 风控控制台本身必须在被误封时可用；路由内仍会执行管理员鉴权。
    if (req.path.startsWith('/admin/security')) return next()
    const source = fingerprint(req.ip)
    const blocked = activeBlock(source)
    if (blocked) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((blocked.expiresAt - now()) / 1000)))
      return res.status(403).json({ ok: false, msg: '当前网络请求异常，已临时限制，请稍后再试' })
    }
    res.on('finish', () => note({ ip: req.ip, path: req.path, status: res.statusCode, userId: req.uid }))
    next()
  }

  function snapshot() {
    clean()
    const db = load()
    const since = now() - 24 * 60 * 60000
    const recent = db.events.filter(item => item.at >= since)
    return {
      blocks: db.blocks.slice().sort((a, b) => b.expiresAt - a.expiresAt),
      events: db.events.slice().sort((a, b) => b.at - a.at).slice(0, 120),
      overview: {
        blocked: db.blocks.length,
        riskEvents24h: recent.filter(item => item.type === 'risk').length,
        autoBlocks24h: recent.filter(item => item.type === 'auto_block').length,
      },
    }
  }

  return { middleware, note, block, unblock, snapshot, fingerprint, _dump: () => load() }
}

let singleton = null
export function sharedSecurityGuard() {
  if (!singleton) singleton = createSecurityGuard()
  return singleton
}

