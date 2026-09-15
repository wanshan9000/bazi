import { useState } from 'react'
import { login, loginBySms, registerByWechat, sendAuthSmsCode } from '../data/users.js'
import { api } from '../api/client.js'
import { useLocale } from '../i18n.jsx'

const LOGIN_COPY = {
  'zh-CN': { back: '返回', backHome: '返回首页', wish: '把好奇，', wishEm: '留给自己', wishCopy: '登录后，命盘、报告与咨询记录都会安稳地留在这里。', wishNote: '注册即可开始一段自己的探索', gift: '注册赠 20 积分', point: '点', credit: '1 积分 = 19,000 Token；元气 Agent 按实际用量结算，积分永久有效。', benefits: ['命盘留存', '报告同步', '咨询元气 Agent'], title: '欢迎回来', subtitle: '登录后保存你的命盘足迹，解锁会员权益', methods: ['扫码登录', '手机短信', '账号登录'], account: '账号', accountInput: '请输入账号', password: '密码', passwordInput: '请输入密码', login: '登 录', loggingIn: '登 录 中…', phone: '手机号', phoneInput: '请输入 11 位手机号', code: '验证码', codeInput: '6 位验证码', send: '获取验证码', smsLogin: '短信登录', qrTip: '使用微信扫一扫确认登录，无需输入密码。', qrOpen: '打开扫码登录', noAccount: '还没有账号？', register: '立即注册', legal: '登录即代表同意《用户协议》与《隐私政策》', hide: '隐藏密码', show: '显示密码', failed: '登录失败，请重试', smsSent: '验证码已发送，请注意查收。' },
  'zh-TW': { back: '返回', backHome: '返回首頁', wish: '把好奇，', wishEm: '留給自己', wishCopy: '登入後，命盤、報告與諮詢紀錄都會安穩地留在這裡。', wishNote: '註冊即可開始一段自己的探索', gift: '註冊贈 20 積分', point: '點', credit: '1 積分 = 19,000 Token；元氣 Agent 按實際用量結算，積分永久有效。', benefits: ['命盤留存', '報告同步', '諮詢元氣 Agent'], title: '歡迎回來', subtitle: '登入後保存你的命盤足跡，解鎖會員權益', methods: ['掃碼登入', '手機簡訊', '帳號登入'], account: '帳號', accountInput: '請輸入帳號', password: '密碼', passwordInput: '請輸入密碼', login: '登 入', loggingIn: '登 入 中…', phone: '手機號碼', phoneInput: '請輸入 11 位手機號碼', code: '驗證碼', codeInput: '6 位驗證碼', send: '取得驗證碼', smsLogin: '簡訊登入', qrTip: '使用微信掃一掃確認登入，無需輸入密碼。', qrOpen: '開啟掃碼登入', noAccount: '還沒有帳號？', register: '立即註冊', legal: '登入即代表同意《使用者協議》與《隱私政策》', hide: '隱藏密碼', show: '顯示密碼', failed: '登入失敗，請重試', smsSent: '驗證碼已發送，請注意查收。' },
  en: { back: 'Back', backHome: 'Back to home', wish: 'Keep your', wishEm: 'curiosity close', wishCopy: 'After you sign in, your charts, reports, and conversations stay safely in one place.', wishNote: 'Create an account to begin your own exploration', gift: '20 credits on sign-up', point: 'credits', credit: '1 credit = 19,000 Tokens. Genki Agent charges by actual use; credits do not expire.', benefits: ['Save charts', 'Sync reports', 'Ask Genki AI'], title: 'Welcome back', subtitle: 'Save your chart journey and unlock member benefits', methods: ['QR sign in', 'SMS sign in', 'Account sign in'], account: 'Account', accountInput: 'Enter your account', password: 'Password', passwordInput: 'Enter your password', login: 'Sign in', loggingIn: 'Signing in…', phone: 'Phone number', phoneInput: 'Enter an 11-digit phone number', code: 'Verification code', codeInput: '6-digit code', send: 'Send code', smsLogin: 'Sign in by SMS', qrTip: 'Use WeChat to scan and confirm. No password needed.', qrOpen: 'Open QR sign-in', noAccount: 'New here?', register: 'Create account', legal: 'By signing in, you agree to the Terms of Service and Privacy Policy.', hide: 'Hide password', show: 'Show password', failed: 'Sign-in failed. Please try again.', smsSent: 'Code sent. Please check your messages.' },
}

