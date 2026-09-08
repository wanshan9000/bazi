import { useEffect, useMemo, useState } from 'react'
import { ARTICLES, CATEGORIES } from '../data/articles.js'
import { api } from '../api/client.js'

export default function ArticlesPage({ onBack, onOpen }) {
  const [cat, setCat] = useState('all')
  const [published, setPublished] = useState(null)

  useEffect(() => {
    let active = true
    api.articles()
      .then(result => { if (active) setPublished(Array.isArray(result?.data) ? result.data : []) })
      .catch(() => { /* 后端暂不可达时继续展示内置文章 */ })
    return () => { active = false }
  }, [])

  // 后端可用时以其清单为准，才能让管理员的隐藏和删除真正影响前台。
  // 只有后端完全不可达时，才退回内置文章保证文库不留白。
  const allArticles = useMemo(() => published === null ? ARTICLES : published, [published])

  const list = cat === 'all' ? allArticles : allArticles.filter(a => a.cat === cat)

  return (
    <div className="page-wrap articles-page">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>‹ 返回</button>
        </div>
        <h1 className="page-title rise rise-1">文库</h1>
        <p className="page-sub rise rise-2">玄学文章中心 · 知命之道</p>

        {/* 分类筛选 */}
        <div className="cat-row rise rise-2">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              className={`cat-chip ${cat === c.key ? 'active' : ''}`}
              onClick={() => setCat(c.key)}
            >
              <span className="ce">{c.emoji || '☰'}</span>
              <span className="cl">{c.label}</span>
            </button>
          ))}
        </div>

        {/* 文章卡片网格 */}
        <div className="article-grid">
          {list.map((a, i) => (
            <article key={a.id} className="article-card rise" style={{ animationDelay: `${i * 0.05}s` }} onClick={() => onOpen(a.id)}>
              <div className="ac-top">
                <span className="ac-cat">
                  {CATEGORIES.find(c => c.key === a.cat)?.label}
                </span>
                <span className="ac-emoji">{a.emoji}</span>
              </div>
              <h3 className="ac-title">{a.title}</h3>
              <p className="ac-digest">{a.digest}</p>
              <div className="ac-meta">
                <span className="am">⏱ {a.read} 分钟</span>
                <span className="am">👁 {a.views || 0}</span>
                <span className="ac-more">阅读全文 →</span>
              </div>
            </article>
          ))}
        </div>

        {list.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 40 }}>
            该分类暂无文章
          </p>
        )}
      </div>
    </div>
  )
}
