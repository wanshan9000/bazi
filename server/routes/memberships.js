import { Router } from 'express'
import { sharedAccounts } from '../accounts.js'
import { requireAdmin } from '../adminAuth.js'
import { createComplaint, createRefund, listComplaints, listRefunds, updateComplaint, updateRefund } from '../store.js'
import { getCreditBalance, planByKey } from '../../src/engine/membership.js'

const router = Router()
const PLAN_KEYS = new Set(['free', 'earth', 'heaven', 'oracle'])
const REFUND_STATUS = new Set(['approved', 'rejected'])
const COMPLAINT_STATUS = new Set(['open', 'processing', 'resolved', 'closed'])

function memberSummary(user) {
  const plan = planByKey(user.plan)
  const balance = getCreditBalance(user)
  return {
    id: user.id,
    account: user.account,
    nickname: user.nickname,
    avatar: user.avatar,
    plan: user.plan,
    planName: plan.name,
    role: user.role,
    status: user.status || 'active',
    isSuperAdmin: user.isSuperAdmin,
    // 保留旧字段兼容管理端的历史响应；新界面用三个明确的钱包字段展示。
    creditsUsed: user.monthlyCreditsUsed ?? user.creditsUsed ?? 0,
    creditsTotal: plan.credits,
    monthlyCredits: balance.monthly,
    permanentCredits: balance.permanent,
    totalCredits: balance.total,
    planExpiresAt: user.planExpiresAt || 0,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || 0,
  }
}

function recordSummary(record, accounts) {
  const member = accounts.get(record.memberId)
  return { ...record, member: member ? memberSummary(accounts.publicUser(member)) : null }
}

router.get('/admin/members', requireAdmin, (_req, res) => {
  const accounts = sharedAccounts()
  const members = accounts.list().map(memberSummary).sort((a, b) => b.createdAt - a.createdAt)
  res.json({
    ok: true,
    data: {
      members,
      refunds: listRefunds().map(record => recordSummary(record, accounts)),
      complaints: listComplaints().map(record => recordSummary(record, accounts)),
    },
  })
})

router.patch('/admin/members/:id/subscription', requireAdmin, (req, res) => {
  const plan = String(req.body?.plan || '')
  if (!PLAN_KEYS.has(plan)) return res.status(400).json({ ok: false, msg: '请选择有效会员档位' })
  const result = sharedAccounts().adminSetPlan(req.params.id, plan)
  if (!result.ok) return res.status(400).json(result)
  res.json({ ok: true, msg: plan === 'free' ? '会员订阅已取消' : `已调整为${result.plan.name}`, data: memberSummary(result.user) })
})

router.patch('/admin/members/:id/status', requireAdmin, (req, res) => {
  const status = String(req.body?.status || '')
  const reason = String(req.body?.reason || '').trim().slice(0, 200)
  const result = sharedAccounts().setStatus(req.params.id, status, reason)
  if (!result.ok) return res.status(400).json(result)
  res.json({ ok: true, msg: status === 'suspended' ? '账号已停用，后续登录与服务请求将被拒绝' : '账号已恢复使用', data: memberSummary(result.user) })
})

router.post('/admin/refunds', requireAdmin, (req, res) => {
  const memberId = String(req.body?.memberId || '')
  const reason = String(req.body?.reason || '').trim().slice(0, 500)
  const member = sharedAccounts().get(memberId)
  if (!member) return res.status(404).json({ ok: false, msg: '会员不存在' })
  if (member.isSuperAdmin) return res.status(400).json({ ok: false, msg: '尊者不支持退款处理' })
  const item = createRefund({ memberId, reason: reason || '管理员登记退款', planAtRequest: member.plan, note: '', handledAt: 0 })
  res.status(201).json({ ok: true, msg: '退款申请已登记，等待处理', data: recordSummary(item, sharedAccounts()) })
})

router.patch('/admin/refunds/:id', requireAdmin, (req, res) => {
  const status = String(req.body?.status || '')
  const note = String(req.body?.note || '').trim().slice(0, 500)
  if (!REFUND_STATUS.has(status)) return res.status(400).json({ ok: false, msg: '退款状态无效' })
  const current = listRefunds().find(item => item.id === req.params.id)
  if (!current) return res.status(404).json({ ok: false, msg: '退款申请不存在' })
  if (current.status !== 'pending') return res.status(400).json({ ok: false, msg: '该退款申请已处理' })

  const accounts = sharedAccounts()
  if (status === 'approved') {
    const result = accounts.adminSetPlan(current.memberId, 'free')
    if (!result.ok) return res.status(400).json(result)
  }
  const saved = updateRefund(current.id, { status, note, handledAt: Date.now(), paymentState: status === 'approved' ? 'manual_pending' : 'not_required' })
  res.json({
    ok: true,
    msg: status === 'approved' ? '退款已批准，订阅已取消；请按支付渠道执行人工打款' : '退款申请已驳回',
    data: recordSummary(saved, accounts),
  })
})

router.get('/admin/complaints', requireAdmin, (_req, res) => {
  const accounts = sharedAccounts()
  res.json({ ok: true, data: listComplaints().map(record => recordSummary(record, accounts)) })
})

router.post('/admin/complaints', requireAdmin, (req, res) => {
  const memberId = String(req.body?.memberId || '')
  const category = String(req.body?.category || '其他').trim().slice(0, 30)
  const content = String(req.body?.content || '').trim().slice(0, 2000)
  if (!memberId || !sharedAccounts().get(memberId)) return res.status(400).json({ ok: false, msg: '请选择有效会员' })
  if (!content) return res.status(400).json({ ok: false, msg: '请填写投诉内容' })
  const item = createComplaint({ memberId, category, content, note: '', handledAt: 0 })
  res.status(201).json({ ok: true, msg: '投诉工单已登记', data: recordSummary(item, sharedAccounts()) })
})

router.patch('/admin/complaints/:id', requireAdmin, (req, res) => {
  const status = String(req.body?.status || '')
  const note = String(req.body?.note || '').trim().slice(0, 1000)
  if (!COMPLAINT_STATUS.has(status)) return res.status(400).json({ ok: false, msg: '投诉状态无效' })
  const saved = updateComplaint(req.params.id, { status, note, handledAt: status === 'open' ? 0 : Date.now() })
  if (!saved) return res.status(404).json({ ok: false, msg: '投诉工单不存在' })
  res.json({ ok: true, msg: '投诉工单已更新', data: recordSummary(saved, sharedAccounts()) })
})

export default router
