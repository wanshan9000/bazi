import { SEO_ROUTES } from '../seo-pages.js'

const page = SEO_ROUTES.baziBasics

export default function BaziBasicsPage({ onBack, onStartCalculator, onOpenAgent }) {
  const { terms, steps, faqs } = page.guide
  return (
    <main className="bazi-guide bazi-basics" lang="zh-CN">
      <section className="bazi-guide-hero">
        <div className="bazi-guide-frame">
          <button className="bazi-guide-back" type="button" onClick={onBack} aria-label="返回元氣满满首页">← <span>元氣满满</span></button>
          <div className="bazi-guide-mark" aria-hidden="true"><img src="/genki-logo.png" alt="" /></div>
          <p className="bazi-guide-kicker">传统文化 · 八字入门 01</p>
          <h1><em>八字</em>是什么？</h1>
          <p className="bazi-guide-deck">从四柱、五行、十神到排盘输入，先把八字读懂，再看命盘。</p>
          <div className="bazi-guide-actions">
            <button type="button" className="bazi-guide-primary" onClick={onStartCalculator}>开始八字排盘 <span aria-hidden="true">→</span></button>
            <button type="button" className="bazi-guide-secondary" onClick={onOpenAgent}>咨询元氣 Agent</button>
            <a className="bazi-guide-secondary" href="#terms">查看核心术语</a>
          </div>
          <p className="bazi-guide-note">传统文化学习与自我观察参考，不提供确定性预测。</p>
        </div>
      </section>

      <section className="bazi-guide-intro bazi-guide-section">
        <p className="bazi-guide-index">01 / 一句话说明</p>
        <div>
          <h2>四根时间坐标，组成八个干支字符。</h2>
          <p>八字是中国传统文化中记录出生年、月、日、时的一套干支表达。每一组时间信息由天干和地支配对，年、月、日、时合起来就是四柱八字。</p>
          <p>它可以帮助理解传统术语之间的关系，但并不构成事实判断、人生承诺或替代现实决策的依据。</p>
        </div>
      </section>

      <section className="bazi-guide-section bazi-guide-terms" id="terms">
        <p className="bazi-guide-index">02 / 核心术语</p>
        <div>
          <h2>先认识这些，再读命盘。</h2>
          <dl>{terms.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl>
        </div>
      </section>

      <section className="bazi-guide-section bazi-guide-method">
        <p className="bazi-guide-index">03 / 排盘之前</p>
        <div>
          <h2>先核对输入，再讨论结论。</h2>
          <ol>{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol>
          <aside><strong>关于出生时辰</strong><p>时柱取决于出生时间。时辰未知或只知道大概范围时，相关解读应保留这个限制，不能把推测当作盘面事实。</p></aside>
        </div>
      </section>

      <section className="bazi-guide-section bazi-guide-faq">
        <p className="bazi-guide-index">04 / 常见问题</p>
        <div>
          <h2>把常见疑问说清楚。</h2>
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
        </div>
      </section>

      <section className="bazi-guide-close">
        <p>准备好先看盘面结构了吗？</p>
        <button type="button" onClick={onStartCalculator}>开始八字排盘 <span aria-hidden="true">→</span></button>
      </section>
    </main>
  )
}
