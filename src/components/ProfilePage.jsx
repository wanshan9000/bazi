import { useEffect, useRef, useState } from 'react'
import { PLANS, AVATARS, updateProfile, changePassword, logout } from '../data/users.js'
import { getCreditBalance, planByKey, nextPlanKey } from '../engine/membership.js'
import { reportApi } from '../api/reports.js'
import { useLocale } from '../i18n.jsx'

const PLAN_STYLE = {
  // free 是「未订阅 / 已过期」的落点，不在可购买的 PLANS 里，但个人中心一定会
  // 渲染到它 —— 漏了这一项就是 PLAN_STYLE[plan].cls 读 undefined，
  // 过期用户一进个人中心整页白屏。
  free: { label: '游客', cls: 'pr-free' },
  earth: { label: '凡者', cls: 'pr-earth' },
  heaven: { label: '玄者', cls: 'pr-heaven' },
  oracle: { label: '天者', cls: 'pr-oracle' },
  supreme: { label: '尊者', cls: 'pr-supreme' }
}

const IMAGE_AVATAR_RE = /^data:image\/(?:png|jpeg|webp);base64,/i
const MAX_AVATAR_SOURCE_BYTES = 8 * 1024 * 1024

function isImageAvatar(avatar) {
  return IMAGE_AVATAR_RE.test(String(avatar || ''))
}

function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(image.naturalWidth, image.naturalHeight)
      if (!side) return reject(new Error('无法读取图片尺寸'))
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 160
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('图片处理暂不可用'))
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 160, 160)
      resolve(canvas.toDataURL('image/webp', 0.84))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败，请换一张再试'))
    }
    image.src = url
  })
}

