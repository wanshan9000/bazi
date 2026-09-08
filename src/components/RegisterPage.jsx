import { useState, useEffect } from 'react'
import { register, registerBySms, registerByWechat, sendAuthSmsCode } from '../data/users.js'
import { api } from '../api/client.js'
import TurnstileField from './TurnstileField.jsx'

export default function RegisterPage({ onBack, onSwitch, onSuccess }) {
  // 注册优先「扫码识别」：默认停在扫码注册 tab，扫码成功自动建号并登录
  const [method, setMethod] = useState('wechat') // wechat | account
  const [nickname, setNickname] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsNote, setSmsNote] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

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
      setErr('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      const res = await register({ nickname, account, password, captchaToken })
      if (!res.ok) { setErr(res.msg); return }
      onSuccess(res.user)
    } catch (e) {
      setErr('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    setErr(''); setSmsNote(''); setLoading(true)
    try {
      const res = await sendAuthSmsCode(phone, 'register')
      if (!res.ok) { setErr(res.msg); return }
      setSmsNote(res.devCode ? `开发验证码：${res.devCode}` : '验证码已发送，请注意查收。')
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
      setErr('微信扫码暂不可用，请稍后再试')
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
        setErr('服务暂不可用，请稍后重试')
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
      setErr('微信注册失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth-page">
      <button className="page-back auth-back" onClick={onBack} aria-label="返回首页">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>返回</span>
      </button>

      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-seal" aria-hidden="true">
            <span className="auth-seal-glyph">🌸</span>
            <span className="auth-seal-ring" />
          </div>
          <h2 className="auth-title">
            遇见<span className="zhushi">·</span>元氣滿滿
          </h2>
          <p className="auth-sub">创建一个账号，开启你的元氣命理之旅</p>

          <div className="auth-methods auth-methods-three" role="tablist" aria-label="注册方式">
            <button
              className={`auth-method ${method === 'wechat' ? 'active' : ''}`}
              onClick={() => { setMethod('wechat'); setErr('') }}
              role="tab"
              aria-selected={method === 'wechat'}
            >
              扫码注册
            </button>
            <button
              className={`auth-method ${method === 'sms' ? 'active' : ''}`}
              onClick={() => { setMethod('sms'); setErr('') }}
              role="tab"
              aria-selected={method === 'sms'}
            >
              手机短信<span className="auth-hot-tag">推荐</span>
            </button>
            <button
              className={`auth-method ${method === 'account' ? 'active' : ''}`}
              onClick={() => { setMethod('account'); setErr('') }}
              role="tab"
              aria-selected={method === 'account'}
            >
              账号注册
            </button>
          </div>

          {method === 'account' ? (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <label htmlFor="reg-nick">昵称</label>
                <input
                  id="reg-nick"
                  type="text"
                  placeholder="给自己起个元氣昵称"
                  value={nickname}
                  maxLength={16}
                  autoComplete="nickname"
                  onChange={e => setNickname(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="reg-account">账号</label>
                <input
                  id="reg-account"
                  type="text"
                  placeholder="3-24 位字母、数字或 . _ -"
                  value={account}
                  autoComplete="username"
                  onChange={e => setAccount(e.target.value)}
                />
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label htmlFor="reg-pwd">密码</label>
                  <div className="auth-password-wrap">
                    <input id="reg-pwd" type={showPassword ? 'text' : 'password'} placeholder="至少 8 位，含字母和数字" value={password} autoComplete="new-password" onChange={e => setPassword(e.target.value)} />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'} title={showPassword ? '隐藏密码' : '显示密码'}><EyeIcon open={showPassword} /></button>
                  </div>
                </div>
                <div className="auth-field">
                  <label htmlFor="reg-pwd2">确认密码</label>
                  <div className="auth-password-wrap">
                    <input id="reg-pwd2" type={showConfirm ? 'text' : 'password'} placeholder="再输一遍" value={confirm} autoComplete="new-password" onChange={e => setConfirm(e.target.value)} />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowConfirm(value => !value)} aria-label={showConfirm ? '隐藏密码' : '显示密码'} title={showConfirm ? '隐藏密码' : '显示密码'}><EyeIcon open={showConfirm} /></button>
                  </div>
                </div>
              </div>

              <TurnstileField onToken={setCaptchaToken} onError={setErr} />

              {err && <p className="auth-err">{err}</p>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? '注 册 中…' : '注 册'}
              </button>
            </form>
          ) : method === 'sms' ? (
            <form className="auth-form" onSubmit={handleSmsRegister} noValidate>
              <div className="auth-field">
                <label htmlFor="reg-phone">手机号</label>
                <input id="reg-phone" type="tel" inputMode="numeric" placeholder="请输入 11 位手机号" value={phone} autoComplete="tel" onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
              </div>
              <div className="auth-field">
                <label htmlFor="reg-code">验证码</label>
                <div className="auth-code-wrap">
                  <input id="reg-code" inputMode="numeric" placeholder="6 位验证码" value={smsCode} autoComplete="one-time-code" onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                  <button type="button" className="auth-code-send" onClick={handleSendCode} disabled={loading || phone.length !== 11}>获取验证码</button>
                </div>
              </div>
              {smsNote && <p className="auth-dev-note">{smsNote}</p>}
              {err && <p className="auth-err">{err}</p>}
              <button type="submit" className="auth-btn" disabled={loading}>{loading ? '注 册 中…' : '短信注册'}</button>
            </form>
          ) : (
            <div className="auth-wechat">
              <div className="auth-wechat-tip">
                使用微信「扫一扫」完成注册，扫码后自动创建账号并登录，无需设置密码。
              </div>
              {mock ? (
                <div className="auth-qr-demo">
                  <div className="auth-qr-box" aria-hidden="true">
                    <span className="auth-qr-grid" />
                    <span className="auth-qr-logo">💬</span>
                  </div>
                  <div className="auth-qr-text">{mock.qrText || '（当前为开发降级模式，未配置微信）'}</div>
                  <button className="auth-btn" onClick={handleMockScan} disabled={busy}>
                    {busy ? '注 册 中…' : '✓ 已扫码 · 确认注册'}
                  </button>
                  </div>
                  ) : (
                  <button className="auth-btn" onClick={handleWechat} disabled={busy}>
                  {busy ? '获取中…' : '📷 打开扫码 · 识别注册'}
                  </button>
                  )}
              {!serverOk && !mock && (
                <div className="auth-dev-note">后端未连接，将使用演示二维码完成注册。</div>
              )}
              {err && <p className="auth-err">{err}</p>}
            </div>
          )}

          <p className="auth-switch">
            已有账号？
            <button onClick={onSwitch}>直接登录</button>
          </p>

          <p className="auth-tip">注册即代表同意《用户协议》与《隐私政策》</p>
        </div>
      </div>
    </section>
  )
}

function EyeIcon({ open }) {
  return open ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0112 4c5.2 0 8.6 4.1 9.6 6.1a1.9 1.9 0 010 1.8 13.9 13.9 0 01-3.3 4.1" /><path d="M6.3 6.3A13.8 13.8 0 002.4 10.1a1.9 1.9 0 000 1.8C3.4 13.9 6.8 18 12 18c1.2 0 2.3-.2 3.3-.6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.4 12S5.8 6 12 6s9.6 6 9.6 6-3.4 6-9.6 6-9.6-6-9.6-6z" /><circle cx="12" cy="12" r="2.7" /></svg>
}
