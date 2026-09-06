import { useEffect, useRef, useState } from 'react'
import { drawCards, interpret, saveHistory, SPREAD_MAP } from '../data/tarot.js'

const STAGES = { INTRO: 'intro', SHUFFLE: 'shuffle', PICK: 'pick', READING: 'reading' }

const THEME_ICON = t => ({ love: '❤', career: '🏛', money: '🪙', health: '🌿', choice: '⚖', study: '📚' }[t] || '✦')
const THEME_NAME = t => ({ love: '情感', career: '事业', money: '财运', health: '身心', choice: '抉择', study: '学业' }[t] || '通用')

function TarotCardBack({ index = 0, small = false }) {
  return (
    <div className={`tc-back ${small ? 'small' : ''}`} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="tc-back-frame">
        <div className="tc-back-orn">✦</div>
        <div className="tc-back-glyph">☥</div>
        <div className="tc-back-orn">✦</div>
      </div>
    </div>
  )
}

function TarotCardFront({ card, index = 0 }) {
  return (
    <div
      className={`tc-front ${card.reversed ? 'reversed' : ''}`}
      style={{ animationDelay: `${index * 0.15}s` }}
    >
      <div className="tc-front-top">
        <span className="tcf-name">{card.name}</span>
      </div>
      <div className="tc-front-glyph">{card.glyph}</div>
      <div className="tc-front-bottom">
        <span className="tcf-en">{card.en}</span>
      </div>
      {card.reversed && <span className="tc-rev-tag">逆位</span>}
    </div>
  )
}

function SpreadLayout({ spread, drawn }) {
  // 根据牌阵类型布局
  if (spread.layout === 'cross') {
    return (
      <div className="celtic-layout">
        {drawn.map((c, i) => {
          const positions = [
            { r: 0, c: 1, label: 1 },
            { r: 1, c: 0, label: 2 },
            { r: 1, c: 1, label: 3 },
            { r: 1, c: 2, label: 4 },
            { r: 2, c: 1, label: 5 },
            { r: 0, c: 0, label: 6 },
            { r: 0, c: 2, label: 7 },
            { r: 2, c: 0, label: 8 },
            { r: 2, c: 2, label: 9 },
            { r: 3, c: 1, label: 10 }
          ]
          const p = positions[i]
          return (
            <div key={i} className="cl-cell" style={{ gridRow: p.r + 1, gridColumn: p.c + 1 }}>
              <TarotCardFront card={c} index={i} />
              <span className="cl-num">{p.label}</span>
            </div>
          )
        })}
      </div>
    )
  }
  if (spread.layout === 'grid' || spread.layout === 'fan') {
    const cols = spread.count <= 3 ? 3 : spread.count <= 5 ? 5 : 4
    return (
      <div className="grid-layout" style={{ '--cols': cols }}>
        {drawn.map((c, i) => (
          <div key={i} className="gl-cell">
            <TarotCardFront card={c} index={i} />
            <span className="gl-num">{i + 1}</span>
          </div>
        ))}
      </div>
    )
  }
  // row / center
  return (
    <div className={`row-layout ${spread.count === 1 ? 'center' : ''}`} style={{ '--cols': spread.count }}>
      {drawn.map((c, i) => (
        <div key={i} className="rl-cell">
          <TarotCardFront card={c} index={i} />
          <span className="rl-num">{i + 1}</span>
        </div>
      ))}
    </div>
  )
}

