// 轻量增长归因：只记录页面、渠道和匿名事件，不接触生辰、命盘、账号或对话内容。
const ATTRIBUTION_KEY = 'genki-campaign-attribution'
const FIELDS = ['source', 'medium', 'campaign', 'content']

function clean(value, fallback = '') {
  const text = String(value || '').trim().toLowerCase()
  return /^[a-z0-9._:-]{1,64}$/.test(text) ? text : fallback
}

function currentAttribution() {
  if (typeof window === 'undefined') return { source: 'direct', medium: 'none', campaign: '' }
  const params = new URLSearchParams(window.location.search)
  const incoming = {
    source: clean(params.get('utm_source')),
    medium: clean(params.get('utm_medium')),
    campaign: clean(params.get('utm_campaign')),
    content: clean(params.get('utm_content')),
  }
  const hasIncoming = FIELDS.some(field => incoming[field])
  if (hasIncoming) {
    const value = { source: incoming.source || 'direct', medium: incoming.medium || 'referral', campaign: incoming.campaign, content: incoming.content }
    try { sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value)) } catch { /* storage is optional */ }
    return value
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || 'null')
    if (saved?.source) return { source: clean(saved.source, 'direct'), medium: clean(saved.medium, 'none'), campaign: clean(saved.campaign), content: clean(saved.content) }
  } catch { /* use direct attribution */ }
  return { source: 'direct', medium: 'none', campaign: '', content: '' }
}

export function trackEvent(event, fields = {}) {
  if (typeof window === 'undefined' || !/^[a-z_]{2,48}$/.test(event)) return
  const attribution = currentAttribution()
  const payload = {
    event,
    page: clean(fields.page || window.location.pathname.replace(/^\//, '') || 'home', 'home'),
    locale: clean(fields.locale || document.documentElement.lang || 'zh-cn', 'zh-cn'),
    ...attribution,
  }
  // fetch 的 keepalive 可在页面跳转后继续发送；失败不影响用户当前操作。
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}

export function campaignUrl(path, { source, medium = 'referral', campaign, content = '' }) {
  if (typeof window === 'undefined') return path
  const url = new URL(path, window.location.origin)
  url.searchParams.set('utm_source', clean(source, 'direct'))
  url.searchParams.set('utm_medium', clean(medium, 'referral'))
  url.searchParams.set('utm_campaign', clean(campaign, 'site'))
  if (content) url.searchParams.set('utm_content', clean(content))
  return url.toString()
}
