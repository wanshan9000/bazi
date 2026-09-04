// 管理后台 · 自定义技能导入/管理 API
// 技能：元数据 + 关键词 + 可选工具 + 人设(sys)。管理员导入后全站 Agent 可用。
// 安全：新增/修改/删除/导入需管理员令牌；未配置 ADMIN_PASSWORD 时写操作一律拒绝。
import { Router } from 'express'
import crypto from 'crypto'
import { config } from '../config.js'
import { listSkills, findSkill, upsertSkill, deleteSkill } from '../store.js'
import { adminConfigured, issueToken, requireAdmin } from '../adminAuth.js'
import { syncAdminSkill, removeAdminSkill } from '../dsh/adminSkills.js'

// 技能落盘：停用的技能必须把 SKILL.md 从 _admin 目录移走，否则 dsh 的
// skill-filesystem 仍会热加载它——后台显示「已停用」，模型却照样能用。
function syncSkillFile(saved) {
  try {
    if (saved.enabled === false) removeAdminSkill(saved.key)
    else syncAdminSkill(saved)
  } catch (e) {
    console.warn('[skills] 同步 _admin 失败：', e.message)
  }
}

const router = Router()

// 内置技能 key 白名单：禁止被管理端导入覆盖（内置技能由代码维护，含精心审核的 sys）
const BUILTIN_KEYS = new Set([
  'bazi', 'yixue-taishan', 'mangpai', 'wuyunliuqi', 'liuyao', 'tarot', 'huangli', 'modern_huangli',
  'ziwei', 'qimen', 'love', 'wealth', 'health', 'fengshui', 'name',
])

// 合法 key：字母/数字/中划线/下划线，1~40 位
const KEY_RE = /^[a-zA-Z0-9_-]{1,40}$/

// ---- 1. 管理员登录（密码换令牌）----
router.post('/admin/auth', (req, res) => {
  if (!adminConfigured()) {
    return res.status(403).json({ ok: false, msg: '管理后台未启用（请设置 ADMIN_PASSWORD 环境变量）' })
  }
  const { password } = req.body || {}
  // 常量时间比较，避免时序侧信道
  const a = Buffer.from(String(password || ''))
  const b = Buffer.from(config.admin.password)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, msg: '密码错误' })
  }
  res.json({ ok: true, token: issueToken(), ttlHours: config.admin.tokenTtlHours })
})

// ---- 2. 技能列表（读操作不鉴权：管理员查看 + 前端 Agent 拉取共用）----
router.get('/admin/skills', (_req, res) => {
  res.json({ ok: true, data: listSkills() })
})

// ---- 3. 导出模板（须在 :key 之前定义，避免被参数路由拦截）----
router.get('/admin/skills/template', (_req, res) => {
  res.json({
    ok: true,
    template: [
      {
        key: 'example-skill',
        name: '示例技能',
        icon: '🧩',
        desc: '一句话说明这个技能的用途',
        keywords: ['关键词1', '关键词2', '关键词3'],
        tool: '',
        cap: '技能调用说明：命中哪些问题场景时使用本技能。',
        sys: '本技能的人设指令（仅管理员导入技能可见，不会覆盖系统灵魂边界）。',
        enabled: true,
      },
    ],
  })
})

// ---- 4. 单个技能详情 ----
router.get('/admin/skills/:key', (req, res) => {
  const s = findSkill(req.params.key)
  if (!s) return res.status(404).json({ ok: false, msg: '技能不存在' })
  res.json({ ok: true, data: s })
})

