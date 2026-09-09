import { useMemo, useState } from 'react'
import { generateHuangli } from '../engine/cantian.js'

const TIPS_ICON = { '今日运势': '☀️', '今日主题': '🎐' }

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']
const splitHuangliItems = value => String(value || '')
  .split(/[、,，]/)
  .map(item => item.trim())
  .filter(Boolean)

// 同一场景解释完全相同的传统条目合并呈现，保留原始事项而不重复说同一句话。
const groupTraditionalItems = entries => {
  const grouped = new Map()
  for (const entry of entries) {
    const key = entry.note || entry.item
    const current = grouped.get(key)
    if (current) current.items.push(entry.item)
    else grouped.set(key, { ...entry, items: [entry.item] })
  }
  return [...grouped.values()].map(entry => ({ ...entry, item: entry.items.join('、') }))
}

export default function FusedHuangliCard({ chart, date = new Date(), onChangeDate, defaultScenario = 'worker', myZodiac, favZodiac = [] }) {
  // 依据订阅人身份/年纪推断出的场景，仅显示这一种，不提供切换
  const [scenario] = useState(defaultScenario)
  const [showTips, setShowTips] = useState(false)
  const [showOtherJi, setShowOtherJi] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  // 受控：日期由外部传入（SubscribePage 维护），弹层 30 天选择通过 onChangeDate 上抛
  const viewDate = date
  const personalized = Boolean(chart)
  const data = useMemo(
    () => generateHuangli({
      chart,
      date: viewDate,
      scenario,
      mode: personalized ? 'personalized' : 'standard',
      tone: 'practical',
    }),
    [chart, viewDate, scenario, personalized]
  )
  const d = data.daily
  const calendar = data.calendar

  const weekName = `周${WEEK_CN[viewDate.getDay()]}`
  const pengzuYi = splitHuangliItems(data.real?.yi)
  const pengzuJi = splitHuangliItems(data.real?.ji)
  const yiItems = personalized ? (data.scene.traditionalItems?.yi || []) : pengzuYi.map(item => ({ item }))
  const jiItems = personalized ? (data.scene.traditionalItems?.ji || []) : pengzuJi.map(item => ({ item }))
  const sensitiveJiPattern = /(行丧|安葬|入殓|移柩|成服|除服)/
  const primaryJiItems = jiItems.filter(entry => !sensitiveJiPattern.test(entry.item))
  const otherJiItems = jiItems.filter(entry => sensitiveJiPattern.test(entry.item))
  const visibleYiItems = groupTraditionalItems(yiItems)
  const visibleJiItems = groupTraditionalItems(primaryJiItems.length ? primaryJiItems : (otherJiItems.length ? [] : [{ item: '待规则库补齐' }]))
  const groupedOtherJiItems = groupTraditionalItems(otherJiItems)
  const context = data.scene.context
  const integratedAdvice = data.scene.advice || d?.advice
  const rhythm = data.scene.rhythm
  const directionItems = [
    { label: '喜神', value: data.real?.xishen, tone: 'xi' },
    { label: '财神', value: data.real?.caishen, tone: 'cai' },
    { label: '福神', value: data.real?.fushen, tone: 'fu' },
    { label: '阳贵神', value: data.real?.yanggui, tone: 'gui' },
    { label: '阴贵神', value: data.real?.yingui, tone: 'gui' },
  ].filter(item => item.value)

  // 30 天可选日期范围（以今天为中心：前 14 天 + 后 15 天）
  const todayMid = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])
  const dayList = useMemo(() => {
    const out = []
    for (let i = 14; i >= -15; i--) {
      const dt = new Date(todayMid)
      dt.setDate(todayMid.getDate() - i)
      out.push(dt)
    }
    return out
  }, [todayMid])
  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const pickDate = (dt) => {
    if (onChangeDate) {
      onChangeDate(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()))
    }
    setShowPicker(false)
  }

  const relationIcon = d
    ? (d.relation === '顺' ? '🟢' : d.relation === '慎' ? '🟠' : '⚪')
    : ''
  const relationText = d
    ? (d.relation === '顺' ? '顺 · 五行生扶于你'
       : d.relation === '慎' ? '慎 · 略有冲克'
       : '平 · 顺势而为')
    : ''

  return (
    <div className="fh-card">

      {/* 头部横幅 */}
      <div className="fh-head">
        <div className="fh-hero">
          <div className="fh-date">
            <span className="fh-date-d">{viewDate.getDate()}</span>
            <div className="fh-date-txt">
              <span className="fh-date-y">📅 {data.date}</span>
              <span className="fh-date-w">{weekName}</span>
            </div>
          </div>
          <button
            type="button"
            className={`fh-badge ${showPicker ? 'open' : ''}`}
            onClick={() => setShowPicker(v => !v)}
            title="查看最近 30 天"
            aria-expanded={showPicker}
          >
            🧧 {isSameDay(viewDate, todayMid) ? '今日黄历' : `${viewDate.getMonth() + 1}月${viewDate.getDate()}日黄历`} ▾
          </button>
        </div>
        {showPicker && (
          <div className="fh-picker" role="dialog" aria-label="选择日期">
            <div className="fh-picker-head">
              <span className="fh-picker-title">查看最近 30 天</span>
              <button
                type="button"
                className="fh-picker-today"
                onClick={() => pickDate(new Date())}
                disabled={isSameDay(viewDate, todayMid)}
              >回到今天</button>
            </div>
            <div className="fh-picker-grid">
              {dayList.map(dt => {
                const isToday = isSameDay(dt, todayMid)
                const isSel = isSameDay(dt, viewDate)
                return (
                  <button
                    type="button"
                    key={dt.toISOString()}
                    className={`fh-picker-cell ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''}`}
                    onClick={() => pickDate(dt)}
                    title={`${dt.getMonth() + 1}月${dt.getDate()}日 · 周${WEEK_CN[dt.getDay()]}`}
                  >
                    <span className="fh-pc-d">{dt.getDate()}</span>
                    <span className="fh-pc-w">周{WEEK_CN[dt.getDay()]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="fh-astro">
          <span className={`fh-mode ${personalized ? 'personal' : 'standard'}`}>{personalized ? '你的今日参考' : '今日传统黄历'}</span>
          <span className="fh-chip">农历{data.lunar}</span>
          <span className="fh-chip">{data.ganzhi}</span>
          <span className="fh-chip">生肖{data.shengxiao}</span>
          {data.nayin && <span className="fh-chip">纳音{data.nayin}</span>}
          {data.jieqi && <span className="fh-chip">🌦 {data.jieqi}</span>}
          {calendar?.monthGanzhi && <span className="fh-chip">月令{calendar.monthGanzhi}</span>}
          {calendar?.jianchu && <span className="fh-chip fh-jianchu-chip">建除·{calendar.jianchu}日</span>}
          {data.lunarFestival && <span className="fh-chip">🏮 {data.lunarFestival}</span>}
          {data.solarFestival && <span className="fh-chip">🎊 {data.solarFestival}</span>}
        </div>
      </div>

      {/* 今日开场金句（由订阅人身份/年纪在后台决定，不暴露身份标签） */}
      {personalized && <div className="fh-persona">
        <span className="fh-persona-kicker">今日场景</span>
        <p className="fh-persona-txt">{data.scene.personaTitle || data.scene.persona}</p>
      </div>}

      {/* 彭祖黄历宜忌：使用真实传统黄历字段，替换旧的现代幽默宜忌。 */}
      {data.real && <div className={`fh-yiji fh-pengzu-yiji ${personalized ? 'has-notes' : ''}`}>
        <div className="fh-yi">
          <h4 className="fh-sec-title fh-yi-title"><span className="fh-sec-ic">宜</span> {personalized ? context.yiHeading : '今日宜 · 传统条目'}</h4>
          <ul>
            {(visibleYiItems.length ? visibleYiItems : [{ item: '待规则库补齐' }]).map((entry, i) => (
              <li key={i}>
                <i className="fh-dot yi">{i + 1}</i>
                <div className="fh-li-txt">
                  <b>{entry.item}</b>
                  {entry.note && <small className="fh-li-note">{entry.note}</small>}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="fh-ji">
          <h4 className="fh-sec-title fh-ji-title"><span className="fh-sec-ic">忌</span> {personalized ? context.jiHeading : '今日忌 · 传统条目'}</h4>
          <ul>
            {visibleJiItems.map((entry, i) => (
              <li key={i}>
                <i className="fh-dot ji">{i + 1}</i>
                <div className="fh-li-txt">
                  <b>{entry.item}</b>
                  {entry.note && <small className="fh-li-note">{entry.note}</small>}
                </div>
              </li>
            ))}
          </ul>
          {otherJiItems.length > 0 && (
            <div className="fh-ji-other">
              <button type="button" onClick={() => setShowOtherJi(value => !value)} aria-expanded={showOtherJi}>
                <span>其他忌项（{otherJiItems.length}）</span>
                <i className={showOtherJi ? 'open' : ''}>▾</i>
              </button>
              {showOtherJi && (
                <ul className="fh-ji-other-list">
                  {groupedOtherJiItems.map((entry, i) => (
                    <li key={entry.item}>
                      <i className="fh-dot ji">{i + visibleJiItems.length + 1}</i>
                      <div className="fh-li-txt">
                        <b>{entry.item}</b>
                        {entry.note && <small className="fh-li-note">{entry.note}</small>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>}

      {/* 今日主题 + 结合八字 */}
      {personalized && d && (
        <div className="fh-fortune">
          <h4 className="fh-sec-title fh-fortune-head"><span className="fh-sec-ic">🔮</span> 你的今日节奏</h4>
          <div className="fh-fortune-main">
            <span className="fh-fortune-ic">{relationIcon}</span>
            <p className="fh-fortune-rel">
              命局与日气：<b>{relationText}</b>
            </p>
            <p className="fh-fortune-theme">{rhythm?.theme || d.theme}</p>
          </div>
          {(rhythm?.action || d.action) && (() => {
            const action = rhythm?.action || d.action
            return (
              <div className="fh-fortune-act">
                <p className="fh-fortune-act-primary"><b>{action.head}</b>——{action.primary || action.body}</p>
                {action.secondary && <p className="fh-fortune-act-secondary">{action.secondary}</p>}
              </div>
            )
          })()}

          {(rhythm?.priorities?.length || d.scenes?.length) && (
            <div className="fh-fortune-scenes">
              <span className="fs-cap">可优先安排</span>
              <div className="fs-tags">
                {(rhythm?.priorities || d.scenes.map(text => ({ text, source: '八字喜用' }))).map((item, i) => (
                  <span key={`${item.source}-${i}`} className="fs-tag" title={item.source}>{item.text}</span>
                ))}
              </div>
            </div>
          )}

          {(rhythm?.tips?.length || d.tips) && (
            <div className="fh-fortune-tips">
              {(rhythm?.tips || [
                { label: '命局配色', value: d.tips.color },
                { label: '命局方位', value: d.tips.dir },
                { label: '数字提示', value: d.tips.num },
                { label: '人际提示', value: d.tips.noble },
              ]).map(tip => <span key={tip.label} className="ftip" title={tip.source}><b>{tip.label}</b>{tip.value}</span>)}
            </div>
          )}
        </div>
      )}

      {/* 老黄历真相（传统数据） · 对你而言 */}
      {data.real && (
        <div className="fh-block fh-real">
          <h4 className="fh-sec-title"><span className="fh-sec-ic">📜</span> 传统规则层 · 日神与方位</h4>

          {calendar?.monthGanzhi && calendar?.jianchu && (
            <div className="fh-calendar-rule">
              <div className="fh-calendar-rule-item">
                <span>月令</span>
                <b>{calendar.monthGanzhi}</b>
                <small>以节气划分月令</small>
              </div>
              <div className="fh-calendar-rule-divider" aria-hidden="true" />
              <div className="fh-calendar-rule-item">
                <span>建除值日</span>
                <b>{calendar.jianchu}日</b>
                <small>先看冲忌，再看用事</small>
              </div>
            </div>
          )}

          {data.real.jieqiProgress && (
            <div className="fh-term-window">
              <b>节气进度</b>
              <span>{data.real.jieqiProgress}</span>
            </div>
          )}

          {/* 冲煞 · 二十八宿 · 彭祖百忌 — 单行三联 */}
          {(data.real.chong || data.real.ershiba || data.real.pengzu) && (
            <div className="fh-real-row3">
              {data.real.chong && (
                <div className="fh-real-cell" title={data.real.chong}>
                  <span className="fh-real-cell-lbl">冲煞</span>
                  <span className="fh-real-cell-val">{data.real.chong}</span>
                </div>
              )}
              {data.real.ershiba && (
                <div className="fh-real-cell" title={data.real.ershiba}>
                  <span className="fh-real-cell-lbl">二十八宿</span>
                  <span className="fh-real-stamp">{data.real.ershiba}</span>
                </div>
              )}
              {data.real.pengzu && (
                <div className="fh-real-cell" title={data.real.pengzu}>
                  <span className="fh-real-cell-lbl">彭祖百忌</span>
                  <span className="fh-real-pengzu">{data.real.pengzu}</span>
                </div>
              )}
            </div>
          )}

          {/* 方位三联：喜神 · 财神 · 福神 */}
          {directionItems.length > 0 && <div className="fh-fang">
            {directionItems.map(item => (
              <div className={`fh-fang-item ${item.tone}`} key={item.label}>
                <span className="fh-fang-label">{item.label}</span>
                <span className="fh-fang-val">{item.value}</span>
              </div>
            ))}
          </div>}
        </div>
      )}

      {/* 八运建议 */}
      {personalized && d && integratedAdvice && (
        <div className="fh-block">
          <h4 className="fh-sec-title"><span className="fh-sec-ic">🔖</span> 今天怎么安排 · {data.scene.name}</h4>
          <div className="fh-advice-grid">
            <div className="fh-advice-item"><b className="a-career">做事</b><span>{integratedAdvice.career}</span></div>
            <div className="fh-advice-item"><b className="a-wealth">用钱</b><span>{integratedAdvice.wealth}</span></div>
            <div className="fh-advice-item"><b className="a-love">相处</b><span>{integratedAdvice.love}</span></div>
            <div className="fh-advice-item"><b className="a-health">状态</b><span>{integratedAdvice.health}</span></div>
            <div className="fh-advice-item"><b className="a-noble">协作</b><span>{integratedAdvice.noble}</span></div>
            <div className="fh-advice-item"><b className="a-travel">出门</b><span>{integratedAdvice.travel}</span></div>
            <div className="fh-advice-item"><b className="a-decision">决定</b><span>{integratedAdvice.decision}</span></div>
            <div className="fh-advice-item"><b className="a-opening">小提示</b><span>{integratedAdvice.opening}</span></div>
          </div>
        </div>
      )}

      {/* 玄学指南 */}
      {personalized && <div className="fh-block">
        <h4 className="fh-sec-title"><span className="fh-sec-ic">🧭</span> 场景生活便签 · {data.scene.name}</h4>
        <div className="fh-guide-grid">
          {Object.entries(data.scene.tips).map(([k, v]) => (
            <div className="fh-guide-item" key={k}><b>{TIPS_ICON[k] || '✦'} {k}</b><span>{v}</span></div>
          ))}
        </div>
      </div>}

      {/* 十二生肖 + 心理贴士 */}
      {personalized && <div className="fh-block">
        <button className="fh-toggle" onClick={() => setShowTips(v => !v)}>
          <span className="fh-toggle-t">🐭 生肖轻松参考（幽默胡话版）</span>
          <span className={`fh-caret ${showTips ? 'open' : ''}`}>▾</span>
        </button>
        {showTips && (
          <div className="fh-zodiac-body">
            <p className="fh-zodiac-context">{data.scene.context.zodiacLead}</p>
            <ul className="fh-zodiac-list">
              {Object.entries(data.scene.zodiac).map(([z, t]) => {
                const isMe = myZodiac && z === myZodiac
                const isFav = favZodiac.includes(z)
                const cls = `fh-zodiac-row ${isMe ? 'me' : ''} ${isFav ? 'fav' : ''}`
                return (
                  <li key={z} className={cls}>
                    <span className="fh-zodiac-name">
                      {(isMe || isFav) && <span className={`fh-zodiac-tag ${isMe ? 'me' : 'fav'}`}>{isMe ? '我' : '关注'}</span>}
                      <b>{z}</b>
                    </span>
                    <span className="fh-zodiac-copy">{t}</span>
                  </li>
                )
              })}
            </ul>
            <div className="fh-mental">
              {data.scene.mental.map((m, i) => <p key={i}>💊 {m}</p>)}
            </div>
          </div>
        )}
      </div>}

      <p className="fh-disclaimer">
        历法、节气与干支为计算字段；宜忌、神煞与方位属于传统民俗规则。所有内容仅作文化与生活参考。
      </p>
    </div>
  )
}
