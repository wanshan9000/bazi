import test from 'node:test'
import assert from 'node:assert/strict'
import { publicPathForView, routeFromPath, seoRoute, shouldIndex } from '../seo.js'
import { SEO_ROUTES } from '../seo-pages.js'

test('核心公开页使用 keymm.me 对应的干净路由', () => {
  assert.equal(publicPathForView('bazi'), '/bazi')
  assert.equal(publicPathForView('huangli'), '/huangli')
  assert.equal(publicPathForView('agent'), '/ai-bazi')
  assert.equal(routeFromPath('/ziwei').view, 'ziwei')
  assert.equal(routeFromPath('/articles/zodiac-rat-2026').articleId, 'zodiac-rat-2026')
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
