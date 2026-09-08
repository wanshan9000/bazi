import { useEffect, useState } from 'react'
import { ARTICLES, CATEGORIES } from '../data/articles.js'
import { api } from '../api/client.js'

export default function ArticleView({ id, onBack, onOpen }) {
  const [publishedArticle, setPublishedArticle] = useState(null)
  const [publishedList, setPublishedList] = useState(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    let active = true
    setPublishedArticle(null)
    setPublishedList(null)
    api.articles()
      .then(result => {
        if (!active) return
        const list = Array.isArray(result?.data) ? result.data : []
        setPublishedList(list)
        if (!list.some(article => article.id === id)) return
        return api.article(id)
          .then(detail => { if (active) setPublishedArticle(detail?.data || null) })
          .catch(() => { /* 保留已成功取得的发布清单，不回退到静态文章 */ })
      })
      .catch(() => { if (active) setPublishedList(false) })
    return () => { active = false }
  }, [id])

  const staticArticle = ARTICLES.find(article => article.id === id) || null
  const article = publishedArticle || (publishedList === false ? staticArticle : null)
  if (!article) {
    return (
      <div className="page-wrap article-view">
        <div className="container">
          <div className="page-head rise"><button className="back-btn" onClick={onBack}>‹ 返回</button></div>
          <div className="admin-empty">{publishedList === null ? '正在加载文章…' : '文章不存在或尚未发布'}</div>
        </div>
      </div>
    )
  }

  const relatedPool = publishedList === false ? ARTICLES : (publishedList || [])
  const related = relatedPool
    .filter(a => a.id !== article.id && (a.cat === article.cat || a.emoji === article.emoji))
    .slice(0, 3)
  const catLabel = CATEGORIES.find(c => c.key === article.cat)?.label

  return (
    <div className="page-wrap article-view">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>

        <article className="article-body card rise rise-1">
          <header className="ab-head">
            <div className="ab-badge">
              <span className="ab-cat">{catLabel}</span>
              <span className="ab-emoji">{article.emoji}</span>
            </div>
            <h1 className="ab-title">{article.title}</h1>
            <p className="ab-meta">
              <span className="latin">Sanmen Journal</span>
              <span className="sep">✦</span>
              ⏱ 阅读约 {article.read} 分钟
              <span className="sep">✦</span>
              👁 {article.views || 0} 阅读
            </p>
          </header>

          <div className="ab-rule">
            <span className="rule-line" />
            <span className="rule-dot">☯</span>
            <span className="rule-line" />
          </div>

          {article.content.map((sec, i) => (
            <section key={i} className="ab-sec">
              <h2>{sec.h}</h2>
              {sec.p.map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </section>
          ))}

          <footer className="ab-foot">
            <p className="ab-disclaimer">
              本文由三门命理 · 三门先生整理呈现，玄学内容仅供参考，请理性看待。
            </p>
            <button className="btn small" onClick={() => onOpen(related[0]?.id || ARTICLES[0].id)}>
              继续阅读 →
            </button>
          </footer>
        </article>

        {/* 相关推荐 */}
        {related.length > 0 && (
          <section className="related">
            <h2 className="section-title"><span className="deco">Keep Reading</span>相关阅读</h2>
            <div className="article-grid">
              {related.map(a => (
                <article key={a.id} className="article-card mini" onClick={() => onOpen(a.id)}>
                  <div className="ac-top">
                    <span className="ac-cat">{CATEGORIES.find(c => c.key === a.cat)?.label}</span>
                    <span className="ac-emoji">{a.emoji}</span>
                  </div>
                  <h3 className="ac-title">{a.title}</h3>
                  <div className="ac-meta">
                    <span className="am">⏱ {a.read} 分钟</span>
                    <span className="ac-more">→</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
