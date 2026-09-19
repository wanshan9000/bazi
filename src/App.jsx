import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { LanguageSwitcher, useLocale } from './i18n.jsx'
import Landing from './components/Landing.jsx'
import { buildChart } from './engine/bazi.js'
import { loadHistory as loadTarot } from './data/tarot.js'
import { getSession, logout as doLogout, refreshSession, consumeCredit } from './data/users.js'
import { setUnauthorizedHandler } from './api/auth.js'
import { getCreditBalance, isSuperAdmin } from './engine/membership.js'
import { createAgentApi } from './api/agent.js'
import { reportApi } from './api/reports.js'
import { createArchiveDraft, legacyArchiveDrafts } from './engine/reportArchive.js'
import { historyRouteForReport, isHistoryReportView } from './engine/reportHistoryRoute.js'
import SeoMeta from './components/SeoMeta.jsx'
import { pairedGuideViewForLocale, publicPathForView, routeFromPath } from './seo.js'

// 首屏只需要首页和应用壳；具体阅读、排盘与管理页进入后才下载。
const BaziPage = lazy(() => import('./components/BaziPage.jsx'))
const BaziGuidePage = lazy(() => import('./components/BaziGuidePage.jsx'))
const BaziBasicsPage = lazy(() => import('./components/BaziBasicsPage.jsx'))
const ZiweiPage = lazy(() => import('./components/ZiweiPage.jsx'))
const ChengguPage = lazy(() => import('./components/ChengguPage.jsx'))
const NamePage = lazy(() => import('./components/NamePage.jsx'))
const HoroscopePage = lazy(() => import('./components/HoroscopePage.jsx'))
const QimenPage = lazy(() => import('./components/QimenPage.jsx'))
const FengshuiPage = lazy(() => import('./components/FengshuiPage.jsx'))
const ArticlesPage = lazy(() => import('./components/ArticlesPage.jsx'))
const ArticleView = lazy(() => import('./components/ArticleView.jsx'))
const TarotPage = lazy(() => import('./components/TarotPage.jsx'))
const TarotReading = lazy(() => import('./components/TarotReading.jsx'))
const AdminPage = lazy(() => import('./components/AdminPage.jsx'))
const SubscribePage = lazy(() => import('./components/SubscribePage.jsx'))
const LoginPage = lazy(() => import('./components/LoginPage.jsx'))
const RegisterPage = lazy(() => import('./components/RegisterPage.jsx'))
const ForgotPasswordPage = lazy(() => import('./components/ForgotPasswordPage.jsx'))
const LegalPage = lazy(() => import('./components/LegalPage.jsx'))
const ProfilePage = lazy(() => import('./components/ProfilePage.jsx'))
const MyReportsPage = lazy(() => import('./components/MyReportsPage.jsx'))
const ReportArchiveDetail = lazy(() => import('./components/MyReportsPage.jsx').then(module => ({ default: module.ReportArchiveDetail })))
const NativeReportHistory = lazy(() => import('./components/NativeReportHistory.jsx'))
const ReportView = lazy(() => import('./components/ReportView.jsx'))
const MembershipModal = lazy(() => import('./components/MembershipModal.jsx'))

// Agent 一律经服务端 dsh 基座：只有这里能拿到上游实际 Token usage 并安全结算。
// 旧浏览器直连路径无法可信计量 Token，不能再作为会员计费的运行时分支。
const AgentChatImpl = lazy(() => import('./components/AgentChatDsh.jsx'))

const LS_KEY = 'sanmen-history'

const NAV = [
  { key: 'home', glyph: '🏠', label: '首页', en: 'Home' },
  { key: 'agent', glyph: '✨', label: '元氣AI', en: 'AI Agent' },
  { key: 'bazi', glyph: '🌿', label: '八字', en: 'Bazi' },
  { key: 'huangli', glyph: '🍀', label: '黄历', en: 'Almanac' },
  { key: 'ziwei', glyph: '⭐', label: '紫微', en: 'Zǐwēi' },
  { key: 'tarot', glyph: '🃏', label: '塔罗', en: 'Tarot' },
  { key: 'wenku', glyph: '📚', label: '文库', en: 'Library' }
]

