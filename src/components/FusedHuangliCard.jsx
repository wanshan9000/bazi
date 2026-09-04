import { useMemo, useState } from 'react'
import { buildFusedHuangliData } from '../engine/cantian.js'
import { buildDaily } from '../engine/huangli.js'

// 结合八字：完整日运数据（主题/策略/开运）+ 五运建议
function useDaily(chart, date) {
  return useMemo(() => {
    if (!chart) return null
    try {
      const d = buildDaily(date, chart)
      const advice = {
        career: d.action ? `${d.action.head}。${d.action.body}` : '今日按部就班即可。',
        wealth: d.relation === '慎' ? '今日财运宜守，避免大额冲动消费。' : '今日适合处理与钱相关的事项，量入为出。',
        love: d.relation === '顺' ? '今日人际和谐，适合约会、聚会，感情升温。' : '今日宜多沟通体谅，避免因小事起争执。',
        health: d.tips ? `今日适合适量运动，${d.tips.color}色系衣物有助提升状态。` : '注意劳逸结合。',
        opening: d.tips ? `今日开运色 ${d.tips.color}，吉方 ${d.tips.dir}，贵人 ${d.tips.noble}，幸运数字 ${d.tips.num}。` : '保持平常心即是好风水。',
        noble: d.tips ? `今日贵人 ${d.tips.noble}，多与这类人走动，遇事易得提点、事半功倍。` : '今日宜与人为善，广结善缘。',
        travel: d.tips ? `出行以${d.tips.dir}方为宜，今日与${d.chong ? d.chong.split('（')[0] : '冲煞生肖'}保持些距离，行程多留缓冲。` : '今日出行注意看路，稳字当头。',
        decision: d.relation === '顺' ? '今日脑子灵光，适合拍板重要决定，趁热打铁。' : '今日略有心绪起伏，重要决定宜缓一缓，明日再议。',
      }
      return { d, advice }
    } catch { return null }
  }, [chart, date])
}

const TIPS_ICON = { '今日运势': '☀️', '今日主题': '🎐' }

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