// onCharge：由 App 注入的计费闸门（游客扣免费配额 / 会员扣积分），返回 { ok, reason }。
// 「换一批」是一次全新解读，必须和首次抽牌走同一条闸门 —— 此前它直接重抽，
// 等于把 10 次游客配额和 5 积分的扣费彻底绕开，无限白嫖。
export default function TarotReading({ spreadId, onBack, onReading, onCharge }) {
  const spread = SPREAD_MAP[spreadId]
  const [stage, setStage] = useState(STAGES.INTRO)
  const [question, setQuestion] = useState('')
  const [drawn, setDrawn] = useState([])
  const [revealed, setRevealed] = useState(0)
  const [interpretation, setInterpretation] = useState(null)

  // TarotPage 在跳转过来之前已经为「这一次解读」扣过费，所以进入本页后的第一次抽牌
  // 不再重复计费；此后的每一次重抽都是一次全新解读，都要重新过闸门。
  const firstDrawRef = useRef(true)
  const [chargeErr, setChargeErr] = useState('')

  useEffect(() => {
    setStage(STAGES.INTRO)
    setDrawn([])
    setRevealed(0)
    setInterpretation(null)
    setQuestion('')
    setChargeErr('')
    firstDrawRef.current = true
  }, [spreadId])

  /** 抽牌前的计费闸门。返回 false 表示这次抽牌不该发生。
   *  扣积分现在要走服务端，所以是异步的 —— 调用方必须 await，
   *  否则拿到的是一个恒为真的 Promise，闸门等于不存在。 */
  const passCharge = async () => {
    if (firstDrawRef.current) { firstDrawRef.current = false; return true }
    if (!onCharge) return true
    const res = await onCharge()
    if (!res || !res.ok) {
      setChargeErr(res && res.reason === 'quota'
        ? '游客免费次数已用完，登录后可继续抽牌'
        : '本月积分不足，升级档位后可继续抽牌')
      return false
    }
    setChargeErr('')
    return true
  }

  if (!spread) {
    return (
      <div className="page-wrap">
        <div className="container">
          <button className="back-btn" onClick={onBack}>← 返回</button>
          <p style={{ padding: 30 }}>未找到此牌阵</p>
        </div>
      </div>
    )
  }

  const startShuffle = async () => {
    if (!(await passCharge())) return
    setStage(STAGES.SHUFFLE)
    setTimeout(() => {
      const result = drawCards(spreadId, Date.now())
      setDrawn(result.cards)
      setStage(STAGES.PICK)
      setRevealed(0)
    }, 1400)
  }

  const revealNext = () => {
    if (revealed < drawn.length) {
      setRevealed(r => r + 1)
      if (revealed + 1 === drawn.length) {
        // 全部揭示 → 生成解读
        setTimeout(() => {
          const result = { spread, cards: drawn, drawnAt: Date.now() }
          const interp = interpret(result, question)
          setInterpretation(interp)
          const next = saveHistory({
            spreadId: spread.id,
            spreadName: spread.name,
            question,
            cards: drawn,
            summary: interp.summary
          })
          if (onReading) onReading(next)
          setStage(STAGES.READING)
        }, 700)
      }
    }
  }

  const revealAll = () => {
    setRevealed(drawn.length)
    setTimeout(() => {
      const result = { spread, cards: drawn, drawnAt: Date.now() }
      const interp = interpret(result, question)
      setInterpretation(interp)
      saveHistory({
        spreadId: spread.id,
        spreadName: spread.name,
        question,
        cards: drawn,
        summary: interp.summary
      })
      setStage(STAGES.READING)
    }, 600)
  }

  const reset = () => {
    setStage(STAGES.INTRO)
    setDrawn([])
    setRevealed(0)
    setInterpretation(null)
    setQuestion('')
  }

  // 换一批：保留问题重新随机抽牌，跳过输入/洗牌动画。先过计费闸门。
  const reshuffle = async () => {
    if (!(await passCharge())) return
    const result = drawCards(spreadId, Date.now())
    setDrawn(result.cards)
    setRevealed(0)
    setInterpretation(null)
    setStage(STAGES.PICK)
  }

  return (
    <div className="page-wrap tarot-reading">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>← 牌阵选择</button>
          <span className="page-meta">{spread.name} · {spread.count} 张</span>
        </div>
        <h1 className="page-title rise rise-1">{spread.name}</h1>
        <p className="page-sub rise rise-2">{spread.short}</p>

        {/* 阶段 1: 输入问题 */}
        {stage === STAGES.INTRO && (
          <div className="card rise rise-3 tarot-intro">
            <div className="field">
              <label>在心中默念所问之事，或直接写下你的问题</label>
              <textarea
                className="tarot-question"
                placeholder="例：近期的工作变动会带来什么？我该如何应对？"
                value={question}
                onChange={e => setQuestion(e.target.value.slice(0, 200))}
                rows={3}
                maxLength={200}
              />
              <p className="form-note">{question.length} / 200</p>
            </div>
            <div className="form-actions">
              <button className="btn cast-btn" onClick={startShuffle} disabled={!question.trim()}>
                ☥ 开始洗牌
              </button>
              <button className="btn ghost small" onClick={startShuffle}>
                心有所感，直接洗牌
              </button>
              <p className="form-note">
                洗牌时心中保持专注，牌会回应你的能量场
              </p>
            </div>
          </div>
        )}

        {/* 阶段 2: 洗牌中 */}
        {stage === STAGES.SHUFFLE && (
          <div className="card tarot-shuffle rise">
            <div className="shuffle-deck">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="sd-card" style={{ animationDelay: `${i * 0.06}s` }}>
                  <TarotCardBack />
                </div>
              ))}
            </div>
            <p className="brush" style={{ textAlign: 'center', fontSize: 22, color: 'var(--cinnabar)', marginTop: 20 }}>
              牌在手中翻动…
            </p>
            <p style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, letterSpacing: '0.2em' }}>
              呼吸放慢，让直觉浮现
            </p>
          </div>
        )}

        {/* 阶段 3: 抽牌 */}
        {stage === STAGES.PICK && (
          <div className="card tarot-pick rise">
            <div className="pick-area" style={{ '--pick-cols': Math.min(spread.count, 5) }}>
              {drawn.map((c, i) => (
                <button
                  key={i}
                  className={`pick-card ${i < revealed ? 'revealed' : ''}`}
                  onClick={() => i === revealed && revealNext()}
                  disabled={i !== revealed}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  {i < revealed ? (
                    <TarotCardFront card={c} index={i} />
                  ) : (
                    <TarotCardBack index={i} />
                  )}
                </button>
              ))}
            </div>
            <div className="pick-progress">
              <p className="pp-label">已抽 {revealed} / {drawn.length}</p>
              <div className="pp-bar">
                <div className="pp-fill" style={{ width: `${(revealed / drawn.length) * 100}%` }} />
              </div>
            </div>
            <div className="form-actions">
              <div className="pick-ghost-row pick-action-row">
                {revealed < drawn.length ? (
                  <button className="btn cast-btn is-inline" onClick={revealNext} disabled={revealed >= drawn.length}>
                    翻牌 →
                  </button>
                ) : (
                  <p className="form-note">所有牌位已揭示</p>
                )}
                {revealed < drawn.length && (
                  <button className="btn ghost small" onClick={revealAll}>
                    全部揭示
                  </button>
                )}
                <button className="btn ghost small" onClick={reshuffle} title="后台重新随机抽一组新牌">
                  🔄 换一批
                </button>
              </div>
              {chargeErr && <p className="form-note" style={{ color: 'var(--danger, #c0392b)' }}>{chargeErr}</p>}
              <p className="form-note">按顺序点击卡牌翻牌，牌位意义见下方 · 换一批将重新计一次解读</p>
            </div>
            <div className="pick-positions">
              {spread.positions.map((p, i) => (
                <div key={i} className={`pp-item ${i < revealed ? 'on' : ''}`}>
                  <span className="pp-num">{i + 1}</span>
                  <div>
                    <div className="pp-name">{p.name}</div>
                    <div className="pp-desc">{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 阶段 4: 解读 */}
        {stage === STAGES.READING && interpretation && (
          <div className="tarot-result">
            {/* 牌面回放 */}
            <div className="card rise">
              <div className="tr-head">
                <h3 className="tr-title">牌面</h3>
                <div className="tr-actions">
                  <button className="btn ghost small" onClick={reshuffle} title="重新随机抽一组新牌（重新计一次解读）">🔄 换一批</button>
                  <button className="btn ghost small" onClick={reset}>重抽这组</button>
                </div>
              </div>
              {chargeErr && <p className="form-note" style={{ color: 'var(--danger, #c0392b)' }}>{chargeErr}</p>}
              {question && (
                <div className="tr-question">
                  <span className="trq-label">你的问题</span>
                  <p className="trq-text">「{question}」</p>
                </div>
              )}
              <SpreadLayout spread={spread} drawn={drawn} />
              <p className="tr-spreadname">{spread.name} · {spread.nameEn}</p>
            </div>

            {/* 能量总览 */}
            <div className="card rise rise-1 tr-enercard" style={{ marginTop: 16 }}>
              <div className="tr-energy">
                <div className="tr-energy-gauge" style={{ '--index': interpretation.index, '--gcolor': interpretation.indexColor }}>
                  <div className="tr-gauge-num">{interpretation.index}</div>
                  <div className="tr-gauge-label">占卜指数</div>
                </div>
                <div className="tr-energy-meta">
                  <div className="tr-energy-word" style={{ color: interpretation.indexColor }}>{interpretation.indexWord}</div>
                  <div className="tr-energy-desc">{interpretation.indexDesc}</div>
                  <div className="tr-energy-stats">
                    <span>正位 {interpretation.energy}%</span>
                    <span>大阿尔克那 ×{interpretation.majorCount}</span>
                    {interpretation.theme && <span className="tr-theme-chip">{THEME_ICON(interpretation.theme)} {THEME_NAME(interpretation.theme)}</span>}
                  </div>
                </div>
              </div>
              {/* 元素分布 */}
              <div className="tr-elements">
                <div className="tr-elem-title">元素分布</div>
                <div className="tr-elem-bars">
                  {[['wands', '权杖', '火'], ['cups', '圣杯', '水'], ['swords', '宝剑', '风'], ['pentacles', '星币', '土'], ['major', '大阿尔克那', '原型']].map(([k, name, el]) => {
                    const v = interpretation.elements[k] || 0
                    const max = Math.max(1, ...['wands', 'cups', 'swords', 'pentacles', 'major'].map(x => interpretation.elements[x] || 0))
                    return (
                      <div key={k} className="tr-elem-row">
                        <span className="tr-elem-name">{name}</span>
                        <div className="tr-elem-bar">
                          <div className="tr-elem-fill" style={{ width: `${(v / max) * 100}%` }} />
                        </div>
                        <span className="tr-elem-val">{v}</span>
                      </div>
                    )
                  })}
                </div>
                {interpretation.dominantElement && (
                  <div className="tr-elem-focus">
                    <div className="tr-focus-chip">{interpretation.dominantElement.name}</div>
                    <div className="tr-focus-body">
                      <div className="tr-focus-q">{interpretation.dominantElement.quality}</div>
                      <div className="tr-focus-f">{interpretation.dominantElement.focus}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 总论 + 牌面叙事 */}
            <div className="card rise rise-2" style={{ marginTop: 16 }}>
              <h3 className="tr-section">司命解卦 · 总论</h3>
              <p className="tr-summary">{interpretation.summary}</p>
              <div className="tr-divider" />
              <h4 className="tr-subhead">牌面叙事</h4>
              <p className="tr-text">{interpretation.narrative}</p>
              <div className="tr-divider" />
              <h4 className="tr-subhead">贯穿线索</h4>
              <p className="tr-text">{interpretation.crossTheme}</p>
              {interpretation.elemNarratives.length > 0 && (
                <>
                  <div className="tr-divider" />
                  <h4 className="tr-subhead">元素相生相克</h4>
                  {interpretation.elemNarratives.map((e, i) => (
                    <p key={i} className="tr-text">{e}</p>
                  ))}
                </>
              )}
            </div>

            {/* 单卡直答：是非结论 */}
            {spread.id === 'single' && interpretation.perCard[0] && interpretation.perCard[0].verdict && (() => {
              const v = interpretation.perCard[0].verdict
              return (
                <div className="card rise rise-3" style={{ marginTop: 16 }}>
                  <div className={`tr-verdict tr-verdict--${v}`}>
                    <span className="tr-verdict-label">是非倾向</span>
                    <span className="tr-verdict-value">{v === 'yes' ? '是' : v === 'no' ? '否' : '需观望'}</span>
                    <span className="tr-verdict-note">
                      {v === 'yes' ? '牌面支持你前行，可果断一些' : v === 'no' ? '牌面提醒你暂缓，时机未到' : '牌面尚在流动，宜静观其变'}
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* 逐位解读 */}
            <div className="card rise rise-3" style={{ marginTop: 16 }}>
              <h3 className="tr-section">逐位解读</h3>
              <div className="tr-list">
                {interpretation.perCard.map((pc, i) => (
                  <div key={i} className="tr-row" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="tr-row-head">
                      <span className="tr-pos">第 {i + 1} 位 · {pc.position}</span>
                      <span className="tr-posdesc">{pc.positionDesc}</span>
                    </div>
                    <div className="tr-card">
                      <div className="tr-card-name">
                        {pc.card.name}
                        {pc.isReversed && <span className="tr-rev">（逆位）</span>}
                      </div>
                      <div className="tr-card-en">{pc.card.en}</div>
                    </div>
                    {pc.image && (
                      <div className="tr-image">
                        <span className="tr-image-label">牌面意象</span>
                        <p className="tr-image-text">{pc.image}</p>
                      </div>
                    )}
                    <p className="tr-text">{pc.text}</p>
                    {pc.contextText && (
                      <div className="tr-context">
                        <span className="tr-context-label">落到当下</span>
                        <p className="tr-context-text">{pc.contextText}</p>
                      </div>
                    )}
                    {pc.revAdvice && (
                      <div className="tr-revadv">
                        <span className="tr-revadv-label">逆位转正</span>
                        <p className="tr-revadv-text">{pc.revAdvice}</p>
                      </div>
                    )}
                    <div className="tr-kw">
                      {pc.card.kw.map((k, j) => <span key={j} className="tr-kw-pill">#{k}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 行动清单 + 总建议 */}
            <div className="card rise rise-4" style={{ marginTop: 16 }}>
              <h3 className="tr-section">行动指引</h3>
              <ol className="tr-actions">
                {interpretation.actions.map((a, i) => (
                  <li key={i} className="tr-action">{a}</li>
                ))}
              </ol>
              <div className="tr-divider" />
              <h4 className="tr-subhead">司命建议</h4>
              <p className="tr-text">{interpretation.suggestion}</p>
              <p className="tr-disclaimer">
                塔罗映照的是当下的能量倾向，最终的选择与行动始终在于你。信任直觉，方能穿越迷雾。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
