import { SEO_ROUTES } from '../seo-pages.js'
import BaziGuideEditorial from './BaziGuideEditorial.jsx'
import { trackEvent } from '../utils/analytics.js'

const page = SEO_ROUTES.baziGuide

export default function BaziGuidePage({ onBack, onStartCalculator }) {
  const { terms, steps, faqs } = page.guide
  const startCalculator = () => {
    trackEvent('guide_calculator_opened', { page: 'bazi-guide', locale: 'en' })
    onStartCalculator?.()
  }
  return (
    <main className="bazi-guide" lang="en">
      <section className="bazi-guide-hero">
        <div className="bazi-guide-frame">
          <button className="bazi-guide-back" type="button" onClick={onBack} aria-label="Back to Genki home">← <span>GENKI</span></button>
          <p className="bazi-guide-kicker">TRADITIONAL CHINESE CULTURE · FIELD GUIDE 01</p>
          <h1>What is <em>BaZi</em>?</h1>
          <p className="bazi-guide-deck">A clear introduction to the Four Pillars of Destiny, the information a chart uses, and the questions a chart cannot answer.</p>
          <div className="bazi-guide-actions">
            <button type="button" className="bazi-guide-primary" onClick={startCalculator}>Open the BaZi calculator <span aria-hidden="true">→</span></button>
            <a className="bazi-guide-secondary" href="#method">Before you begin</a>
            <a className="bazi-guide-secondary" href="#terms">Read the terms</a>
          </div>
          <p className="bazi-guide-note">A traditional cultural framework for learning and reflection. Not a prediction service.</p>
        </div>
      </section>

      <section className="bazi-guide-intro bazi-guide-section">
        <p className="bazi-guide-index">01 / THE SHORT VERSION</p>
        <div>
          <h2>Four pillars. Eight characters. One way to organize a birth moment.</h2>
          <p>BaZi is the common Chinese name for the Four Pillars of Destiny. It represents the year, month, day and hour of birth as four pairs of traditional symbols: a Heavenly Stem and an Earthly Branch.</p>
          <p>People use the system to explore symbolic relationships in a chart. It is a cultural tradition, not a verified way to establish facts or guarantee future events.</p>
        </div>
      </section>

      <section className="bazi-guide-section bazi-guide-terms" id="terms">
        <p className="bazi-guide-index">02 / VOCABULARY</p>
        <div>
          <h2>The terms worth knowing first</h2>
          <dl>
            {terms.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="bazi-guide-section bazi-guide-method" id="method">
        <p className="bazi-guide-index">03 / A REPRODUCIBLE START</p>
        <div>
          <h2>Begin with the inputs, not the conclusion.</h2>
          <ol>{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol>
          <aside><strong>A note on birth time</strong><p>The hour pillar depends on birth time. If it is unknown or approximate, that uncertainty should remain visible in any interpretation.</p></aside>
        </div>
      </section>

      <section className="bazi-guide-section bazi-guide-faq">
        <p className="bazi-guide-index">04 / FAQ</p>
        <div>
          <h2>Common questions, plainly answered.</h2>
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
        </div>
      </section>

      <BaziGuideEditorial editorial={page.editorial} language="en" />

      <section className="bazi-guide-close">
        <p>Ready to begin with your Four Pillars?</p>
        <ol className="bazi-guide-route" aria-label="From guide to consultation">
          <li><b>01</b><span>Create a free chart</span></li>
          <li><b>02</b><span>Read your elemental snapshot</span></li>
          <li><b>03</b><span>Ask Genki AI with your chart</span></li>
        </ol>
        <button type="button" onClick={startCalculator}>Calculate your four pillars <span aria-hidden="true">→</span></button>
      </section>
    </main>
  )
}
