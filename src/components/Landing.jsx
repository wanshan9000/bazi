import { useState } from 'react'
import { ARTICLES, CATEGORIES } from '../data/articles.js'
import { PLANS } from '../engine/membership.js'

// 测算分类（门类筛选）
const CATS = [
  { key: 'all', icon: '✧', label: '全部', en: 'All' },
  { key: 'mingli', icon: '☯', label: '命理排盘', en: 'Mingli' },
  { key: 'yunshi', icon: '☽', label: '运势预测', en: 'Fortune' },
  { key: 'zhanbu', icon: '◈', label: '决策占卜', en: 'Divination' },
  { key: 'huanjing', icon: '⛩', label: '环境家居', en: 'Space' }
]

// 八卡片·元气测算矩阵
// 每张卡片有三种跳转：page（路由到独立页面）/ agent（带 seed 打开元气AI）/ ask（带预设问题）
const CALCULATORS = [
  {
    key: 'bazi',
    cls: 'yc-c-1',
    cat: 'mingli',
    icon: '🗓',
    aiTag: 'AI',
    title: '八字排盘',
    desc: '输入出生年月日时，AI 自动推算四柱八字，结合六运流年进行深度命理解读，涵盖事业、感情、财运、健康。',
    tags: ['四柱', '大运', '流年', '深度解读'],
    cta: '立即排盘',
    route: 'page',
    target: 'bazi'
  },
  {
    key: 'chenggu',
    cls: 'yc-c-2',
    cat: 'mingli',
    icon: '✦',
    aiTag: 'AI',
    title: '称骨论命',
    desc: '袁天罡称骨算命法，根据出生年月日时计算骨重常数，判断命格厚薄，揭示一生事业财运与命运格局。',
    tags: ['骨重命格', '命格厚薄', '生平估算'],
    cta: 'AI 称骨论命',
    route: 'page',
    target: 'chenggu'
  },
  {
    key: 'huangli',
    cls: 'yc-c-3',
    cat: 'yunshi',
    icon: '🍀',
    aiTag: 'NEW',
    title: '今日黄历',
    desc: '结合你的生辰八字，每日推送个性化宜忌、开运方位、贵人属相与幸运色，支持晨起 / 午间 / 晚归定时提醒。',
    tags: ['结合八字', '每日推送', '开运指引'],
    cta: '查看今日黄历',
    route: 'page',
    target: 'huangli'
  },
  {
    key: 'astro',
    cls: 'yc-c-4',
    cat: 'yunshi',
    icon: '✦',
    aiTag: 'AI',
    title: '星座运势',
    desc: 'AI 每日生成个性化星座运势，结合行星运行轨迹，提供当日事业、感情、财运、健康的精准指引。',
    tags: ['每日更新', '十二星座', '行星追踪'],
    cta: '查看运势',
    route: 'page',
    target: 'astro'
  },
  {
    key: 'fengshui',
    cls: 'yc-c-5',
    cat: 'huanjing',
    icon: '⛩',
    aiTag: 'AI',
    title: '风水分析',
    desc: '上传户型图，AI 识别空间布局，从方位、五行、气场流动等角度给出风水优化建议，助力家居能量提升。',
    tags: ['户型分析', '方位优化', '五行调和'],
    cta: '风水分析',
    route: 'page',
    target: 'fengshui'
  },
  {
    key: 'tarot',
    cls: 'yc-c-6',
    cat: 'zhanbu',
    icon: '☽',
    aiTag: 'AI',
    freeTag: '免费 10 次',
    title: '塔罗占卜',
    desc: '融合 78 张塔罗牌的神秘象征体系，AI 根据你的问题与当下能量，给出精准而有温度的塔罗解读。',
    tags: ['单张', '三牌阵', '凯尔特十字'],
    cta: '开始占卜',
    route: 'page',
    target: 'tarot'
  },
  {
    key: 'qimen',
    cls: 'yc-c-7',
    cat: 'zhanbu',
    icon: '◈',
    aiTag: 'AI',
    freeTag: '免费 10 次',
    title: '奇门遁甲',
    desc: '时家奇门排盘，九宫八门九星八神布局可化，AI 深度解读当下格局，给出方位、时机、事情的精准建议。',
    tags: ['九宫排盘', '八门九星', '方位指引'],
    cta: '起盘排局',
    route: 'page',
    target: 'qimen'
  },
  {
    key: 'ziwei',
    cls: 'yc-c-8',
    cat: 'mingli',
    icon: '☼',
    aiTag: 'AI',
    title: '紫微斗数',
    desc: '紫微斗数十四主星全盘排布，十二宫位星曜可化，四化飞星精准标注，大运流年逐步推算，AI 深度解读命盘格局。',
    tags: ['十四主星', '十二宫位', '四化飞星', '大运流年'],
    cta: '紫微排盘',
    route: 'page',
    target: 'ziwei'
  }
]

