import { useState } from 'react'
import {
  TIAN_GAN, DI_ZHI, GAN_WUXING, ZHI_WUXING, ZHI_CANGGAN, WUXING_COLOR, WUXING_ICON, WUXING_SHENG
} from '../data/ganzhi.js'
import { currentYearGanzhi } from '../engine/bazi.js'

const SHICHEN = [
  ['子时', '23-01'], ['丑时', '01-03'], ['寅时', '03-05'], ['卯时', '05-07'],
  ['辰时', '07-09'], ['巳时', '09-11'], ['午时', '11-13'], ['未时', '13-15'],
  ['申时', '15-17'], ['酉时', '17-19'], ['戌时', '19-21'], ['亥时', '21-23']
]
const SHICHEN_HOUR = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 }
const WX_LABEL = { 木: '木 · 仁', 火: '火 · 礼', 土: '土 · 信', 金: '金 · 义', 水: '水 · 智' }
const FAV_COLOR = { 木: '#3f6f63', 火: '#b03a2c', 土: '#a3843c', 金: '#8a8371', 水: '#3a6a8a' }

export default function BaziPage({ chart, onBack, onChart }) {
  const [editing, setEditing] = useState(!chart)
  const [tab, setTab] = useState('chart')

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>← 返回首页</button>
          {chart && !editing && (
            <button className="btn ghost small" onClick={() => { setEditing(true); setTab('chart') }}>重新排盘</button>
          )}
        </div>
        <h1 className="page-title rise rise-1">八字门</h1>
        <p className="page-sub rise rise-2">排四柱 · 看五行 · 定喜用神</p>

        {editing || !chart ? (
          <BirthFormComp
            onDone={(data) => {
              onChart(data)
              setEditing(false)
              setTab('chart')
              window.scrollTo(0, 0)
            }}
          />
        ) : (
          <ChartResult chart={chart} tab={tab} setTab={setTab} />
        )}
      </div>
    </div>
  )
}

