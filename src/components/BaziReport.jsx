import { useState } from 'react'

// 八字命理完整报告卡片（聊天内展示 + 导出）
export default function BaziReport({ report }) {
  const [copied, setCopied] = useState(false)
  if (!report || !report.ok) {
    return <div className="bazi-report br-error">{report?.error || '报告生成失败'}</div>
  }

  const exportMd = () => {
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `八字报告-${report.baziString.replace(/\s+/g, '')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }

  const p = report.pillars || []
  const dy = report.daYun
  const prof = report.profile || {}
  const gods = Object.keys(report.gods || {}).filter(k => (report.gods[k] || []).length)
  const chKeys = Object.keys(report.chonghe || {}).filter(k => report.chonghe[k])

  return (
    <div className="bazi-report">
      <div className="br-actions">
        <button className="br-btn" onClick={exportMd}>导出 Markdown</button>
        <button className="br-btn" onClick={copy}>{copied ? '已复制 ✓' : '复制报告'}</button>
      </div>

      <div className="br-head">
        <div className="br-title">八字命理完整报告</div>
        <div className="br-sub">
          {report.solar} ｜ 农历 {report.lunar} ｜ {report.gender} · {report.shengxiao}肖
        </div>
        <div className="br-bazi">
          {p.map(pl => <span className="br-bazi-char" key={pl.name}>{pl.gan.char}</span>)}
          <span className="br-bazi-zhi">{p.map(pl => pl.zhi.char).join(' ')}</span>
          <span className="br-daymaster">日主 {report.dayMaster} · {report.dayMasterWx}命</span>
        </div>
      </div>

      {/* 四柱排盘 */}
      <section className="br-section">
        <h4>一、四柱排盘</h4>
        <div className="br-pillars">
          {p.map(pl => (
            <div className="br-pillar" key={pl.name}>
              <div className="br-pillar-name">{pl.name}</div>
              <div className="br-pillar-gan">{pl.gan.char}<em>{pl.gan.ten}</em></div>
              <div className="br-pillar-zhi">{pl.zhi.char}<em>{pl.zhi.cang.map(c => c.char).join(' ')}</em></div>
              <div className="br-pillar-meta">纳音 {pl.nayin}</div>
              <div className="br-pillar-meta">{pl.kong ? `空亡 ${pl.kong}` : ''}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 十神配置 */}
      {report.tenGods.length > 0 && (
        <section className="br-section">
          <h4>二、十神配置</h4>
          <div className="br-chips">
            {Object.entries(report.tenGods.reduce((acc, t) => {
              (acc[t.ten] = acc[t.ten] || []).push(`${t.char}（${t.src.replace('天干', '干').replace('地支', '支')}）`)
              return acc
            }, {})).map(([ten, items]) => (
              <span className="br-chip" key={ten}><b>{ten}</b>{items.join('、')}</span>
            ))}
          </div>
        </section>
      )}

      {/* 大运排盘 */}
      <section className="br-section">
        <h4>三、大运排盘</h4>
        <p className="br-note">{report.dayMaster}日主 · 约 {dy.qiYunText || `${dy.qiYunAge} 岁`}起运（{dy.qiYunDate}）</p>
        <div className="br-table-wrap">
          <table className="br-table br-table-dy">
            <thead>
              <tr>
                <th>运程</th>
                <th>年龄</th>
                <th>天干</th>
                <th>地支</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {dy.list.map((d, i) => {
                const cur = dy.current && dy.current.干支 === d.干支 && dy.current.开始年份 === d.开始年份
                return (
                  <tr key={i} className={cur ? 'br-current' : ''}>
                    <td className="br-ganzhi">
                      {d.干支}
                      {cur && <span className="br-now-dot" aria-label="当前大运" />}
                    </td>
                    <td className="br-age">{d.开始年龄}-{d.结束年龄}</td>
                    <td>{d.天干十神}</td>
                    <td>{d.地支十神}</td>
                    <td>
                      <span className={`br-status br-status-${d.level || 'plain'}`}>
                        {d.icon && <span className="br-status-icon" aria-hidden="true">{d.icon}</span>}
                        <span className="br-status-text">{d.status || '平稳期'}</span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {dy.current && <p className="br-note br-highlight">当前正行 <b>{dy.current.干支}</b> 大运（{dy.current.天干十神}运），{dy.current.开始年龄}-{dy.current.结束年龄}岁。</p>}
      </section>

      {/* 命宫胎元 */}
      <section className="br-section br-inline">
        <h4>四、命宫与胎元</h4>
        <div className="br-kv">
          <span>命宫 <b>{report.minggong || '-'}</b></span>
          <span>身宫 <b>{report.shengong || '-'}</b></span>
          <span>胎元 <b>{report.taiyuan || '-'}</b></span>
          <span>胎息 <b>{report.taixi || '-'}</b></span>
        </div>
      </section>

      {/* 神煞 */}
      {gods.length > 0 && (
        <section className="br-section">
          <h4>五、神煞</h4>
          <div className="br-kv br-kv-col">
            {gods.map(k => <span key={k}><b>{k}</b>：{(report.gods[k] || []).join('、')}</span>)}
          </div>
        </section>
      )}

      {/* 刑冲合会 */}
      {chKeys.length > 0 && (
        <section className="br-section">
          <h4>六、刑冲合会</h4>
          <div className="br-kv br-kv-col">
            {chKeys.map(k => <span key={k}><b>{k}</b>：{report.chonghe[k]}</span>)}
          </div>
        </section>
      )}

      {/* 命局画像 */}
      <section className="br-section">
        <h4>七、命局画像</h4>
        <div className="br-kv br-kv-col">
          <span>身强身弱：<b>{prof.strength || '-'}</b></span>
          <span>喜用神：<b className="br-good">{(prof.favorable || []).join('、') || '-'}</b> ｜ 忌神：<b className="br-bad">{(prof.avoid || []).join('、') || '-'}</b></span>
          <span>事业类型：<b>{prof.careerType || '-'}</b>{prof.careerField ? `（${prof.careerField}）` : ''}</span>
          <span>感情特质：<b>{prof.loveTrait || '-'}</b>{prof.loveStar ? `（${prof.loveStar}）` : ''}</span>
          <span>健康关注：<b>{(prof.healthOrgans || []).join('、') || '-'}</b></span>
        </div>
      </section>

      {/* 流年运势 */}
      <section className="br-section">
        <h4>八、流年运势</h4>
        <div className="br-flow-cur">
          <div className="br-flow-year">{report.flow.year} 年 <b>{report.flow.ganzhi}</b></div>
          <p>{report.flow.note}</p>
        </div>
        <div className="br-flow-future">
          {report.future.map(f => (
            <div className="br-flow-card" key={f.year}>
              <div className="br-flow-year">{f.year} <b>{f.ganzhi}</b></div>
              <p>{f.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 开运建议 */}
      <section className="br-section br-advice">
        <h4>九、开运建议</h4>
        <div className="br-advice-item"><b>事业</b><p>{report.advice.career}</p></div>
        <div className="br-advice-item"><b>财运</b><p>{report.advice.wealth}</p></div>
        <div className="br-advice-item"><b>感情</b><p>{report.advice.love}</p></div>
        <div className="br-advice-item"><b>健康</b><p>{report.advice.health}</p></div>
        <div className="br-advice-item"><b>开运</b><p>{report.advice.opening}</p></div>
      </section>

      <div className="br-foot">本报告由元气AI 高精度排盘引擎生成，仅供娱乐与参考。</div>
    </div>
  )
}
