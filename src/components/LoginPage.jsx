import { useState, useEffect } from 'react'
import { login } from '../data/users.js'
import { loadQuota, tokensToCredits, isAgentOverQuota, AGENT_QUOTA_TOKENS } from '../engine/freeQuota.js'

export default function LoginPage({ onBack, onSwitch, onSuccess }) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentTokens, setAgentTokens] = useState(0)

  useEffect(() => {
    setAgentTokens(loadQuota().agentTokens || 0)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    // 模拟异步，保证交互反馈
    setTimeout(() => {
      const res = login(account, password)
      setLoading(false)
      if (!res.ok) {
        setErr(res.msg)
        return
      }
      onSuccess(res.user)
    }, 260)
  }

  const credits = tokensToCredits(agentTokens)
  const over = isAgentOverQuota(agentTokens)

  return (
    <section className="auth-page">
      <button className="page-back auth-back" onClick={onBack} aria-label="返回首页">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>返回</span>
      </button>

      <div className="auth-wrap">
        {/* 游客积分提示（移自元气AI页面顶部） */}
        {agentTokens > 0 && (
          <div className={`agent-credit-hint auth-credit-hint ${over ? 'over' : ''}`}>
            {over ? (
              <span className="ach-text">💎 游客积分已用尽 · 累计 {credits.toFixed(1)} / 100 积分（≈ {AGENT_QUOTA_TOKENS.toLocaleString()} token）</span>
            ) : (
              <span className="ach-text">我的元气 · 游客积分 <b>{credits.toFixed(1)}</b> / 100（1 积分 ≈ 10 万 token）</span>
            )}
          </div>
        )}

        <div className="auth-card">
          <div className="auth-seal" aria-hidden="true">
            <span className="auth-seal-glyph">🐻</span>
            <span className="auth-seal-ring" />
          </div>
          <h2 className="auth-title">
            欢迎回来<span className="zhushi">·</span>元氣滿滿
          </h2>
          <p className="auth-sub">登录后保存你的命盘足迹，解锁会员权益</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
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
              <input
                id="login-pwd"
                type="password"
                placeholder="请输入密码"
                value={password}
                autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {err && <p className="auth-err">{err}</p>}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? '登 录 中…' : '登 录'}
            </button>
          </form>

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
