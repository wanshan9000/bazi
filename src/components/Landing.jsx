import { useState } from 'react'
import { ARTICLES, CATEGORIES } from '../data/articles.js'
import { PLANS } from '../engine/membership.js'

const CALCULATOR_CATEGORY_LABELS = {
  mingli: '命理排盘',
  yunshi: '运势预测',
  zhanbu: '决策占卜',
  huanjing: '环境家居',
}

// 八卡片·元氣测算矩阵
// 每张卡片有三种跳转：page（路由到独立页面）/ agent（带 seed 打开元氣AI）/ ask（带预设问题）
const CALCULATORS = [
  {
    key: 'bazi',
    cls: 'yc-c-1',
    cat: 'mingli',
    icon: '🗓',
    aiTag: 'AI',
    title: '八字排盘',
    desc: '输入出生年月日时，自动推算四柱八字，结合大运流年给出命理解读，涵盖事业、感情、财运、健康。',
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
    aiTag: '经典',  // 纯查表算法，不经模型，别标 AI
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
    aiTag: '运势',  // 本地引擎出报告，未调用模型
    title: '星座运势',
    // 实现是本地运势规则表，并没有天文历/行星轨迹计算
    desc: '每日星座运势，涵盖事业、感情、财运、健康四个维度，并给出当日幸运色与开运提示。',
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
    aiTag: '排盘',  // 本地引擎出报告，未调用模型
    title: '风水分析',
    // 页面里只有方位下拉表单，没有任何图片上传或识别；文案曾写「上传户型图，AI 识别空间布局」
    desc: '选择大门、客厅、主卧、厨房、书房与床头的方位，按八宅派结合你的八字喜忌，给出五行调和与布局优化建议。',
    tags: ['八宅方位', '五行调和', '结合八字'],
    cta: '风水分析',
    route: 'page',
    target: 'fengshui'
  },
  {
    key: 'tarot',
    cls: 'yc-c-6',
    cat: 'zhanbu',
    icon: '☽',
    aiTag: '牌阵',  // 本地引擎出报告，未调用模型
    freeTag: '免费 8 次',
    title: '塔罗占卜',
    desc: '融合 78 张塔罗牌的神秘象征体系，依你的问题与所抽牌阵，逐位给出正逆位牌意与整体指引。',
    tags: ['多种牌阵', '正逆位解读', '牌意详解'],
    cta: '开始占卜',
    route: 'page',
    target: 'tarot'
  },
  {
    key: 'qimen',
    cls: 'yc-c-7',
    cat: 'zhanbu',
    icon: '◈',
    aiTag: '排盘',  // 本地引擎出报告，未调用模型
    title: '奇门遁甲',
    desc: '时家奇门排盘，九宫、八门、九星、八神完整布局，解读当下格局，给出方位与时机上的参考。',
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
    desc: '紫微斗数十四主星全盘排布，十二宫位星曜齐全，四化飞星标注，大运流年逐步推算，逐宫解读命盘格局。',
    tags: ['十四主星', '十二宫位', '四化飞星', '大运流年'],
    cta: '紫微排盘',
    route: 'page',
    target: 'ziwei'
  }
]

// 首页高频入口：Agent 类入口直接带着问题进入会话；已有测算页则复用原路由，避免做空壳测试页。
const POPULAR_TESTS = [
  {
    key: 'love',
    icon: '♡',
    eyebrow: '关系小测',
    title: '感情测试',
    desc: '想知道桃花、暧昧或相处节奏？先说说你在意的那个人。',
    cta: '问问元氣 AI',
    route: 'agent',
    seed: '我想做一次感情与桃花小测，看看最近适合怎样经营关系。'
  },
  {
    key: 'wealth',
    icon: '¥',
    eyebrow: '财运小测',
    title: '财源测试',
    desc: '从近期财运与赚钱节奏出发，理清适合先做什么。',
    cta: '看看财运',
    route: 'agent',
    seed: '我想做一次财运与赚钱方向小测，看看近期该怎样安排。'
  },
  {
    key: 'tarot-love',
    icon: '☾',
    eyebrow: '心动占卜',
    title: '爱情塔罗',
    desc: '为一段关系抽牌，把心里的犹豫换成更清楚的提示。',
    cta: '开始抽牌',
    route: 'page',
    target: 'tarot'
  },
  {
    key: 'desk-fengshui',
    icon: '⌂',
    eyebrow: '学习与办公',
    title: '书桌风水',
    desc: '从座位与书桌方位开始，看看怎么让空间更顺手、安心。',
    cta: '调整书桌',
    route: 'page',
    target: 'fengshui'
  }
]

// 会员方案 · PLANS 已统一自 src/engine/membership.js
const FEATURED = ARTICLES.slice(0, 3)

