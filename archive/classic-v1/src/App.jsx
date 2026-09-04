import { useEffect, useState } from 'react'
import Landing from './components/Landing.jsx'
import BaziPage from './components/BaziPage.jsx'
import LiuyaoPage from './components/LiuyaoPage.jsx'
import ZiweiPage from './components/ZiweiPage.jsx'
import ArticlesPage from './components/ArticlesPage.jsx'
import ArticleView from './components/ArticleView.jsx'
import TarotPage from './components/TarotPage.jsx'
import TarotReading from './components/TarotReading.jsx'
import AdminPage from './components/AdminPage.jsx'
import { buildChart } from './engine/bazi.js'
import { loadHistory as loadTarot } from './data/tarot.js'

const LS_KEY = 'sanmen-history'

const NAV = [
  { key: 'home', glyph: '⌂', label: '首页', en: 'Home' },
  { key: 'bazi', glyph: '⌾', label: '八字', en: 'Bazi' },
  { key: 'liuyao', glyph: '☯', label: '六爻', en: 'Liuyáo' },
  { key: 'ziwei', glyph: '☾', label: '紫微', en: 'Zǐwēi' },
  { key: 'tarot', glyph: '☥', label: '塔罗', en: 'Tarot' },
  { key: 'wenku', glyph: '书', label: '文库', en: 'Library' }
]

function TopBar({ view, onNav }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <div className="brand" onClick={() => onNav('home')}>
          <div className="brand-mark">三</div>
          <div>
            <span className="brand-name">三门<em>命理</em></span>
            <span className="brand-sub">Sanmen Mystic AI</span>
          </div>
        </div>
        <nav className="topnav">
          {NAV.map(n => (
            <button
              key={n.key}
              className={`topnav-link ${view === n.key || (n.key === 'wenku' && view === 'article') || (n.key === 'tarot' && view === 'tarot-reading') ? 'active' : ''}`}
              onClick={() => onNav(n.key)}
            >
              <span className="tg">{n.glyph}</span>
              <span className="tl">{n.label}</span>
            </button>
          ))}
        </nav>
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
          <span className="bg">{n.glyph}</span>
          <span className="bl">{n.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const [view, setView] = useState('home') // home | bazi | liuyao | ziwei | tarot | tarot-reading | wenku | article
  const [articleId, setArticleId] = useState(null)
  const [spreadId, setSpreadId] = useState(null)
  const [chart, setChart] = useState(null)
  const [history, setHistory] = useState(loadHistory)
  const [tarotHistory, setTarotHistory] = useState(loadTarot)

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(history.slice(0, 8)))
    } catch { /* ignore */ }
  }, [history])

  const goNav = (v) => {
    if (v === 'wenku') {
      setView('wenku')
      setArticleId(null)
    } else {
      setView(v)
      if (v !== 'tarot-reading') setSpreadId(null)
    }
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

  const handleChart = (data) => {
    if (!data.year) {
      setView('bazi')
      return null
    }
    const c = buildChart(data.year, data.month, data.day, data.hour, data.gender)
    c.hour = data.hour ?? 12
    c.timeKnown = data.timeKnown !== false
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
      <TopBar view={view} onNav={goNav} />
      <main className="app-main">
        {view === 'home' && (
          <Landing
            onGate={goNav}
            chart={chart}
            onPickChart={handleChart}
            onArticle={openArticle}
          />
        )}
        {view === 'bazi' && (
          <BaziPage
            chart={chart}
            onBack={() => goNav('home')}
            onChart={handleChart}
          />
        )}
        {view === 'liuyao' && <LiuyaoPage onBack={() => goNav('home')} />}
        {view === 'ziwei' && (
          <ZiweiPage
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
          />
        )}
        {view === 'tarot-reading' && (
          <TarotReading
            spreadId={spreadId}
            onBack={() => goNav('tarot')}
            onReading={setTarotHistory}
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
      </main>
      <BottomNav view={view} onNav={goNav} />
      <footer className="footer">
        <p className="brand-foot">三门命理</p>
        <p>
          <span className="latin">Three Gates · One Oracle</span>
          <span className="sep">✦</span>
          玄学内容仅供参考 · 知命是为了更好地生活
        </p>
        <p style={{ marginTop: 8 }}>
          <a
            href="#admin"
            onClick={(e) => { e.preventDefault(); goNav('admin') }}
            className="footer-admin-link"
            title="管理控制台"
          >
            管理
          </a>
        </p>
      </footer>
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
