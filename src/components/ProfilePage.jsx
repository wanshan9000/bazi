import { useState } from 'react'
import { PLANS, AVATARS, updateProfile, changePassword, logout } from '../data/users.js'
import { planByKey, getMonthlyCredits, getMonthlyProgress } from '../engine/membership.js'

const PLAN_STYLE = {
  earth: { label: '凡境', cls: 'pr-earth' },
  heaven: { label: '玄境', cls: 'pr-heaven' },
  oracle: { label: '天机境', cls: 'pr-oracle' }
}

// onSubscribe 由 App 传入（openSubscribe），此前漏在解构里，而第 55/168/174 行直接引用它，
// 严格模式下就是 ReferenceError：个人中心的「升级 / 续费」按钮一点就崩。
export default function ProfilePage({ user, historyCount = 0, tarotCount = 0, onBack, onLogout, onUpdate, onSubscribe }) {
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(user.nickname)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('ok')

  const days = Math.max(1, Math.ceil((Date.now() - user.createdAt) / 86400000))
  const plan = PLANS.find(p => p.key === user.plan) || PLANS[0]
  const remaining = getMonthlyCredits(user)
  const used = user.creditsUsed || 0
  const progress = getMonthlyProgress(user)
  const expiresAt = user.planExpiresAt || 0
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000)) : 0
  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('zh-CN') : '—'

  const flash = (text, type = 'ok') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 2600)
  }

  const saveNickname = () => {
    const res = updateProfile(user.id, { nickname })
    if (!res.ok) return flash(res.msg, 'err')
    setEditing(false)
    onUpdate(res.user)
    flash('昵称已更新')
  }

  const pickAvatar = (a) => {
    const res = updateProfile(user.id, { avatar: a })
    setAvatarOpen(false)
    if (!res.ok) return flash(res.msg, 'err')
    onUpdate(res.user)
    flash('头像已更新')
  }

  const upgrade = (key) => {
    if (key === user.plan) return
    // 走订阅 Modal（确认即 changePlan，自动重置积分与到期）
    if (onSubscribe) { onSubscribe(key); return }
    // 兜底（无 Modal 时）：直接切档
    const res = updateProfile(user.id, { plan: key })
    if (!res.ok) return flash(res.msg, 'err')
    onUpdate(res.user)
    flash(`已切换至${PLANS.find(p => p.key === key).name}`)
  }

  const savePwd = async () => {
    if (newPwd !== confirm) return flash('两次输入的新密码不一致', 'err')
    const res = await changePassword(user.id, oldPwd, newPwd)
    if (!res.ok) return flash(res.msg, 'err')
    setOldPwd(''); setNewPwd(''); setConfirm('')
    flash('密码已更新，下次请用新密码登录')
  }

  const doLogout = () => {
    logout()
    onLogout()
  }

  return (
    <section className="profile-page">
      <div className="profile-head">
        <button className="page-back" onClick={onBack} aria-label="返回首页">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>返回</span>
        </button>
        <h1 className="page-title">
          我的<span className="zhushi">元气</span>
          <span className="page-subtitle">用户中心 · 会员权益 · 账号设置</span>
        </h1>
      </div>

      {msg && <p className={`auth-msg ${msgType === 'err' ? 'auth-msg-err' : ''}`}>{msg}</p>}

      <div className="profile-wrap">
        {/* 用户信息卡 */}
        <div className="profile-card pr-id-card">
          <div className="pr-id-avatar" onClick={() => setAvatarOpen(v => !v)} title="点击更换头像">
            <span className="pr-id-glyph">{user.avatar}</span>
            <span className="pr-id-edit">✎</span>
          </div>
          <div className="pr-id-info">
            {editing ? (
              <div className="pr-nick-edit">
                <input value={nickname} maxLength={16} onChange={e => setNickname(e.target.value)} autoFocus />
                <button onClick={saveNickname} className="pr-nick-save">保存</button>
                <button onClick={() => { setEditing(false); setNickname(user.nickname) }} className="pr-nick-cancel">取消</button>
              </div>
            ) : (
              <h2 className="pr-nick" onClick={() => setEditing(true)} title="点击修改昵称">
                {user.nickname} <span className="pr-nick-pen">✎</span>
              </h2>
            )}
            <p className="pr-account">{user.account}</p>
            <p className="pr-join">加入第 {days} 天 · {new Date(user.createdAt).toLocaleDateString('zh-CN')} 加入</p>
          </div>
          <div className="pr-badge">
            <span className={`pr-badge-tag ${PLAN_STYLE[user.plan].cls}`}>{PLAN_STYLE[user.plan].label}</span>
            <span className="pr-badge-meta">{plan.tag}会员</span>
          </div>
        </div>

        {/* 头像选择 */}
        {avatarOpen && (
          <div className="pr-avatar-picker">
            {AVATARS.map(a => (
              <button key={a} className={`pr-avatar-opt ${a === user.avatar ? 'active' : ''}`} onClick={() => pickAvatar(a)}>{a}</button>
            ))}
          </div>
        )}

        {/* 统计条 */}
        <div className="profile-card pr-stats">
          <div className="pr-stat">
            <span className="pr-stat-num">{historyCount}</span>
            <span className="pr-stat-label">命盘记录</span>
          </div>
          <div className="pr-stat">
            <span className="pr-stat-num">{tarotCount}</span>
            <span className="pr-stat-label">塔罗足迹</span>
          </div>
          <div className="pr-stat">
            <span className="pr-stat-num">{plan.price}</span>
            <span className="pr-stat-label">当前月费 ¥</span>
          </div>
        </div>

        {/* 积分余额（核心新增） */}
        <div className="profile-card pr-credits">
          <div className="pr-cr-head">
            <div>
              <span className="pr-cr-label">本月积分余额</span>
              <span className="pr-cr-num"><b>{remaining}</b> <i>/ {plan.credits}</i></span>
            </div>
            <div className="pr-cr-meta">
              <span>已用 <b>{used}</b> 积分</span>
              <span>·</span>
              <span>到期 {fmtDate(expiresAt)}{daysLeft > 0 ? `（剩 ${daysLeft} 天）` : ''}</span>
            </div>
          </div>
          <div className="pr-cr-bar">
            <i style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
          </div>
          <p className="pr-cr-tip">
            完整命书 / AI 解读 / 元氣 AI 对话按消耗扣积分；积分每月自动续期，到期前可手动续费。
          </p>
          <div className="pr-cr-actions">
            <button
              className="pr-set-btn"
              onClick={() => plan.key !== 'oracle' && onSubscribe && onSubscribe(plan.key === 'earth' ? 'heaven' : 'oracle')}
            >
              {plan.key === 'oracle' ? '已是最高档位' : `升级至${plan.key === 'earth' ? '玄境' : '天机境'}`}
            </button>
            <button
              className="pr-set-btn ghost"
              onClick={() => onSubscribe && onSubscribe(plan.key)}
            >
              续费 {plan.name}
            </button>
          </div>
        </div>

        {/* 会员权益 */}
        <div className="profile-block">
          <h3 className="pr-block-title">会员权益</h3>
          <p className="pr-block-sub">当前为 <b className="pr-current-plan">{plan.name}</b> · {plan.desc}</p>
          <div className="pr-plans">
            {PLANS.map(p => (
              <div key={p.key} className={`pr-plan ${p.key === user.plan ? 'active' : ''}`}>
                <div className="pr-plan-top">
                  <span className="pr-plan-name">{p.name}</span>
                  <span className="pr-plan-en">{p.en}</span>
                  {p.hot && <span className="pr-plan-hot">推荐</span>}
                </div>
                <p className="pr-plan-price"><b>¥{p.price}</b><span>/月</span></p>
                <ul className="pr-plan-benefits">
                  {p.benefits.map(b => <li key={b}>✓ {b}</li>)}
                </ul>
                <button
                  className={`pr-plan-btn ${p.key === user.plan ? 'pr-plan-btn-current' : ''}`}
                  disabled={p.key === user.plan}
                  onClick={() => upgrade(p.key)}
                >
                  {p.key === user.plan ? '当前会员' : `升级${p.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 账号设置 */}
        <div className="profile-block">
          <h3 className="pr-block-title">账号设置</h3>
          <div className="profile-card pr-set">
            <div className="pr-set-row">
              <div className="pr-set-label">
                <span className="pr-set-icon">🔒</span>
                <div><b>修改密码</b><p>定期更换密码更安全</p></div>
              </div>
              <div className="pr-pwd-fields">
                <input type="password" placeholder="当前密码" value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
                <input type="password" placeholder="新密码（至少 6 位）" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                <input type="password" placeholder="确认新密码" value={confirm} onChange={e => setConfirm(e.target.value)} />
                <button className="pr-set-btn" onClick={savePwd}>更新密码</button>
              </div>
            </div>
          </div>

          <div className="profile-card pr-set">
            <div className="pr-set-row pr-set-danger">
              <div className="pr-set-label">
                <span className="pr-set-icon">🚪</span>
                <div><b>退出登录</b><p>退出后本地命盘记录仍会保留</p></div>
              </div>
              <button className="pr-set-btn pr-set-btn-danger" onClick={doLogout}>退出登录</button>
            </div>
          </div>
        </div>

        <p className="profile-foot">元氣滿滿 · 数据仅保存在本设备浏览器中</p>
      </div>
    </section>
  )
}
