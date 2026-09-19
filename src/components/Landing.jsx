import { useState } from 'react'
import { ARTICLES, CATEGORIES } from '../data/articles.js'
import { PLANS } from '../engine/membership.js'
import { useLocale } from '../i18n.jsx'
import { trackEvent } from '../utils/analytics.js'

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
    freeTag: '基础排盘免费 · 无需登录',
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
    freeTag: '游客本机免费 3 次',
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

const LANDING_COPY = {
  'zh-CN': {
    kicker: 'AI 元氣助手，分享得积分', heroA: '先和元氣AI', heroB: '聊聊人生', input: '想问事业、姻缘，还是今年的运势？', ask: '向元氣 AI 提问', start: '开启元氣 AI 对话', try: '试试这样问', suggestions: ['今年工作会有变化吗？', '我适合主动表白吗？', '最近该注意什么？'], explore: '也可以自己探索', shortcuts: ['排八字', '抽塔罗', '看黄历', '择吉', '座位风水', '紫微'],
    popularKicker: 'Popular picks', popularTitle: '大家都在测', popularDesc: '从一件最近在意的小事开始，也能慢慢找到答案。', calcTitle: '元氣测算', calcDesc: '八字、紫微、塔罗、奇门、每日黄历……传统命理 × AI 算法，一站式解决你的疑问。', plansTitle: '解锁你的命运层级', plansDesc: '从日常陪伴到天机尽握，选择属于你的玄学境界。', popular: [
      ['关系小测', '感情测试', '想知道桃花、暧昧或相处节奏？先说说你在意的那个人。', '问问元氣 AI'], ['财运小测', '财源测试', '从近期财运与赚钱节奏出发，理清适合先做什么。', '看看财运'], ['心动占卜', '爱情塔罗', '为一段关系抽牌，把心里的犹豫换成更清楚的提示。', '开始抽牌'], ['学习与办公', '书桌风水', '从座位与书桌方位开始，看看怎么让空间更顺手、安心。', '调整书桌'],
    ], categories: ['命理排盘', '运势预测', '决策占卜', '环境家居'], articleTitle: '文库精选', allArticles: '全部文章', read: '阅读', minutes: '分钟', guest: '游客', featuredLabel: '最受欢迎',
  },
  'zh-TW': {
    kicker: 'AI 元氣助手，分享得積分', heroA: '先和元氣AI', heroB: '聊聊人生', input: '想問事業、姻緣，還是今年的運勢？', ask: '向元氣 AI 提問', start: '開啟元氣 AI 對話', try: '試試這樣問', suggestions: ['今年工作會有變化嗎？', '我適合主動表白嗎？', '最近該注意什麼？'], explore: '也可以自己探索', shortcuts: ['排八字', '抽塔羅', '看黃曆', '擇吉', '座位風水', '紫微'],
    popularKicker: 'Popular picks', popularTitle: '大家都在測', popularDesc: '從一件最近在意的小事開始，也能慢慢找到答案。', calcTitle: '元氣測算', calcDesc: '八字、紫微、塔羅、奇門、每日黃曆……傳統命理 × AI 演算法，一站式解決你的疑問。', plansTitle: '解鎖你的命運層級', plansDesc: '從日常陪伴到天機盡握，選擇屬於你的玄學境界。', popular: [
      ['關係小測', '感情測試', '想知道桃花、曖昧或相處節奏？先說說你在意的那個人。', '問問元氣 AI'], ['財運小測', '財源測試', '從近期財運與賺錢節奏出發，理清適合先做什麼。', '看看財運'], ['心動占卜', '愛情塔羅', '為一段關係抽牌，把心裡的猶豫換成更清楚的提示。', '開始抽牌'], ['學習與辦公', '書桌風水', '從座位與書桌方位開始，看看怎麼讓空間更順手、安心。', '調整書桌'],
    ], categories: ['命理排盤', '運勢預測', '決策占卜', '環境家居'], articleTitle: '文庫精選', allArticles: '全部文章', read: '閱讀', minutes: '分鐘', guest: '遊客', featuredLabel: '最受歡迎',
  },
  en: {
    kicker: 'GENKI AI · SHARE TO EARN CREDITS', heroA: 'Talk with Genki AI', heroB: 'about your life', input: 'Career, relationships, or this year\'s outlook?', ask: 'Ask Genki AI', start: 'Start a Genki AI conversation', try: 'Try asking', suggestions: ['Will my work change this year?', 'Should I make the first move?', 'What should I watch for lately?'], explore: 'Or explore on your own', shortcuts: ['Bazi chart', 'Draw Tarot', 'Almanac', 'Choose a date', 'Desk Feng Shui', 'Ziwei'],
    popularKicker: 'Popular picks', popularTitle: 'What people are exploring', popularDesc: 'Start with what has been on your mind lately, then find a clearer next step.', calcTitle: 'Explore with Genki', calcDesc: 'Bazi, Ziwei, Tarot, Qimen, and the daily Almanac. Traditional systems and AI guidance in one place.', plansTitle: 'Choose your access level', plansDesc: 'From everyday guidance to frequent, in-depth use, find the plan that fits you.', popular: [
      ['Relationship check-in', 'Love reading', 'Explore the rhythm of attraction, ambiguity, and connection.', 'Ask Genki AI'], ['Money check-in', 'Wealth reading', 'Start with your recent money rhythm and clarify what to focus on.', 'Explore finances'], ['Tarot reading', 'Love Tarot', 'Draw for a relationship and turn uncertainty into a clearer prompt.', 'Draw cards'], ['Study and work', 'Desk Feng Shui', 'Start with the direction of your desk and make your space feel more supportive.', 'Adjust my desk'],
    ], categories: ['Chart reading', 'Daily outlook', 'Decision reading', 'Home and space'], articleTitle: 'From the library', allArticles: 'All articles', read: 'Read', minutes: 'min', guest: 'Guest', featuredLabel: 'Most popular',
  },
}

