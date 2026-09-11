import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARTICLES, CATEGORIES } from './articles.js'

const NEW_ARTICLE_IDS = [
  'huangli-practical',
  'bazi-jieqi',
  'dayun-guide',
  'fengshui-bazi',
  'tarot-question',
]

const ZODIAC_2026_ARTICLE_IDS = [
  'zodiac-rat-2026', 'zodiac-ox-2026', 'zodiac-tiger-2026', 'zodiac-rabbit-2026',
  'zodiac-dragon-2026', 'zodiac-snake-2026', 'zodiac-horse-2026', 'zodiac-goat-2026',
  'zodiac-monkey-2026', 'zodiac-rooster-2026', 'zodiac-dog-2026', 'zodiac-pig-2026',
]

test('文库提供黄历择日分类与五篇可完整阅读的新文章', () => {
  assert.ok(CATEGORIES.some(category => category.key === 'huangli' && category.label === '黄历择日'))

  const additions = ARTICLES.filter(article => NEW_ARTICLE_IDS.includes(article.id))
  assert.deepEqual(additions.map(article => article.id), NEW_ARTICLE_IDS)
  additions.forEach(article => {
    assert.ok(article.title.length >= 8)
    assert.ok(article.digest.length >= 24)
    assert.ok(article.content.length >= 4)
    assert.ok(article.content.every(section => section.h && section.p.length >= 1))
  })
})

test('文库为十二生肖分别提供 2026 丙午年行动指南', () => {
  const guides = ARTICLES.filter(article => ZODIAC_2026_ARTICLE_IDS.includes(article.id))

  assert.deepEqual(guides.map(article => article.id), ZODIAC_2026_ARTICLE_IDS)
  guides.forEach(article => {
    assert.equal(article.cat, 'flow')
    assert.match(article.title, /2026/)
    assert.ok(article.content.length >= 3)
    assert.ok(article.content.every(section => section.p.join('').length >= 40))
  })
})
