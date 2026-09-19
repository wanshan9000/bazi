import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEFAULT_SITE_URL, SEO_ROUTES, structuredDataForPage } from '../src/seo-pages.js'

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

function guideBody(page) {
  const guide = page.guide
  if (!guide) return ''
  const labels = page.language === 'en'
    ? ['Key terms', 'How to read a chart responsibly', 'Frequently asked questions']
    : ['核心术语', '如何稳妥地阅读命盘', '常见问题']
  const terms = guide.terms.map(([term, definition]) => `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(definition)}</dd>`).join('')
  const steps = guide.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')
  const faqs = guide.faqs.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')
  return `
      <section><h2>${labels[0]}</h2><dl>${terms}</dl></section>
      <section><h2>${labels[1]}</h2><ol>${steps}</ol></section>
      <section><h2>${labels[2]}</h2>${faqs}</section>`
}

function faqBody(page) {
  if (!page.faqs?.length) return ''
  const heading = page.language === 'en' ? 'Frequently asked questions' : '常见问题'
  const faqs = page.faqs.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')
  return `\n      <section><h2>${heading}</h2>${faqs}</section>`
}

function pairedGuideLink(page) {
  if (page.path === '/learn/bazi-four-pillars') return { href: '/learn/bazi-basics', label: '八字入门（中文）' }
  if (page.path === '/learn/bazi-basics') return { href: '/learn/bazi-four-pillars', label: 'BaZi guide (English)' }
  return page.language === 'en'
    ? { href: '/learn/bazi-four-pillars', label: 'BaZi guide' }
    : { href: '/learn/bazi-basics', label: '八字入门' }
}

function staticBody(page) {
  const sections = page.sections.map(([heading, content]) => `
        <section>
          <h2>${escapeHtml(heading)}</h2>
          <p>${escapeHtml(content)}</p>
        </section>`).join('')
  const agentLink = page.path === '/ai-bazi'
    ? ''
    : `<a href="/ai-bazi">${page.language === 'en' ? 'Ask Genki Agent' : '咨询元氣 Agent'}</a>`
  const guideLink = pairedGuideLink(page)
  return `<div id="root" data-seo-prerendered="true">
  <main class="seo-prerender" aria-label="${escapeHtml(page.heading)}">
    <header>
      <a href="/" aria-label="Genki home">GENKI</a>
      <p>${page.language === 'en' ? 'Traditional culture, clearly explained' : '随时在身边的玄学助手'}</p>
    </header>
    <article>
      <h1>${escapeHtml(page.heading)}</h1>
      <p class="seo-prerender-summary">${escapeHtml(page.summary)}</p>${sections}${guideBody(page)}${faqBody(page)}
      <p class="seo-prerender-links"><a href="/bazi">${page.language === 'en' ? 'Try the BaZi calculator' : '八字排盘'}</a>${agentLink}<a href="${guideLink.href}">${guideLink.label}</a><a href="/ziwei">${page.language === 'en' ? 'Ziwei Doushu' : '紫微斗数'}</a><a href="/wenku">${page.language === 'en' ? 'Library' : '命理文库'}</a></p>
      <p class="seo-prerender-disclaimer">${page.language === 'en' ? 'This site is for traditional culture, learning and entertainment. It is not medical, legal, financial or other professional advice.' : '本站内容仅供传统文化学习与娱乐参考，不构成医疗、投资、法律或其他专业建议。'}</p>
    </article>
  </main>
</div>`
}

function pageHtml(template, page) {
  const canonicalUrl = `${siteUrl}${page.path}`
  const jsonLd = JSON.stringify(structuredDataForPage(page, canonicalUrl, siteUrl)).replaceAll('<', '\\u003c')

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
  if (page.language) html = html.replace('<html lang="zh-CN">', `<html lang="${escapeHtml(page.language)}">`)
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