// 校验并规范化单个技能对象；返回 { ok, skill? | errors[] }
function validateSkill(raw) {
  const errors = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['技能对象无效'] }

  const key = String(raw.key || '').trim()
  if (!key) errors.push('缺少 key')
  else if (!KEY_RE.test(key)) errors.push('key 仅允许字母/数字/中划线/下划线，1~40 位')
  else if (BUILTIN_KEYS.has(key)) errors.push(`key「${key}」为内置技能，不允许覆盖`)

  const name = String(raw.name || '').trim()
  if (!name) errors.push('缺少 name')

  const icon = String(raw.icon || '🧩').trim().slice(0, 8)
  const desc = String(raw.desc || '').trim().slice(0, 300)
  const cap = String(raw.cap || '').trim().slice(0, 500)
  const sys = String(raw.sys || '').trim().slice(0, 2000)

  // keywords：字符串数组，去重、去空，最多 60 个
  let keywords = []
  if (Array.isArray(raw.keywords)) {
    keywords = [...new Set(raw.keywords.map(k => String(k).trim()).filter(Boolean))].slice(0, 60)
  }
  if (!keywords.length) errors.push('keywords 至少需要一个关键词')

  // tool：可选，仅允许字符串，有效性由前端 agentTools 判定
  let tool = undefined
  if (raw.tool != null && raw.tool !== '') {
    tool = String(raw.tool).trim()
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(tool)) errors.push('tool 格式不合法')
  }

  if (errors.length) return { ok: false, errors }

  const enabled = raw.enabled === false ? false : true

  return {
    ok: true,
    skill: { key, name, icon, desc, cap, sys, keywords, tool, enabled },
  }
}

// ---- 4. 新增/更新单个技能 ----
router.post('/admin/skills', requireAdmin, (req, res) => {
  const { ok, errors, skill } = validateSkill(req.body)
  if (!ok) return res.status(400).json({ ok: false, msg: '校验失败', errors })
  const saved = upsertSkill(skill)
  syncSkillFile(saved)
  res.json({ ok: true, msg: '已保存', data: saved })
})

// ---- 5. 批量导入（JSON 文本 或 items 数组）----
router.post('/admin/skills/import', requireAdmin, (req, res) => {
  let items = null
  if (Array.isArray(req.body.items)) items = req.body.items
  else if (typeof req.body.text === 'string' && req.body.text.trim()) {
    try {
      const parsed = JSON.parse(req.body.text)
      items = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return res.status(400).json({ ok: false, msg: 'JSON 解析失败，请检查格式' })
    }
  } else {
    return res.status(400).json({ ok: false, msg: '未提供有效的技能数据' })
  }

  if (!items.length) return res.status(400).json({ ok: false, msg: '技能列表为空' })
  if (items.length > 50) return res.status(400).json({ ok: false, msg: '单次最多导入 50 个技能' })

  const imported = []
  const skipped = []
  items.forEach((raw, i) => {
    const r = validateSkill(raw)
    if (r.ok) {
      const saved = upsertSkill(r.skill)
      syncSkillFile(saved)
      imported.push(saved)
    } else {
      skipped.push({ index: i, name: raw?.name || raw?.key || `#${i + 1}`, errors: r.errors })
    }
  })

  res.json({ ok: true, msg: `成功导入 ${imported.length} 个，跳过 ${skipped.length} 个`, imported, skipped })
})

// ---- 6. 启用/停用 ----
router.patch('/admin/skills/:key', requireAdmin, (req, res) => {
  const existing = findSkill(req.params.key)
  if (!existing) return res.status(404).json({ ok: false, msg: '技能不存在' })
  const patch = {}
  if (typeof req.body.enabled === 'boolean') patch.enabled = req.body.enabled
  if (req.body.name != null) patch.name = String(req.body.name).trim()
  const saved = upsertSkill({ ...existing, ...patch })
  syncSkillFile(saved)
  res.json({ ok: true, msg: '已更新', data: saved })
})

// ---- 7. 删除 ----
router.delete('/admin/skills/:key', requireAdmin, (req, res) => {
  const ok = deleteSkill(req.params.key)
  if (ok) {
    try { removeAdminSkill(req.params.key) } catch (e) { console.warn('[skills] 移除 _admin 失败：', e.message) }
  }
  res.json({ ok, msg: ok ? '已删除' : '技能不存在' })
})

export default router
