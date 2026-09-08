// 前端 API 客户端：调用订阅后端
// 所有请求 path 已自带 /api 前缀（如 /api/health），由 vite 将 /api 代理到后端 8787，避免浏览器 CORS
// 因此 BASE 默认为空；如需部署到子路径，可用 VITE_API_BASE 覆盖（如 '/myapp'）
import { authHeader } from './auth.js'

const BASE = import.meta.env.VITE_API_BASE || ''

async function request(path, { headers = {}, ...options } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...headers },
    ...options,
  })
  let json
  try { json = await res.json() } catch { json = { ok: false, msg: '响应解析失败' } }
  if (!res.ok && !json.ok) {
    throw new Error(json.msg || `请求失败(${res.status})`)
  }
  return json
}

export const api = {
  /**
   * 健康检查。
   *
   * ⚠ /api/health 在**元氣 AI 不可用**时会返回 503（缺 DEEPSEEK_API_KEY、
   * 缺引擎产物），那是给部署与监控用的信号。但它不能被当成「整个后端挂了」——
   * 此前走 request()，503 直接抛异常 → 订阅页与注册页一律显示服务不可用，
   * 哪怕短信和微信通道好好的。
   *
   * 这里改为不看状态码、只读响应体，并把「服务器有没有应答」（reachable）
   * 与「AI 通道是否就绪」（ok）分开，调用方各取所需。
   */
  async health() {
    try {
      const res = await fetch(`${BASE}/api/health`, { headers: { 'Content-Type': 'application/json' } })
      const r = await res.json().catch(() => null)
      if (!r) return { ok: false, reachable: false }
      return { ok: Boolean(r.ok), reachable: true, sms: r.sms, wechat: r.wechat, agent: r.agent }
    } catch {
      // 只有真的连不上（网络错误）才算不可达
      return { ok: false, reachable: false }
    }
  },
  // 发送短信验证码
  async sendCode(phone) {
    return request('/api/sms/send-code', { method: 'POST', body: JSON.stringify({ phone }) })
  },
  // 短信订阅
  async smsSubscribe({ phone, code, birth, time, favZodiac }) {
    return request('/api/sms/subscribe', { method: 'POST', body: JSON.stringify({ phone, code, birth, time, favZodiac }) })
  },
  // 凭手机号 + 验证码找回订阅令牌（换设备/清缓存后仍能管理自己的订阅）
  async smsRecover({ phone, code }) {
    return request('/api/sms/recover', { method: 'POST', body: JSON.stringify({ phone, code }) })
  },
  // 获取微信扫码链接
  async wechatQr() {
    return request('/api/wechat/qr')
  },
  // 微信模拟扫码完成（降级联调）
  async wechatMockDone({ phone, birth, time, favZodiac }) {
    return request('/api/wechat/mock-done', { method: 'POST', body: JSON.stringify({ phone, birth, time, favZodiac }) })
  },
  // 查询订阅状态
  async status(token) {
    return request(`/api/status?token=${encodeURIComponent(token)}`)
  },
  // 更新订阅偏好
  async update(token, patch) {
    return request('/api/update', { method: 'POST', body: JSON.stringify({ token, ...patch }) })
  },
  // 取消订阅
  async unsubscribe(token) {
    return request('/api/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) })
  },

  // ================= 管理后台：自定义技能 =================
  // 技能列表（读操作不鉴权，前端 Agent 也可拉取）
  async adminSkills() {
    return request('/api/admin/skills')
  },
  // 管理员登录：密码换令牌
  async adminAuth(password = '') {
    return request('/api/admin/auth', { method: 'POST', body: JSON.stringify({ password }), headers: authHeader() })
  },
  // 保存单个技能（需令牌）
  async saveSkill(skill, token) {
    return request('/api/admin/skills', {
      method: 'POST',
      body: JSON.stringify(skill),
      headers: { 'X-Admin-Token': token },
    })
  },
  // 批量导入（需令牌）
  async importSkills({ items, text }, token) {
    return request('/api/admin/skills/import', {
      method: 'POST',
      body: JSON.stringify({ items, text }),
      headers: { 'X-Admin-Token': token },
    })
  },
  // 更新技能（启用/停用、改名）（需令牌）
  async updateSkill(key, patch, token) {
    return request(`/api/admin/skills/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
      headers: { 'X-Admin-Token': token },
    })
  },
  // 删除技能（需令牌）
  async deleteSkill(key, token) {
    return request(`/api/admin/skills/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Token': token },
    })
  },

  // ================= 文库：公开阅读 + 管理后台发布 =================
  async articles() {
    return request('/api/articles')
  },
  async article(id) {
    return request(`/api/articles/${encodeURIComponent(id)}`)
  },
  async adminArticles(token) {
    return request('/api/admin/articles', { headers: { 'X-Admin-Token': token } })
  },
  async adminArticle(id, token) {
    return request(`/api/admin/articles/${encodeURIComponent(id)}`, { headers: { 'X-Admin-Token': token } })
  },
  async saveArticle(article, token) {
    const editing = Boolean(article.id)
    const path = editing ? `/api/admin/articles/${encodeURIComponent(article.id)}` : '/api/admin/articles'
    return request(path, {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(article),
      headers: { 'X-Admin-Token': token },
    })
  },
  async updateArticleStatus(id, status, token) {
    return request(`/api/admin/articles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      headers: { 'X-Admin-Token': token },
    })
  },
  async deleteArticle(id, token) {
    return request(`/api/admin/articles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Token': token },
    })
  },

  // ================= 管理后台：会员、退款与投诉 =================
  async adminMembers(token) {
    return request('/api/admin/members', { headers: { 'X-Admin-Token': token } })
  },
  async updateMemberSubscription(id, plan, token) {
    return request(`/api/admin/members/${encodeURIComponent(id)}/subscription`, {
      method: 'PATCH', body: JSON.stringify({ plan }), headers: { 'X-Admin-Token': token },
    })
  },
  async updateMemberStatus(id, status, reason, token) {
    return request(`/api/admin/members/${encodeURIComponent(id)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status, reason }), headers: { 'X-Admin-Token': token },
    })
  },
  async createRefund(memberId, reason, token) {
    return request('/api/admin/refunds', {
      method: 'POST', body: JSON.stringify({ memberId, reason }), headers: { 'X-Admin-Token': token },
    })
  },
  async updateRefund(id, status, note, token) {
    return request(`/api/admin/refunds/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify({ status, note }), headers: { 'X-Admin-Token': token },
    })
  },
  async createComplaint(memberId, category, content, token) {
    return request('/api/admin/complaints', {
      method: 'POST', body: JSON.stringify({ memberId, category, content }), headers: { 'X-Admin-Token': token },
    })
  },
  async updateComplaint(id, status, note, token) {
    return request(`/api/admin/complaints/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify({ status, note }), headers: { 'X-Admin-Token': token },
    })
  },
  // ================= 管理后台：安全风控 =================
  async adminSecurity(token) {
    return request('/api/admin/security', { headers: { 'X-Admin-Token': token } })
  },
  async blockSource(fingerprint, { minutes, reason }, token) {
    return request(`/api/admin/security/blocks/${encodeURIComponent(fingerprint)}`, {
      method: 'POST', body: JSON.stringify({ minutes, reason }), headers: { 'X-Admin-Token': token },
    })
  },
  async unblockSource(fingerprint, token) {
    return request(`/api/admin/security/blocks/${encodeURIComponent(fingerprint)}`, {
      method: 'DELETE', headers: { 'X-Admin-Token': token },
    })
  },
  // 导出模板
  async skillTemplate() {
    return request('/api/admin/skills/template')
  },
}
