import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const LOCALES = [
  { key: 'zh-CN', label: '简体', name: '简体', htmlLang: 'zh-CN' },
  { key: 'zh-TW', label: '繁体', name: '繁体', htmlLang: 'zh-Hant' },
  { key: 'en', label: 'EN', name: 'English', htmlLang: 'en' },
]

const COPY = {
  'zh-CN': {
    'nav.home': '首页', 'nav.agent': '元氣AI', 'nav.bazi': '八字', 'nav.huangli': '黄历', 'nav.ziwei': '紫微', 'nav.tarot': '塔罗', 'nav.wenku': '文库', 'nav.profile': '我的',
    'brand': '元氣满满', 'auth.login': '登录', 'profile.credits': '查看 Token 积分余额', 'profile.title': '我的元氣',
    'language': '语言', 'language.aria': '切换显示语言', 'loading': '页面载入中', 'common.back': '返回', 'common.backHome': '返回首页', 'agent.title': '元氣', 'agent.subtitle': '问三门 · 八字 · 紫微，两门通晓', 'agent.languageNote': 'Agent 会以所选语言回复；盘面术语保留原文。',
  },
  'zh-TW': {
    'nav.home': '首頁', 'nav.agent': '元氣AI', 'nav.bazi': '八字', 'nav.huangli': '黃曆', 'nav.ziwei': '紫微', 'nav.tarot': '塔羅', 'nav.wenku': '文庫', 'nav.profile': '我的',
    'brand': '元氣滿滿', 'auth.login': '登入', 'profile.credits': '查看 Token 積分餘額', 'profile.title': '我的元氣',
    'language': '語言', 'language.aria': '切換顯示語言', 'loading': '頁面載入中', 'common.back': '返回', 'common.backHome': '返回首頁', 'agent.title': '元氣', 'agent.subtitle': '問三門 · 八字 · 紫微，兩門通曉', 'agent.languageNote': 'Agent 會以所選語言回覆；盤面術語保留原文。',
  },
  en: {
    'nav.home': 'Home', 'nav.agent': 'AI Agent', 'nav.bazi': 'Bazi', 'nav.huangli': 'Almanac', 'nav.ziwei': 'Ziwei', 'nav.tarot': 'Tarot', 'nav.wenku': 'Library', 'nav.profile': 'Profile',
    'brand': 'Genki', 'auth.login': 'Sign in', 'profile.credits': 'View Token credits', 'profile.title': 'My Genki',
    'language': 'Language', 'language.aria': 'Change display language', 'loading': 'Loading page', 'common.back': 'Back', 'common.backHome': 'Back to home', 'agent.title': 'Genki', 'agent.subtitle': 'Bazi and Ziwei, clearly explained', 'agent.languageNote': 'Agent replies in your selected language; chart terms remain in their original form.',
  },
}

const LocaleContext = createContext(null)
const STORAGE_KEY = 'genki-locale'
const FALLBACK_CONTEXT = {
  locale: 'zh-CN',
  setLocale: () => {},
  t: (key, fallback = key) => COPY['zh-CN'][key] || fallback,
}

export function normalizeLocale(value) {
  return LOCALES.some(item => item.key === value) ? value : 'zh-CN'
}

function initialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return normalizeLocale(stored)
    return navigator.language?.toLowerCase().startsWith('zh-tw') || navigator.language?.toLowerCase().startsWith('zh-hk') ? 'zh-TW' : 'zh-CN'
  } catch {
    return 'zh-CN'
  }
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(initialLocale)
  const setLocale = next => setLocaleState(normalizeLocale(next))
  useEffect(() => {
    const option = LOCALES.find(item => item.key === locale) || LOCALES[0]
    document.documentElement.lang = option.htmlLang
    try { localStorage.setItem(STORAGE_KEY, locale) } catch { /* 私密模式仅维持当前页 */ }
  }, [locale])
  const value = useMemo(() => ({
    locale,
    setLocale,
    t: (key, fallback = key) => COPY[locale]?.[key] || COPY['zh-CN'][key] || fallback,
  }), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)
  return context || FALLBACK_CONTEXT
}

export function LanguageSwitcher({ mobile = false }) {
  const { locale, setLocale, t } = useLocale()
  const [open, setOpen] = useState(false)
  const current = LOCALES.find(option => option.key === locale) || LOCALES[0]
  const choose = key => {
    setLocale(key)
    setOpen(false)
  }
  return (
    <div className={`language-switcher language-switcher-${locale}${mobile ? ' language-switcher-mobile' : ''}`}>
      <button type="button" className="language-switcher-trigger" onClick={() => setOpen(value => !value)} aria-label={t('language.aria')} aria-expanded={open} aria-haspopup="listbox" title={t('language.aria')}>
        {current.name}
      </button>
      {open && (
        <div className="language-switcher-menu" role="listbox" aria-label={t('language')}>
          {LOCALES.map(option => (
            <button key={option.key} type="button" role="option" aria-selected={option.key === locale} className={`language-switcher-option${option.key === locale ? ' active' : ''}`} onClick={() => choose(option.key)}>
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
