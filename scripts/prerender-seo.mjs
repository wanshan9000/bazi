import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEFAULT_SITE_URL, languageAlternatesForPage, SEO_ROUTES, structuredDataForPage } from '../src/seo-pages.js'
import { ARTICLES } from '../src/data/articles.js'
import { articleSeo } from '../src/article-seo.js'

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

function editorialBody(page) {
  const editorial = page.editorial
  if (!editorial) return ''
  const english = page.language === 'en'
  const labels = english
    ? { heading: 'Editorial and method', byline: 'Author and editorial byline', published: 'Published', updated: 'Updated', method: 'Terminology and calendar convention', sources: 'References and public texts', responsibility: 'Published by Genki. The byline identifies editorial responsibility and does not claim academic or professional credentials.' }
    : { heading: '编辑、口径与参考', byline: '作者与编辑署名', published: '发布日期', updated: '更新日期', method: '术语与历法口径', sources: '参考书目与公开资料', responsibility: '发布机构：元氣满满。该署名用于标明本页编辑责任，不代表学术或其他专业资质。' }
  const sources = (editorial.sources || []).map(source => source.url
    ? `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a></li>`
    : `<li>${escapeHtml(source.title)}</li>`).join('')
  const method = editorial.method ? (english ? editorial.method.en : editorial.method.zh) : editorial.sourceHistory
  const sourceSection = sources ? `<h3>${labels.sources}</h3><ul>${sources}</ul>` : ''
  return `
      <section><h2>${labels.heading}</h2>
        <p><strong>${labels.byline}${english ? ': ' : '：'}</strong>${escapeHtml(editorial.byline)}${english ? '. ' : '。'}${labels.responsibility}</p>
        <dl><dt>${labels.published}</dt><dd>${escapeHtml(editorial.datePublished)}</dd><dt>${labels.updated}</dt><dd>${escapeHtml(editorial.dateModified)}</dd><dt>${labels.method}</dt><dd>${escapeHtml(method)}</dd></dl>${sourceSection}
      </section>`
}

function articleBody(page) {
  const article = page.article
  if (!article) return ''
  return article.content.map(section => `
        <section>
          <h2>${escapeHtml(section.h)}</h2>
          ${section.p.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        </section>`).join('')
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
  const sections = (page.sections || []).map(([heading, content]) => `
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
      <p class="seo-prerender-summary">${escapeHtml(page.summary)}</p>${articleBody(page) || sections}${guideBody(page)}${editorialBody(page)}${faqBody(page)}
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
  const alternates = languageAlternatesForPage(page, siteUrl)
    .map(alternate => `<link rel="alternate" hreflang="${alternate.language}" href="${escapeHtml(alternate.href)}" />`)
    .join('')
  if (alternates) html = html.replace(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />${alternates}`)
  html = replaceTag(html, /<script id="site-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/, `<script id="site-jsonld" type="application/ld+json">${jsonLd}</script>`)
  html = replaceTag(html, /<div id="root"><\/div>/, staticBody(page))
  if (page.language) html = html.replace('<html lang="zh-CN">', `<html lang="${escapeHtml(page.language)}">`)
  return html
}

function sitemapXml(pages) {
  const urls = pages.map(page => {
    const lastmod = page.schema?.article?.dateModified || page.editorial?.dateModified || '2026-09-19'
    const priority = page.article ? '0.6' : page.path === '/' ? '1.0' : '0.8'
    const changefreq = page.article ? 'monthly' : page.path === '/' ? 'weekly' : 'monthly'
    return `  <url><loc>${escapeHtml(`${siteUrl}${page.path}`)}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function sitemapText(pages) {
  return `${pages.map(page => `${siteUrl}${page.path}`).join('\n')}\n`
}

function llmsText(pages) {
  const articleLinks = pages
    .filter(page => page.article)
    .map(page => `- [${page.article.title}](${siteUrl}${page.path}): ${page.article.digest}`)
    .join('\n')
  return `# 元氣满满（Genki）公开资源索引

元氣满满提供八字、紫微斗数、黄历等中国传统文化学习工具与文库内容。站内内容用于学习、反思与娱乐参考，不构成医疗、法律、投资、科学或其他专业建议，也不承诺预测结果。

## 核心页面

- [八字入门](${siteUrl}/learn/bazi-basics): 简体中文八字基础说明，涵盖四柱、五行、十神、排盘输入与阅读边界。
- [BaZi / Four Pillars guide](${siteUrl}/learn/bazi-four-pillars): English explanation of BaZi terminology, required chart inputs and limitations.
- [八字排盘](${siteUrl}/bazi): 基于出生日期、时间与性别展示传统四柱八字盘面的在线工具。
- [元氣 Agent](${siteUrl}/ai-bazi): 随时在身边的玄学 AI 助手，可围绕八字、紫微斗数与黄历等传统文化问题继续追问。
- [命理文库](${siteUrl}/wenku): 传统文化主题文章集合。

## 文库文章（简体中文）

${articleLinks}

## 编辑与边界

- 八字基础指南与文库的内容编辑署名为三门先生；发布机构为元氣满满。署名用于标明编辑责任，不代表学术或其他专业资质。
- 八字指南采用节气口径：年柱以立春为界，月柱随节令转换；输入使用公历日期。出生时刻不明时，不补定时柱。
- 公开可核对的八字参考文本包括《渊海子平》《三命通会》（四库全书本）与《滴天髓》；具体链接和书目信息见八字指南页面。
`
}

const template = await readFile(join(DIST_DIR.pathname, 'index.html'), 'utf8')
const pages = [...Object.values(SEO_ROUTES), ...ARTICLES.map(articleSeo)]
for (const page of pages) {
  const output = page.path === '/' ? join(DIST_DIR.pathname, 'index.html') : join(DIST_DIR.pathname, page.path.slice(1), 'index.html')
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, pageHtml(template, page), 'utf8')
}
await writeFile(join(DIST_DIR.pathname, 'sitemap.xml'), sitemapXml(pages), 'utf8')
await writeFile(join(DIST_DIR.pathname, 'sitemap.txt'), sitemapText(pages), 'utf8')
await writeFile(join(DIST_DIR.pathname, 'llms.txt'), llmsText(pages), 'utf8')

console.log(`SEO prerendered ${pages.length} public pages, sitemaps and resource index into dist/`)
