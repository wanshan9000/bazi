import { ARTICLES } from './data/articles.js'

const RECENT_ARTICLE_IDS = new Set([
  'huangli-practical',
  'bazi-jieqi',
  'dayun-guide',
  'fengshui-bazi',
  'tarot-question',
  'zodiac-rat-2026',
  'zodiac-ox-2026',
  'zodiac-tiger-2026',
  'zodiac-rabbit-2026',
  'zodiac-dragon-2026',
  'zodiac-snake-2026',
  'zodiac-horse-2026',
  'zodiac-goat-2026',
  'zodiac-monkey-2026',
  'zodiac-rooster-2026',
  'zodiac-dog-2026',
  'zodiac-pig-2026',
])

export const ARTICLE_EDITORIAL_BYLINE = '三门先生'

export function articleContentDate(article) {
  return RECENT_ARTICLE_IDS.has(article.id) ? '2026-09-11' : '2026-09-04'
}

export function findStaticArticle(id) {
  return ARTICLES.find(article => article.id === id) || null
}

export function articleSeo(articleOrId) {
  const article = typeof articleOrId === 'string' ? findStaticArticle(articleOrId) : articleOrId
  if (!article) return null

  const contentDate = articleContentDate(article)
  return {
    path: `/articles/${article.id}`,
    title: `${article.title} | 元氣满满文库`,
    description: article.digest,
    heading: article.title,
    summary: article.digest,
    language: 'zh-CN',
    article,
    schema: {
      article: {
        headline: article.title,
        datePublished: contentDate,
        dateModified: contentDate,
      },
    },
    editorial: {
      byline: ARTICLE_EDITORIAL_BYLINE,
      publisher: '元氣满满',
      datePublished: contentDate,
      dateModified: contentDate,
      sourceHistory: '日期依据本页内容的源码修订记录标注。',
      sources: [],
    },
  }
}
