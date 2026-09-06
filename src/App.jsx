import { useEffect, useState } from 'react'
import Landing from './components/Landing.jsx'
import BaziPage from './components/BaziPage.jsx'
import ZiweiPage from './components/ZiweiPage.jsx'
import ChengguPage from './components/ChengguPage.jsx'
import NamePage from './components/NamePage.jsx'
import HoroscopePage from './components/HoroscopePage.jsx'
import QimenPage from './components/QimenPage.jsx'
import FengshuiPage from './components/FengshuiPage.jsx'
import ArticlesPage from './components/ArticlesPage.jsx'
import ArticleView from './components/ArticleView.jsx'
import TarotPage from './components/TarotPage.jsx'
import TarotReading from './components/TarotReading.jsx'
import AdminPage from './components/AdminPage.jsx'
import AgentChat from './components/AgentChat.jsx'
import AgentChatDsh from './components/AgentChatDsh.jsx'
import SubscribePage from './components/SubscribePage.jsx'
import LoginPage from './components/LoginPage.jsx'
import RegisterPage from './components/RegisterPage.jsx'
import ProfilePage from './components/ProfilePage.jsx'
import ReportView from './components/ReportView.jsx'
import MembershipModal from './components/MembershipModal.jsx'
import { buildChart } from './engine/bazi.js'
import { loadHistory as loadTarot } from './data/tarot.js'
import { getSession, logout as doLogout, refreshSession, consumeCredit } from './data/users.js'
import { setUnauthorizedHandler } from './api/auth.js'
import { loadQuota, incTarot, isTarotOverLimit } from './engine/freeQuota.js'
import { getMonthlyCredits } from './engine/membership.js'
import { createAgentApi } from './api/agent.js'

// VITE_AGENT_BACKEND=legacy 时走旧浏览器内编排；默认 dsh 基座
const AgentChatImpl = import.meta.env.VITE_AGENT_BACKEND === 'legacy' ? AgentChat : AgentChatDsh

const LS_KEY = 'sanmen-history'

const NAV = [
  { key: 'home', glyph: '🏠', label: '首页', en: 'Home' },
  { key: 'agent', glyph: '✨', label: '元气AI', en: 'AI Agent' },
  { key: 'bazi', glyph: '🌿', label: '八字', en: 'Bazi' },
  { key: 'huangli', glyph: '🍀', label: '黄历', en: 'Almanac' },
  { key: 'ziwei', glyph: '⭐', label: '紫微', en: 'Zǐwēi' },
  { key: 'tarot', glyph: '🃏', label: '塔罗', en: 'Tarot' },
  { key: 'wenku', glyph: '📚', label: '文库', en: 'Library' }
]

