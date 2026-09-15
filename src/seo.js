import { DEFAULT_SITE_URL, SEO_ROUTES } from './seo-pages.js'

const viteEnv = import.meta.env || {}
export const SITE_URL = (viteEnv.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
const ROUTES = SEO_ROUTES

const NON_INDEXABLE = new Set(['login', 'register', 'forgot-password', 'profile', 'reports', 'report-detail', 'share', 'admin', 'article', 'tarot-reading'])

export function seoRoute(view) {
  return ROUTES[view] || ROUTES.home
}

export function publicPathForView(view, articleId = null) {
  if (view === 'article' && /^[a-z0-9-]+$/.test(articleId || '')) return `/articles/${articleId}`
  return ROUTES[view]?.path || null
}

export function routeFromPath(pathname) {
  const path = decodeURIComponent(pathname || '/').replace(/\/+$/, '') || '/'
  const found = Object.entries(ROUTES).find(([, value]) => value.path === path)
  if (found) return { view: found[0] }
  const article = path.match(/^\/articles\/([a-z0-9-]+)$/)
  return article ? { view: 'article', articleId: article[1] } : null
}

export function shouldIndex(view) {
  return !NON_INDEXABLE.has(view) && Boolean(ROUTES[view])
}
