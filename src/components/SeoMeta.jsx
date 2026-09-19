import { useEffect } from 'react'
import { SITE_URL, publicPathForView, seoRoute, shouldIndex } from '../seo.js'
import { languageAlternatesForPage, structuredDataForPage } from '../seo-pages.js'

function setMeta(selector, attributes) {
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('meta')
    document.head.appendChild(node)
  }
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value))
}

export default function SeoMeta({ view, articleId }) {
  useEffect(() => {
    const seo = seoRoute(view, articleId)
    const path = publicPathForView(view, articleId) || `/${view}`
    const canonicalUrl = `${SITE_URL}${path}`
    const indexable = shouldIndex(view, articleId)

    document.title = seo.title
    setMeta('meta[name="description"]', { name: 'description', content: seo.description })
    setMeta('meta[name="robots"]', { name: 'robots', content: indexable ? 'index,follow,max-image-preview:large' : 'noindex,nofollow' })
    setMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title })
    setMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description })
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl })

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', canonicalUrl)

    document.head.querySelectorAll('link[data-language-alternate="true"]').forEach(node => node.remove())
    for (const alternate of languageAlternatesForPage(seo, SITE_URL)) {
      const link = document.createElement('link')
      link.setAttribute('rel', 'alternate')
      link.setAttribute('hreflang', alternate.language)
      link.setAttribute('href', alternate.href)
      link.dataset.languageAlternate = 'true'
      document.head.appendChild(link)
    }

    let structured = document.getElementById('site-jsonld')
    if (!structured) {
      structured = document.createElement('script')
      structured.id = 'site-jsonld'
      structured.type = 'application/ld+json'
      document.head.appendChild(structured)
    }
    structured.textContent = JSON.stringify(structuredDataForPage(seo, canonicalUrl, SITE_URL))
  }, [articleId, view])

  return null
}