function TopBar({ view, onNav, user, onUser, credits }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <div className="brand" onClick={() => onNav('home')}>
          <div className="brand-mark" aria-hidden="true">
            <svg className="bear-silhouette" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              {/* 双耳 */}
              <circle cx="9.2" cy="9.5" r="4.2" />
              <circle cx="22.8" cy="9.5" r="4.2" />
              {/* 头部 */}
              <circle cx="16" cy="14.2" r="7.4" />
              {/* 身体 */}
              <ellipse cx="16" cy="23.8" rx="8" ry="6.2" />
              {/* 双臂搭在身体两侧 */}
              <ellipse cx="8.2" cy="23" rx="2.8" ry="5.2" />
              <ellipse cx="23.8" cy="23" rx="2.8" ry="5.2" />
              {/* 双脚 */}
              <ellipse cx="12.4" cy="28.6" rx="2.6" ry="2" />
              <ellipse cx="19.6" cy="28.6" rx="2.6" ry="2" />
            </svg>
          </div>
          <div>
            <span className="brand-name">元氣<em>满满</em></span>
          </div>
        </div>
        <nav className="topnav">
          {NAV.map(n => (
            <button
              key={n.key}
              className={`topnav-link ${view === n.key || (n.key === 'wenku' && view === 'article') || (n.key === 'tarot' && view === 'tarot-reading') ? 'active' : ''}`}
              onClick={() => onNav(n.key)}
            >
              <span className="tl">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="topbar-user">
          {user ? (
            <>
              <button className="credits-chip" onClick={() => onUser('profile')} title="点击查看积分明细">
                <span className="cc-icon" aria-hidden="true">✦</span>
                <span className="cc-num">{credits}</span>
                <span className="cc-lbl">积分</span>
              </button>
              <button className="user-chip" onClick={() => onUser('profile')} title="我的元气">
                <span className="user-chip-avatar">{user.avatar}</span>
                <span className="user-chip-name">{user.nickname}</span>
              </button>
            </>
          ) : (
            <button className="user-chip user-chip-login" onClick={() => onUser('login')}>
              <span className="user-chip-name">登录</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function BottomNav({ view, onNav }) {
  return (
    <nav className="bottom-nav">
      {NAV.map(n => (
        <button
          key={n.key}
          className={`bn-link ${view === n.key || (n.key === 'wenku' && view === 'article') || (n.key === 'tarot' && view === 'tarot-reading') ? 'active' : ''}`}
          onClick={() => onNav(n.key)}
        >
          <span className="bl">{n.label}</span>
        </button>
      ))}
    </nav>
  )
}

// 只读分享报告页（游客可阅读，但不可再点任何转发/编辑操作）
function SharedReportPage({ report, onClose, onTest }) {
  return (
    <div className="shared-report">
      <div className="container">
        <div className="shared-banner">
          <span className="sb-icon" aria-hidden="true">🔒</span>
          <span className="sb-text">
            这是一份<em>只读</em>报告 · 访客可阅读，但无法再次转发、复制或编辑
          </span>
          <button className="sb-close" onClick={onClose}>知道了</button>
        </div>
        <ReportView report={report} readonly />
        <div className="shared-cta">
          <p className="shared-cta-tip">看完别人的命盘，好奇自己的出厂设置吗？</p>
          <button className="shared-cta-btn" onClick={onTest}>✦ 我也要测</button>
          <p className="shared-cta-sub">先排盘 · 查看结果需注册 / 登录</p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('home') // home | bazi | liuyao | ziwei | tarot | tarot-reading | wenku | article | login | register | profile | share
  const [articleId, setArticleId] = useState(null)
  const [spreadId, setSpreadId] = useState(null)
  const [chart, setChart] = useState(null)
  const [agentSeed, setAgentSeed] = useState(null)
  const [history, setHistory] = useState(loadHistory)
  const [tarotHistory, setTarotHistory] = useState(loadTarot)
  const [user, setUser] = useState(getSession)
  const [sharedReport, setSharedReport] = useState(null)
  // 未登录排盘后的"登录回来继续"视图（注册/登录成功后自动返回）
  const [pendingView, setPendingView] = useState(null)
  // 订阅 Modal 状态：null=关闭；否则为待开通/续费的档位 key
  const [subscribeModal, setSubscribeModal] = useState(null)

  // 启动 / 切换账号时向服务端确认登录态并拉取权威状态
  // （月度重置与到期降级都由服务端推进，这里只负责把结果同步到界面）。
  useEffect(() => {
    if (!user) return
    let alive = true
    refreshSession().then(u2 => {
      if (!alive) return
      if (!u2) { setUser(null); return } // token 已失效
      if (u2.creditsUsed !== user.creditsUsed || u2.plan !== user.plan) setUser(u2)
    })
    return () => { alive = false }
  }, [user?.id])

  // token 过期或账号被注销时，任何一次接口调用都会触发这里，把界面切回未登录。
  // 没有它的话，用户会停留在「看起来已登录、每一次操作都失败」的状态里。
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(history.slice(0, 8)))
    } catch { /* ignore */ }
  }, [history])

  // 可被 hash 直达/恢复的视图白名单。
  // 必须与下方实际渲染的 view 分支保持一致：
  //  · 名单里有、但没有渲染分支 → 直达该 hash 得到一个空白页（此前的 liuyao、hehun，
  //    这两个页面根本不存在，已移除）；
  //  · 有渲染分支、但名单里没有 → goNav 不写 hash，刷新后回落首页
  //    （此前的 astro、fengshui、register，已补上）。
  const HASH_VIEWS = ['home', 'agent', 'bazi', 'ziwei', 'qimen', 'chenggu', 'huangli',
    'name', 'fengshui', 'astro', 'tarot', 'tarot-reading', 'wenku', 'article',
    'profile', 'login', 'register', 'admin', 'share']

  // 启动时检测 URL hash：
  //   #share=...     → 完整报告直接序列化在 URL 里，解码为只读报告
  //   #share-id=xxx  → 短链，需向后端取报告
  //   #/view-name    → 直达视图（如 #/agent），刷新后也能恢复
  useEffect(() => {
    const hash = window.location.hash || ''
    const parseShare = (json) => {
      try {
        const report = JSON.parse(json)
        setSharedReport(report)
        setView('share')
      } catch (err) {
        console.warn('分享链接解析失败', err)
        setSharedReport(null)
      }
    }
    if (hash.startsWith('#share=')) {
      // atob 对非法 base64 会抛 InvalidCharacterError，decodeURIComponent 对残缺
      // 百分号转义也会抛。这两步原先在 parseShare 的 try 之外，异常直接冒到
      // useEffect，整个 App 白屏——别人转发时被聊天软件截断的长链就足以触发。
      let json = null
      try {
        const encoded = hash.slice('#share='.length)
        json = typeof atob !== 'undefined'
          ? decodeURIComponent(escape(atob(encoded)))
          : decodeURIComponent(encoded)
      } catch (err) {
        console.warn('分享链接解码失败', err)
        setSharedReport(null)
      }
      if (json !== null) parseShare(json)
    } else if (hash.startsWith('#share-id=')) {
      const id = hash.slice('#share-id='.length)
      fetch(`/api/share/${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.ok && data.payload) parseShare(data.payload)
          else { console.warn('短链分享不存在或已过期'); setSharedReport(null) }
        })
        .catch(err => { console.warn('短链分享加载失败', err); setSharedReport(null) })
    } else if (hash.startsWith('#/')) {
      // 直达/恢复主视图：#/agent、#/bazi……
      const v = hash.slice(2).split('?')[0]
      if (HASH_VIEWS.includes(v)) setView(v)
    }
  }, [])

  // 手动改 hash（或浏览器前进/后退）时同步视图
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash || ''
      if (h.startsWith('#/')) {
        const v = h.slice(2).split('?')[0]
        if (HASH_VIEWS.includes(v)) setView(v)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const goNav = (v, payload) => {
    if (v === 'wenku') {
      setView('wenku')
      setArticleId(null)
    } else {
      setView(v)
      if (v !== 'tarot-reading') setSpreadId(null)
    }
    // 同步 URL hash（#/view），支持直达与刷新恢复；分享/文章等有独立子状态的不写
    if (HASH_VIEWS.includes(v) && v !== 'share') {
      try { window.history.replaceState(null, '', `#/${v}`) } catch { /* ignore */ }
    }
    if (payload && typeof payload === 'object' && payload.seedQuery) {
      setAgentSeed(payload.seedQuery)
    } else if (v !== 'agent') {
      setAgentSeed(null)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openAgentWith = (q) => {
    setAgentSeed(q)
    setView('agent')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openArticle = (id) => {
    setArticleId(id)
    setView('article')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startTarot = (id) => {
    setSpreadId(id)
    setView('tarot-reading')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 塔罗一次解读的计费闸门：游客扣免费配额，会员扣 5 积分。
  // 首次抽牌由 TarotPage 在跳转前扣，这里服务于解读页里的「换一批 / 重抽这组」——
  // 那两个按钮此前直接重新 drawCards，把配额与扣费彻底绕过去了。
  const chargeTarotReading = async () => {
    if (user) {
      const res = await consumeCredit(user.id, 'tarot.reading')
      if (!res.ok) return { ok: false, reason: res.reason }
      if (res.user) setUser(res.user)
      return { ok: true }
    }
    if (isTarotOverLimit(loadQuota().tarot || 0)) return { ok: false, reason: 'quota' }
    incTarot()
    return { ok: true }
  }

  const handleLogin = (u) => {
    setUser(u)
    // 把游客期间产生的 AI 会话认领到这个账号名下。
    // 不做的话，uid 从 anon:xxx 变成账号 id，之前聊的内容全部「消失」。
    // 失败不影响登录本身，静默重试没有意义，记一条日志即可。
    createAgentApi().claimGuestSessions()
      .catch(err => console.warn('游客会话认领失败', err))
    // 若排盘后曾要求登录 → 登录成功直接回到原排盘结果页
    if (pendingView) {
      const v = pendingView
      setPendingView(null)
      setView(v)
      if (v !== 'share') {
        try { window.history.replaceState(null, '', `#/${v}`) } catch { /* ignore */ }
      }
    } else {
      setView('profile')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 排盘查看结果需登录：记录待返回视图并跳注册/登录
  const requireLogin = (backView) => {
    setPendingView(backView || 'bazi')
    setView('register')
    try { window.history.replaceState(null, '', `#/register`) } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = () => {
    doLogout()
    setUser(null)
    goNav('home')
  }

  // 打开订阅 Modal（来自 Landing 定价卡、Profile 升级、ReportLock 等入口）
  const openSubscribe = (planKey) => {
    setSubscribeModal(planKey || 'earth')
  }
  const handleSubscribeSuccess = (updatedUser) => {
    if (updatedUser) setUser(updatedUser)
  }

  const handleChart = (data) => {
    if (!data.year) {
      setView('bazi')
      return null
    }
    const c = buildChart(data.year, data.month, data.day, data.hour, data.gender)
    c.hour = data.hour ?? 12
    c.timeKnown = data.timeKnown !== false
    c.name = data.name || ''
    setChart(c)
    setHistory(prev => [
      {
        id: Date.now(),
        name: data.name || '',
        year: data.year, month: data.month, day: data.day,
        hour: data.hour ?? 12, gender: data.gender,
        dayMaster: c.dayMaster,
        dayMasterWx: c.dayMasterWx,
        shengxiao: c.shengxiao,
        pillars: c.pillars
      },
      ...prev.filter(p => !(p.year === data.year && p.month === data.month && p.day === data.day))
    ])
    return c
  }

  return (
    <div className="app-shell">
      <TopBar
        view={view}
        onNav={goNav}
        user={user}
        onUser={v => goNav(v)}
        credits={user ? getMonthlyCredits(user) : 0}
      />
      <main className="app-main">
        {view === 'home' && (
          <Landing
            onGate={goNav}
            onArticle={openArticle}
            onAskAgent={openAgentWith}
            onSubscribe={openSubscribe}
            user={user}
          />
        )}
        {view === 'bazi' && (
          <BaziPage
            chart={chart}
            user={user}
            onBack={() => goNav('home')}
            onChart={handleChart}
            onRequireLogin={() => requireLogin('bazi')}
            onUpgrade={openSubscribe}
            onUserChange={setUser}
          />
        )}
        {view === 'huangli' && (
          <SubscribePage
            chart={chart}
            onBack={() => goNav('home')}
            user={user}
            onRequireLogin={() => requireLogin('huangli')}
          />
        )}
        {view === 'ziwei' && (
          <ZiweiPage
            chart={chart}
            onBack={() => goNav('home')}
            onChart={handleChart}
            user={user}
            onRequireLogin={() => requireLogin('ziwei')}
            onUpgrade={openSubscribe}
            onUserChange={setUser}
          />
        )}
        {view === 'chenggu' && (
          <ChengguPage onBack={() => goNav('home')} />
        )}
        {view === 'name' && (
          <NamePage
            chart={chart}
            onBack={() => goNav('home')}
            onChart={handleChart}
          />
        )}
        {view === 'astro' && (
          <HoroscopePage onBack={() => goNav('home')} />
        )}
        {view === 'qimen' && (
          <QimenPage
            onBack={() => goNav('home')}
            user={user}
            onRequireLogin={() => requireLogin('qimen')}
            onUserChange={setUser}
            onUpgrade={openSubscribe}
          />
        )}
        {view === 'fengshui' && (
          <FengshuiPage
            chart={chart}
            onBack={() => goNav('home')}
            onChart={handleChart}
          />
        )}
        {view === 'tarot' && (
          <TarotPage
            onBack={() => goNav('home')}
            onStart={startTarot}
            history={tarotHistory}
            user={user}
            onRequireLogin={() => requireLogin('tarot')}
            onUpgrade={openSubscribe}
            onUserChange={setUser}
          />
        )}
        {view === 'tarot-reading' && (
          <TarotReading
            spreadId={spreadId}
            onBack={() => goNav('tarot')}
            onReading={setTarotHistory}
            onCharge={chargeTarotReading}
          />
        )}
        {view === 'agent' && (
          <AgentPage
            chart={chart}
            onBack={() => goNav('home')}
            seedQuery={agentSeed}
            user={user}
            onRequireLogin={() => requireLogin('agent')}
            onUpgrade={openSubscribe}
            onUserChange={setUser}
          />
        )}
        {view === 'wenku' && (
          <ArticlesPage onBack={() => goNav('home')} onOpen={openArticle} />
        )}
        {view === 'article' && (
          <ArticleView
            id={articleId}
            onBack={() => { setView('wenku'); window.scrollTo({ top: 0 }) }}
            onOpen={openArticle}
          />
        )}
        {view === 'admin' && (
          <AdminPage onBack={() => goNav('home')} />
        )}
        {view === 'login' && (
          <LoginPage
            onBack={() => goNav('home')}
            onSwitch={() => goNav('register')}
            onSuccess={handleLogin}
          />
        )}
        {view === 'register' && (
          <RegisterPage
            onBack={() => goNav('home')}
            onSwitch={() => goNav('login')}
            onSuccess={handleLogin}
          />
        )}
        {view === 'profile' && user && (
          <ProfilePage
            user={user}
            historyCount={history.length}
            tarotCount={tarotHistory.length}
            onBack={() => goNav('home')}
            onLogout={handleLogout}
            onUpdate={setUser}
            onSubscribe={openSubscribe}
          />
        )}
        {view === 'profile' && !user && (
          <LoginPage
            onBack={() => goNav('home')}
            onSwitch={() => goNav('login')}
            onSuccess={handleLogin}
          />
        )}
        {view === 'share' && sharedReport && (
          <SharedReportPage
            report={sharedReport}
            onClose={() => {
              setSharedReport(null)
              try { window.history.replaceState(null, '', window.location.pathname) } catch {}
              goNav('home')
            }}
            onTest={() => {
              setSharedReport(null)
              try { window.history.replaceState(null, '', window.location.pathname) } catch {}
              goNav('bazi')
            }}
          />
        )}
      </main>
      <BottomNav view={view} onNav={goNav} />
      <TailBand onNav={goNav} hideOnMobile={view === 'share'} />

      {/* 全局订阅 Modal（会员方案 · 三重境界） */}
      <MembershipModal
        open={!!subscribeModal}
        planKey={subscribeModal}
        user={user}
        onClose={() => setSubscribeModal(null)}
        onSuccess={handleSubscribeSuccess}
        onRequireLogin={() => requireLogin('subscribe')}
      />
    </div>
  )
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// onUpgrade 由调用处传入（App 里绑的是 openSubscribe），此前没解构也没往下传，
// 于是元气 AI 里积分不足的分支永远拿不到回调，用户点了没有任何反应。
function AgentPage({ chart, onBack, seedQuery, user, onRequireLogin, onUpgrade, onUserChange }) {
  return (
    <section className="agent-page page-shell">
      <button className="page-back" onClick={onBack} aria-label="返回首页">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>返回</span>
      </button>
      <h1 className="page-title">
        元气<span className="zhushi">AI</span>
        <span className="page-subtitle">问司命 · 八字 · 紫微，两门通晓</span>
      </h1>
      <div className="agent-page-card">
        <AgentChatImpl key={seedQuery || 'fresh'} chart={chart} seedQuery={seedQuery} user={user} onRequireLogin={onRequireLogin} onUpgrade={onUpgrade} onUserChange={onUserChange} />
      </div>
    </section>
  )
}

// 站点合规信息全部来自构建期环境变量：没配就不渲染，绝不摆占位符。
const ICP_NO = import.meta.env.VITE_ICP_NO || ''
const POLICE_NO = import.meta.env.VITE_POLICE_NO || ''
const PRIVACY_URL = import.meta.env.VITE_LEGAL_PRIVACY_URL || ''
const TERMS_URL = import.meta.env.VITE_LEGAL_TERMS_URL || ''
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || ''

function TailBand({ onNav, hideOnMobile }) {
  return (
    <footer className={`tail-band${hideOnMobile ? ' tail-band-share-sm' : ''}`}>
      <div className="tail-inner">
        <div className="tail-brand">
          <div className="tail-logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="bear-silhouette">
              <circle cx="9.2" cy="9.5" r="4.2" />
              <circle cx="22.8" cy="9.5" r="4.2" />
              <circle cx="16" cy="14.2" r="7.4" />
              <ellipse cx="16" cy="23.8" rx="8" ry="6.2" />
              <ellipse cx="8.2" cy="23" rx="2.8" ry="5.2" />
              <ellipse cx="23.8" cy="23" rx="2.8" ry="5.2" />
              <ellipse cx="12.4" cy="28.6" rx="2.6" ry="2" />
              <ellipse cx="19.6" cy="28.6" rx="2.6" ry="2" />
            </svg>
          </div>
          <div>
            <p className="tail-brand-name">元氣<em>满满</em></p>
            <p className="tail-brand-slogan">把心事交给星星，把好运留给自己</p>
          </div>
        </div>

        <div className="tail-cols">
          <div className="tail-col">
            <p className="tail-col-title">开始占卜</p>
            <ul>
              <li><a onClick={() => onNav('bazi')}>八字排盘</a></li>
              <li><a onClick={() => onNav('ziwei')}>紫微斗数</a></li>
              <li><a onClick={() => onNav('tarot')}>塔罗指引</a></li>
              <li><a onClick={() => onNav('agent')}>元气 AI</a></li>
            </ul>
          </div>
          <div className="tail-col">
            <p className="tail-col-title">发现更多</p>
            <ul>
              <li><a onClick={() => onNav('wenku')}>文库精选</a></li>
              <li><a onClick={() => onNav('huangli')}>订阅黄历</a></li>
              <li><a onClick={() => onNav('profile')}>我的元气</a></li>
            </ul>
          </div>
          <div className="tail-col">
            <p className="tail-col-title">关于</p>
            <ul>
              {/* 隐私政策 / 用户协议是法律文本，必须由本人撰写后再挂出来。
                  此前这三项是没有任何 onClick 的死链接，点了毫无反应 ——
                  与其摆着不如先不放。配了 VITE_LEGAL_* 就会显示为真实链接。 */}
              {PRIVACY_URL && <li><a href={PRIVACY_URL} target="_blank" rel="noreferrer">隐私政策</a></li>}
              {TERMS_URL && <li><a href={TERMS_URL} target="_blank" rel="noreferrer">用户协议</a></li>}
              {CONTACT_EMAIL && <li><a href={`mailto:${CONTACT_EMAIL}`}>联系我们</a></li>}
              <li><a onClick={() => onNav('admin')}>管理控制台</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="tail-bottom">
        <p className="tail-copy">© 2025–2026 元氣滿滿 · 仅供娱乐参考 · 命由己造，相由心生</p>
        {/* 备案号原先写死成 XXXXXXXX 占位。公网站点挂一个假的备案号比不挂更糟，
            所以改成读环境变量，没配就整行不渲染。 */}
        {(ICP_NO || POLICE_NO) && (
          <p className="tail-icp">
            {ICP_NO && <span>{ICP_NO}</span>}
            {ICP_NO && POLICE_NO && <span className="dot-sep">·</span>}
            {POLICE_NO && <span>{POLICE_NO}</span>}
          </p>
        )}
      </div>
    </footer>
  )
}