export default function Landing({ onGate, onAskAgent, onArticle, onSubscribe, user }) {
  const [agentQuery, setAgentQuery] = useState('')

  const handleClick = (card) => {
    if (card.route === 'agent') {
      onAskAgent && onAskAgent(card.seed)
    } else {
      onGate(card.target)
    }
  }

  const openAgent = (event) => {
    event.preventDefault()
    onAskAgent && onAskAgent(agentQuery.trim())
  }

  return (
    <div className="landing">
      {/* Hero：以元氣智能体为首要入口 */}
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker rise rise-1">AI 元氣助手 · 24 小时在线</p>
          <h1 className="rise rise-1">
            <span className="hero-line">先和元氣AI</span>
            <span className="hero-line hero-line-2">聊聊人生<span className="zhushi">吧</span></span>
          </h1>
          <form className="hero-agent rise rise-3" onSubmit={openAgent}>
            <div className={`hero-agent-input ${agentQuery.trim() ? 'has-query' : ''}`}>
              <input
                value={agentQuery}
                onChange={event => setAgentQuery(event.target.value)}
                aria-label="向元氣 AI 提问"
                placeholder="想问事业、姻缘，还是今年的运势？"
              />
              <button type="submit" aria-label="开启元氣 AI 对话" title="开启元氣 AI 对话">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22l-4-9-9-4z" />
                </svg>
              </button>
            </div>
          </form>
          <div className="hero-agent-suggestions rise rise-3" aria-label="元氣智能体示例问题">
            <span>试试这样问</span>
            {['今年工作会有变化吗？', '我适合主动表白吗？', '最近该注意什么？'].map(question => (
              <button key={question} type="button" onClick={() => onAskAgent && onAskAgent(question)}>{question}</button>
            ))}
          </div>
          <div className="hero-quick-start rise rise-3">
            <span>也可以自己探索</span>
            <div className="hero-cta">
              <button className="btn ghost" onClick={() => onGate('bazi')}>排八字</button>
              <button className="btn ghost" onClick={() => onGate('tarot')}>抽塔罗</button>
              <button className="btn ghost" onClick={() => onGate('huangli')}>看黄历</button>
              <button className="btn ghost" onClick={() => onGate('huangli')}>择吉</button>
              <button className="btn ghost" onClick={() => onGate('fengshui')}>座位风水</button>
              <button className="btn ghost" onClick={() => onGate('ziwei')}>紫微</button>
            </div>
          </div>
        </div>
      </section>

      {/* 大家都在测：用真实已有入口承接高频、轻量的首次探索 */}
      <section className="container popular-tests rise" aria-labelledby="popular-tests-title">
        <div className="popular-tests-head">
          <div>
            <p className="popular-tests-kicker">Popular picks</p>
            <h2 id="popular-tests-title">大家都在测</h2>
          </div>
          <p>从一件最近在意的小事开始，也能慢慢找到答案。</p>
        </div>
        <div className="popular-tests-grid">
          {POPULAR_TESTS.map((test, index) => (
            <button
              key={test.key}
              type="button"
              className={`popular-test-card popular-test-${test.key} rise rise-${index + 1}`}
              onClick={() => handleClick(test)}
            >
              <span className="popular-test-icon" aria-hidden="true">{test.icon}</span>
              <span className="popular-test-eyebrow">{test.eyebrow}</span>
              <span className="popular-test-title">{test.title}</span>
              <span className="popular-test-desc">{test.desc}</span>
              <span className="popular-test-cta">{test.cta} <span aria-hidden="true">→</span></span>
            </button>
          ))}
        </div>
      </section>

      {/* 元氣测算 · 八卡矩阵 */}
      <section className="container">
        <div className="yc-head rise">
          <div>
            <h2 className="section-title">
              元氣<span className="zhushi">测算</span>
            </h2>
            <p className="yc-sub">八字、紫微、塔罗、奇门、每日黄历……传统命理 × AI 算法，一站式解决你的疑问。</p>
          </div>
        </div>

        <div className="yc-grid rise">
          {CALCULATORS.map((c, i) => (
            <div
              key={c.key}
              className={`yc-card ${c.cls} rise rise-${(i % 4) + 1}`}
              onClick={() => handleClick(c)}
              role="button"
              tabIndex={0}
            >
              <span className="yc-cat-label">{CALCULATOR_CATEGORY_LABELS[c.cat]}</span>
              <span className="yc-icon" aria-hidden="true">{c.icon}</span>
              <div className="yc-title">
                <span className="yc-ai">{c.aiTag}</span>
                <span>{c.title}</span>
              </div>
              <p className="yc-desc">{c.desc}</p>
              {!user && c.freeTag && (
                <span className="yc-free">🎁 客者 {c.freeTag}</span>
              )}
              <div className="yc-tags">
                {c.tags.map(t => <span key={t} className="yc-tag-chip">{t}</span>)}
              </div>
              <span className="yc-cta">{c.cta} <span aria-hidden="true">→</span></span>
            </div>
          ))}
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
