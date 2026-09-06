import { useState, useEffect } from 'react'
import { register, registerByWechat } from '../data/users.js'
import { api } from '../api/client.js'

export default function RegisterPage({ onBack, onSwitch, onSuccess }) {
  // 注册优先「扫码识别」：默认停在扫码注册 tab，扫码成功自动建号并登录
  const [method, setMethod] = useState('wechat') // wechat | account
  const [nickname, setNickname] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
        setServerOk(Boolean(r && r.ok))
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

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')
    if (password !== confirm) {
      setErr('两次输入的密码不一致')
      return
    }
    setLoading(true)
    setTimeout(async () => {
      try {
        const res = await register({ nickname, account, password })
        if (!res.ok) { setErr(res.msg); return }
        onSuccess(res.user)
      } catch (e) {
        setErr('注册失败，请重试')
      } finally {
        setLoading(false)
      }
    }, 320)
  }

  // 本机专属的演示 openid：首次生成后存本地，同一浏览器重复演示落到同一账号，
  // 不同浏览器/不同人各自独立。
  const localDemoOpenid = () => {
    const KEY = 'genki-demo-openid'
    try {
      const cached = localStorage.getItem(KEY)
      if (cached) return cached
      const rnd = globalThis.crypto && globalThis.crypto.getRandomValues
        ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
      const id = `demo-local-${rnd}`
      localStorage.setItem(KEY, id)
      return id
    } catch {
      return `demo-local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    }
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
        // 后端不可达：本地建号。
        // ⚠ 这里原先写死 'demo-local-guest' —— 所有人拿到同一个 openid，于是同一台
        // 设备（甚至同一个演示环境）上后来的人会直接登进前一个人的账号。演示身份
        // 必须一人一份：本机生成一次随机 openid 并记住，重复演示才落到同一账号。
        const res = registerByWechat(localDemoOpenid(), '元气新友')
        if (!res.ok) { setErr(res.msg); return }
        onSuccess(res.user)
        return
      }
      const done = await api.wechatMockDone({})
      const res = registerByWechat(done.openid || done.token, '微信用户')
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
          <p className="auth-sub">创建一个账号，开启你的元气命理之旅</p>

          {/* 注册方式切换（扫码注册优先） */}
          <div className="auth-methods">
            <button
              className={`auth-method ${method === 'wechat' ? 'active' : ''}`}
              onClick={() => { setMethod('wechat'); setErr('') }}
            >
              扫码注册<span className="auth-hot-tag">推荐</span>
            </button>
            <button
              className={`auth-method ${method === 'account' ? 'active' : ''}`}
              onClick={() => { setMethod('account'); setErr('') }}
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
                  placeholder="给自己起个元气昵称"
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
                  <input
                    id="reg-pwd"
                    type="password"
                    placeholder="至少 6 位"
                    value={password}
                    autoComplete="new-password"
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="reg-pwd2">确认密码</label>
                  <input
                    id="reg-pwd2"
                    type="password"
                    placeholder="再输一遍"
                    value={confirm}
                    autoComplete="new-password"
                    onChange={e => setConfirm(e.target.value)}
                  />
                </div>
              </div>

              {err && <p className="auth-err">{err}</p>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? '注 册 中…' : '注 册'}
              </button>
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
