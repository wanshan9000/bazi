import { TIAN_GAN, WUXING_SHENG } from '../data/ganzhi.js'
import { currentYearGanzhi } from '../engine/bazi.js'

export default function Report({ chart }) {
  const dayMasterWx = chart.dayMasterWx
  const shengWo = Object.keys(WUXING_SHENG).find(k => WUXING_SHENG[k] === dayMasterWx)
  const weak = chart.strength.weak
  const strong = chart.strength.strong
  const nowGanzhi = currentYearGanzhi()

  const sections = [
    {
      icon: '🧬',
      title: '性格底色',
      body: (
        <>
          你是<b>{chart.dayMaster}日主</b>，五行属<b>{dayMasterWx}</b>。{dayMasterWx}性主「{dayMasterWx === '木' ? '仁，生发向上，柔韧而有主见' : dayMasterWx === '火' ? '礼，热烈明亮，真诚而有感染力' : dayMasterWx === '土' ? '信，厚德载物，稳重而值得托付' : dayMasterWx === '金' ? '义，刚毅果断，守正而有锋芒' : '智，圆融流动，聪慧而随机应变'}」。身{strong ? '强' : weak ? '弱' : '中和'}的你，{strong ? '行事有魄力、敢作敢当，但偶尔固执，需学会听取他人意见' : weak ? '心思细腻、善于借力，但易多虑，需给自己更多肯定' : '平衡稳健，外圆内方，是难得的中庸之才'}。
        </>
      )
    },
    {
      icon: '🧭',
      title: '天生赛道',
      body: (
        <>
          你的<b>日主{dayMasterWx}</b>决定了你最适合在<b>「{dayMasterWx === '木' ? '生长、创造' : dayMasterWx === '火' ? '表达、传播' : dayMasterWx === '土' ? '经营、承载' : dayMasterWx === '金' ? '规则、专业' : '流动、连接'}」</b>型的领域深耕。喜用神<b>{chart.favorable.join('、')}</b>所对应的行业与人脉，是你命中的贵人方向——多靠近它们，路会越走越宽。{shengWo}为你的印星，学习、考证、拜师之事多利，是终身可用的杠杆。
        </>
      )
    },
    {
      icon: '💰',
      title: '财运特征',
      body: (
        <>
          {strong ? '身强能任财，你有主动求财的底气和魄力，正财稳、偏财有机缘，但须防「财来财去」，设置好止损线、量入为出即可守成。' : '身弱财旺是你的课题，赚钱宜「借力」：合伙、跟投、深耕专业让钱追着你跑，切忌贪大冒进。'}今年<b>{nowGanzhi.year}年</b>财星状态平中有升，适合学习理财、经营副业，把基础打牢再图突破。
        </>
      )
    },
    {
      icon: '❤️',
      title: '感情指南',
      body: (
        <>
          你的夫妻宫坐<b>{chart.pillars[2].zhi}</b>，感情上你{strong ? '习惯主导，需要学会为对方留出表达的空间' : '细腻敏感，需要一个能给你安全感的坚定选择'}。喜<b>{chart.favorable.join('、')}</b>的你，良缘多出现在与喜用神相关的场合与人群中。感情讲「合」不讲「争」，多包容、少较劲，姻缘自会水到渠成。
        </>
      )
    },
    {
      icon: '🌿',
      title: '健康提醒',
      body: (
        <>
          你的<b>{dayMasterWx}</b>命，需重点养护{dayMasterWx === '木' ? '肝胆与眼睛，忌熬夜，宜早睡早起舒展筋骨' : dayMasterWx === '火' ? '心与血脉，忌急躁上火，宜静心冥想、规律作息' : dayMasterWx === '土' ? '脾胃，忌思虑过重与暴饮暴食，宜细嚼慢咽' : dayMasterWx === '金' ? '肺与皮肤，忌干燥与悲忧，宜润肺养阴、常做深呼吸' : '肾与骨骼，忌久坐耗神，宜多活动、注意保暖' }。身{strong ? '强' : weak ? '弱' : '中和'}之人，{strong ? '精力充沛但易透支，节律是关键' : '体质偏敏，规律养护胜过猛补'}。
        </>
      )
    },
    {
      icon: '🌟',
      title: '今年流年',
      body: (
        <>
          当前流年为<b>{nowGanzhi.gan}{nowGanzhi.zhi}</b>（{nowGanzhi.year}年），与你的日柱形成相应生克关系。整体而言，今年是「<b>顺势而为</b>」的一年：<b>旺{chart.favorable.join('、')}</b>之事可放手去做，<b>忌{chart.avoid.join('、')}</b>之事需谨慎对待。把注意力放在长期复利的事情上，把现金流管住，这一年便是你的吉年。
        </>
      )
    }
  ]

  const fav = chart.favorable[0]
  const favColorMap = { 木: '#7fb069', 火: '#e0603f', 土: '#c9a227', 金: '#d8c9a3', 水: '#5b8fb9' }

  return (
    <div className="rise">
      {/* 开运卡 */}
      <div className="card chart-card" style={{ marginBottom: 14 }}>
        <div className="corner tl" /><div className="corner br" />
        <div className="chart-head">
          <div className="name" style={{ fontSize: 20 }}>
            ✦ 开运锦囊 ✦
          </div>
          <div className="sub">喜用 · 宜亲近</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {chart.favorable.map(w => (
            <span key={w} className="fav-pill good" style={{ borderColor: favColorMap[w] }}>{w}</span>
          ))}
        </div>
        <div className="sub" style={{ marginBottom: 8 }}>忌神 · 宜规避</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {chart.avoid.map(w => (
            <span key={w} className="fav-pill bad">{w}</span>
          ))}
        </div>
        <div className="meta-grid" style={{ marginTop: 18 }}>
          <div className="meta">
            <div className="k">幸运色</div>
            <div className="v gold">{ { 木: '青绿', 火: '红紫', 土: '黄棕', 金: '白金', 水: '黑蓝' }[fav] }</div>
          </div>
          <div className="meta">
            <div className="k">幸运方位</div>
            <div className="v gold">{ { 木: '东方', 火: '南方', 土: '中原', 金: '西方', 水: '北方' }[fav] }</div>
          </div>
          <div className="meta">
            <div className="k">幸运数字</div>
            <div className="v gold">{ { 木: '3 · 8', 火: '2 · 7', 土: '5 · 10', 金: '4 · 9', 水: '1 · 6' }[fav] }</div>
          </div>
          <div className="meta">
            <div className="k">贵人生肖</div>
            <div className="v gold">{ { 木: '虎 · 兔 · 猪', 火: '蛇 · 马 · 羊', 土: '龙 · 狗 · 牛', 金: '猴 · 鸡 · 鼠', 水: '猪 · 鼠 · 鸡' }[fav] }</div>
          </div>
        </div>
      </div>

      {sections.map(s => (
        <div key={s.title} className="card report-sec">
          <div className="corner tr" /><div className="corner bl" />
          <h3><span className="ico">{s.icon}</span>{s.title}</h3>
          <p>{s.body}</p>
        </div>
      ))}

      <div className="card" style={{ marginTop: 14, textAlign: 'center', padding: '16px 18px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.9, fontWeight: 300 }}>
          以上解读基于你的生辰命盘生成 · 命理仅供参考，人生由你书写
        </p>
      </div>
    </div>
  )
}
