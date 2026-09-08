import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'

const PLANS = [
  { key: 'free', label: '游客' },
  { key: 'earth', label: '凡者' },
  { key: 'heaven', label: '玄者' },
  { key: 'oracle', label: '天者' },
]

const COMPLAINT_STATUS = {
  open: '待处理', processing: '处理中', resolved: '已解决', closed: '已关闭',
}

const REFUND_STATUS = { pending: '待审批', approved: '已批准', rejected: '已驳回' }

function fmtDate(value, fallback = '—') {
  if (!value) return fallback
  return new Date(value).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

export default function MemberManagement({ token, onNotify }) {
  const [data, setData] = useState({ members: [], refunds: [], complaints: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [section, setSection] = useState('members')
  const [query, setQuery] = useState('')
  const [showComplaint, setShowComplaint] = useState(false)
  const [complaint, setComplaint] = useState({ memberId: '', category: '服务体验', content: '' })

  const refresh = async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await api.adminMembers(token)
      setData(result?.data || { members: [], refunds: [], complaints: [] })
      setError('')
    } catch (e) {
      setError(e.message || '会员数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const overview = useMemo(() => ({
    total: data.members.length,
    paid: data.members.filter(member => member.plan !== 'free' && !member.isSuperAdmin).length,
    refunds: data.refunds.filter(refund => refund.status === 'pending').length,
    complaints: data.complaints.filter(item => item.status === 'open' || item.status === 'processing').length,
  }), [data])

  const members = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return data.members
    return data.members.filter(member => `${member.account} ${member.nickname}`.toLowerCase().includes(keyword))
  }, [data.members, query])

  const notify = (message, type = 'ok') => {
    setNotice({ message, type })
    onNotify?.(message, type)
  }

  const updateSubscription = async (member, plan) => {
    if (plan === member.plan) return
    const action = plan === 'free' ? '取消该会员的订阅' : `调整为「${PLANS.find(item => item.key === plan)?.label}」`
    if (!window.confirm(`确认${action}？会员额度将从当前状态重新计算。`)) return
    try {
      const result = await api.updateMemberSubscription(member.id, plan, token)
      notify(result.msg)
      await refresh()
    } catch (e) {
      notify(e.message || '订阅调整失败', 'err')
    }
  }

  const createRefund = async (member) => {
    const reason = window.prompt('请输入退款原因或备注（可留空）：', '')
    if (reason === null) return
    try {
      const result = await api.createRefund(member.id, reason, token)
      notify(result.msg)
      setSection('refunds')
      await refresh()
    } catch (e) {
      notify(e.message || '退款登记失败', 'err')
    }
  }

  const updateMemberStatus = async (member) => {
    const suspending = member.status !== 'suspended'
    const action = suspending ? '停用该账号' : '恢复该账号'
    if (!window.confirm(`确认${action}？${suspending ? '该账号后续将无法登录或使用服务。' : ''}`)) return
    const reason = suspending ? window.prompt('停用原因（可留空）：', '') : ''
    if (reason === null) return
    try {
      const result = await api.updateMemberStatus(member.id, suspending ? 'suspended' : 'active', reason, token)
      notify(result.msg)
      await refresh()
    } catch (e) {
      notify(e.message || '账号状态更新失败', 'err')
    }
  }

  const reviewRefund = async (refund, status) => {
    const label = status === 'approved' ? '批准退款并取消订阅' : '驳回退款申请'
    if (!window.confirm(`确认${label}？`)) return
    const note = window.prompt('处理备注（可留空）：', refund.note || '')
    if (note === null) return
    try {
      const result = await api.updateRefund(refund.id, status, note, token)
      notify(result.msg)
      await refresh()
    } catch (e) {
      notify(e.message || '退款处理失败', 'err')
    }
  }

  const submitComplaint = async (event) => {
    event.preventDefault()
    try {
      const result = await api.createComplaint(complaint.memberId, complaint.category, complaint.content, token)
      notify(result.msg)
      setComplaint({ memberId: '', category: '服务体验', content: '' })
      setShowComplaint(false)
      await refresh()
    } catch (e) {
      notify(e.message || '投诉登记失败', 'err')
    }
  }

  const updateComplaint = async (item, status) => {
    if (status === item.status) return
    const note = window.prompt('处理备注（可留空）：', item.note || '')
    if (note === null) return
    try {
      const result = await api.updateComplaint(item.id, status, note, token)
      notify(result.msg)
      await refresh()
    } catch (e) {
      notify(e.message || '投诉工单更新失败', 'err')
    }
  }

  return (
    <section className="admin-members">
      <div className="am-overview">
        <div className="am-kpi"><b>{overview.total}</b><span>注册会员</span></div>
        <div className="am-kpi"><b>{overview.paid}</b><span>有效订阅</span></div>
        <div className={`am-kpi ${overview.refunds ? 'attention' : ''}`}><b>{overview.refunds}</b><span>待审批退款</span></div>
        <div className={`am-kpi ${overview.complaints ? 'attention' : ''}`}><b>{overview.complaints}</b><span>待处理投诉</span></div>
      </div>

      <div className="am-nav" role="tablist" aria-label="会员管理分类">
        <button className={section === 'members' ? 'on' : ''} onClick={() => setSection('members')}>会员与订阅</button>
        <button className={section === 'refunds' ? 'on' : ''} onClick={() => setSection('refunds')}>退款申请 <i>{overview.refunds || ''}</i></button>
        <button className={section === 'complaints' ? 'on' : ''} onClick={() => setSection('complaints')}>投诉工单 <i>{overview.complaints || ''}</i></button>
      </div>

      {error && <div className="ask-msg err">{error}</div>}
      {notice && <div className={`ask-msg ${notice.type === 'err' ? 'err' : ''}`}>{notice.message}</div>}

      {section === 'members' && (
        <>
          <div className="am-tools">
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索账号或昵称" />
            <span>{members.length} 位会员</span>
          </div>
          {loading ? <div className="admin-empty">正在加载会员数据…</div> : (
            <div className="am-list">
              {members.map(member => (
                <article className="am-member" key={member.id}>
                  <div className="am-avatar">{member.avatar}</div>
                  <div className="am-member-main">
                    <div className="am-member-name"><b>{member.nickname}</b><span>{member.account}</span>{member.isSuperAdmin && <em>超级尊者</em>}{member.status === 'suspended' && <em className="suspended">已停用</em>}</div>
                    <p>注册于 {fmtDate(member.createdAt)} · 最近登录 {fmtDate(member.lastLoginAt)}</p>
                  </div>
                  <div className="am-member-plan">
                    <strong>{member.isSuperAdmin ? '无限权限' : member.planName}</strong>
                    <small>{member.isSuperAdmin ? '永久有效' : member.planExpiresAt ? `至 ${fmtDate(member.planExpiresAt)}` : '无有效订阅'}</small>
                  </div>
                  <div className="am-member-credit"><b>{member.isSuperAdmin ? '∞' : Math.max(0, member.creditsTotal - member.creditsUsed)}</b><span>/ {member.isSuperAdmin ? '∞' : member.creditsTotal} 积分</span></div>
                  <div className="am-member-actions">
                    <select value={member.plan} disabled={member.isSuperAdmin} onChange={event => updateSubscription(member, event.target.value)} aria-label={`调整 ${member.nickname} 的会员档位`}>
                      {member.isSuperAdmin ? <option>超级尊者</option> : PLANS.map(plan => <option value={plan.key} key={plan.key}>{plan.label}</option>)}
                    </select>
                    <button className="ask-btn ghost" disabled={member.isSuperAdmin} onClick={() => updateMemberStatus(member)}>{member.status === 'suspended' ? '恢复账号' : '停用账号'}</button>
                    <button className="ask-btn ghost warn" disabled={member.isSuperAdmin || member.plan === 'free'} onClick={() => createRefund(member)}>登记退款</button>
                  </div>
                </article>
              ))}
              {!members.length && <div className="admin-empty">没有匹配的会员</div>}
            </div>
          )}
        </>
      )}

      {section === 'refunds' && (
        <div className="am-list">
          {!loading && !data.refunds.length && <div className="admin-empty">暂无退款申请</div>}
          {data.refunds.map(refund => (
            <article className="am-case" key={refund.id}>
              <div className="am-case-main">
                <div className="am-case-title"><b>{refund.member?.nickname || '已删除会员'}</b><span>{refund.member?.account || refund.memberId}</span><em className={`am-status ${refund.status}`}>{REFUND_STATUS[refund.status]}</em></div>
                <p>申请档位：{refund.member?.planName || refund.planAtRequest} · {fmtDate(refund.createdAt)}</p>
                {refund.reason && <blockquote>{refund.reason}</blockquote>}
                {refund.note && <small>处理备注：{refund.note}</small>}
                {refund.paymentState === 'manual_pending' && <small className="am-payment-note">订阅已取消，需按原支付渠道执行人工退款。</small>}
              </div>
              {refund.status === 'pending' && <div className="am-case-actions"><button className="ask-btn primary" onClick={() => reviewRefund(refund, 'approved')}>批准退款</button><button className="ask-btn ghost" onClick={() => reviewRefund(refund, 'rejected')}>驳回</button></div>}
            </article>
          ))}
        </div>
      )}

      {section === 'complaints' && (
        <>
          <div className="am-case-head"><p>统一登记会员反馈与投诉，处理结果将保留在工单记录中。</p><button className="ask-btn primary" onClick={() => setShowComplaint(value => !value)}>{showComplaint ? '收起登记' : '登记投诉'}</button></div>
          {showComplaint && (
            <form className="am-complaint-form" onSubmit={submitComplaint}>
              <select required value={complaint.memberId} onChange={event => setComplaint({ ...complaint, memberId: event.target.value })}>
                <option value="">选择会员</option>
                {data.members.filter(member => !member.isSuperAdmin).map(member => <option value={member.id} key={member.id}>{member.nickname} · {member.account}</option>)}
              </select>
              <select value={complaint.category} onChange={event => setComplaint({ ...complaint, category: event.target.value })}>
                <option>服务体验</option><option>订阅计费</option><option>内容反馈</option><option>隐私与账号</option><option>其他</option>
              </select>
              <textarea required maxLength={2000} value={complaint.content} onChange={event => setComplaint({ ...complaint, content: event.target.value })} placeholder="记录投诉内容、发生时间及期望处理方式" />
              <button className="ask-btn primary" type="submit">创建工单</button>
            </form>
          )}
          <div className="am-list">
            {!loading && !data.complaints.length && <div className="admin-empty">暂无投诉工单</div>}
            {data.complaints.map(item => (
              <article className="am-case" key={item.id}>
                <div className="am-case-main">
                  <div className="am-case-title"><b>{item.category}</b><span>{item.member?.nickname || '已删除会员'} · {item.member?.account || item.memberId}</span><em className={`am-status ${item.status}`}>{COMPLAINT_STATUS[item.status]}</em></div>
                  <p>{fmtDate(item.createdAt)}</p>
                  <blockquote>{item.content}</blockquote>
                  {item.note && <small>处理备注：{item.note}</small>}
                </div>
                <div className="am-case-actions"><select value={item.status} onChange={event => updateComplaint(item, event.target.value)}>{Object.entries(COMPLAINT_STATUS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