function guestPlan(locale) {
  const copy = {
    'zh-CN': {
      name: '游者', en: 'WANDERER', priceLabel: '免费体验', desc: '无需注册，先从一次免费的测算开始。',
      perks: ['无 Token 功能每项每天最多 20 次', '元氣 AI 每 30 天含 24 积分体验额度', '分享可获永久积分'], cta: '开始免费体验',
    },
    'zh-TW': {
      name: '遊者', en: 'WANDERER', priceLabel: '免費體驗', desc: '無需註冊，先從一次免費的測算開始。',
      perks: ['無 Token 功能每項每天最多 20 次', '元氣 AI 每 30 天含 24 積分體驗額度', '分享可獲永久積分'], cta: '開始免費體驗',
    },
    en: {
      name: 'Wanderer', en: 'GUEST', priceLabel: 'Free to try', desc: 'No sign-in needed. Start with a free reading.',
      perks: ['Up to 20 no-Token uses per feature each day', '24 Genki AI trial credits every 30 days', 'Earn permanent credits when sharing'], cta: 'Start for free',
    },
  }[locale] || {
    name: '游者', en: 'WANDERER', priceLabel: '免费体验', desc: '无需注册，先从一次免费的测算开始。',
    perks: ['无 Token 功能每项每天最多 20 次', '元氣 AI 每 30 天含 24 积分体验额度', '分享可获永久积分'], cta: '开始免费体验',
  }

  return { key: 'guest', icon: '◎', ...copy }
}