export default function FusedHuangliCard({ chart, date = new Date(), onChangeDate, defaultScenario = 'worker', myZodiac, favZodiac = [] }) {
  // 依据订阅人身份/年纪推断出的场景，仅显示这一种，不提供切换
  const [scenario] = useState(defaultScenario)
  const [showTips, setShowTips] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  // 受控：日期由外部传入（SubscribePage 维护），弹层 30 天选择通过 onChangeDate 上抛
  const viewDate = date
  const daily = useDaily(chart, viewDate)
  const d = daily ? daily.d : null

  const data = useMemo(
    () => buildFusedHuangliData(viewDate, scenario, d ? { action: d.action, tips: d.tips } : null),
    [viewDate, scenario, d]
  )

  const weekName = `周${WEEK_CN[viewDate.getDay()]}`

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
          <span className="fh-chip">农历{data.lunar}</span>
          <span className="fh-chip">{data.ganzhi}</span>
          <span className="fh-chip">生肖{data.shengxiao}</span>
          {data.nayin && <span className="fh-chip">纳音{data.nayin}</span>}
          {data.jieqi && <span className="fh-chip">🌦 {data.jieqi}</span>}
          {data.lunarFestival && <span className="fh-chip">🏮 {data.lunarFestival}</span>}
          {data.solarFestival && <span className="fh-chip">🎊 {data.solarFestival}</span>}
        </div>
      </div>

      {/* 今日开场金句（由订阅人身份/年纪在后台决定，不暴露身份标签） */}
      <div className="fh-persona">
        <p className="fh-persona-txt">“{data.scene.persona}”</p>
        <p className="fh-persona-bgm">🎵 今日BGM：{data.scene.bgm}</p>
      </div>

      {/* 现代幽默宜忌 */}
      <div className="fh-yiji">
        <div className="fh-yi">
          <h4 className="fh-sec-title fh-yi-title"><span className="fh-sec-ic">✅</span> 今日宜 · 现代版</h4>
          <ul>
            {data.scene.yi.map((it, i) => (
              <li key={i}>
                <i className="fh-dot yi">{i + 1}</i>
                <div className="fh-li-txt"><b>{it.head}</b>{it.tail ? <span className="fh-li-tail">——{it.tail}</span> : ''}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="fh-ji">
          <h4 className="fh-sec-title fh-ji-title"><span className="fh-sec-ic">❌</span> 今日忌 · 现代版</h4>
          <ul>
            {data.scene.ji.map((it, i) => (
              <li key={i}>
                <i className="fh-dot ji">{i + 1}</i>
                <div className="fh-li-txt"><b>{it.head}</b>{it.tail ? <span className="fh-li-tail">——{it.tail}</span> : ''}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 今日主题 + 结合八字 */}
      {d && (
        <div className="fh-fortune">
          <h4 className="fh-sec-title fh-fortune-head"><span className="fh-sec-ic">🔮</span> 今日主题 · 结合你的八字</h4>
          <div className="fh-fortune-main">
            <span className="fh-fortune-ic">{relationIcon}</span>
            <p className="fh-fortune-rel">
              今日运势：<b>{relationText}</b>
            </p>
            <p className="fh-fortune-theme">{d.theme}</p>
            {d.tone && <p className="fh-fortune-tone">{d.tone}</p>}
          </div>
          {d.action && (
            <p className="fh-fortune-act"><b>{d.action.head}</b>——{d.action.body}</p>
          )}

          {(d.dayGanzhi || d.term) && (
            <div className="fh-fortune-meta">
              {d.dayGanzhi && <span className="fm-pill">☯ {d.dayGanzhi}日</span>}
              {d.dayWx && <span className="fm-pill">🔅 {d.dayWx}日</span>}
              {d.term && d.term !== '无' && <span className="fm-pill">🌦 {d.term}</span>}
              {d.chong && <span className="fm-pill">⚡ {d.chong}</span>}
            </div>
          )}

          {d.scenes && d.scenes.length > 0 && (
            <div className="fh-fortune-scenes">
              <span className="fs-cap">今日适合</span>
              <div className="fs-tags">
                {d.scenes.map((s, i) => <span key={i} className="fs-tag">{s}</span>)}
              </div>
            </div>
          )}

          {d.tips && (
            <div className="fh-fortune-tips">
              <span className="ftip"><b>开运色</b>{d.tips.color}</span>
              <span className="ftip"><b>吉方</b>{d.tips.dir}</span>
              <span className="ftip"><b>幸运数字</b>{d.tips.num}</span>
              <span className="ftip"><b>贵人属相</b>{d.tips.noble}</span>
            </div>
          )}
        </div>
      )}

      {/* 老黄历真相（传统数据） · 对你而言 */}
      {data.real && (
        <div className="fh-block fh-real">
          <h4 className="fh-sec-title"><span className="fh-sec-ic">📜</span> 老黄历真相（传统数据）</h4>

          {/* 宜·忌 双联卡 */}
          <div className="fh-yj-grid">
            <div className="fh-yj yi">
              <div className="fh-yj-head">
                <span className="fh-yj-ic">宜</span>
                <span className="fh-yj-cap">所当为</span>
              </div>
              <div className="fh-yj-body">{data.real.yi || '-'}</div>
            </div>
            <div className="fh-yj ji">
              <div className="fh-yj-head">
                <span className="fh-yj-ic">忌</span>
                <span className="fh-yj-cap">所当避</span>
              </div>
              <div className="fh-yj-body">{data.real.ji || '-'}</div>
            </div>
          </div>

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
          <div className="fh-fang">
            <div className="fh-fang-item xi">
              <span className="fh-fang-label">喜神</span>
              <span className="fh-fang-val">{data.real.xishen || '-'}</span>
            </div>
            <div className="fh-fang-item cai">
              <span className="fh-fang-label">财神</span>
              <span className="fh-fang-val">{data.real.caishen || '-'}</span>
            </div>
            <div className="fh-fang-item fu">
              <span className="fh-fang-label">福神</span>
              <span className="fh-fang-val">{data.real.fushen || '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 八运建议 */}
      {d && daily.advice && (
        <div className="fh-block">
          <h4 className="fh-sec-title"><span className="fh-sec-ic">🔖</span> 今日八大建议</h4>
          <div className="fh-advice-grid">
            <div className="fh-advice-item"><b className="a-career">事业</b><span>{daily.advice.career}</span></div>
            <div className="fh-advice-item"><b className="a-wealth">财运</b><span>{daily.advice.wealth}</span></div>
            <div className="fh-advice-item"><b className="a-love">感情</b><span>{daily.advice.love}</span></div>
            <div className="fh-advice-item"><b className="a-health">健康</b><span>{daily.advice.health}</span></div>
            <div className="fh-advice-item"><b className="a-noble">贵人</b><span>{daily.advice.noble}</span></div>
            <div className="fh-advice-item"><b className="a-travel">出行</b><span>{daily.advice.travel}</span></div>
            <div className="fh-advice-item"><b className="a-decision">决策</b><span>{daily.advice.decision}</span></div>
            <div className="fh-advice-item"><b className="a-opening">开运</b><span>{daily.advice.opening}</span></div>
          </div>
        </div>
      )}

      {/* 玄学指南 */}
      <div className="fh-block">
        <h4 className="fh-sec-title"><span className="fh-sec-ic">🧭</span> 今日玄学指南</h4>
        <div className="fh-guide-grid">
          {Object.entries(data.scene.tips).map(([k, v]) => (
            <div className="fh-guide-item" key={k}><b>{TIPS_ICON[k] || '✦'} {k}</b><span>{v}</span></div>
          ))}
        </div>
      </div>

      {/* 十二生肖 + 心理贴士 */}
      <div className="fh-block">
        <button className="fh-toggle" onClick={() => setShowTips(v => !v)}>
          <span className="fh-toggle-t">🐭 十二生肖今日运势 + 💊 心理贴士（胡说八道版）</span>
          <span className={`fh-caret ${showTips ? 'open' : ''}`}>▾</span>
        </button>
        {showTips && (
          <div className="fh-zodiac-body">
            <ul className="fh-zodiac-list">
              {Object.entries(data.scene.zodiac).map(([z, t]) => {
                const isMe = myZodiac && z === myZodiac
                const isFav = favZodiac.includes(z)
                const cls = `fh-zodiac-row ${isMe ? 'me' : ''} ${isFav ? 'fav' : ''}`
                return (
                  <li key={z} className={cls}>
                    {isMe && <span className="fh-zodiac-tag me">我的</span>}
                    {!isMe && isFav && <span className="fh-zodiac-tag fav">关注</span>}
                    <b>{z}</b><span>{t}</span>
                  </li>
                )
              })}
            </ul>
            <div className="fh-mental">
              {data.scene.mental.map((m, i) => <p key={i}>💊 {m}</p>)}
            </div>
          </div>
        )}
      </div>

      <p className="fh-disclaimer">
        传统黄历数据来自真实历法排盘，现代宜忌纯属胡说八道，仅供娱乐，不构成任何建议。
      </p>
    </div>
  )
}
