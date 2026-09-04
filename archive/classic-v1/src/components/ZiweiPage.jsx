import { useState } from 'react'
import { WUXING_SHENG } from '../data/ganzhi.js'

const SHICHEN = [
  ['子时', '23-01'], ['丑时', '01-03'], ['寅时', '03-05'], ['卯时', '05-07'],
  ['辰时', '07-09'], ['巳时', '09-11'], ['午时', '11-13'], ['未时', '13-15'],
  ['申时', '15-17'], ['酉时', '17-19'], ['戌时', '19-21'], ['亥时', '21-23']
]
const SHICHEN_HOUR = { 子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10, 午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22 }

const WX_STAR = {
  木: { lord: '天机 · 文曲', color: '青', tone: '灵动多变，思维敏捷' },
  火: { lord: '太阳 · 廉贞', color: '赤', tone: '光明显达，热情外放' },
  土: { lord: '天府 · 紫微', color: '黄', tone: '厚重沉稳，承载八方' },
  金: { lord: '武曲 · 七杀', color: '白', tone: '刚毅果决，雷厉风行' },
  水: { lord: '天同 · 破军', color: '玄', tone: '圆融善变，智谋深远' }
}

// 十二宫个性化文案生成器
function buildPalaces(chart) {
  const wx = chart.dayMasterWx
  const star = WX_STAR[wx]
  const strong = chart.strength.strong
  const weak = chart.strength.weak
  const fav = chart.favorable[0]
  const avoid = chart.avoid[0]
  const favDir = { 木: '东', 火: '南', 土: '中', 金: '西', 水: '北' }[fav]
  const shengWo = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === wx)

  const p = (desc, starN) => ({ desc, star: starN })

  return {
    ming: p(`命宫为总纲。你属${wx}命，主星${star.lord}入命，其人${star.tone}。身${strong ? '强' : weak ? '弱' : '中和'}，命局${strong ? '格局开阔，敢为天下先' : weak ? '贵在守成，善借外力' : '外圆内方，动静相宜'}。`, '紫微·天机'),
    xiongdi: p(`兄弟宫${strong ? '平' : '利'}。你与手足${strong ? '各自独立，聚少离多，但大事仍守望相助' : '感情笃厚，常为彼此牵绊'}。宜以「${fav}」相关的共同事业为纽带。`, '天梁'),
    fuqi: p(`夫妻宫坐${chart.pillars[2].zhi}，主星平和。你待感情${weak ? '细腻专一，需要被坚定选择' : '热情真挚，亦需给对方留足空间'}。良缘多现于${favDir}方之人，喜${fav}者与你和鸣。`, '太阴·太阳'),
    zinv: p(`子女宫。你与子女${strong ? '似友似师，望子成龙之心切，须防期望过重' : '亲厚无间，子女温顺，是晚年的福气'}。${fav}之年添丁或升学之事顺遂。`, '武曲'),
    caibo: p(`财帛宫。${strong ? '身强任财，正财安稳，偏财有机缘，但财来财去较快，宜设止损' : '身弱财旺，求财贵在借力，合伙经营胜过单打独斗'}。喜${fav}的行业是你的财源方向。`, '廉贞·天府'),
    jie: p(`疾厄宫。${wx}命者，重点养护${ { 木: '肝胆、目', 火: '心、小肠', 土: '脾胃', 金: '肺、大肠', 水: '肾、膀胱' }[wx] }。忌${avoid}之时节，注意劳逸结合，莫透支元气。`, '天相'),
    qianyi: p(`迁移宫。你宜${favDir}方发展，${strong ? '外出闯荡能开格局，远行有贵' : '迁徙需谨慎，但遇${fav}之机缘则大有裨益'}。常年在外者，事业反胜故土。`, '贪狼'),
    jiaoyou: p(`交友宫。你命中的贵人多为${fav}命格之人，与${shengWo}属性者交游亦利。${weak ? '宜多结善缘，广种福田' : '贵人多但亦防损友，择友以品为先'}。`, '巨门'),
    guanlu: p(`官禄宫。你的天职在「${ { 木: '创造生长', 火: '表达传播', 土: '经营承载', 金: '专业规则', 水: '流动连接' }[wx] }」之道。${strong ? '宜开创宜承担，中年后权势渐显' : '宜辅佐宜深耕，专业越精越受重'}。喜${fav}领域终有作为。`, '紫微·破军'),
    tianzhai: p(`田宅宫。家宅宜清朗，${favDir}向开窗聚气。${strong ? '置业宜早，不动产是你的底气' : '居家宜静，小宅亦可安居乐业'}。忌${avoid}方位堆放杂物。`, '七杀'),
    fade: p(`福德宫。你心性${strong ? '刚强，思虑深沉，需修「静」字' : '柔软，感知敏锐，需养「定」字'}。多亲近山水自然，或研习${fav}相关的雅好，可养福德。`, '天同'),
    fumu: p(`父母宫。父母宫主星得地，长辈缘佳，${weak ? '得长辈荫庇，凡事有靠' : '父母对你期许高，宜常怀感恩'}。${fav}之年，家中有喜。`, '天梁·禄存')
  }
}