const CALCULATOR_TRANSLATIONS = {
  'zh-TW': [
    ['八字排盤', '輸入出生年月日時，自動推算四柱八字，結合大運流年給出命理解讀，涵蓋事業、感情、財運、健康。', ['四柱', '大運', '流年', '深度解讀'], '立即排盤'],
    ['稱骨論命', '袁天罡稱骨算命法，根據出生年月日時推算骨重，解讀人生格局與趨勢。', ['骨重命格', '命格厚薄', '生平估算'], '開始稱骨'],
    ['今日黃曆', '結合你的生辰八字，每日提供個人化宜忌、開運方位、貴人屬相與幸運色。', ['結合八字', '每日推送', '開運指引'], '查看今日黃曆'],
    ['星座運勢', '每日星座運勢，涵蓋事業、感情、財運、健康與幸運提示。', ['每日更新', '十二星座', '行星追蹤'], '查看運勢'],
    ['風水分析', '依八宅派結合八字喜忌，為你的空間提供五行調和與布局建議。', ['八宅方位', '五行調和', '結合八字'], '風水分析'],
    ['塔羅占卜', '依你抽取的牌陣，逐位給出正逆位牌意與整體指引。', ['多種牌陣', '正逆位解讀', '牌意詳解'], '開始占卜'],
    ['奇門遁甲', '時家奇門排盤，解讀當下格局，提供方位與時機參考。', ['九宮排盤', '八門九星', '方位指引'], '起盤排局'],
    ['紫微斗數', '紫微斗數完整排盤，逐宮解讀命盤格局與大運流年。', ['十四主星', '十二宮位', '四化飛星', '大運流年'], '紫微排盤'],
  ],
  en: [
    ['Bazi chart', 'Enter your birth date and time to generate the Four Pillars and explore career, relationships, finances, and wellbeing.', ['Four Pillars', '10-year luck', 'Annual outlook', 'In-depth reading'], 'Create chart'],
    ['Bone Weight reading', 'A traditional Yuan Tiangang calculation based on birth year, month, day, and hour.', ['Bone weight', 'Life pattern', 'Life overview'], 'Calculate reading'],
    ["Today’s Almanac", 'Personalized daily auspicious activities, directions, and color guidance, connected to your Bazi.', ['With Bazi', 'Daily update', 'Helpful directions'], 'View Almanac'],
    ['Horoscope', 'Daily signs for career, relationships, finances, wellbeing, and a lucky prompt.', ['Daily update', '12 signs', 'Planetary themes'], 'View horoscope'],
    ['Feng Shui', 'Use Eight Mansions and your elemental profile to improve balance and layout in your space.', ['Eight Mansions', 'Element balance', 'With Bazi'], 'Analyze space'],
    ['Tarot', 'Choose a spread and receive position-by-position card meanings and a full reading.', ['Multiple spreads', 'Upright and reversed', 'Card meanings'], 'Start reading'],
    ['Qimen Dunjia', 'A Qimen chart for the moment, with directions and timing to consider.', ['Nine palaces', 'Gates and stars', 'Direction guide'], 'Create chart'],
    ['Ziwei Doushu', 'A full Ziwei chart with palace interpretations and 10-year and annual cycles.', ['14 major stars', '12 palaces', 'Transformations', 'Annual outlook'], 'Create chart'],
  ],
}

function localizedCalculators(locale) {
  const translations = CALCULATOR_TRANSLATIONS[locale]
  if (!translations) return CALCULATORS
  return CALCULATORS.map((card, index) => ({ ...card, title: translations[index][0], desc: translations[index][1], tags: translations[index][2], cta: translations[index][3] }))
}