// onSubscribe 由 App 传入（openSubscribe），此前漏在解构里，而第 55/168/174 行直接引用它，
// 严格模式下就是 ReferenceError：个人中心的「升级 / 续费」按钮一点就崩。
export default function ProfilePage({ user, historyCount = 0, tarotCount = 0, onBack, onLogout, onUpdate, onSubscribe, onReports, onAskAgent }) {
  const { locale } = useLocale()
  const en = locale === 'en'
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(user.nickname)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('ok')
  const avatarInputRef = useRef(null)
  const [reportCount, setReportCount] = useState(null)

  useEffect(() => {
    let alive = true
    reportApi.list().then(result => {
      if (alive && result.ok) setReportCount((result.reports || []).length)
    }).catch(() => {})
    return () => { alive = false }
  }, [user?.id])

  const days = Math.max(1, Math.ceil((Date.now() - user.createdAt) / 86400000))
  // 必须走 planByKey：PLANS 里没有 free，用 find 会静默回落到 PLANS[0]（凡境），
  // 于是一个已过期的账号在个人中心显示成付费档，额度和到期时间也跟着错。
  const plan = planByKey(user.plan)
  const isSuper = Boolean(user.isSuperAdmin)
  const nextPlan = nextPlanKey(plan.key)
  const balance = getCreditBalance(user)
  const remaining = balance.total
  const expiresAt = user.planExpiresAt || 0
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000)) : 0
  const membershipStatus = isSuper ? (en ? 'Lifetime access' : '永久有效') : expiresAt ? (en ? `${daysLeft} days left` : `剩余 ${daysLeft} 天`) : (en ? 'Not active' : '未开通')
  const agentTip = isSuper
    ? (en ? 'Genki AI is available without limits for deeper follow-up while you read.' : '元气 Agent 可随时开启咨询与追问，适合在阅读报告时持续深入交流。')
    : (en ? `Genki AI is usage-based. ${remaining.toLocaleString('en-US')} credits are available.` : `元气 Agent 按实际用量结算；当前可用 ${remaining.toLocaleString('zh-CN')} 积分，优先使用当月额度。`)

  const flash = (text, type = 'ok') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 2600)
  }

  const saveNickname = async () => {
    const res = await updateProfile(user.id, { nickname })
    if (!res.ok) return flash(res.msg, 'err')
    setEditing(false)
    onUpdate(res.user)
    flash(en ? 'Display name updated' : '昵称已更新')
  }

  const saveAvatar = async (avatar) => {
    const res = await updateProfile(user.id, { avatar })
    if (!res.ok) return flash(res.msg, 'err')
    setAvatarOpen(false)
    onUpdate(res.user)
    setAvatarSaved(true)
  }

  const pickAvatar = async (avatar) => {
    if (avatarBusy) return
    setAvatarBusy(true)
    try { await saveAvatar(avatar) } finally { setAvatarBusy(false) }
  }

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return flash(en ? 'Choose a PNG, JPG, or WebP image.' : '请选择 PNG、JPG 或 WebP 图片', 'err')
    if (file.size > MAX_AVATAR_SOURCE_BYTES) return flash(en ? 'Image must be under 8MB.' : '图片请控制在 8MB 以内', 'err')
    setAvatarBusy(true)
    try {
      await saveAvatar(await compressAvatar(file))
    } catch (error) {
      flash(error.message || (en ? 'Could not upload image. Please try again.' : '头像上传失败，请重试'), 'err')
    } finally {
      setAvatarBusy(false)
    }
  }

  const upgrade = (key) => {
    if (key === user.plan) return
    onSubscribe && onSubscribe(key)
  }

  const savePwd = async () => {
    if (newPwd !== confirm) return flash(en ? 'New passwords do not match.' : '两次输入的新密码不一致', 'err')
    const res = await changePassword(user.id, oldPwd, newPwd)
    if (!res.ok) return flash(res.msg, 'err')
    setOldPwd(''); setNewPwd(''); setConfirm('')
    flash(en ? 'Password updated. Use it next time you sign in.' : '密码已更新，下次请用新密码登录')
  }

  const doLogout = () => {
    logout()
    onLogout()
  }

  return (
    <section className="profile-page">
      <div className="profile-head">
        <button className="page-back" onClick={onBack} aria-label={en ? 'Back to home' : '返回首页'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>{en ? 'Back' : '返回'}</span>
        </button>
        <h1 className="page-title">
          {en ? 'My ' : '我的'}<span className="zhushi">{en ? 'Genki' : '元氣'}</span>
          <span className="page-subtitle">{en ? 'Account · Membership · Settings' : '用户中心 · 会员权益 · 账号设置'}</span>
        </h1>
      </div>

      {msg && <p className={`auth-msg ${msgType === 'err' ? 'auth-msg-err' : ''}`}>{msg}</p>}

      {avatarSaved && (
        <div className="pr-avatar-confirm-mask" onClick={() => setAvatarSaved(false)}>
          <section className="pr-avatar-confirm" role="dialog" aria-modal="true" aria-labelledby="avatar-confirm-title" onClick={e => e.stopPropagation()}>
            <button className="pr-avatar-confirm-close" onClick={() => setAvatarSaved(false)} aria-label={en ? 'Close' : '关闭'}>×</button>
            <div className="pr-avatar-confirm-icon" aria-hidden="true">✓</div>
            <h2 id="avatar-confirm-title">{en ? 'Avatar updated' : '头像已更新'}</h2>
            <p>{en ? 'Your new avatar is saved to your profile.' : '新的头像已经保存到你的个人资料。'}</p>
            <button className="pr-avatar-confirm-action" onClick={() => setAvatarSaved(false)}>{en ? 'Done' : '知道了'}</button>
          </section>
        </div>
      )}

      <div className="profile-wrap">
        <section className="pr-account-overview" aria-label={en ? 'Account overview' : '账户总览'}>
          {/* 身份信息 */}
          <div className="profile-card pr-id-card">
            <div className="pr-id-avatar" onClick={() => setAvatarOpen(v => !v)} title={en ? 'Change avatar' : '点击更换头像'}>
              <span className={`pr-id-glyph ${isImageAvatar(user.avatar) ? 'pr-id-photo' : ''}`}>
                {isImageAvatar(user.avatar) ? <img src={user.avatar} alt="" /> : user.avatar}
              </span>
              <span className="pr-id-edit">✎</span>
            </div>
            <div className="pr-id-info">
              {editing ? (
                <div className="pr-nick-edit">
                  <input value={nickname} maxLength={16} onChange={e => setNickname(e.target.value)} autoFocus />
                  <button onClick={saveNickname} className="pr-nick-save">{en ? 'Save' : '保存'}</button>
                  <button onClick={() => { setEditing(false); setNickname(user.nickname) }} className="pr-nick-cancel">{en ? 'Cancel' : '取消'}</button>
                </div>
              ) : (
                <h2 className="pr-nick" onClick={() => setEditing(true)} title={en ? 'Edit display name' : '点击修改昵称'}>
                  {user.nickname} <span className="pr-nick-pen">✎</span>
                </h2>
              )}
              <p className="pr-account">{user.account}</p>
              <p className="pr-join">{en ? `Day ${days} · Joined ${new Date(user.createdAt).toLocaleDateString('en-US')}` : `加入第 ${days} 天 · ${new Date(user.createdAt).toLocaleDateString('zh-CN')} 加入`}</p>
            </div>
            <div className="pr-badge">
              <div className="pr-badge-row">
                <span className={`pr-badge-tag ${(PLAN_STYLE[user.plan] || PLAN_STYLE.free).cls}`}>{en ? (isSuper ? 'Admin' : plan.en) : (PLAN_STYLE[user.plan] || PLAN_STYLE.free).label}</span>
                <button className="pr-logout-btn" onClick={doLogout} title={en ? 'Sign out' : '退出登录'} aria-label={en ? 'Sign out' : '退出登录'}>↪</button>
              </div>
            </div>
          </div>

          {avatarOpen && (
            <div className="pr-avatar-picker">
              {AVATARS.map(a => (
                <button key={a} className={`pr-avatar-opt ${a === user.avatar ? 'active' : ''}`} onClick={() => pickAvatar(a)} disabled={avatarBusy}>{a}</button>
              ))}
              <input ref={avatarInputRef} className="pr-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} />
              <button className="pr-avatar-upload" onClick={() => avatarInputRef.current?.click()} disabled={avatarBusy}>
                <span aria-hidden="true">＋</span>
                <b>{avatarBusy ? (en ? 'Working…' : '处理中') : (en ? 'Upload image' : '上传图片')}</b>
              </button>
            </div>
          )}

          <div className="pr-account-tools" aria-label={en ? 'Account tools' : '账户工具'}>
            <button className="pr-account-tool pr-report-tool" onClick={() => onReports?.()}>
              <span className="pr-tool-kicker">REPORT ARCHIVE</span>
              <strong>{reportCount ?? (historyCount + tarotCount || '—')}</strong>
              <span className="pr-tool-title">{en ? 'My reports' : '我的报告'}</span>
              <small>{en ? 'View all' : '查看全部记录'} <i>›</i></small>
            </button>
            <div className="pr-account-tool pr-points-tool">
              <span className="pr-tool-kicker">{en ? 'CREDITS' : '积分账户'}</span>
              <strong>{isSuper ? '∞' : remaining.toLocaleString(en ? 'en-US' : 'zh-CN')}<em>{isSuper ? '' : (en ? ' credits' : ' 积分')}</em></strong>
              <span className="pr-tool-title">{isSuper ? (en ? 'Full access' : '全量使用权限') : (en ? 'Available credits' : '可用积分')}</span>
              <button className="pr-points-action" onClick={() => nextPlan ? upgrade(nextPlan) : onSubscribe?.(null, { selectPlan: true })}>
                {nextPlan ? (en ? 'Upgrade' : `升级至${PLAN_STYLE[nextPlan].label}`) : (en ? 'Manage membership' : '会员订阅管理')} <i>›</i>
              </button>
            </div>
          </div>

          <div className="pr-agent-strip">
            <span className="pr-agent-sigil" aria-hidden="true">✦</span>
            <p><b>Genki AI</b><span>{agentTip}</span></p>
            <button onClick={() => onAskAgent?.()}>{en ? 'Ask AI' : '去咨询'}</button>
          </div>
        </section>

        {/* 会员权益 */}
        <div className="profile-block">
          <h3 className="pr-block-title">{en ? 'Membership' : '会员权益'}</h3>
          <p className="pr-block-sub">{en ? <>Current plan: <b className="pr-current-plan">{plan.en}</b></> : <>当前为 <b className="pr-current-plan">{plan.name}</b> · {plan.desc}</>}</p>
          <div className="pr-plans">
            {PLANS.map(p => (
              <div key={p.key} className={`pr-plan ${p.key === user.plan ? 'active' : ''}`}>
                <div className="pr-plan-top">
                  <span className="pr-plan-name">{en ? p.en : p.name}</span>
                  {!en && <span className="pr-plan-en">{p.en}</span>}
                  {p.hot && <span className="pr-plan-hot">{en ? 'Popular' : '推荐'}</span>}
                </div>
                <p className="pr-plan-price"><b>¥{p.price}</b><span>/{en ? 'month' : '月'}</span></p>
                <ul className="pr-plan-benefits">
                  {p.benefits.map(b => <li key={b}>✓ {en ? 'Included feature' : b}</li>)}
                </ul>
                <button
                  className={`pr-plan-btn ${p.key === user.plan ? 'pr-plan-btn-current' : ''}`}
                  disabled={p.key === user.plan}
                  onClick={() => upgrade(p.key)}
                >
                  {p.key === user.plan ? (en ? 'Current plan' : '当前会员') : (en ? 'Upgrade' : `升级${p.name}`)}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 账号设置 */}
        <div className="profile-block pr-account-block">
          <h3 className="pr-block-title">{en ? 'Account settings' : '账号设置'}</h3>
          <div className="profile-card pr-account-settings">
            <div className="pr-set">
              <div className="pr-set-row">
                <div className="pr-set-label">
                  <span className="pr-set-icon">🔒</span>
                  <div className="pr-set-copy">
                    <b>{en ? 'Password security' : '密码安全'}</b>
                    <p>{en ? 'Update your password to protect your account.' : '定期更新密码，保护账户安全'}</p>
                    <button className="pr-set-btn" onClick={savePwd}>{en ? 'Change password' : '修改密码'}</button>
                  </div>
                </div>
                <div className="pr-pwd-fields">
                  <input type="password" placeholder={en ? 'Current password' : '当前密码'} value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
                  <input type="password" placeholder={en ? 'New password (8+ characters)' : '新密码（至少 8 位）'} value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                  <input type="password" placeholder={en ? 'Confirm new password' : '确认新密码'} value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
              </div>
            </div>

          </div>
        </div>

        <p className="profile-foot">{en ? 'Genki · Your reports and conversations are securely saved to your account.' : '元氣滿滿 · 报告与咨询记录会安全归入你的账号'}</p>
      </div>
    </section>
  )
}
