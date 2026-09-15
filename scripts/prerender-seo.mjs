import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEFAULT_SITE_URL, SEO_ROUTES } from '../src/seo-pages.js'

const DIST_DIR = new URL('../dist/', import.meta.url)
const siteUrl = (process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function replaceTag(html, pattern, value) {
  if (!pattern.test(html)) throw new Error(`Cannot locate required HTML tag: ${pattern}`)
  return html.replace(pattern, value)
}

function staticBody(page) {
  const sections = page.sections.map(([heading, content]) => `
        <section>
          <h2>${escapeHtml(heading)}</h2>
          <p>${escapeHtml(content)}</p>
        </section>`).join('')
  return `<div id="root" data-seo-prerendered="true">
  <main class="seo-prerender" aria-label="${escapeHtml(page.heading)}">
    <header>
      <a href="/" aria-label="元氣满满首页">元氣满满</a>
      <p>随时在身边的玄学助手</p>
    </header>
    <article>
      <h1>${escapeHtml(page.heading)}</h1>
      <p class="seo-prerender-summary">${escapeHtml(page.summary)}</p>${sections}
      <p class="seo-prerender-links"><a href="/bazi">八字排盘</a><a href="/ziwei">紫微斗数</a><a href="/huangli">黄历</a><a href="/ai-bazi">元氣AI</a><a href="/wenku">命理文库</a></p>
      <p class="seo-prerender-disclaimer">本站内容仅供传统文化学习与娱乐参考，不构成医疗、投资、法律或其他专业建议。</p>
    </article>
  </main>
</div>`
}

function pageHtml(template, page) {
  const canonicalUrl = `${siteUrl}${page.path}`
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': page.path === '/wenku' ? 'CollectionPage' : 'WebPage',
    name: page.title,
    description: page.description,
    url: canonicalUrl,
    isPartOf: { '@type': 'WebSite', name: '元氣满满', url: siteUrl },
    inLanguage: 'zh-CN',
  }).replaceAll('<', '\\u003c')

  let html = template
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
  html = replaceTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(page.description)}" />`)
  html = replaceTag(html, /<meta name="robots"[^>]*>/, '<meta name="robots" content="index,follow,max-image-preview:large" />')
  html = replaceTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(page.title)}" />`)
  html = replaceTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(page.description)}" />`)
  html = replaceTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
  html = replaceTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`)
  html = replaceTag(html, /<script id="site-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/, `<script id="site-jsonld" type="application/ld+json">${jsonLd}</script>`)
  html = replaceTag(html, /<div id="root"><\/div>/, staticBody(page))
  return html
}

const template = await readFile(join(DIST_DIR.pathname, 'index.html'), 'utf8')
const pages = Object.values(SEO_ROUTES)
for (const page of pages) {
  const output = page.path === '/' ? join(DIST_DIR.pathname, 'index.html') : join(DIST_DIR.pathname, page.path.slice(1), 'index.html')
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, pageHtml(template, page), 'utf8')
}

console.log(`SEO prerendered ${pages.length} public pages into dist/`)
