import { useEffect, useState } from 'react'
import { SPREADS } from '../data/tarot.js'
import { loadQuota, incTarot, FREE_LIMIT, isTarotOverLimit } from '../engine/freeQuota.js'
import ReportLock from './ReportLock.jsx'
import UpgradePrompt from './UpgradePrompt.jsx'
import { consumeCredit } from '../data/users.js'
import { getMonthlyCredits, planByKey } from '../engine/membership.js'

// 牌阵主题分类
const SPREAD_CATS = [
  { k: 'all', icon: '✧', l: '全部', hint: '全部牌阵' },
  { k: 'love', icon: '♥', l: '爱情桃花', hint: '感情 · 复合 · 正缘' },
  { k: 'career', icon: '🏛', l: '事业职场', hint: '职业 · 转型 · 人际' },
  { k: 'decision', icon: '⚖', l: '决策选择', hint: '抉择 · 取舍 · 二选一' },
  { k: 'self', icon: '🌿', l: '自我成长', hint: '探索 · 天赋 · 身心灵' },
  { k: 'general', icon: '☉', l: '通用综合', hint: '速答 · 全景 · 无牌阵' }
]

function SpreadPreview({ spread, drawn = 0 }) {
  // 凯尔特十字专用 10 位置
  const CELTIC = [
    { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 },
    { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 },
    { r: 2, c: 0 }, { r: 2, c: 1 }
  ]
  let cells, cols
  if (Array.isArray(spread.layoutSpec) && spread.layoutSpec.length) {
    cells = spread.layoutSpec
    cols = spread.layoutSpec.reduce((m, c) => Math.max(m, c.c + 1), 1)
  } else if (spread.layout === 'cross') {
    cells = CELTIC
    cols = 4
  } else if (spread.layout === 'fan') {
    cells = spread.positions.map((_, i) => ({ r: 0, c: i }))
    cols = spread.count
  } else if (spread.layout === 'grid') {
    cells = [
      { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 },
      { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }
    ].slice(0, spread.count)
    cols = 4
  } else {
    cells = spread.positions.map((_, i) => ({ r: 0, c: i }))
    cols = spread.count
  }
  return (
    <div className="spread-preview" style={{ '--cols': cols }}>
      {cells.map((cell, i) => (
        <span
          key={i}
          className={`sp-cell ${i < drawn ? 'drawn' : ''}`}
          style={{ gridRow: cell.r + 1, gridColumn: cell.c + 1 }}
        >
          {i < drawn ? (i + 1) : '?'}
        </span>
      ))}
    </div>
  )
}

