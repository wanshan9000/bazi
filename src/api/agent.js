// 元氣 AI 前端客户端：POST /api/agent/chat（SSE）+ 会话接口
//
// 身份：登录用户带 Authorization: Bearer <jwt>，游客带自报的 anon:* 标识。
// 服务端不再接受自报的账号 uid（那等于谁都能读别人的会话）。
import { authHeader, getToken } from './auth.js'

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || ''

export function parseSseChunks() {
  let buf = ''
  return {
    feed(text) {
      buf += text
      const out = []
      let idx
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try { out.push(JSON.parse(line.slice(6))) } catch { /* 忽略坏帧 */ }
        }
      }
      return out
    },
  }
}

// localStorage 不可用（隐私模式、站点数据被禁）时的每标签页随机 id。
// ⚠ 此前这种情况一律返回常量 'nostorage' —— 所有此类浏览器共用同一个
// uid `anon:nostorage`，彼此的会话互相可见。宁可会话不跨刷新保留，
// 也不能让不同的人共用一个身份。
let memoryDeviceId = null

function deviceId() {
  try {
    let id = localStorage.getItem('genki-device-id')
    if (!id) { id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem('genki-device-id', id) }
    return id
  } catch {
    if (!memoryDeviceId) memoryDeviceId = `mem${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    return memoryDeviceId
  }
}

/** 当前使用的游客 uid（登录后用于把游客会话认领过来） */
export function guestUid() {
  return `anon:${deviceId()}`
}

/**
 * 身份头。登录时用 token，未登录时用游客标识。
 * 两者不并发：带了 token 服务端就只看 token，再带 uid 头只会造成误解。
 */
export function uidHeader() {
  if (getToken()) return authHeader()
  return { 'X-Genki-Uid': `anon:${deviceId()}` }
}

async function json(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...uidHeader(), ...(options.headers || {}) } })
  const body = await res.json().catch(() => ({ ok: false, msg: '响应解析失败' }))
  if (!res.ok && !body.ok) throw apiError(body, res.status)
  return body
}

/** 把服务端的错误码带在异常上，调用方才能区分「积分不足」和「服务挂了」。 */
function apiError(body, status) {
  const err = new Error(body.msg || `请求失败(${status})`)
  err.status = status
  if (body.reason) err.reason = body.reason
  return err
}

export function createAgentApi() {
  return {
    listModels: () => json('/api/agent/models', {}),
    listSessions: () => json('/api/agent/sessions', {}),
    // 登录后认领游客期间的会话
    claimGuestSessions: () => json('/api/agent/sessions/claim', { method: 'POST', body: JSON.stringify({ from: guestUid() }) }),
    loadMessages: id => json(`/api/agent/sessions/${id}/messages`, {}),
    deleteSession: id => json(`/api/agent/sessions/${id}`, { method: 'DELETE' }),
    async streamChat({ sessionId, text, chart, route, onEvent, signal }) {
      const res = await fetch(`${BASE}/api/agent/chat`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', ...uidHeader() },
        body: JSON.stringify({ sessionId, text, chart, route }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw apiError(body, res.status)
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      const parser = parseSseChunks()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        for (const e of parser.feed(dec.decode(value, { stream: true }))) onEvent(e)
      }
    },
  }
}