// 「我的」只属于移动端底栏：桌面端继续用右上角的头像与积分入口，避免顶部导航变长。
const BOTTOM_NAV = [
  ...NAV,
  { key: 'profile', glyph: '◉', label: '我的', en: 'Profile' },
]

function RouteFallback() {
  const { t } = useLocale()
  return <div className="route-loading" role="status" aria-label={t('loading')}><span /></div>
}

function TopBar({ view, onNav, onLocaleChange, user, onUser, credits }) {
  const { t } = useLocale()
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <div className="brand" onClick={() => onNav('home')}>
          <div className="brand-mark" aria-hidden="true">
            <img src="/genki-logo.png" alt="" />
          </div>
          <div>
            <span className="brand-name" aria-label={t('brand')}>{t('brand')}</span>
          </div>
        </div>
        <nav className="topnav">
          {NAV.filter(n => n.key !== 'home').map(n => (
            <button
              key={n.key}
              className={`topnav-link ${view === n.key || (n.key === 'wenku' && view === 'article') || (n.key === 'tarot' && view === 'tarot-reading') ? 'active' : ''}`}
              data-nav-key={n.key}
              onClick={() => onNav(n.key)}
            >
              <span className="tl">{t(`nav.${n.key}`, n.label)}</span>
            </button>
          ))}
        </nav>
        <div className="topbar-user">
          {user ? (
            <>
              <button className="credits-chip" onClick={() => onUser('profile')} title={t('profile.credits')}>
                <span className="cc-icon" aria-hidden="true">✦</span>
                <span className="cc-num">{credits === Infinity ? '∞' : Number(credits || 0).toLocaleString('zh-CN')}</span>
              </button>
              <button className="user-chip" onClick={() => onUser('profile')} title="我的元氣">
                <span className={`user-chip-avatar ${/^data:image\/(?:png|jpeg|webp);base64,/i.test(String(user.avatar || '')) ? 'user-chip-avatar-image' : ''}`}>
                  {/^data:image\/(?:png|jpeg|webp);base64,/i.test(String(user.avatar || '')) ? <img src={user.avatar} alt="" /> : user.avatar}
                </span>
                <span className="user-chip-name">{user.nickname}</span>
              </button>
            </>
          ) : (
            <button className="user-chip user-chip-login" onClick={() => onUser('login')}>
              <span className="user-chip-name">{t('auth.login')}</span>
            </button>
          )}
          <LanguageSwitcher onLocaleChange={onLocaleChange} />
        </div>
      </div>
    </header>
  )
}

