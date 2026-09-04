import { useState } from 'react'
import { ARTICLES, CATEGORIES } from '../data/articles.js'

export default function ArticlesPage({ onBack, onOpen }) {
  const [cat, setCat] = useState('all')

  const list = cat === 'all' ? ARTICLES : ARTICLES.filter(a => a.cat === cat)
  const catEmoji = CATEGORIES.find(c => c.key === cat)

  return (
    <div className="page-wrap articles-page">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>← 返回首页</button>
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
                <span className="am">👁 {a.views}</span>
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