function BirthFormComp({ onDone }) {
  const now = new Date()
  const [year, setYear] = useState(1995)
  const [month, setMonth] = useState(6)
  const [day, setDay] = useState(15)
  const [hour, setHour] = useState(12)
  const [timeKnown, setTimeKnown] = useState(true)
  const [gender, setGender] = useState('男')
  const [name, setName] = useState('')

  const daysInMonth = (y, m) => new Date(y, m, 0).getDate()
  const years = []
  for (let y = now.getFullYear(); y >= 1926; y--) years.push(y)

  const adjustDay = (d) => setDay(Math.min(d, daysInMonth(year, month)))
  const setM = (m) => { setMonth(m); setDay(prev => Math.min(prev, daysInMonth(year, m))) }
  const setY = (y) => { setYear(y); setDay(prev => Math.min(prev, daysInMonth(y, month))) }

  return (
    <div className="card rise rise-3">
      <div className="field">
        <label>出生日期<span className="req">*</span></label>
        <div className="date-row">
          <div className="select-wrap">
            <select value={year} onChange={e => setY(+e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y} 年</option>)}
            </select>
          </div>
          <div className="select-wrap">
            <select value={month} onChange={e => setM(+e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 月</option>)}
            </select>
          </div>
          <div className="select-wrap">
            <select value={day} onChange={e => adjustDay(+e.target.value)}>
              {Array.from({ length: daysInMonth(year, month) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 日</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="field">
        <label>出生时辰</label>
        <div className="toggle-row" style={{ marginBottom: 10 }}>
          <div className={`toggle-chip ${timeKnown ? 'active' : ''}`} onClick={() => setTimeKnown(true)}>知道时辰</div>
          <div className={`toggle-chip ${!timeKnown ? 'active' : ''}`} onClick={() => setTimeKnown(false)}>时辰不确定</div>
        </div>
        {timeKnown && (
          <div className="time-grid">
            {SHICHEN.map(([label, range]) => (
              <div
                key={label}
                className={`time-chip ${hour === SHICHEN_HOUR[label[0]] ? 'active' : ''}`}
                onClick={() => setHour(SHICHEN_HOUR[label[0]])}
              >
                {label}<small>{range}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label>性别</label>
        <div className="toggle-row">
          <div className={`toggle-chip ${gender === '男' ? 'active' : ''}`} onClick={() => setGender('男')}>乾造 · 男</div>
          <div className={`toggle-chip ${gender === '女' ? 'active' : ''}`} onClick={() => setGender('女')}>坤造 · 女</div>
        </div>
      </div>

      <div className="field">
        <label>称呼（可选）</label>
        <input type="text" placeholder="怎么称呼你？" value={name} maxLength={12} onChange={e => setName(e.target.value)} />
      </div>

      <div className="form-actions">
        <button className="btn" style={{ width: '100%' }} onClick={() => onDone({ year, month, day, hour: timeKnown ? hour : 12, gender, name, timeKnown })}>
          ✦ 排定命盘
        </button>
        <p className="form-note">基于你的生辰推算四柱八字与五行命局 · 仅供自我探索参考</p>
      </div>
    </div>
  )
}

const HOUR_LABEL = (h) => {
  const hour = h ?? 12
  const idx = Math.min(11, Math.floor(((hour + 1) % 24) / 2))
  const label = SHICHEN[idx][0]
  const range = SHICHEN[idx][1]
  return { label, range }
}

function ChartResult({ chart, tab, setTab }) {
  const now = currentYearGanzhi()
  const total = Object.values(chart.wuxing).reduce((a, b) => a + b, 0)
  const strengthTxt = chart.strength.strong ? '身强' : chart.strength.weak ? '身弱' : '中和'
  const shichen = HOUR_LABEL(chart.hour)

  // 五行能量环分段（conic-gradient）
  const segs = []
  let acc = 0
  chart.wuxingRank.forEach((wx, i) => {
    const pct = (chart.wuxing[wx] / total) * 100
    const end = acc + pct
    if (i < chart.wuxingRank.length - 1) {
      segs.push(`${WUXING_COLOR[wx]} ${acc}% ${end - 1.5}%, transparent ${end - 1.5}% ${end}%`)
    } else {
      segs.push(`${WUXING_COLOR[wx]} ${acc}% ${end}%`)
    }
    acc = end
  })

  const strengthDesc =
    strengthTxt === '身强' ? '气势充沛，可任财官' :
    strengthTxt === '身弱' ? '贵在借力，宜守成深耕' : '外圆内方，动静相宜'

  return (
    <div className="rise">
      <div className="tabs">
        <button className={`tab ${tab === 'chart' ? 'active' : ''}`} onClick={() => setTab('chart')}>命盘</button>
        <button className={`tab ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>解读</button>
      </div>

      {tab === 'chart' ? (
        <>
          <div className="card chart-card chart-main">
            {/* 锦缎头 */}
            <div className="chart-banner">
              <div className="cb-seal">命</div>
              <div>
                <div className="cb-title">八字命盘</div>
                <div className="cb-sub">
                  {chart.name ? `${chart.name} · ` : ''}{chart.gender === '男' ? '乾造' : '坤造'} · {chart.shengxiao}肖 · {chart.dayMasterWx}命
                </div>
              </div>
            </div>

            {/* 四柱八字连写 */}
            <div className="bazi-line">
              {chart.pillars.map(p => (
                <span key={p.label}>
                  <b style={{ color: WUXING_COLOR[GAN_WUXING[TIAN_GAN.indexOf(p.gan)]] }}>{p.gan}</b>
                  <i style={{ color: WUXING_COLOR[ZHI_WUXING[DI_ZHI.indexOf(p.zhi)]] }}>{p.zhi}</i>
                </span>
              ))}
            </div>
            <div className="bazi-info">
              {chart.year} 年 {chart.month} 月 {chart.day} 日 · {shichen.label} {shichen.range} · {chart.shengxiao}肖
            </div>

            <div className="chart-divider">✦ ✦ ✦</div>

            {/* 四柱大卡 */}
            <div className="pillars">
              {chart.pillars.map(p => {
                const gwx = GAN_WUXING[TIAN_GAN.indexOf(p.gan)]
                const isDay = p.label === '日柱'
                return (
                  <div key={p.label} className={`pillar ${isDay ? 'day' : ''}`} style={{ ['--pc']: WUXING_COLOR[gwx] }}>
                    <div className="p-top">
                      <span className="lab">{p.label}</span>
                      {isDay && <span className="p-tag">日主</span>}
                    </div>
                    <div className="gan" style={{ color: WUXING_COLOR[gwx] }}>{p.gan}</div>
                    <div className="zhi" style={{ color: WUXING_COLOR[ZHI_WUXING[DI_ZHI.indexOf(p.zhi)]] }}>{p.zhi}</div>
                    <div className="p-ss">{p.shiShen}</div>
                    <div className="p-cang">藏 · {ZHI_CANGGAN[DI_ZHI.indexOf(p.zhi)].join(' ')}</div>
                  </div>
                )
              })}
            </div>

            {/* 五行能量 */}
            <div className="wx-panel">
              <div className="wx-ring-wrap">
                <div className="wx-ring" style={{ background: `conic-gradient(${segs.join(', ')})` }} />
                <div className="wx-hole">
                  <div className="wx-master" style={{ color: WUXING_COLOR[chart.dayMasterWx] }}>{chart.dayMaster}</div>
                  <div className="wx-master-label">{chart.dayMasterWx}日主</div>
                </div>
              </div>
              <div className="wx-bars">
                <div className="wx-title">五行能量</div>
                {chart.wuxingRank.map(wx => {
                  const pct = Math.round((chart.wuxing[wx] / total) * 100)
                  return (
                    <div key={wx} className="wuxing-item">
                      <div className="row">
                        <span>{WUXING_ICON[wx]} {WX_LABEL[wx]}</span>
                        <span className="val">{pct}%</span>
                      </div>
                      <div className="bar" style={{ ['--wx-c']: WUXING_COLOR[wx] }}>
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <p className="wx-tip">旺于 {chart.wuxingRank[0]} · 弱于 {chart.wuxingRank[chart.wuxingRank.length - 1]}</p>
              </div>
            </div>

            {/* 关键信息 */}
            <div className="meta-grid meta-grid-4">
              <div className="meta">
                <div className="k">☯ 日主强弱</div>
                <div className="v gold">{strengthTxt}</div>
                <div className="d">{strengthDesc}</div>
              </div>
              <div className="meta">
                <div className="k">✦ 喜用神</div>
                <div className="v gold">{chart.favorable.join('、')}</div>
                <div className="d">宜亲近 · 补命局之不足</div>
              </div>
              <div className="meta">
                <div className="k">✕ 忌神</div>
                <div className="v">{chart.avoid.join('、')}</div>
                <div className="d">宜规避 · 泄命局之有余</div>
              </div>
              <div className="meta">
                <div className="k">◉ 当前流年</div>
                <div className="v gold">{now.gan}{now.zhi}</div>
                <div className="d">{now.year} 年 · 顺势而为</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14, textAlign: 'center', padding: '14px 16px' }}>
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.9 }}>
              命盘已排定 · 切到「解读」查看详解，或回首页与司命 Agent 对话
            </p>
          </div>
        </>
      ) : (
        <ReportBody chart={chart} />
      )}
    </div>
  )
}

function ReportBody({ chart }) {
  const dayMasterWx = chart.dayMasterWx
  const strong = chart.strength.strong
  const weak = chart.strength.weak
  const now = currentYearGanzhi()
  const fav = chart.favorable[0]

  const wxChar = {
    木: '仁，生发向上，柔韧而有主见',
    火: '礼，热烈明亮，真诚而有感染力',
    土: '信，厚德载物，稳重而值得托付',
    金: '义，刚毅果断，守正而有锋芒',
    水: '智，圆融流动，聪慧而随机应变'
  }[dayMasterWx]

  const sections = [
    { ico: '🧬', title: '性格底色', body: <>你是<b>{chart.dayMaster}日主</b>，五行属<b>{dayMasterWx}</b>，主「{wxChar}」。身{strong ? '强' : weak ? '弱' : '中和'}的你，{strong ? '行事有魄力、敢作敢当，但偶尔固执，需学会听取他人意见' : weak ? '心思细腻、善于借力，但易多虑，需给自己更多肯定' : '平衡稳健，外圆内方，是难得的中庸之才'}。</> },
    { ico: '🧭', title: '天生赛道', body: <>你的日主{dayMasterWx}，适合在<b>「{ { 木: '生长、创造', 火: '表达、传播', 土: '经营、承载', 金: '规则、专业', 水: '流动、连接' }[dayMasterWx] }」</b>型领域深耕。喜用神<b>{chart.favorable.join('、')}</b>对应的行业与人脉，是你命中的贵人方向——多靠近它们，路越走越宽。</> },
    { ico: '💰', title: '财运特征', body: <>{strong ? '身强能任财，正财稳、偏财有机缘，但须防「财来财去」，量入为出即可守成。' : '身弱财旺是你的课题，赚钱宜「借力」：合伙、跟投、深耕专业，切忌贪大冒进。'}今年<b>{now.year}年</b>财星平中有升，宜学习理财、经营副业。</> },
    { ico: '❤️', title: '感情指南', body: <>你的夫妻宫坐<b>{chart.pillars[2].zhi}</b>，感情上你{strong ? '习惯主导，需学会为对方留出表达空间' : '细腻敏感，需要一个坚定选择你的人'}。良缘多出现在与喜用神相关的场合与人群中，感情讲「合」不讲「争」。</> },
    { ico: '🌿', title: '健康提醒', body: <>你的{dayMasterWx}命，需重点养护{ { 木: '肝胆与眼睛，忌熬夜', 火: '心与血脉，忌急躁上火', 土: '脾胃，忌思虑过重', 金: '肺与皮肤，忌干燥悲忧', 水: '肾与骨骼，忌久坐耗神' }[dayMasterWx] }。身{strong ? '强' : weak ? '弱' : '中和'}之人，{strong ? '精力充沛但易透支，节律是关键' : '体质偏敏，规律养护胜过猛补'}。</> },
    { ico: '🌟', title: '今年流年', body: <>当前流年为<b>{now.gan}{now.zhi}</b>（{now.year}年）。整体而言，今年是「顺势而为」的一年：<b>旺{chart.favorable.join('、')}</b>之事放手去做，<b>忌{chart.avoid.join('、')}</b>之事谨慎对待。把注意力放在长期复利的事情上，这一年便是你的吉年。</> }
  ]

  return (
    <div>
      <div className="card chart-card" style={{ marginBottom: 14, overflow: 'hidden', padding: 0 }}>
        <div className="report-banner">
          <div>
            <div className="rb-title">✦ 命理详解 ✦</div>
            <div className="rb-sub">
              {chart.name ? `${chart.name} · ` : ''}{chart.dayMaster}日主 · {chart.shengxiao}肖 {chart.gender === '男' ? '乾造' : '坤造'} · {chart.dayMasterWx}命
            </div>
          </div>
          <div className="rb-wx" style={{ color: WUXING_COLOR[chart.dayMasterWx] }}>{chart.dayMasterWx}</div>
        </div>
        <div style={{ padding: '20px 22px 24px' }}>
        <div className="chart-head" style={{ marginBottom: 10 }}>
          <div className="name" style={{ fontSize: 17 }}>✦ 开运锦囊 ✦</div>
          <div className="sub">喜用 · 宜亲近</div>
        </div>
        <div>
          {chart.favorable.map(w => (
            <span key={w} className="fav-pill good" style={{ borderColor: FAV_COLOR[w] }}>{w}</span>
          ))}
          <span style={{ display: 'block', margin: '6px 0 8px', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.2em' }}>忌神 · 宜规避</span>
          {chart.avoid.map(w => (
            <span key={w} className="fav-pill bad">{w}</span>
          ))}
        </div>
        <div className="meta-grid">
          <div className="meta"><div className="k">幸运色</div><div className="v gold">{ { 木: '青绿', 火: '红紫', 土: '黄棕', 金: '白金', 水: '黑蓝' }[fav] }</div></div>
          <div className="meta"><div className="k">幸运方位</div><div className="v gold">{ { 木: '东方', 火: '南方', 土: '中原', 金: '西方', 水: '北方' }[fav] }</div></div>
          <div className="meta"><div className="k">幸运数字</div><div className="v gold">{ { 木: '3·8', 火: '2·7', 土: '5·10', 金: '4·9', 水: '1·6' }[fav] }</div></div>
          <div className="meta"><div className="k">贵人生肖</div><div className="v gold">{ { 木: '虎兔猪', 火: '蛇马羊', 土: '龙狗牛', 金: '猴鸡鼠', 水: '猪鼠鸡' }[fav] }</div></div>
        </div>
        </div>
      </div>

      {sections.map(s => (
        <div key={s.title} className="card report-sec">
          <h3><span className="ico">{s.ico}</span>{s.title}</h3>
          <p>{s.body}</p>
        </div>
      ))}

      <div className="card" style={{ marginTop: 14, textAlign: 'center', padding: '14px 16px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.9 }}>
          解读基于你的生辰命盘生成 · 命理仅供参考，人生由你书写
        </p>
      </div>
    </div>
  )
}
