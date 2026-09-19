import BaziGuideEditorial from './BaziGuideEditorial.jsx'
import { trackEvent } from '../utils/analytics.js'

export default function BaziTermPage({ page, onBack, onStartCalculator }) {
  const english = page.language === 'en'
  const isDayMasterPage = page.path === '/learn/what-is-a-day-master-in-bazi'
  const { termPage, definedTerms, faqs, sections } = page
  const startCalculator = () => {
    trackEvent('guide_calculator_opened', { page: page.path, locale: page.language })
    onStartCalculator?.()
  }

  return (
    <main className={`bazi-guide bazi-term-page${english ? '' : ' bazi-basics'}${isDayMasterPage ? ' bazi-day-master-page' : ''}`} lang={page.language}>
      <section className="bazi-term-hero">
        <div className="bazi-guide-frame">
          <button className="bazi-guide-back" type="button" onClick={onBack} aria-label={english ? 'Back to Genki home' : '返回元氣满满首页'}>← <span>{english ? 'GENKI' : '元氣满满'}</span></button>
          <p className="bazi-guide-kicker">{termPage.eyebrow}</p>
          <h1>{isDayMasterPage ? <>What is a <em>Day Master</em> in BaZi?</> : page.heading}</h1>
          <p className="bazi-guide-deck">{page.summary}</p>
          {isDayMasterPage && (
            <div className="bazi-term-hero-reference" aria-label="Day Master definition context">
              <span>DAY PILLAR</span><b>HEAVENLY STEM</b><span>RELATIONSHIP REFERENCE</span>
            </div>
          )}
          <p className="bazi-term-note">{english ? 'For traditional culture, learning and reflection. Not a prediction or professional advice service.' : '仅供传统文化学习、反思与娱乐参考，不构成预测或专业建议。'}</p>
        </div>
      </section>

      <section className="bazi-guide-section bazi-term-definition" id="definition">
        <p className="bazi-guide-index">01 / {termPage.definitionLabel}</p>
        <div>
          <h2>{termPage.definition}</h2>
        </div>
      </section>

      <section className="bazi-guide-section bazi-term-explainer" id="explainer">
        <p className="bazi-guide-index">02 / {english ? 'CONTEXT' : '理解这个说法'}</p>
        <div>
          {sections.map(([heading, body]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="bazi-guide-section bazi-guide-terms" id="terms">
        <p className="bazi-guide-index">03 / {english ? 'RELATED TERMS' : '相关术语'}</p>
        <div>
          <h2>{english ? 'Terms that keep the definition in context.' : '结合这些术语，才不会把“缺”读成结论。'}</h2>
          <dl>{definedTerms.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl>
        </div>
      </section>

      <section className="bazi-guide-section bazi-guide-faq" id="faq">
        <p className="bazi-guide-index">04 / {english ? 'FAQ' : '常见问题'}</p>
        <div>
          <h2>{english ? 'Questions answered plainly.' : '把容易混淆的地方说清楚。'}</h2>
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
        </div>
      </section>

      <BaziGuideEditorial editorial={page.editorial} language={english ? 'en' : 'zh'} />

      <section className="bazi-term-links" aria-label={english ? 'Related BaZi resources' : '相关八字资源'}>
        <p>{english ? 'Continue with a chart or related reading.' : '从实际盘面或基础概念继续了解。'}</p>
        <div>
          <button type="button" onClick={startCalculator}>{termPage.calculatorLabel} <span aria-hidden="true">→</span></button>
          {termPage.related.map(link => <a key={link.href} href={link.href}>{link.label} <span aria-hidden="true">→</span></a>)}
        </div>
      </section>
    </main>
  )
}
