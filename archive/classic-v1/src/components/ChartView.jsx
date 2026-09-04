import { TIAN_GAN, DI_ZHI, GAN_WUXING, ZHI_WUXING, WUXING_COLOR, WUXING_ICON, ZHI_CANGGAN } from '../data/ganzhi.js'
import { currentYearGanzhi } from '../engine/bazi.js'

const WX_LABEL = { 木: '木 · 仁', 火: '火 · 礼', 土: '土 · 信', 金: '金 · 义', 水: '水 · 智' }

export default function ChartView({ chart }) {
  const now = currentYearGanzhi()
  const total = Object.values(chart.wuxing).reduce((a, b) => a + b, 0)
  const strengthTxt = chart.strength.strong ? '身强' : chart.strength.weak ? '身弱' : '中和'

  return (
    <div className="rise">
      {/* 命盘卡 */}
      <div className="card chart-card">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="chart-head">
          <div className="name">{chart.dayMaster}日主 · {chart.shengxiao}肖</div>
          <div className="sub">
            {chart.year}年{chart.month}月{chart.day}日 · {chart.gender === '男' ? '乾造' : '坤造'}
          </div>
        </div>

        <div className="pillars">
          {chart.pillars.map(p => (
            <div key={p.label} className="pillar">
              <div className="wxb" style={{ background: WUXING_COLOR[GAN_WUXING[TIAN_GAN.indexOf(p.gan)]] }} />
              <div className="lab">{p.label}</div>
              <div className="gan" style={{ color: WUXING_COLOR[GAN_WUXING[TIAN_GAN.indexOf(p.gan)]] }}>{p.gan}</div>
              <div className="zhi" style={{ color: WUXING_COLOR[ZHI_WUXING[DI_ZHI.indexOf(p.zhi)]] }}>{p.zhi}</div>
              <div className="ss">{p.shiShen}</div>
              <div className="cang">{ZHI_CANGGAN[DI_ZHI.indexOf(p.zhi)].join('')}</div>
            </div>
          ))}
        </div>

        {/* 五行 */}
        <div className="wuxing-list">
          {chart.wuxingRank.map(wx => {
            const v = chart.wuxing[wx]
            const pct = Math.round((v / total) * 100)
            return (
              <div key={wx} className="wuxing-item">
                <div className="row">
                  <span className="name">{WUXING_ICON[wx]} {WX_LABEL[wx]}</span>
                  <span className="val">{pct}%</span>
                </div>
                <div className="bar" style={{ ['--wx-c']: WUXING_COLOR[wx] }}>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="meta-grid">
          <div className="meta">
            <div className="k">日主强弱</div>
            <div className="v gold">{strengthTxt}</div>
          </div>
          <div className="meta">
            <div className="k">喜用神</div>
            <div className="v gold">{chart.favorable.join('、')}</div>
          </div>
          <div className="meta">
            <div className="k">忌神</div>
            <div className="v">{chart.avoid.join('、')}</div>
          </div>
          <div className="meta">
            <div className="k">当前流年</div>
            <div className="v gold">{now.gan}{now.zhi} · {now.year}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, textAlign: 'center', padding: '16px 18px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.9, fontWeight: 300 }}>
          命盘已排定 · 切换上方「报告」查看详解，或到「咨询」与灵枢对话
        </p>
      </div>
    </div>
  )
}