export default function TarotPage({ onBack, onStart, history, user, onRequireLogin, onUpgrade, onUserChange }) {
  const [cat, setCat] = useState('all')
  // 游客免费配额（塔罗 10 次含 10），注册会员不计数
  const [tarotUsed, setTarotUsed] = useState(0)
  useEffect(() => { setTarotUsed(loadQuota().tarot || 0) }, [])
  const tarotLocked = !user && isTarotOverLimit(tarotUsed)
  // 登录用户扣分结果：true 表示扣分成功；'insufficient' 表示积分不足
  const [insufficient, setInsufficient] = useState(false)

  const list = SPREADS.filter(s => cat === 'all' || s.cat === cat)
  const activeCat = SPREAD_CATS.find(c => c.k === cat)

  return (
    <div className="page-wrap tarot-page">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>← 返回首页</button>
          {history.length > 0 && (
            <span className="page-meta page-meta--divined" title={`已累计完成 ${history.length} 次塔罗占卜`}>
              <span className="page-meta-icon" aria-hidden="true">✦</span>
              <span className="page-meta-text">已抽过 <em className="page-meta-num">{history.length}</em> 卦</span>
            </span>
          )}
        </div>
        <h1 className="page-title rise rise-1">塔罗门 🃏</h1>
        <p className="page-sub rise rise-2">七十八张阿卡那 · 九种经典牌阵 · 一抽即明</p>

        {/* 游客免费配额提示（已登录不显示） */}
        {!user && (
          <p className="quota-hint rise rise-2">
            游客免费 <b>{FREE_LIMIT}</b> 次抽牌 · 已用 <b>{tarotUsed}</b> / {FREE_LIMIT}{tarotLocked ? ' · 已用完 · 登录后可继续' : ''}
          </p>
        )}
        {user && (
          <p className="quota-hint rise rise-2">
            {planByKey(user.plan).name}会员 · 每次抽牌消耗 <b>5</b> 积分 · 本月剩余 <b>{getMonthlyCredits(user)}</b>
          </p>
        )}

        {/* 积分不足：此前只 setInsufficient(true) 却从不渲染，用户点「抽这组牌」毫无反应 */}
        {user && insufficient && (
          <div className="rise rise-2" style={{ marginTop: 16 }}>
            <UpgradePrompt
              featureName="塔罗完整解读"
              cost={5}
              remaining={getMonthlyCredits(user)}
              planLabel={planByKey(user.plan).name}
              onUpgrade={onUpgrade ? () => onUpgrade(user.plan === 'earth' ? 'heaven' : 'oracle') : null}
              onClose={() => setInsufficient(false)}
            />
          </div>
        )}

        {/* 主题分类筛选 */}
        <div className="cat-row spread-cat-row rise rise-2">
          {SPREAD_CATS.map(c => (
            <button
              key={c.k}
              className={`cat-chip ${cat === c.k ? 'active' : ''}`}
              title={c.hint}
              onClick={() => setCat(c.k)}
            >
              <span className="ce" aria-hidden="true">{c.icon}</span>
              <span className="cl">{c.l}</span>
            </button>
          ))}
        </div>

        {/* 牌阵卡片网格：游客 10 次用尽后展示解锁卡，引导登录 */}
        {tarotLocked ? (
          <div className="rise rise-3" style={{ marginTop: 16 }}>
            <ReportLock
              user={user}
              onRequireLogin={onRequireLogin}
              backView="tarot"
              icon="🃏"
              eyebrow="塔罗占卜 · 游客免费 10 次"
              title="免费 10 次抽牌已用完"
              desc="游客每抽 1 次牌计 1 次免费配额，累计 10 次后需注册/登录成为会员，即可继续无限制抽牌解读。"
              note={`已累计抽牌 ${tarotUsed} 次 · 注册默认开通「凡境」会员 · 扫码识别一步注册，自动登录`}
            />
          </div>
        ) : (
          <>
            <div className="spread-result-head rise rise-3">
              <span className="srh-label">
                {activeCat.icon} {activeCat.l}
              </span>
              <span className="srh-count">{list.length} 个牌阵</span>
            </div>
            <div className="spread-grid rise rise-3">
              {list.map((s, i) => (
                <article
                  key={s.id}
                  className="spread-card"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="sc-top">
                    <span className={`sc-cat ${s.cat}`}>
                      {SPREAD_CATS.find(c => c.k === s.cat)?.icon}
                      {SPREAD_CATS.find(c => c.k === s.cat)?.l}
                    </span>
                    <span className="sc-count">{s.count} 张 · {s.diff}</span>
                  </div>
                  <SpreadPreview spread={s} />
                  <h3 className="sc-name">{s.name}</h3>
                  <p className="sc-en">{s.nameEn}</p>
                  <p className="sc-short">{s.short}</p>
                  <p className="sc-desc">{s.desc}</p>
                  <div className="sc-positions">
                    {s.positions.map((p, i) => (
                      <span key={i} className="sc-pill">
                        <b>{i + 1}</b> {p.name}
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn small sc-go"
                    onClick={async () => {
                      if (!user && isTarotOverLimit(tarotUsed)) {
                        onRequireLogin && onRequireLogin('tarot')
                        return
                      }
                      if (user) {
                        // 扣分走服务端，所以必须 await —— 不等结果就 onStart 的话，
                        // 积分不足时用户已经进了抽牌页，闸门形同虚设。
                        const res = await consumeCredit(user.id, 'tarot.reading')
                        if (!res.ok) {
                          if (res.reason === 'insufficient') setInsufficient(true)
                          return
                        }
                        setInsufficient(false)
                        if (res.user) onUserChange && onUserChange(res.user)
                      } else {
                        setTarotUsed(incTarot())
                      }
                      onStart(s.id)
                    }}
                  >
                    {(!user && isTarotOverLimit(tarotUsed)) ? '登录继续解锁 →' : '抽这组牌 →'}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}

        {list.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 40 }}>
            该分类下暂无符合的牌阵，换个筛选试试
          </p>
        )}
      </div>
    </div>
  )
}
