import { useState, useEffect } from 'react'
import { register, registerBySms, registerByWechat, sendAuthSmsCode } from '../data/users.js'
import { api } from '../api/client.js'
import { useLocale } from '../i18n.jsx'

const REGISTER_COPY = {
  'zh-CN': {
    backHome: '返回首页', back: '返回', title: '遇见', subtitle: '创建一个账号，开启你的元氣命理之旅', methods: ['扫码注册', '手机短信', '账号注册'], recommended: '推荐', smsDisabled: '手机短信注册正在接入，暂请使用账号注册。', wechatDisabled: '微信扫码注册正在接入，暂请使用账号注册。',
    nickname: '昵称', nicknamePlaceholder: '给自己起个元氣昵称', account: '账号', accountPlaceholder: '3-24 位字母、数字或 . _ -', email: '绑定邮箱', emailPlaceholder: '用于找回密码', password: '密码', passwordPlaceholder: '至少 8 位，含字母和数字', confirm: '确认密码', confirmPlaceholder: '再输一遍', show: '显示密码', hide: '隐藏密码', registering: '注 册 中…', register: '注 册',
    phone: '手机号', phonePlaceholder: '请输入 11 位手机号', code: '验证码', codePlaceholder: '6 位验证码', getCode: '获取验证码', smsRegister: '短信注册', scanTip: '使用微信「扫一扫」完成注册，扫码后自动创建账号并登录，无需设置密码。', demoMode: '（当前为开发降级模式，未配置微信）', scanned: '✓ 已扫码 · 确认注册', scan: '📷 打开扫码 · 识别注册', backendDown: '后端未连接，将使用演示二维码完成注册。', hasAccount: '已有账号？', login: '直接登录', agree: '注册即代表同意', terms: '《用户协议》', privacy: '《隐私政策》', passwordMismatch: '两次输入的密码不一致', failed: '注册失败，请重试', codeSent: '验证码已发送，请注意查收。', devCode: '开发验证码', scanUnavailable: '微信扫码暂不可用，请稍后再试', serviceUnavailable: '服务暂不可用，请稍后重试', scanFailed: '微信注册失败，请重试',
  },
  'zh-TW': {
    backHome: '返回首頁', back: '返回', title: '遇見', subtitle: '建立帳號，開啟你的元氣命理之旅', methods: ['掃碼註冊', '手機簡訊', '帳號註冊'], recommended: '推薦', smsDisabled: '手機簡訊註冊正在接入，暫請使用帳號註冊。', wechatDisabled: '微信掃碼註冊正在接入，暫請使用帳號註冊。',
    nickname: '暱稱', nicknamePlaceholder: '給自己起個元氣暱稱', account: '帳號', accountPlaceholder: '3-24 位字母、數字或 . _ -', email: '綁定信箱', emailPlaceholder: '用於找回密碼', password: '密碼', passwordPlaceholder: '至少 8 位，含字母和數字', confirm: '確認密碼', confirmPlaceholder: '再輸一遍', show: '顯示密碼', hide: '隱藏密碼', registering: '註 冊 中…', register: '註 冊',
    phone: '手機號', phonePlaceholder: '請輸入 11 位手機號', code: '驗證碼', codePlaceholder: '6 位驗證碼', getCode: '取得驗證碼', smsRegister: '簡訊註冊', scanTip: '使用微信「掃一掃」完成註冊，掃碼後自動建立帳號並登入，無需設定密碼。', demoMode: '（目前為開發降級模式，未設定微信）', scanned: '✓ 已掃碼 · 確認註冊', scan: '📷 開啟掃碼 · 識別註冊', backendDown: '後端未連線，將使用示範 QR Code 完成註冊。', hasAccount: '已有帳號？', login: '直接登入', agree: '註冊即代表同意', terms: '《使用者協議》', privacy: '《隱私政策》', passwordMismatch: '兩次輸入的密碼不一致', failed: '註冊失敗，請重試', codeSent: '驗證碼已發送，請注意查收。', devCode: '開發驗證碼', scanUnavailable: '微信掃碼暫不可用，請稍後再試', serviceUnavailable: '服務暫不可用，請稍後重試', scanFailed: '微信註冊失敗，請重試',
  },
  en: {
    backHome: 'Back to home', back: 'Back', title: 'Welcome to', subtitle: 'Create an account to begin your Genki journey', methods: ['QR sign-up', 'SMS', 'Account'], recommended: 'Recommended', smsDisabled: 'SMS sign-up is not available yet. Please use an account.', wechatDisabled: 'QR sign-up is not available yet. Please use an account.',
    nickname: 'Display name', nicknamePlaceholder: 'Choose a name', account: 'Username', accountPlaceholder: '3-24 letters, numbers, . _ -', email: 'Email', emailPlaceholder: 'For password recovery', password: 'Password', passwordPlaceholder: '8+ characters, letters and numbers', confirm: 'Confirm password', confirmPlaceholder: 'Enter it again', show: 'Show password', hide: 'Hide password', registering: 'Creating account…', register: 'Sign up',
    phone: 'Phone', phonePlaceholder: 'Enter your phone number', code: 'Code', codePlaceholder: '6-digit code', getCode: 'Get code', smsRegister: 'Sign up by SMS', scanTip: 'Scan with WeChat to create an account and sign in without a password.', demoMode: '(Development demo: WeChat is not configured)', scanned: 'Scanned · Create account', scan: 'Open QR sign-up', backendDown: 'Server unavailable. A demo QR code will be used.', hasAccount: 'Already have an account?', login: 'Sign in', agree: 'By signing up, you agree to the ', terms: 'Terms of Service', privacy: 'Privacy Policy', passwordMismatch: 'Passwords do not match', failed: 'Could not create your account. Please try again.', codeSent: 'Code sent. Please check your messages.', devCode: 'Development code', scanUnavailable: 'QR sign-up is unavailable. Please try again later.', serviceUnavailable: 'Service is unavailable. Please try again later.', scanFailed: 'QR sign-up failed. Please try again.',
  },
}