export default function ZiweiPage({ chart, onBack, onChart }) {
  const [active, setActive] = useState(null)
  const [editing, setEditing] = useState(false)
  const hasChart = !!chart

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head rise">
          <button className="back-btn" onClick={onBack}>← 返回首页</button>
          {chart && !editing && (
            <button className="btn ghost small" onClick={() => setEditing(true)}>重新排盘</button>
          )}
        </div>
        <h1 className="page-title rise rise-1">紫微门</h1>
        <p className="page-sub rise rise-2">览十二宫 · 观星曜 · 明格局</p>

        {!hasChart || editing ? (
          <ZiweiEntry
            chart={chart}
            onDone={(data) => {
              onChart(data)
              setEditing(false)
            }}
          />
        ) : (
          <ZiweiBoard chart={chart} active={active} setActive={setActive} />
        )}
      </div>
    </div>
  )
}

/* ============ 紫微排盘台：单列布局（概念+步骤 → 表单，去掉了天盘装饰图） ============ */
function ZiweiEntry({ chart, onDone }) {
  const steps = [
    { n: '一', t: '输生辰', d: '年月日时 · 性别' },
    { n: '二', t: '排十二宫', d: '依命局定盘位' },
    { n: '三', t: '览星曜', d: '逐宫解读 · AI 深化' }
  ]

  return (
    <div className="zw-home rise rise-3">
      {/* 上半：标题 + 描述 + 三步流程（融合自原左列） */}
      <div className="zw-intro">
        <h3 className="zw-title">以生辰 · 定格局</h3>
        <p className="zw-desc">紫微斗数依生年、月、日、时排出十二宫位，主星入宫，决定人生的十二个面相。填好生辰，即刻起盘。</p>
        <div className="zw-home-steps">
          {steps.map(s => (
            <div key={s.n} className="zw-step">
              <div className="zws-num">{s.n}</div>
              <div className="zws-t">{s.t}</div>
              <div className="zws-d">{s.d}</div>
            </div>
          ))}
        </div>
        {chart && (
          <p className="zw-tip" style={{ marginTop: 14 }}>
            已有命盘 · 如无需重排可直接返回查看
          </p>
        )}
      </div>

      {/* 下半：紫微生辰表单（融合自原右列） */}
      <ZiweiBirthForm onDone={onDone} />
    </div>
  )
}

/* ============ 紫微生辰表单 ============ */
function ZiweiBirthForm({ onDone }) {
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
    <div className="zw-form-card">
      <div className="zw-form-title">
        <span className="zft-glyph">☾</span>
        <div>
          <div className="zft-t">输入生辰 · 起紫微命盘</div>
          <div className="zft-d">依生年、月、日、时排出十二宫位 · 主星入宫定格局</div>
        </div>
      </div>

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
        <button className="zw-submit" onClick={() => onDone({ year, month, day, hour: timeKnown ? hour : 12, gender, name, timeKnown })}>
          <span>✦ 起紫微命盘</span>
          <span className="zfs-arrow">→</span>
        </button>
        <p className="form-note">生辰信息仅用于本次排盘 · 紫微斗数依此起十二宫 · 仅供自我探索参考</p>
      </div>
    </div>
  )
}

function ZiweiBoard({ chart, active, setActive }) {
  const palaces = buildPalaces(chart)
  const list = [
    ['ming', '命宫', '本命'], ['xiongdi', '兄弟', '手足'], ['fuqi', '夫妻', '情缘'],
    ['zinv', '子女', '晚辈'], ['caibo', '财帛', '钱财'], ['jie', '疾厄', '健康'],
    ['qianyi', '迁移', '出行'], ['jiaoyou', '交友', '人脉'], ['guanlu', '官禄', '事业'],
    ['tianzhai', '田宅', '家宅'], ['fade', '福德', '心性'], ['fumu', '父母', '尊长']
  ]
  const star = WX_STAR[chart.dayMasterWx]

  return (
    <div className="rise">
      <div className="card chart-card">
        <div className="chart-head">
          <div className="name" style={{ fontSize: 19 }}>{chart.dayMaster}日主 · 紫微十二宫</div>
          <div className="sub">命主星曜：{star.lord} · {chart.shengxiao}肖 {chart.gender === '男' ? '乾造' : '坤造'}</div>
        </div>

        <div className="ziwei-grid">
          {list.map(([key, name, en]) => {
            const palace = palaces[key]
            const isMing = key === 'ming'
            return (
              <div
                key={key}
                className={`zw-palace ${isMing ? 'ming' : ''}`}
                onClick={() => setActive(key)}
              >
                <div className="pn">{name}</div>
                <div className="ps">{en} · {palace.star}</div>
                <div className="pt" style={{ maxHeight: active === key ? 'none' : '3.2em', overflow: 'hidden' }}>
                  {palace.desc}
                </div>
                <div style={{ fontSize: 10, color: 'var(--cinnabar)', marginTop: 6, opacity: active === key ? 1 : 0.6 }}>
                  {active === key ? '▲ 收起' : '▼ 展开'}
                </div>
              </div>
            )
          })}
        </div>

        <div className="meta-grid">
          <div className="meta"><div className="k">命主星曜</div><div className="v gold">{star.lord}</div></div>
          <div className="meta"><div className="k">身宫所在</div><div className="v gold">财帛 · 官禄之间</div></div>
          <div className="meta"><div className="k">命格色调</div><div className="v gold">{star.color} · {chart.dayMasterWx}</div></div>
          <div className="meta"><div className="k">当前流年</div><div className="v gold">紫微垣内 · 顺势而为</div></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, textAlign: 'center', padding: '14px 16px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.9 }}>
          紫微十二宫简览 · 结合八字命局生成 · 仅供自我探索参考
        </p>
      </div>
    </div>
  )
}