export default function Landing({ onGate, onAskAgent, onArticle, onSubscribe, user }) {
  const [agentQuery, setAgentQuery] = useState('')
  const { locale } = useLocale()
  const copy = LANDING_COPY[locale] || LANDING_COPY['zh-CN']
  const plans = [guestPlan(locale), ...PLANS]
  const calculators = localizedCalculators(locale)

  const handleClick = (card) => {
    if (card.route === 'agent') {
      onAskAgent && onAskAgent(card.seed)
    } else {
      if (card.target === 'bazi') trackEvent('bazi_calculator_opened', { page: 'home', locale })
      onGate(card.target)
    }
  }

  const openAgent = (event) => {
    event.preventDefault()
    onAskAgent && onAskAgent(agentQuery.trim())
  }

  const openBaziCalculator = () => {
    trackEvent('bazi_calculator_opened', { page: 'home', locale })
    onGate('bazi')
  }

  return (
    <div className="landing">
      {/* Hero：以元氣智能体为首要入口 */}
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker rise rise-1">{copy.kicker}</p>
          <h1 className="rise rise-1">
            <span className="hero-line">{copy.heroA}</span>
            <span className="hero-line hero-line-2">{copy.heroB}<span className="zhushi">{locale === 'en' ? '' : '吧'}</span></span>
          </h1>
          <form className="hero-agent rise rise-3" onSubmit={openAgent}>
            <div className={`hero-agent-input ${agentQuery.trim() ? 'has-query' : ''}`}>
              <input
                value={agentQuery}
                onChange={event => setAgentQuery(event.target.value)}
                aria-label={copy.ask}
                placeholder={copy.input}
              />
              <button type="submit" aria-label={copy.start} title={copy.start}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22l-4-9-9-4z" />
                </svg>
              </button>
            </div>
          </form>
          <div className="hero-agent-suggestions rise rise-3" aria-label={copy.ask}>
            <span>{copy.try}</span>
            {copy.suggestions.map(question => (
              <button key={question} type="button" onClick={() => onAskAgent && onAskAgent(question)}>{question}</button>
            ))}
          </div>
          <div className="hero-quick-start rise rise-3">
            <span>{copy.explore}</span>
            <div className="hero-cta">
              {['bazi', 'tarot', 'huangli', 'huangli', 'fengshui', 'ziwei'].map((target, index) => <button key={`${target}-${index}`} className="btn ghost" onClick={target === 'bazi' ? openBaziCalculator : () => onGate(target)}>{copy.shortcuts[index]}</button>)}
            </div>
          </div>
        </div>
      </section>

      {/* 大家都在测：用真实已有入口承接高频、轻量的首次探索 */}
      <section className="container popular-tests rise" aria-labelledby="popular-tests-title">
        <div className="popular-tests-head">
          <div>
            <p className="popular-tests-kicker">{copy.popularKicker}</p>
            <h2 id="popular-tests-title">{copy.popularTitle}</h2>
          </div>
          <p>{copy.popularDesc}</p>
        </div>
        <div className="popular-tests-grid">
          {POPULAR_TESTS.map((test, index) => {
            const translated = copy.popular[index]
            return (
            <button
              key={test.key}
              type="button"
              className={`popular-test-card popular-test-${test.key} rise rise-${index + 1}`}
              onClick={() => handleClick(test)}
            >
              <span className="popular-test-icon" aria-hidden="true">{test.icon}</span>
              <span className="popular-test-eyebrow">{translated[0]}</span>
              <span className="popular-test-title">{translated[1]}</span>
              <span className="popular-test-desc">{translated[2]}</span>
              <span className="popular-test-cta">{translated[3]} <span aria-hidden="true">→</span></span>
            </button>
            )
          })}
        </div>
      </section>

      {/* 元氣测算 · 八卡矩阵 */}
      <section className="container">
        <div className="yc-head rise">
          <div>
            <h2 className="section-title">
              {locale === 'zh-CN' ? <>元氣<span className="zhushi">测算</span></> : copy.calcTitle}
            </h2>
            <p className="yc-sub">{copy.calcDesc}</p>
          </div>
        </div>

        <div className="yc-grid rise">
          {calculators.map((c, i) => (
            <div
              key={c.key}
              className={`yc-card ${c.cls} rise rise-${(i % 4) + 1}`}
              onClick={() => handleClick(c)}
              role="button"
              tabIndex={0}
            >
              <span className="yc-cat-label">{copy.categories[['mingli', 'yunshi', 'zhanbu', 'huanjing'].indexOf(c.cat)]}</span>
              <span className="yc-icon" aria-hidden="true">{c.icon}</span>
              <div className="yc-title">
                <span className="yc-ai">{c.aiTag}</span>
                <span>{c.title}</span>
              </div>
              <p className="yc-desc">{c.desc}</p>
              {!user && c.freeTag && (
                <span className="yc-free">🎁 {locale === 'en' ? (c.key === 'bazi' ? 'Free chart, no sign-in' : 'Guest: 3 free on-device readings') : c.freeTag}</span>
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
            {locale === 'zh-CN' ? <>解锁你的<span className="zhushi">命运层级</span></> : copy.plansTitle}
          </h2>
          <p className="yc-sub">{copy.plansDesc}</p>
        </div>
        <div className="plans-grid rise">
          {plans.map((p, i) => (
            <div key={p.key} className={`plan-card ${p.key === 'guest' ? 'guest' : ''} ${p.featured ? 'featured' : ''} rise rise-${(i % 3) + 1}`}>
              {p.featured && <span className="plan-badge">{copy.featuredLabel}</span>}
              <span className="plan-icon" aria-hidden="true">{p.icon}</span>
              <h3 className="plan-name">{p.name}</h3>
              <div className="plan-price">
                {p.priceLabel
                  ? <span className="plan-price-free">{p.priceLabel}</span>
                  : <><span className="num">{p.price}</span><span className="unit">{p.unit}</span></>}
              </div>
              <ul className="plan-perks">
                {p.perks.slice(0, 2).map(perk => <li key={perk}>{perk}</li>)}
              </ul>
              <button className={`btn ${p.featured ? 'light' : 'ghost'} plan-cta`}
                onClick={() => (p.key === 'guest'
                  ? onGate && onGate('bazi')
                  : (onSubscribe ? onSubscribe(p.key) : onGate && onGate('agent')))}>
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
            {copy.articleTitle}
          </h2>
          <button className="featured-more" onClick={() => onGate('wenku')}>{copy.allArticles} →</button>
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
                <span className="am">⏱ {a.read} {copy.minutes}</span>
                <span className="am">👁 {a.views}</span>
                <span className="ac-more">{copy.read} →</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