export default function RegisterPage({ onBack, onSwitch, onOpenLegal, onSuccess }) {
  const { locale } = useLocale()
  const copy = REGISTER_COPY[locale] || REGISTER_COPY['zh-CN']
  // 注册优先「扫码识别」：默认停在扫码注册 tab，扫码成功自动建号并登录
  const [method, setMethod] = useState('wechat') // wechat | account
  const [nickname, setNickname] = useState('')
  const [account, setAccount] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsNote, setSmsNote] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  // 微信扫码注册
  const [busy, setBusy] = useState(false)
  const [mock, setMock] = useState(null) // 后端降级时的二维码信息
  const [serverOk, setServerOk] = useState(false)
  const [serverChecked, setServerChecked] = useState(false)

  // 后端可用性探测：决定扫码注册走真实授权还是本地演示
  useEffect(() => {
    let alive = true
    api.health().then(r => {
      if (alive) {
        // 看「服务器答不答话」，不看 AI 通道就绪与否 —— 注册用不到 AI。
        setServerOk(Boolean(r && r.reachable))
        setServerChecked(true)
      }
    }).catch(() => {
      if (alive) {
        setServerOk(false)
        setServerChecked(true)
      }
    })
    return () => { alive = false }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (password !== confirm) {
      setErr(copy.passwordMismatch)
      return
    }
    setLoading(true)
    try {
      const res = await register({ nickname, account, email, password })
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
      const res = await sendAuthSmsCode(phone, 'register')
      if (!res.ok) { setErr(res.msg); return }
      setSmsNote(res.devCode ? `${copy.devCode}: ${res.devCode}` : copy.codeSent)
    } finally { setLoading(false) }
  }

  const handleSmsRegister = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const res = await registerBySms(phone, smsCode)
      if (!res.ok) { setErr(res.msg); return }
      onSuccess(res.user)
    } finally { setLoading(false) }
  }

  // 扫码注册：后端已配置则跳转真实微信授权，未连接/未配置则本地演示（模拟扫码即自动建号登录）
  const handleWechat = async () => {
    setErr('')
    setBusy(true)
    try {
      if (!serverChecked || !serverOk) {
        // 本地降级：直接呈现演示二维码，点确认即模拟完成扫码
        setMock({ mock: true, qrText: '（后端未连接 · 本地演示二维码，点击下方按钮即模拟「扫码完成」，自动注册并登录）' })
        return
      }
      const r = await api.wechatQr()
      if (r.mock) {
        // 后端已配置但未接入：显示演示二维码，模拟扫码完成
        setMock(r)
      } else if (r.url) {
        // 真实授权：跳转微信
        window.location.href = r.url
      }
    } catch (e) {
      setErr(copy.scanUnavailable)
    } finally {
      setBusy(false)
    }
  }

  // 演示/降级模式：模拟扫码完成 → 用 openid 本地建号并自动登录
  const handleMockScan = async () => {
    setErr('')
    setBusy(true)
    try {
      if (!serverChecked || !serverOk) {
        // 账号已迁到服务端（R2 M1）：没有后端就没有账号可建。
        // 此前这里会在本地凭空造一个账号，那种账号换台设备就不存在、也拿不到
        // 任何服务端额度，等于给用户一个看着像登录成功、实际什么都不是的状态。
        setErr(copy.serviceUnavailable)
        return
      }
      const done = await api.wechatMockDone({})
      const res = await registerByWechat(done.openid || done.token, '微信用户')
      if (!res.ok) {
        setErr(res.msg)
        return
      }
      onSuccess(res.user)
    } catch (e) {
      setErr(copy.scanFailed)
    } finally {
      setBusy(false)
    }
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
        <div className="auth-card">
          <div className="auth-seal" aria-hidden="true">
            <span className="auth-seal-glyph">🌸</span>
            <span className="auth-seal-ring" />
          </div>
          <h2 className="auth-title">
            {copy.title}<span className="zhushi">·</span>元氣滿滿
          </h2>
          <p className="auth-sub">{copy.subtitle}</p>

          <div className="auth-methods auth-methods-three" role="tablist" aria-label={copy.register}>
            <button
              className={`auth-method ${method === 'wechat' ? 'active' : ''}`}
              onClick={() => { setMethod('wechat'); setErr('') }}
              role="tab"
              aria-selected={method === 'wechat'}
            >
              {copy.methods[0]}
            </button>
            <button
              className={`auth-method ${method === 'sms' ? 'active' : ''}`}
              onClick={() => { setMethod('sms'); setErr('') }}
              role="tab"
              aria-selected={method === 'sms'}
            >
              {copy.methods[1]}<span className="auth-hot-tag">{copy.recommended}</span>
            </button>
            <button
              className={`auth-method ${method === 'account' ? 'active' : ''}`}
              onClick={() => { setMethod('account'); setErr('') }}
              role="tab"
              aria-selected={method === 'account'}
            >
              {copy.methods[2]}
            </button>
          </div>
          {method === 'sms' && <p className="auth-dev-note">{copy.smsDisabled}</p>}
          {method === 'wechat' && <p className="auth-dev-note">{copy.wechatDisabled}</p>}

          {method === 'account' ? (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <label htmlFor="reg-nick">{copy.nickname}</label>
                <input
                  id="reg-nick"
                  type="text"
                  placeholder={copy.nicknamePlaceholder}
                  value={nickname}
                  maxLength={16}
                  autoComplete="nickname"
                  onChange={e => setNickname(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="reg-account">{copy.account}</label>
                <input
                  id="reg-account"
                  type="text"
                  placeholder={copy.accountPlaceholder}
                  value={account}
                  autoComplete="username"
                  onChange={e => setAccount(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="reg-email">{copy.email}</label>
                <input
                  id="reg-email"
                  type="email"
                  inputMode="email"
                  placeholder={copy.emailPlaceholder}
                  value={email}
                  autoComplete="email"
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label htmlFor="reg-pwd">{copy.password}</label>
                  <div className="auth-password-wrap">
                    <input id="reg-pwd" type={showPassword ? 'text' : 'password'} placeholder={copy.passwordPlaceholder} value={password} autoComplete="new-password" onChange={e => setPassword(e.target.value)} />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? copy.hide : copy.show} title={showPassword ? copy.hide : copy.show}><EyeIcon open={showPassword} /></button>
                  </div>
                </div>
                <div className="auth-field">
                  <label htmlFor="reg-pwd2">{copy.confirm}</label>
                  <div className="auth-password-wrap">
                    <input id="reg-pwd2" type={showConfirm ? 'text' : 'password'} placeholder={copy.confirmPlaceholder} value={confirm} autoComplete="new-password" onChange={e => setConfirm(e.target.value)} />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowConfirm(value => !value)} aria-label={showConfirm ? copy.hide : copy.show} title={showConfirm ? copy.hide : copy.show}><EyeIcon open={showConfirm} /></button>
                  </div>
                </div>
              </div>

              {err && <p className="auth-err">{err}</p>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? copy.registering : copy.register}
              </button>
            </form>
          ) : method === 'sms' ? (
            <form className="auth-form" onSubmit={handleSmsRegister} noValidate>
              <div className="auth-field">
                <label htmlFor="reg-phone">{copy.phone}</label>
                <input id="reg-phone" type="tel" inputMode="numeric" placeholder={copy.phonePlaceholder} value={phone} autoComplete="tel" disabled onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
              </div>
              <div className="auth-field">
                <label htmlFor="reg-code">{copy.code}</label>
                <div className="auth-code-wrap">
                  <input id="reg-code" inputMode="numeric" placeholder={copy.codePlaceholder} value={smsCode} autoComplete="one-time-code" disabled onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                  <button type="button" className="auth-code-send" onClick={handleSendCode} disabled>{copy.getCode}</button>
                </div>
              </div>
              {smsNote && <p className="auth-dev-note">{smsNote}</p>}
              {err && <p className="auth-err">{err}</p>}
              <button type="submit" className="auth-btn" disabled>{copy.smsRegister}</button>
            </form>
          ) : (
            <div className="auth-wechat">
              <div className="auth-wechat-tip">
                {copy.scanTip}
              </div>
              {mock ? (
                <div className="auth-qr-demo">
                  <div className="auth-qr-box" aria-hidden="true">
                    <span className="auth-qr-grid" />
                    <span className="auth-qr-logo">💬</span>
                  </div>
                  <div className="auth-qr-text">{mock.qrText || copy.demoMode}</div>
                  <button className="auth-btn" onClick={handleMockScan} disabled>
                    {copy.scanned}
                  </button>
                  </div>
                  ) : (
                  <button className="auth-btn" onClick={handleWechat} disabled>
                  {copy.scan}
                  </button>
                  )}
              {!serverOk && !mock && (
                <div className="auth-dev-note">{copy.backendDown}</div>
              )}
              {err && <p className="auth-err">{err}</p>}
            </div>
          )}

          <p className="auth-switch">
            {copy.hasAccount}
            <button onClick={onSwitch}>{copy.login}</button>
          </p>

          <p className="auth-tip">{copy.agree}
            <button type="button" className="auth-legal-link" onClick={() => onOpenLegal?.('terms')}>{copy.terms}</button>
            {locale === 'en' ? ' and the ' : '与'}
            <button type="button" className="auth-legal-link" onClick={() => onOpenLegal?.('privacy')}>{copy.privacy}</button>{locale === 'en' ? '.' : ''}
          </p>
        </div>
      </div>
    </section>
  )
}

function EyeIcon({ open }) {
  return open ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0112 4c5.2 0 8.6 4.1 9.6 6.1a1.9 1.9 0 010 1.8 13.9 13.9 0 01-3.3 4.1" /><path d="M6.3 6.3A13.8 13.8 0 002.4 10.1a1.9 1.9 0 000 1.8C3.4 13.9 6.8 18 12 18c1.2 0 2.3-.2 3.3-.6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.4 12S5.8 6 12 6s9.6 6 9.6 6-3.4 6-9.6 6-9.6-6-9.6-6z" /><circle cx="12" cy="12" r="2.7" /></svg>
}
