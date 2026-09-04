import { useState } from 'react'
import { castHexagram, interpret } from '../engine/liuyao.js'

export default function LiuyaoPage({ onBack }) {
  const [nums, setNums] = useState({ a: '', b: '', c: '' })
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [shaking, setShaking] = useState(false)

  const cast = (a, b, c, auto) => {
    const seed = Date.now()
    const r = castHexagram(a, b, c, seed)
    setResult({ ...r, auto, text: interpret(r.ben, r.bian, r.movingLine) })
  }

  const handleCast = () => {
    const a = parseInt(nums.a, 10)
    const b = parseInt(nums.b, 10)
    const c = parseInt(nums.c, 10)
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || a <= 0 || b <= 0 || c <= 0) return
    doShake(() => cast(a, b, c, false))
  }

  const handleRandom = () => {
    doShake(() => cast(null, null, null, true))
  }

  const doShake = (fn) => {
    setShaking(true)
    setResult(null)
    setTimeout(() => {
      fn()
      setShaking(false)
    }, 1100)
  }

  const setNum = (k) => (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 3)
    setNums(prev => ({ ...prev, [k]: v }))
  }

  const steps = [
    { n: '一', t: '默念所问', d: '心诚一事 · 凝神聚念' },
    { n: '二', t: '报数起卦', d: '三数成象 · 或随机摇' },
    { n: '三', t: '观象解卦', d: '本卦变卦 · 明其机要' }
  ]

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>← 返回首页</button>
        </div>
        <h1 className="page-title rise rise-1">六爻门</h1>
        <p className="page-sub rise rise-2">报数起卦 · 梅花易数 · 趋吉避凶</p>

        {/* 占问台：单列布局（概念 + 步骤 → 表单，融合为一列） */}
        <div className="ly-home rise rise-3">
          {/* 顶部：标题 + 描述 + 三步骤（融合自原左列） */}
          <div className="ly-intro">
            <h3 className="ly-title">诚心默念 · 起卦问事</h3>
            <p className="ly-desc">
              六爻以三枚铜钱，掷六次而成一卦。初爻为始，上爻为终，动爻为变。
              心中默念所问，报数或摇卦，卦象自会说话。
            </p>
            <div className="ly-steps">
              {steps.map(s => (
                <div key={s.n} className="ly-step">
                  <div className="lys-num">{s.n}</div>
                  <div className="lys-t">{s.t}</div>
                  <div className="lys-d">{s.d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 起卦表单（融合自原右列） */}
          <div className="ly-form-card">
            <div className="ly-form-title">
              <span className="lyft-glyph">☯</span>
              <div>
                <div className="lyft-t">起卦台</div>
                <div className="lyft-d">一数定上卦 · 二数定下卦 · 三数定动爻</div>
              </div>
            </div>

            <div className="field">
              <label>所问之事（可选）</label>
              <input
                type="text"
                placeholder="心中默念所问之事，凝神于此"
                value={question}
                maxLength={24}
                onChange={e => setQuestion(e.target.value)}
              />
            </div>

            <div className="field">
              <label>默念所问，再报三个数</label>
              <div className="num-inputs">
                <input inputMode="numeric" placeholder="数一" value={nums.a} onChange={setNum('a')} />
                <input inputMode="numeric" placeholder="数二" value={nums.b} onChange={setNum('b')} />
                <input inputMode="numeric" placeholder="数三" value={nums.c} onChange={setNum('c')} />
              </div>
            </div>

            <div className="form-actions">
              <button className="cast-btn" onClick={handleCast} disabled={shaking}>☯ 起卦</button>
              <button className="btn ghost small" onClick={handleRandom} disabled={shaking}>
                心里没数？让司命随机摇一卦
              </button>
              <p className="form-note">以报数起卦（梅花易数）：一数定上卦，二数定下卦，三数定动爻 · 心诚则灵</p>
            </div>
          </div>
        </div>

        {shaking && (
          <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
            <p className="brush" style={{ fontSize: 34, color: 'var(--cinnabar)', animation: 'shake 0.35s ease-in-out 3' }}>
              ☯
            </p>
            <p style={{ color: 'var(--ink-faint)', fontSize: 13, letterSpacing: '0.2em' }}>铜钱落定，卦象将成…</p>
          </div>
        )}

        {result && !shaking && (
          <div className="hexagram-result rise">
            {question && (
              <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: '10px 16px' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', letterSpacing: '0.04em' }}>
                  <span style={{ color: 'var(--ink-faint)' }}>所问 · </span>{question}
                </p>
              </div>
            )}

            <div className="card" style={{ marginBottom: 14 }}>
              <div className="chart-head">
                <div className="name" style={{ fontSize: 20 }}>本卦 · {result.ben.name}</div>
                <div className="sub">卦辞：{result.ben.juci}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 10 }}>
                <HexBlock title="本卦" lines={[...result.lowerLines, ...result.upperLines]} moving={result.movingLine} />
                <HexBlock title="变卦" lines={[...result.lowerLines, ...result.upperLines].map((v, i) => i + 1 === result.movingLine ? 1 - v : v)} moving={0} />
              </div>
              <p className="hex-desc" style={{ marginTop: 14 }}>
                <b>{result.ben.name}</b> · {result.ben.desc}
              </p>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div className="chart-head" style={{ marginBottom: 10 }}>
                <div className="name" style={{ fontSize: 17 }}>司命解卦</div>
              </div>
              <div className="hex-desc">
                {result.text.map((p, i) => (
                  <p key={i} style={{ marginBottom: 9 }}>{p}</p>
                ))}
              </div>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '14px 16px' }}>
              <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.9 }}>
                卦象仅供参详 · 心诚则灵 · 真正的方向在你心底
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HexBlock({ title, lines, moving }) {
  const labels = ['初', '二', '三', '四', '五', '上']
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', letterSpacing: '0.2em', marginBottom: 6 }}>{title}</p>
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
        {lines.map((v, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-start' }}>
            <span style={{ fontSize: 9, color: 'var(--ink-faint)', width: 12, textAlign: 'right' }}>{labels[i]}</span>
            <span className={`yao ${v ? 'yang' : 'yin'} ${moving === i + 1 ? 'move' : ''}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
