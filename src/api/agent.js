// 元气 AI 前端客户端：POST /api/agent/chat（SSE）+ 会话接口
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

export function uidHeader(currentUid) {
  const uid = typeof currentUid === 'function' ? currentUid() : 'anon'
  return { 'X-Genki-Uid': uid && uid !== 'anon' ? uid : `anon:${deviceId()}` }
}

async function json(path, options = {}, currentUid) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...uidHeader(currentUid), ...(options.headers || {}) } })
  const body = await res.json().catch(() => ({ ok: false, msg: '响应解析失败' }))
  if (!res.ok && !body.ok) throw new Error(body.msg || `请求失败(${res.status})`)
  return body
}

export function createAgentApi(currentUid) {
  return {
    listModels: () => json('/api/agent/models', {}, currentUid),
    listSessions: () => json('/api/agent/sessions', {}, currentUid),
    // 登录后认领游客期间的会话
    claimGuestSessions: () => json('/api/agent/sessions/claim', { method: 'POST', body: JSON.stringify({ from: guestUid() }) }, currentUid),
    loadMessages: id => json(`/api/agent/sessions/${id}/messages`, {}, currentUid),
    deleteSession: id => json(`/api/agent/sessions/${id}`, { method: 'DELETE' }, currentUid),
    async streamChat({ sessionId, text, chart, route, onEvent, signal }) {
      const res = await fetch(`${BASE}/api/agent/chat`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', ...uidHeader(currentUid) },
        body: JSON.stringify({ sessionId, text, chart, route }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.msg || `请求失败(${res.status})`)
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
