import AgentChat from './AgentChat.jsx'
import { ARTICLES, CATEGORIES } from '../data/articles.js'

const GATES = [
  { key: 'bazi', glyph: '⌾', name: '八字门', desc: '排四柱 · 看五行 · 定喜用', no: '第一门' },
  { key: 'ziwei', glyph: '☾', name: '紫微门', desc: '览十二宫 · 观星曜布局', no: '第二门' },
  { key: 'liuyao', glyph: '☯', name: '六爻门', desc: '报数起卦 · 趋吉避凶', no: '第三门' },
  { key: 'tarot', glyph: '☥', name: '塔罗门', desc: '七十八张 · 探命运之镜', no: '第四门' }
]

const FEATURED = ARTICLES.slice(0, 3)

export default function Landing({ onGate, chart, onArticle }) {
  return (
    <div className="landing">
      {/* Hero（手机：单列居中 / 桌面：居中聚焦，去掉了右侧K线图） */}
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker rise rise-1">AI 命理 Agent · 三法归一</p>
          <h1 className="rise rise-1">
            三门<span className="zhushi">命理</span>
          </h1>
          <p className="subtitle-en latin rise rise-2">Three Gates · One Oracle</p>
          <p className="lead rise rise-2">
            八字推命、紫微斗数、六爻占卜——<b>三门通晓，一问答尽</b>。<br />
            司命 Agent 随时候命，知命而不困于命。
          </p>
          <div className="hero-cta rise rise-3">
            <button className="btn" onClick={() => onGate('bazi')}>立即排盘</button>
            <button className="btn ghost" onClick={() => onGate('liuyao')}>起卦问事</button>
          </div>
          <div className="badge rise rise-4">
            <span className="dot" />
            知命 · 用命 · 破局
          </div>
        </div>
      </section>

      {/* Agent 对话面板 */}
      <section className="container">
        <div className="agent-panel card rise rise-3">
          <AgentChat chart={chart} />
        </div>
      </section>

      {/* 三门入口 */}
      <section className="container">
        <h2 className="section-title rise">
          <span className="deco">Three Gates</span>
          三门通晓
        </h2>
        <div className="gates rise">
          {GATES.map((g, i) => (
            <div key={g.key} className={`gate rise rise-${i + 1}`} onClick={() => onGate(g.key)}>
              <span className="no">{g.no}</span>
              <span className="glyph">{g.glyph}</span>
              <div className="gn">{g.name}</div>
              <div className="gd">{g.desc}</div>
              <span className="gate-arrow">→</span>
            </div>
          ))}
        </div>

        
      </section>

      {/* 精选文章 */}
      <section className="container">
        <div className="featured-head rise">
          <h2 className="section-title" style={{ marginBottom: 10 }}>
            <span className="deco">Sanmen Journal</span>
            文库精选
          </h2>
          <button className="featured-more" onClick={() => onGate('wenku')}>全部文章 →</button>
        </div>
        <div className="article-grid rise">
          {FEATURED.map(a => (
            <article key={a.id} className="article-card mini" onClick={() => onArticle(a.id)}>
              <div className="ac-top">
                <span className="ac-cat">{CATEGORIES.find(c => c.key === a.cat)?.label}</span>
                <span className="ac-emoji">{a.emoji}</span>
              </div>
              <h3 className="ac-title">{a.title}</h3>
              <p className="ac-digest">{a.digest}</p>
              <div className="ac-meta">
                <span className="am">⏱ {a.read} 分钟</span>
                <span className="am">👁 {a.views}</span>
                <span className="ac-more">阅读 →</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
