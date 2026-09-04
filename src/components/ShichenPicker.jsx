import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * 时辰选择器（点击触发按钮 → 弹层选择）
 *
 * Props:
 *   - value: 当前小时（0-23）
 *   - timeKnown: 布尔（true=知道时辰，false=不确定）
 *   - onChange({ hour, timeKnown }): 选择变化回调
 *   - placeholder: 触发按钮占位文本（可选）
 *   - tone: 'rose' | 'purple' | 'default'   决定主高亮色
 *
 * 时辰数据（公历小时 → 地支 + 时段）
 */
// 子时跨日拆分为「晚子时 23:00-24:00 / 早子时 00:00-01:00」两个精确选项：
// 晚子时按次日子时起干（夜子时口径，与参天 sect:2 一致），避免时柱排错一个天干。
const SHICHEN = [
  { zhi: '子', hour: 23, range: '23:00 - 24:00', sub: '晚子时' },
  { zhi: '子', hour: 0, range: '00:00 - 01:00', sub: '早子时' },
  { zhi: '丑', hour: 2, range: '01:00 - 03:00' },
  { zhi: '寅', hour: 4, range: '03:00 - 05:00' },
  { zhi: '卯', hour: 6, range: '05:00 - 07:00' },
  { zhi: '辰', hour: 8, range: '07:00 - 09:00' },
  { zhi: '巳', hour: 10, range: '09:00 - 11:00' },
  { zhi: '午', hour: 12, range: '11:00 - 13:00' },
  { zhi: '未', hour: 14, range: '13:00 - 15:00' },
  { zhi: '申', hour: 16, range: '15:00 - 17:00' },
  { zhi: '酉', hour: 18, range: '17:00 - 19:00' },
  { zhi: '戌', hour: 20, range: '19:00 - 21:00' },
  { zhi: '亥', hour: 22, range: '21:00 - 23:00' }
]

function getShichenByHour(h) {
  const hour = Number(h)
  // 命中失败时回退午时（12）
  return SHICHEN.find((s) => s.hour === hour) || SHICHEN[7]
}

const TONE_VAR = {
  rose: { accent: 'var(--cinnabar)', accentRgb: '224, 92, 133' },
  purple: { accent: '#8b6fc4', accentRgb: '139, 111, 196' },
  default: { accent: 'var(--cinnabar)', accentRgb: '224, 92, 133' }
}

export default function ShichenPicker({
  value = 12,
  timeKnown = true,
  onChange,
  placeholder = '点击选择出生时辰',
  tone = 'rose'
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(timeKnown ? 'known' : 'unknown')
  const accent = TONE_VAR[tone] || TONE_VAR.rose

  // 关闭时同步 tab 与外层状态一致
  useEffect(() => {
    if (!open) setTab(timeKnown ? 'known' : 'unknown')
  }, [open, timeKnown])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 打开时锁滚
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const current = getShichenByHour(value)
  const triggerLabel = !timeKnown
    ? '时辰不确定'
    : `${current.zhi}时 · ${current.range}`

  const pickHour = (hour) => {
    onChange({ hour, timeKnown: true })
    setOpen(false)
  }
  const pickUnknown = () => {
    onChange({ hour: 12, timeKnown: false })
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={`scp-trigger ${!timeKnown ? 'unknown' : ''}`}
        onClick={() => setOpen(true)}
        style={{ '--scp-accent': accent.accent, '--scp-accent-rgb': accent.accentRgb }}
      >
        <span className="scp-trigger-text">
          {timeKnown || value !== 12 ? triggerLabel : placeholder}
        </span>
        <span className="scp-trigger-caret" aria-hidden>▾</span>
      </button>

      {open && createPortal(
        <div
          className="scp-mask"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="选择出生时辰"
        >
          <div
            className="scp-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ '--scp-accent': accent.accent, '--scp-accent-rgb': accent.accentRgb }}
          >
            <header className="scp-modal-head">
              <h3 className="scp-modal-title">选择出生时辰</h3>
              <button className="scp-modal-close" onClick={() => setOpen(false)} aria-label="关闭">✕</button>
            </header>

            <div className="scp-tabs">
              <div
                className={`scp-tab ${tab === 'known' ? 'active' : ''}`}
                onClick={() => setTab('known')}
              >
                知道时辰
              </div>
              <div
                className={`scp-tab ${tab === 'unknown' ? 'active' : ''}`}
                onClick={() => setTab('unknown')}
              >
                时辰不确定
              </div>
            </div>

            {tab === 'known' ? (
              <div className="scp-grid">
                {SHICHEN.map((s) => {
                  const isActive = timeKnown && value === s.hour
                  return (
                    <div
                      key={s.hour}
                      className={`scp-cell ${isActive ? 'active' : ''}`}
                      onClick={() => pickHour(s.hour)}
                    >
                      <div className="scp-cell-zhi">
                        {s.zhi}时
                        {s.sub ? <em className="scp-cell-sub">{s.sub}</em> : null}
                      </div>
                      <div className="scp-cell-range">{s.range}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="scp-unknown-panel">
                <div className="scp-unknown-illu" aria-hidden>⏳</div>
                <p className="scp-unknown-tit">不记得具体时辰？</p>
                <p className="scp-unknown-desc">系统将以<strong>午时（11-13 点）</strong>为中点起盘，仍然可以得出大方向，结果精度略有偏差。</p>
                <button className="scp-unknown-cta" onClick={pickUnknown}>确定 · 以午时起盘</button>
              </div>
            )}

            <p className="scp-foot">子时跨日 · 晚子时（23-24 点）按次日子时起干 · 选中即关闭</p>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
