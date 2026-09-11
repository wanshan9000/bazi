import { useState } from 'react'
import { login, loginBySms, registerByWechat, sendAuthSmsCode } from '../data/users.js'
import { api } from '../api/client.js'

export default function LoginPage({ onBack, onSwitch, onSuccess }) {
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
      setErr('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    setErr(''); setSmsNote(''); setLoading(true)
    try {
      const res = await sendAuthSmsCode(phone, 'login')
      if (!res.ok) { setErr(res.msg); return }
      setSmsNote(res.devCode ? `开发验证码：${res.devCode}` : '验证码已发送，请注意查收。')
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
      <button className="page-back auth-back" onClick={onBack} aria-label="返回首页">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>返回</span>
      </button>

      <div className="auth-wrap">
        <aside className="agent-credit-hint auth-credit-hint auth-wish-panel">
          <div className="auth-wish-stars" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></div>
          <div className="auth-wish-seal" aria-hidden="true"><span>愿</span></div>
          <p className="auth-wish-eyebrow">YOUR GENKI ACCOUNT</p>
          <h2 className="auth-wish-title">把好奇，<em>留给自己</em></h2>
          <p className="auth-wish-copy">登录后，命盘、报告与咨询记录都会安稳地留在这里。</p>
          <div className="auth-wish-note"><span aria-hidden="true">✦</span> 注册即可开始一段自己的探索</div>
          <div className="auth-credit-balance">
            <span>注册赠 20 点永久积分</span>
            <strong>20<small>点</small></strong>
          </div>
          <p className="auth-credit-copy">可用于 4 次标准解读，或开启 4 个元气 Agent 咨询主题；每个主题含 8 次具体问题解读。</p>
          <div className="auth-credit-tags" aria-label="注册后可用权益"><span>命盘留存</span><span>报告同步</span><span>咨询元气 Agent</span></div>
        </aside>

        <div className="auth-card">
          <div className="auth-seal" aria-hidden="true">
            <span className="auth-seal-glyph">🐻</span>
            <span className="auth-seal-ring" />
          </div>
          <h2 className="auth-title">
            欢迎回来<span className="zhushi">·</span>元氣滿滿
          </h2>
          <p className="auth-sub">登录后保存你的命盘足迹，解锁会员权益</p>

          <div className="auth-methods auth-methods-three" role="tablist" aria-label="登录方式">
            <button className={`auth-method ${method === 'wechat' ? 'active' : ''}`} onClick={() => { setMethod('wechat'); setErr('') }} role="tab" aria-selected={method === 'wechat'}>扫码登录</button>
            <button className={`auth-method ${method === 'sms' ? 'active' : ''}`} onClick={() => { setMethod('sms'); setErr('') }} role="tab" aria-selected={method === 'sms'}>手机短信</button>
            <button className={`auth-method ${method === 'account' ? 'active' : ''}`} onClick={() => { setMethod('account'); setErr('') }} role="tab" aria-selected={method === 'account'}>账号登录</button>
          </div>

          {method === 'account' && <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="login-account">账号</label>
              <input
                id="login-account"
                type="text"
                placeholder="请输入账号"
                value={account}
                autoComplete="username"
                onChange={e => setAccount(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="login-pwd">密码</label>
              <div className="auth-password-wrap">
                <input id="login-pwd" type={showPassword ? 'text' : 'password'} placeholder="请输入密码" value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'} title={showPassword ? '隐藏密码' : '显示密码'}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {err && <p className="auth-err">{err}</p>}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? '登 录 中…' : '登 录'}
            </button>
          </form>}

          {method === 'sms' && <form className="auth-form" onSubmit={handleSmsLogin} noValidate>
            <div className="auth-field">
              <label htmlFor="login-phone">手机号</label>
              <input id="login-phone" type="tel" inputMode="numeric" placeholder="请输入 11 位手机号" value={phone} autoComplete="tel" onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
            </div>
            <div className="auth-field">
              <label htmlFor="login-code">验证码</label>
              <div className="auth-code-wrap">
                <input id="login-code" inputMode="numeric" placeholder="6 位验证码" value={code} autoComplete="one-time-code" onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                <button type="button" className="auth-code-send" onClick={handleSendCode} disabled={loading || phone.length !== 11}>获取验证码</button>
              </div>
            </div>
            {smsNote && <p className="auth-dev-note">{smsNote}</p>}
            {err && <p className="auth-err">{err}</p>}
            <button type="submit" className="auth-btn" disabled={loading}>{loading ? '登 录 中…' : '短信登录'}</button>
          </form>}

          {method === 'wechat' && <div className="auth-wechat">
            <div className="auth-qr-box" aria-hidden="true"><span className="auth-qr-grid" /><span className="auth-qr-logo">微</span></div>
            <p className="auth-wechat-tip">使用微信扫一扫确认登录，无需输入密码。</p>
            {err && <p className="auth-err">{err}</p>}
            <button className="auth-btn" onClick={handleWechatLogin} disabled={loading}>{loading ? '登录中…' : '打开扫码登录'}</button>
          </div>}

          <p className="auth-switch">
            还没有账号？
            <button onClick={onSwitch}>立即注册</button>
          </p>

          <p className="auth-tip">登录即代表同意《用户协议》与《隐私政策》</p>
        </div>
      </div>
    </section>
  )
}

function EyeIcon({ open }) {
  return open ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0112 4c5.2 0 8.6 4.1 9.6 6.1a1.9 1.9 0 010 1.8 13.9 13.9 0 01-3.3 4.1" /><path d="M6.3 6.3A13.8 13.8 0 002.4 10.1a1.9 1.9 0 000 1.8C3.4 13.9 6.8 18 12 18c1.2 0 2.3-.2 3.3-.6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.4 12S5.8 6 12 6s9.6 6 9.6 6-3.4 6-9.6 6-9.6-6-9.6-6z" /><circle cx="12" cy="12" r="2.7" /></svg>
}
