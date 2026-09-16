import { useEffect, useState } from 'react'
import { resetPasswordByEmail, sendPasswordResetCode } from '../data/users.js'
import { useLocale } from '../i18n.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function ForgotPasswordPage({ onBack, onLogin }) {
  const { locale } = useLocale()
  const en = locale === 'en'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cooldown) return undefined
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const sendCode = async () => {
    const value = email.trim().toLowerCase()
    setError(''); setMessage('')
    if (!EMAIL_RE.test(value)) return setError(en ? 'Enter a valid account email.' : '请输入正确的绑定邮箱')
    setLoading(true)
    try {
      const result = await sendPasswordResetCode(value)
      if (!result.ok) return setError(result.msg)
      setMessage(result.msg)
      setCooldown(60)
    } finally { setLoading(false) }
  }

  const submit = async event => {
    event.preventDefault()
    setError(''); setMessage('')
    if (password !== confirm) return setError(en ? 'Passwords do not match.' : '两次输入的密码不一致')
    setLoading(true)
    try {
      const result = await resetPasswordByEmail(email, code, password)
      if (!result.ok) return setError(result.msg)
      setMessage(en ? 'Password reset. You can now sign in with your new password.' : '密码已重置，请使用新密码登录。')
    } finally { setLoading(false) }
  }

  return <section className="auth-page">
    <button className="page-back auth-back" onClick={onBack} aria-label={en ? 'Back to sign in' : '返回登录'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      <span>{en ? 'Back to sign in' : '返回登录'}</span>
    </button>
    <div className="auth-wrap auth-wrap-reset">
      <aside className="agent-credit-hint auth-credit-hint auth-wish-panel">
        <div className="auth-wish-stars" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></div>
        <div className="auth-wish-seal" aria-hidden="true"><span>信</span></div>
        <p className="auth-wish-eyebrow">ACCOUNT RECOVERY</p>
        <h2 className="auth-wish-title">{en ? 'Recover access to' : '重新掌握'}<em>{en ? 'your account' : '自己的入口'}</em></h2>
        <p className="auth-wish-copy">{en ? 'We send a code only to the email on your account. Verify it to set a new password.' : '验证码只会发送到账号已绑定的邮箱，验证后即可设置新的登录密码。'}</p>
      </aside>
      <div className="auth-card auth-reset-card">
        <div className="auth-seal" aria-hidden="true"><span className="auth-seal-glyph">✦</span><span className="auth-seal-ring" /></div>
        <h2 className="auth-title">{en ? 'Reset' : '找回'}<span className="zhushi">·</span>{en ? 'password' : '密码'}</h2>
        <p className="auth-sub">{en ? 'Use your account email to reset your password' : '当前仅支持通过绑定邮箱找回'}</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field"><label htmlFor="reset-email">{en ? 'Account email' : '绑定邮箱'}</label><input id="reset-email" type="email" inputMode="email" placeholder="name@example.com" value={email} autoComplete="email" onChange={event => setEmail(event.target.value)} /></div>
          <div className="auth-field"><label htmlFor="reset-code">{en ? 'Email code' : '邮箱验证码'}</label><div className="auth-code-wrap"><input id="reset-code" inputMode="numeric" placeholder={en ? '6-digit code' : '6 位验证码'} value={code} autoComplete="one-time-code" onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button type="button" className="auth-code-send" onClick={sendCode} disabled={loading || cooldown > 0}>{cooldown ? (en ? `Resend in ${cooldown}s` : `${cooldown} 秒后重发`) : (en ? 'Get code' : '获取验证码')}</button></div></div>
          <div className="auth-row">
            <div className="auth-field"><label htmlFor="reset-password">{en ? 'New password' : '新密码'}</label><input id="reset-password" type="password" placeholder={en ? '8+ characters, letters and numbers' : '至少 8 位，含字母和数字'} value={password} autoComplete="new-password" onChange={event => setPassword(event.target.value)} /></div>
            <div className="auth-field"><label htmlFor="reset-confirm">{en ? 'Confirm password' : '确认密码'}</label><input id="reset-confirm" type="password" placeholder={en ? 'Enter it again' : '再输一遍'} value={confirm} autoComplete="new-password" onChange={event => setConfirm(event.target.value)} /></div>
          </div>
          {error && <p className="auth-err">{error}</p>}
          {message && <p className="auth-msg">{message}</p>}
          <button type="submit" className="auth-btn" disabled={loading}>{loading ? (en ? 'Working…' : '处理中…') : (en ? 'Reset password' : '确认重设密码')}</button>
        </form>
        <p className="auth-switch">{en ? 'Remembered it?' : '想起密码了？'}<button type="button" onClick={onLogin}>{en ? 'Sign in' : '返回登录'}</button></p>
      </div>
    </div>
  </section>
}