// 会员方案 · PLANS 已统一自 src/engine/membership.js
const FEATURED = ARTICLES.slice(0, 3)

export default function Landing({ onGate, onAskAgent, onArticle, onSubscribe, user }) {
  const [cat, setCat] = useState('all')
  const list = CALCULATORS.filter(c => cat === 'all' || c.cat === cat)

  const handleClick = (card) => {
    if (card.route === 'agent') {
      onAskAgent && onAskAgent(card.seed)
    } else {
      onGate(card.target)
    }
  }

  return (
    <div className="landing">
      {/* Hero（萌系：标题居中） */}
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker rise rise-1">AI 元气助手 · 24 小时在线</p>
          <h1 className="rise rise-1">
            <span className="hero-line">今天开心</span>
            <span className="hero-line hero-line-2">元气<span className="zhushi">满满</span></span>
          </h1>
          <p className="lead rise rise-2">
            八字、塔罗、紫微、奇门、黄历——<b>八种测算尽在指尖</b>。<br />
            你的专属玄学助手，随时为你解码命运的答案。
          </p>
          <div className="hero-cta rise rise-3">
            <button className="btn" onClick={() => onGate('bazi')}>立即排盘</button>
            <button className="btn ghost" onClick={() => onGate('tarot')}>抽张塔罗</button>
            <button className="btn highlight" onClick={() => onGate('huangli')}>订阅个人黄历</button>
          </div>
        </div>
      </section>

      {/* 元气测算 · 八卡矩阵 */}
      <section className="container">
        <div className="yc-head rise">
          <div>
            <h2 className="section-title">
              元气<span className="zhushi">测算</span>
            </h2>
            <p className="yc-sub">八字、紫微、塔罗、奇门、每日黄历……传统命理 × AI 算法，一站式解决你的疑问。</p>
          </div>
        </div>

        {/* 测算分类筛选 */}
        <div className="cat-row yc-cat-row rise rise-1">
          {CATS.map(c => (
            <button
              key={c.key}
              className={`cat-chip ${cat === c.key ? 'active' : ''}`}
              onClick={() => setCat(c.key)}
            >
              <span className="ce" aria-hidden="true">{c.icon}</span>
              <span className="cl">{c.label}</span>
              <span className="ce en">{c.en}</span>
            </button>
          ))}
        </div>

        <div className="yc-grid rise">
          {list.map((c, i) => (
            <div
              key={c.key}
              className={`yc-card ${c.cls} rise rise-${(i % 4) + 1}`}
              onClick={() => handleClick(c)}
              role="button"
              tabIndex={0}
            >
              <span className="yc-cat-label">{CATS.find(x => x.key === c.cat)?.label}</span>
              <span className="yc-icon" aria-hidden="true">{c.icon}</span>
              <div className="yc-title">
                <span className="yc-ai">{c.aiTag}</span>
                <span>{c.title}</span>
              </div>
              <p className="yc-desc">{c.desc}</p>
              {!user && c.freeTag && (
                <span className="yc-free">🎁 游客 {c.freeTag}</span>
              )}
              <div className="yc-tags">
                {c.tags.map(t => <span key={t} className="yc-tag-chip">{t}</span>)}
              </div>
              <span className="yc-cta">{c.cta} <span aria-hidden="true">→</span></span>
            </div>
          ))}
          {list.length === 0 && (
            <p className="yc-empty">该分类暂无可用的测算，敬请期待。</p>
          )}
        </div>
      </section>

      {/* 会员方案 · 三重境界 */}
      <section className="container plans">
        <div className="yc-head rise">
          <h2 className="section-title">
            解锁你的<span className="zhushi">命运层级</span>
          </h2>
          <p className="yc-sub">从日常陪伴到天机尽握，选择属于你的玄学境界。</p>
        </div>
        <div className="plans-grid rise">
          {PLANS.map((p, i) => (
            <div key={p.key} className={`plan-card ${p.featured ? 'featured' : ''} rise rise-${(i % 3) + 1}`}>
              {p.featured && <span className="plan-badge">最受欢迎</span>}
              <span className="plan-icon" aria-hidden="true">{p.icon}</span>
              <h3 className="plan-name">{p.name}</h3>
              <p className="plan-en latin">{p.en}</p>
              <div className="plan-price">
                <span className="num">{p.price}</span>
                <span className="unit">{p.unit}</span>
              </div>
              <p className="plan-desc">{p.desc}</p>
              <ul className="plan-perks">
                {p.perks.map(perk => <li key={perk}>{perk}</li>)}
              </ul>
              <button className={`btn ${p.featured ? 'light' : 'ghost'} plan-cta`}
                onClick={() => (onSubscribe ? onSubscribe(p.key) : onGate && onGate('agent'))}>
                {p.cta} <span aria-hidden="true">→</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 精选文章 */}
      <section className="container">
        <div className="featured-head rise">
          <h2 className="section-title" style={{ marginBottom: 10 }}>
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