export default function LoginPage({ onBack, onSwitch, onSuccess }) {
  const { locale } = useLocale()
  const copy = LOGIN_COPY[locale] || LOGIN_COPY['zh-CN']
  const [method, setMethod] = useState('sms')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [smsNote, setSmsNote] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const res = await login(account, password)
      if (!res.ok) { setErr(res.msg); return }
      onSuccess(res.user)
    } catch (e) {
      setErr(copy.failed)
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    setErr(''); setSmsNote(''); setLoading(true)
    try {
      const res = await sendAuthSmsCode(phone, 'login')
      if (!res.ok) { setErr(res.msg); return }
      setSmsNote(res.devCode ? `${locale === 'en' ? 'Development code' : '开发验证码'}：${res.devCode}` : copy.smsSent)
    } finally { setLoading(false) }
  }

  const handleSmsLogin = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const res = await loginBySms(phone, code)
      if (!res.ok) { setErr(res.msg); return }
      onSuccess(res.user)
    } finally { setLoading(false) }
  }

  const handleWechatLogin = async () => {
    setErr(''); setLoading(true)
    try {
      const qr = await api.wechatQr()
      if (!qr.mock && qr.url) {
        window.location.href = qr.url
        return
      }
      const done = await api.wechatMockDone({})
      const res = await registerByWechat(done.openid || done.token, '微信用户')
      if (!res.ok) { setErr(res.msg); return }
      onSuccess(res.user)
    } finally { setLoading(false) }
  }

  return (
    <section className="auth-page">
      <button className="page-back auth-back" onClick={onBack} aria-label={copy.backHome}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>{copy.back}</span>
      </button>

      <div className="auth-wrap">
        <aside className="agent-credit-hint auth-credit-hint auth-wish-panel">
          <div className="auth-wish-stars" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></div>
          <div className="auth-wish-seal" aria-hidden="true"><span>愿</span></div>
          <p className="auth-wish-eyebrow">YOUR GENKI ACCOUNT</p>
          <h2 className="auth-wish-title">{copy.wish}<em>{copy.wishEm}</em></h2>
          <p className="auth-wish-copy">{copy.wishCopy}</p>
          <div className="auth-wish-note"><span aria-hidden="true">✦</span> {copy.wishNote}</div>
          <div className="auth-credit-balance">
            <span>{copy.gift}</span>
            <strong>20<small>{copy.point}</small></strong>
          </div>
          <p className="auth-credit-copy">{copy.credit}</p>
          <div className="auth-credit-tags" aria-label={copy.benefits.join('、')}>{copy.benefits.map(item => <span key={item}>{item}</span>)}</div>
        </aside>

        <div className="auth-card">
          <div className="auth-seal" aria-hidden="true">
            <span className="auth-seal-glyph">🐻</span>
            <span className="auth-seal-ring" />
          </div>
          <h2 className="auth-title">
            {copy.title}<span className="zhushi">·</span>元氣滿滿
          </h2>
          <p className="auth-sub">{copy.subtitle}</p>

          <div className="auth-methods auth-methods-three" role="tablist" aria-label={copy.login}>
            <button className={`auth-method ${method === 'wechat' ? 'active' : ''}`} onClick={() => { setMethod('wechat'); setErr('') }} role="tab" aria-selected={method === 'wechat'}>{copy.methods[0]}</button>
            <button className={`auth-method ${method === 'sms' ? 'active' : ''}`} onClick={() => { setMethod('sms'); setErr('') }} role="tab" aria-selected={method === 'sms'}>{copy.methods[1]}</button>
            <button className={`auth-method ${method === 'account' ? 'active' : ''}`} onClick={() => { setMethod('account'); setErr('') }} role="tab" aria-selected={method === 'account'}>{copy.methods[2]}</button>
          </div>

          {method === 'account' && <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="login-account">{copy.account}</label>
              <input
                id="login-account"
                type="text"
                placeholder={copy.accountInput}
                value={account}
                autoComplete="username"
                onChange={e => setAccount(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="login-pwd">{copy.password}</label>
              <div className="auth-password-wrap">
                <input id="login-pwd" type={showPassword ? 'text' : 'password'} placeholder={copy.passwordInput} value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? copy.hide : copy.show} title={showPassword ? copy.hide : copy.show}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {err && <p className="auth-err">{err}</p>}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? copy.loggingIn : copy.login}
            </button>
          </form>}

          {method === 'sms' && <form className="auth-form" onSubmit={handleSmsLogin} noValidate>
            <div className="auth-field">
              <label htmlFor="login-phone">{copy.phone}</label>
              <input id="login-phone" type="tel" inputMode="numeric" placeholder={copy.phoneInput} value={phone} autoComplete="tel" onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
            </div>
            <div className="auth-field">
              <label htmlFor="login-code">{copy.code}</label>
              <div className="auth-code-wrap">
                <input id="login-code" inputMode="numeric" placeholder={copy.codeInput} value={code} autoComplete="one-time-code" onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                <button type="button" className="auth-code-send" onClick={handleSendCode} disabled={loading || phone.length !== 11}>{copy.send}</button>
              </div>
            </div>
            {smsNote && <p className="auth-dev-note">{smsNote}</p>}
            {err && <p className="auth-err">{err}</p>}
            <button type="submit" className="auth-btn" disabled={loading}>{loading ? copy.loggingIn : copy.smsLogin}</button>
          </form>}

          {method === 'wechat' && <div className="auth-wechat">
            <div className="auth-qr-box" aria-hidden="true"><span className="auth-qr-grid" /><span className="auth-qr-logo">微</span></div>
            <p className="auth-wechat-tip">{copy.qrTip}</p>
            {err && <p className="auth-err">{err}</p>}
            <button className="auth-btn" onClick={handleWechatLogin} disabled={loading}>{loading ? copy.loggingIn : copy.qrOpen}</button>
          </div>}

          <p className="auth-switch">
            {copy.noAccount}
            <button onClick={onSwitch}>{copy.register}</button>
          </p>

          <p className="auth-tip">{copy.legal}</p>
        </div>
      </div>
    </section>
  )
}

function EyeIcon({ open }) {
  return open ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0112 4c5.2 0 8.6 4.1 9.6 6.1a1.9 1.9 0 010 1.8 13.9 13.9 0 01-3.3 4.1" /><path d="M6.3 6.3A13.8 13.8 0 002.4 10.1a1.9 1.9 0 000 1.8C3.4 13.9 6.8 18 12 18c1.2 0 2.3-.2 3.3-.6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.4 12S5.8 6 12 6s9.6 6 9.6 6-3.4 6-9.6 6-9.6-6-9.6-6z" /><circle cx="12" cy="12" r="2.7" /></svg>
}
