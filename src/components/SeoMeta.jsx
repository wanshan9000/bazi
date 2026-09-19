import { useEffect } from 'react'
import { SITE_URL, publicPathForView, seoRoute, shouldIndex } from '../seo.js'
import { structuredDataForPage } from '../seo-pages.js'

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
    const seo = seoRoute(view)
    const path = publicPathForView(view, articleId) || `/${view}`
    const canonicalUrl = `${SITE_URL}${path}`
    const indexable = shouldIndex(view)

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