function BottomNav({ view, onNav, user }) {
  const { t } = useLocale()
  return (
    <nav className="bottom-nav">
      {BOTTOM_NAV.map(n => {
        const destination = n.key === 'profile' ? (user ? 'profile' : 'login') : n.key
        const isActive = view === n.key
          || (n.key === 'profile' && view === 'login')
          || (n.key === 'wenku' && view === 'article')
          || (n.key === 'tarot' && view === 'tarot-reading')
        return (
        <button
          key={n.key}
          className={`bn-link${n.key === 'home' ? ' bn-link-home' : ''}${n.key === 'profile' ? ' bn-link-profile' : ''} ${isActive ? 'active' : ''}`}
          onClick={() => onNav(destination)}
          aria-label={t(`nav.${n.key}`, n.label)}
          title={t(`nav.${n.key}`, n.label)}
        >
          {n.key === 'home' ? (
            <span className="bn-home-logo" aria-hidden="true">
              <img src="/genki-logo.png" alt="" />
            </span>
          ) : n.key === 'profile' ? (
            <span className="bn-profile-mark" aria-hidden="true">◉</span>
          ) : null}
          {n.key !== 'home' && <span className="bl">{t(`nav.${n.key}`, n.label)}</span>}
        </button>
        )
      })}
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
  const { locale } = useLocale()
  const [view, setView] = useState('home') // home | bazi | liuyao | ziwei | tarot | tarot-reading | wenku | article | login | register | profile | share
  const [articleId, setArticleId] = useState(null)
  const [spreadId, setSpreadId] = useState(null)
  const [chart, setChart] = useState(null)
  const [agentSeed, setAgentSeed] = useState(null)
  const [agentReportId, setAgentReportId] = useState(null)
  const [agentSessionId, setAgentSessionId] = useState(null)
  const [history, setHistory] = useState(loadHistory)
  const [tarotHistory, setTarotHistory] = useState(loadTarot)
  const [user, setUser] = useState(getSession)
  const [sharedReport, setSharedReport] = useState(null)
  // 未登录排盘后的"登录回来继续"视图（注册/登录成功后自动返回）
  const [pendingView, setPendingView] = useState(null)
  // 订阅 Modal 状态：待选档位 + 是否先进入续费方案选择。
  const [subscribeModal, setSubscribeModal] = useState(null)
  const [archiveReportId, setArchiveReportId] = useState(null)
  const [legalReturnView, setLegalReturnView] = useState('home')
  const hasAdminAccess = isSuperAdmin(user)
  const archiveIds = useRef(new Map())

  const saveReportArchive = useCallback(async (payload) => {
    if (!user?.id) return null
    const draft = createArchiveDraft(payload)
    const key = `${user.id}:${draft.clientKey}`
    if (archiveIds.current.has(key)) return archiveIds.current.get(key)
    const result = await reportApi.save(draft)
    if (!result.ok || !result.report?.id) {
      console.warn('报告保存失败', result.msg || result.reason || 'unknown')
      return null
    }
    archiveIds.current.set(key, result.report.id)
    return result.report.id
  }, [user?.id])

  // 启动 / 切换账号时向服务端确认登录态并拉取权威状态
  // （月度重置与到期降级都由服务端推进，这里只负责把结果同步到界面）。
  useEffect(() => {
    if (!user) return
    let alive = true
    refreshSession().then(u2 => {
      if (!alive) return
      if (!u2) { setUser(null); return } // token 已失效
      if (u2.creditsUsed !== user.creditsUsed || u2.permanentCredits !== user.permanentCredits || u2.plan !== user.plan) setUser(u2)
    })
    return () => { alive = false }
  }, [user?.id])

  // 已登录用户也可能是升级前就留在浏览器里的会话；不必等下一次重新登录，
  // 首次进入应用便把明确白名单内的旧命盘、塔罗记录迁入账号档案。服务端以账号
  // 记录迁移声明，因此刷新或多端重复进入都不会重复创建报告。
  useEffect(() => {
    if (!user?.id) return
    reportApi.migrate(legacyArchiveDrafts())
      .catch(err => console.warn('旧报告迁移失败', err))
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
    'name', 'fengshui', 'astro', 'tarot', 'tarot-reading', 'wenku', 'article', 'baziGuide', 'baziBasics',
    'profile', 'reports', 'report-detail', 'login', 'register', 'forgot-password', 'terms', 'privacy', 'admin', 'share']

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
      if (HASH_VIEWS.includes(v)) {
        const params = new URLSearchParams(hash.split('?')[1] || '')
        if (isHistoryReportView(v) || v === 'report-detail') setArchiveReportId(params.get('report') || null)
        else setArchiveReportId(null)
        const target = v === 'admin' && user && !hasAdminAccess ? 'home' : v
        setView(target)
        if (target !== v) {
          try { window.history.replaceState(null, '', '#/home') } catch { /* ignore */ }
        }
      }
    } else {
      const route = routeFromPath(window.location.pathname)
      if (route) {
        setArticleId(route.articleId || null)
        setView(route.view)
      }
    }
  }, [])

  // 手动改 hash（或浏览器前进/后退）时同步视图
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash || ''
      if (h.startsWith('#/')) {
        const v = h.slice(2).split('?')[0]
        if (HASH_VIEWS.includes(v)) {
          const params = new URLSearchParams(h.split('?')[1] || '')
          if (isHistoryReportView(v) || v === 'report-detail') setArchiveReportId(params.get('report') || null)
          else setArchiveReportId(null)
          const target = v === 'admin' && user && !hasAdminAccess ? 'home' : v
          setView(target)
          if (target !== v) {
            try { window.history.replaceState(null, '', '#/home') } catch { /* ignore */ }
          }
        }
      } else {
        const route = routeFromPath(window.location.pathname)
        if (route) {
          setArticleId(route.articleId || null)
          setView(route.view)
        }
      }
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [user, hasAdminAccess])

  const goNav = (v, payload) => {
    // 管理控制台不是会员权益；普通登录用户即使手动改地址也回首页。
    if (v === 'admin' && user && !hasAdminAccess) v = 'home'
    // 懒加载页面时保留当前界面，弱网下不会因一次点击突然退回到空白载入态。
    startTransition(() => {
      if (v === 'wenku') {
        setView('wenku')
        setArticleId(null)
      } else {
        setView(v)
        if (v !== 'tarot-reading') setSpreadId(null)
      }
      if (payload && typeof payload === 'object' && payload.seedQuery) {
        setAgentSeed(payload.seedQuery)
      } else if (v !== 'agent') {
        setAgentSeed(null)
      }
      if (payload && typeof payload === 'object' && payload.reportId) setArchiveReportId(payload.reportId)
      else if (!isHistoryReportView(v) && v !== 'report-detail') setArchiveReportId(null)
      if (payload && typeof payload === 'object' && payload.articleId) setArticleId(payload.articleId)
      else if (v !== 'article') setArticleId(null)
    })
    // 公开内容使用干净路径供爬虫和分享直接访问；账户、报告等私密视图保持 hash 路由。
    const cleanPath = publicPathForView(v, payload?.articleId || articleId)
    if (cleanPath) {
      try { window.history.replaceState(null, '', cleanPath) } catch { /* ignore */ }
    } else if (HASH_VIEWS.includes(v) && v !== 'share') {
      const reportQuery = (isHistoryReportView(v) || v === 'report-detail') && (payload?.reportId || archiveReportId) ? `?report=${encodeURIComponent(payload?.reportId || archiveReportId)}` : ''
      try { window.history.replaceState(null, '', `#/${v}${reportQuery}`) } catch { /* ignore */ }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const syncGuideLanguage = nextLocale => {
    const pairedView = pairedGuideViewForLocale(view, nextLocale)
    if (pairedView) goNav(pairedView)
  }

  const openAgentWith = (q) => {
    // 首页智能体入口始终开启一段无命盘上下文的新会话。否则用户此前排过八字后，
    // App 里残留的 chart 会被带入元氣 AI，造成未提供生辰却被默认按八字解读。
    setChart(null)
    setAgentReportId(null)
    setAgentSessionId(null)
    goNav('agent', { seedQuery: q })
  }
  const openReportAgent = ({ chart: reportChart, prompt, reportId = null, displayText }) => {
    if (reportChart) setChart(reportChart)
    setAgentReportId(reportId)
    setAgentSessionId(null)
    // 报告资料仍完整发送给服务端，供本次会话建立上下文；displayText 仅用于聊天首屏。
    // 两者分开后，长报告不会再被当成用户消息渲染出来。
    goNav('agent', { seedQuery: displayText ? { text: prompt, displayText } : prompt })
  }

  const openArticle = (id) => {
    goNav('article', { articleId: id })
  }

  const startTarot = (id) => {
    startTransition(() => {
      setSpreadId(id)
      setView('tarot-reading')
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 塔罗重抽也必须经过服务端：全部牌阵共用会员每月内含次数，超出后按积分扣减。
  // 首次抽牌由 TarotPage 在跳转前扣，这里服务于解读页里的「换一批 / 重抽这组」——
  // 那两个按钮此前直接重新 drawCards，把配额与扣费彻底绕过去了。
  const chargeTarotReading = async (feature = 'tarot.reading') => {
    if (!user) return { ok: false, reason: 'plan_required' }
    const res = await consumeCredit(user.id, feature)
    if (!res.ok) return { ok: false, reason: res.reason }
    if (res.user) setUser(res.user)
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
    startTransition(() => {
      setPendingView(backView || 'bazi')
      setView('register')
    })
    try { window.history.replaceState(null, '', `#/register`) } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = () => {
    doLogout()
    setUser(null)
    goNav('home')
  }

  // 打开订阅 Modal（来自 Landing 定价卡、Profile 升级、ReportLock 等入口）
  const openSubscribe = (planKey, { selectPlan = false } = {}) => {
    setSubscribeModal({ planKey: planKey || 'earth', selectPlan })
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
      <SeoMeta view={view} articleId={articleId} />
      <TopBar
        view={view}
        onNav={goNav}
        onLocaleChange={syncGuideLanguage}
        user={user}
        onUser={v => goNav(v)}
        credits={user ? getCreditBalance(user).total : 0}
      />
      <main className="app-main">
        <Suspense fallback={<RouteFallback />}>
        {view === 'home' && (
          <Landing
            onGate={goNav}
            onArticle={openArticle}
            onAskAgent={openAgentWith}
            onSubscribe={openSubscribe}
            user={user}
          />
        )}
        {view === 'bazi' && (archiveReportId ? (
          <NativeReportHistory view="bazi" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <BaziPage
            chart={chart}
            user={user}
            onBack={() => goNav('home')}
            onChart={handleChart}
            onRequireLogin={() => requireLogin('bazi')}
            onUpgrade={openSubscribe}
            onUserChange={setUser}
            onAskAgent={openReportAgent}
            onReportReady={saveReportArchive}
          />
        ))}
        {view === 'baziGuide' && <BaziGuidePage onBack={() => goNav('home')} onStartCalculator={() => goNav('bazi')} onOpenAgent={() => goNav('agent')} />}
        {view === 'baziBasics' && <BaziBasicsPage onBack={() => goNav('home')} onStartCalculator={() => goNav('bazi')} onOpenAgent={() => goNav('agent')} />}
        {view === 'huangli' && (archiveReportId ? (
          <NativeReportHistory view="huangli" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <SubscribePage
            chart={chart}
            onBack={() => goNav('home')}
            user={user}
            onRequireLogin={() => requireLogin('huangli')}
            onUpgrade={() => openSubscribe('earth')}
            onAskAgent={openReportAgent}
            onReportReady={saveReportArchive}
          />
        ))}
        {view === 'ziwei' && (archiveReportId ? (
          <NativeReportHistory view="ziwei" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <ZiweiPage
            chart={chart}
            onBack={() => goNav('home')}
            onChart={handleChart}
            user={user}
            onRequireLogin={() => requireLogin('ziwei')}
            onUpgrade={openSubscribe}
            onUserChange={setUser}
            onAskAgent={openReportAgent}
            onReportReady={saveReportArchive}
          />
        ))}
        {view === 'chenggu' && (archiveReportId ? (
          <NativeReportHistory view="chenggu" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <ChengguPage user={user} onBack={() => goNav('home')} onAskAgent={openReportAgent} onReportReady={saveReportArchive} />
        ))}
        {view === 'name' && (archiveReportId ? (
          <NativeReportHistory view="name" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <NamePage
            chart={chart}
            onBack={() => goNav('home')}
            onChart={handleChart}
            onAskAgent={openReportAgent}
            user={user}
            onReportReady={saveReportArchive}
          />
        ))}
        {view === 'astro' && (archiveReportId ? (
          <NativeReportHistory view="astro" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <HoroscopePage user={user} onBack={() => goNav('home')} onAskAgent={openReportAgent} onReportReady={saveReportArchive} />
        ))}
        {view === 'qimen' && (archiveReportId ? (
          <NativeReportHistory view="qimen" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <QimenPage
            onBack={() => goNav('home')}
            user={user}
            onRequireLogin={() => requireLogin('qimen')}
            onUserChange={setUser}
            onUpgrade={openSubscribe}
            onAskAgent={openReportAgent}
            onReportReady={saveReportArchive}
          />
        ))}
        {view === 'fengshui' && (archiveReportId ? (
          <NativeReportHistory view="fengshui" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <FengshuiPage
            chart={chart}
            onBack={() => goNav('home')}
            onChart={handleChart}
            onAskAgent={openReportAgent}
            user={user}
            onReportReady={saveReportArchive}
          />
        ))}
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
        {view === 'tarot-reading' && (archiveReportId ? (
          <NativeReportHistory view="tarot-reading" reportId={archiveReportId} onBack={() => goNav('reports')} onAskAgent={openReportAgent} onOpenSession={sessionId => { setAgentReportId(null); setAgentSessionId(sessionId); goNav('agent') }} onDeleted={() => goNav('reports')} />
        ) : (
          <TarotReading
            spreadId={spreadId}
            onBack={() => goNav('tarot')}
            onReading={setTarotHistory}
            onCharge={chargeTarotReading}
            onAskAgent={openReportAgent}
            onHome={() => goNav('home')}
            user={user}
            onReportReady={saveReportArchive}
          />
        ))}
        {view === 'agent' && (
          <AgentPage
            chart={chart}
            onBack={() => goNav('home')}
            seedQuery={agentSeed}
            user={user}
            onRequireLogin={() => requireLogin('agent')}
            onUpgrade={openSubscribe}
            onUserChange={setUser}
            reportId={agentReportId}
            initialSessionId={agentSessionId}
            locale={locale}
          />
        )}
        {view === 'wenku' && (
          <ArticlesPage onBack={() => goNav('home')} onOpen={openArticle} />
        )}
        {view === 'article' && (
          <ArticleView
            id={articleId}
            onBack={() => goNav('wenku')}
            onOpen={openArticle}
          />
        )}
        {view === 'admin' && (!user || hasAdminAccess) && (
          <AdminPage onBack={() => goNav('home')} />
        )}
        {view === 'login' && (
          <LoginPage
            onBack={() => goNav('home')}
            onSwitch={() => goNav('register')}
            onForgotPassword={() => goNav('forgot-password')}
            onOpenLegal={type => { setLegalReturnView('login'); goNav(type) }}
            onSuccess={handleLogin}
          />
        )}
        {view === 'register' && (
          <RegisterPage
            onBack={() => goNav('home')}
            onSwitch={() => goNav('login')}
            onOpenLegal={type => { setLegalReturnView('register'); goNav(type) }}
            onSuccess={handleLogin}
          />
        )}
        {view === 'forgot-password' && <ForgotPasswordPage onBack={() => goNav('login')} onLogin={() => goNav('login')} />}
        {view === 'terms' && <LegalPage type="terms" onBack={() => goNav(legalReturnView)} />}
        {view === 'privacy' && <LegalPage type="privacy" onBack={() => goNav(legalReturnView)} />}
        {view === 'profile' && user && (
          <ProfilePage
            user={user}
            historyCount={history.length}
            tarotCount={tarotHistory.length}
            onBack={() => goNav('home')}
            onLogout={handleLogout}
            onUpdate={setUser}
            onSubscribe={openSubscribe}
            onReports={() => goNav('reports')}
            onAskAgent={() => goNav('agent')}
          />
        )}
        {view === 'reports' && user && (
          <MyReportsPage user={user} onBack={() => goNav('profile')} onOpenReport={report => {
            const target = historyRouteForReport(report)
            if (target) goNav(target, { reportId: report.id })
          }} />
        )}
        {view === 'report-detail' && user && archiveReportId && (
          <ReportArchiveDetail
            reportId={archiveReportId}
            onBack={() => goNav('reports')}
            onAskAgent={openReportAgent}
            onOpenSession={sessionId => {
              setAgentReportId(null)
              setAgentSessionId(sessionId)
              goNav('agent')
            }}
            onDeleted={() => goNav('reports')}
          />
        )}
        {view === 'report-detail' && user && !archiveReportId && (
          <MyReportsPage user={user} onBack={() => goNav('profile')} onOpenReport={report => {
            const target = historyRouteForReport(report)
            if (target) goNav(target, { reportId: report.id })
          }} />
        )}
        {(view === 'profile' || view === 'reports' || view === 'report-detail') && !user && (
          <LoginPage
            onBack={() => goNav('home')}
            onSwitch={() => goNav('login')}
            onForgotPassword={() => goNav('forgot-password')}
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
        </Suspense>
      </main>
      <BottomNav view={view} onNav={goNav} user={user} />
      {view !== 'agent' && <LanguageSwitcher mobile onLocaleChange={syncGuideLanguage} />}
      <TailBand onNav={goNav} hideOnMobile={view === 'share'} user={user} />

      {/* 全局订阅 Modal（会员方案 · 三重境界） */}
      {subscribeModal && (
        <Suspense fallback={null}>
          <MembershipModal
            open
            planKey={subscribeModal.planKey}
            user={user}
            onClose={() => setSubscribeModal(null)}
            onRequireLogin={() => requireLogin('subscribe')}
            showPlanPicker={subscribeModal.selectPlan}
          />
        </Suspense>
      )}
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
// 于是元氣 AI 里积分不足的分支永远拿不到回调，用户点了没有任何反应。
function AgentPage({ chart, onBack, seedQuery, user, locale, onRequireLogin, onUpgrade, onUserChange, reportId, initialSessionId }) {
  const { t } = useLocale()
  return (
    <section className="agent-page page-shell">
      <button className="page-back" onClick={onBack} aria-label={t('common.backHome', '返回首页')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>{t('common.back', '返回')}</span>
      </button>
      <h1 className="page-title">
        {t('agent.title', '元氣')}<span className="zhushi">AI</span>
        <span className="page-subtitle">{t('agent.subtitle', '问三门 · 八字 · 紫微，两门通晓')}</span>
      </h1>
      <div className="agent-page-card">
        <AgentChatImpl key={`${seedQuery || 'fresh'}:${reportId || initialSessionId || 'general'}`} chart={chart} seedQuery={seedQuery} user={user} reportId={reportId} initialSessionId={initialSessionId} locale={locale} onRequireLogin={onRequireLogin} onUpgrade={onUpgrade} onUserChange={onUserChange} />
      </div>
    </section>
  )
}

// 备案和联系信息来自构建期环境变量；法律文本由站内页面统一维护。
const ICP_NO = import.meta.env.VITE_ICP_NO || ''
const POLICE_NO = import.meta.env.VITE_POLICE_NO || ''
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || ''

function TailBand({ onNav, hideOnMobile, user }) {
  const { locale } = useLocale()
  const l = (zh, en) => locale === 'en' ? en : zh
  return (
    <footer className={`tail-band${hideOnMobile ? ' tail-band-share-sm' : ''}`}>
      <div className="tail-inner">
        <div className="tail-brand">
          <div className="tail-logo" aria-hidden="true">
            <img src="/genki-logo.png" alt="" />
          </div>
          <div>
            <p className="tail-brand-name">GENKI</p>
            <p className="tail-brand-slogan">{l('把心事交给星星，把好运留给自己', 'Bring your questions to the stars. Keep the next step for yourself.')}</p>
          </div>
        </div>

        <div className="tail-cols">
          <div className="tail-col">
            <p className="tail-col-title">{l('开始占卜', 'Explore')}</p>
            <ul>
              <li><a onClick={() => onNav('bazi')}>{l('八字排盘', 'Bazi chart')}</a></li>
              <li><a onClick={() => onNav('ziwei')}>{l('紫微斗数', 'Ziwei Doushu')}</a></li>
              <li><a onClick={() => onNav('tarot')}>{l('塔罗指引', 'Tarot')}</a></li>
              <li><a onClick={() => onNav('agent')}>元氣 AI</a></li>
            </ul>
          </div>
          <div className="tail-col">
            <p className="tail-col-title">{l('发现更多', 'Discover')}</p>
            <ul>
              <li><a onClick={() => onNav('wenku')}>{l('文库精选', 'Library')}</a></li>
              <li><a onClick={() => onNav('baziBasics')}>{l('八字入门', 'BaZi basics')}</a></li>
              <li><a onClick={() => onNav('baziGuide')}>{l('BaZi 英文指南', 'BaZi guide')}</a></li>
              <li><a onClick={() => onNav('huangli')}>{l('订阅黄历', 'Almanac')}</a></li>
              <li><a onClick={() => onNav('profile')}>{l('我的元氣', 'My Genki')}</a></li>
            </ul>
          </div>
          <div className="tail-col">
            <p className="tail-col-title">{l('关于', 'About')}</p>
            <ul>
              <li><a onClick={() => onNav('privacy')}>{l('隐私政策', 'Privacy')}</a></li>
              <li><a onClick={() => onNav('terms')}>{l('用户协议', 'Terms')}</a></li>
              {CONTACT_EMAIL && <li><a href={`mailto:${CONTACT_EMAIL}`}>{l('联系我们', 'Contact')}</a></li>}
              {isSuperAdmin(user) && <li><a onClick={() => onNav('admin')}>{l('管理控制台', 'Admin')}</a></li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="tail-bottom">
        <p className="tail-copy">{locale === 'en' ? '© 2025–2026 Genki · Traditional culture and entertainment reference only.' : '© 2025–2026 元氣滿滿 · 仅供娱乐参考 · 命由己造，相由心生'}</p>
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
