import test from 'node:test'
import assert from 'node:assert/strict'
import { publicPathForView, routeFromPath, seoRoute, shouldIndex } from '../seo.js'
import { SEO_ROUTES, structuredDataForPage } from '../seo-pages.js'

test('核心公开页使用 keymm.me 对应的干净路由', () => {
  assert.equal(publicPathForView('bazi'), '/bazi')
  assert.equal(publicPathForView('huangli'), '/huangli')
  assert.equal(publicPathForView('agent'), '/ai-bazi')
  assert.equal(publicPathForView('baziGuide'), '/learn/bazi-four-pillars')
  assert.equal(publicPathForView('baziBasics'), '/learn/bazi-basics')
  assert.equal(routeFromPath('/ziwei').view, 'ziwei')
  assert.equal(routeFromPath('/learn/bazi-four-pillars').view, 'baziGuide')
  assert.equal(routeFromPath('/learn/bazi-basics').view, 'baziBasics')
  assert.equal(routeFromPath('/articles/zodiac-rat-2026').articleId, 'zodiac-rat-2026')
})

test('中文八字入门页提供可引用的中文 FAQ、文章与工具结构化数据', () => {
  const page = SEO_ROUTES.baziBasics
  const data = structuredDataForPage(page, 'https://keymm.me/learn/bazi-basics', 'https://keymm.me')
  const types = data['@graph'].map(node => node['@type'])

  assert.equal(page.language, 'zh-CN')
  assert.ok(page.guide.faqs.length >= 3)
  assert.ok(types.includes('Article'))
  assert.ok(types.includes('FAQPage'))
  assert.ok(types.includes('WebApplication'))
})

test('英文 BaZi 指南提供可引用的 FAQ、文章与工具结构化数据', () => {
  const page = SEO_ROUTES.baziGuide
  const data = structuredDataForPage(page, 'https://keymm.me/learn/bazi-four-pillars', 'https://keymm.me')
  const types = data['@graph'].map(node => node['@type'])

  assert.equal(page.language, 'en')
  assert.ok(page.guide.faqs.length >= 3)
  assert.ok(types.includes('Article'))
  assert.ok(types.includes('FAQPage'))
  assert.ok(types.includes('WebApplication'))
})

test('中英文八字指南使用同一主题实体，并提供稳定的页面、术语和工具关系', () => {
  const pages = [SEO_ROUTES.baziBasics, SEO_ROUTES.baziGuide]
  const data = pages.map(page => structuredDataForPage(page, `https://keymm.me${page.path}`, 'https://keymm.me'))

  for (const graph of data) {
    const webPage = graph['@graph'].find(node => node['@type'] === 'WebPage')
    const article = graph['@graph'].find(node => node['@type'] === 'Article')
    const terms = graph['@graph'].find(node => node['@type'] === 'DefinedTermSet')
    const application = graph['@graph'].find(node => node['@type'] === 'WebApplication')

    assert.equal(webPage.mainEntity['@id'], article['@id'])
    assert.equal(webPage.about['@id'], 'https://keymm.me/#bazi-four-pillars')
    assert.equal(article.about['@id'], webPage.about['@id'])
    assert.equal(terms.hasDefinedTerm.length >= 5, true)
    assert.ok(article.mentions.some(node => node['@id'] === application['@id']))
    assert.ok(article.mentions.some(node => node['@id'] === 'https://keymm.me/ai-bazi#application'))
  }
})

test('元氣 Agent 以独立助手实体提供能力、问答与正确落地页', () => {
  const page = SEO_ROUTES.agent
  const data = structuredDataForPage(page, 'https://keymm.me/ai-bazi', 'https://keymm.me')
  const application = data['@graph'].find(node => node['@type'] === 'WebApplication')
  const article = data['@graph'].find(node => node['@type'] === 'Article')
  const faq = data['@graph'].find(node => node['@type'] === 'FAQPage')

  assert.match(page.heading, /随时在身边的玄学 AI 助手/)
  assert.ok(article)
  assert.equal(application.url, 'https://keymm.me/ai-bazi')
  assert.ok(application.featureList.includes('基于会话的继续追问'))
  assert.equal(faq.mainEntity.length, 4)
})

test('私密与账户页面不应进入搜索索引', () => {
  assert.equal(shouldIndex('bazi'), true)
  assert.equal(shouldIndex('agent'), true)
  assert.equal(shouldIndex('profile'), false)
  assert.equal(shouldIndex('report-detail'), false)
  assert.match(seoRoute('bazi').title, /八字排盘/)
})

test('每个可索引路由均具有供静态预渲染使用的页面正文', () => {
  for (const [view, page] of Object.entries(SEO_ROUTES)) {
    assert.equal(shouldIndex(view), true)
    assert.ok(page.heading.length > 1)
    assert.ok(page.summary.length > 10)
    assert.ok(page.sections.length >= 2)
  }
})
