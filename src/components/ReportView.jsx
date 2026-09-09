import { cloneElement, forwardRef, Fragment, useEffect, useImperativeHandle, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'

// 统一报告渲染器：消费 reportSchema 统一结构（sections + advice）
// 支持区块 kind：baziPillars / table / chips / kv / cards / flow / note
// 每个门类拥有独立的主题色 accent，报告头部带印章徽章，区块编号徽章化并交错入场

const BR_ACCENT = {
  // 八字两派改用低饱和传统色：子平取黛（青紫），盲派取檀（茶褐），
  // 整体降饱和、去荧光，让版面靠层次与留白立质感，而非靠彩度抢眼。
  bazi:     { hex: '#6b6480', rgb: '107, 100, 128' },  // 黛（青灰紫，沉静文雅）
  mangpai:  { hex: '#8a7358', rgb: '138, 115, 88' },   // 檀（茶褐，古朴温润）
  ziwei:    { hex: '#8b6fc4', rgb: '139, 111, 196' },  // 星紫
  liuyao:   { hex: '#4f7fa0', rgb: '79, 127, 160' },   // 墨青
  qimen:    { hex: '#d14b5e', rgb: '209, 75, 94' },    // 朱砂
  huangli:  { hex: '#b08a3e', rgb: '176, 138, 62' },   // 金褐
  tarot:    { hex: '#6a5fae', rgb: '106, 95, 174' },   // 靛蓝
  name:     { hex: '#4a9d86', rgb: '74, 157, 134' },   // 青绿
  fengshui: { hex: '#a07a4a', rgb: '160, 122, 74' },   // 土棕
  hehun:    { hex: '#e070a0', rgb: '224, 112, 160' },  // 胭脂
  zejiri:   { hex: '#c99a3f', rgb: '201, 154, 63' },   // 鎏金
  consult:  { hex: '#6b7fd7', rgb: '107, 127, 215' },  // 会诊靛
}

const NUM_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

// 视觉宽度：汉字/全角/emoji/特殊符号（渲染约占 1 个汉字宽）按 2 计；英文/数字/半角按 1 计。
// 用于：① 按列内容动态分配列宽；② 判定短列（<5 视觉宽度）强制单行不换行、长列允许换行。
const dispWidth = (s) => {
  const t = (s || '').toString()
  let w = 0
  for (const ch of t) {
    if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\u2600-\u27ff\u2e80-\u2fff\u2022\u00b7\u2660\u2663\u2665\u2666\ufe0f]/.test(ch)) w += 2
    else if (/[\u{1F000}-\u{1FAFF}\u{1F300}-\u{1F64F}]/u.test(ch)) w += 2
    else w += 1
  }
  return Math.max(1, w)
}

// 列宽分配：完全按"列内各单元格内容的最大视觉宽度"等比分配（宽列宽、窄列窄），
// 表头较长（≥5 汉字）的列额外保底，避免长表头被折行。
// 返回与列数等长的百分比数组（精确凑成 100）。
const planColumnWidths = (headers, rows) => {
  const colWidth = headers.map((_, j) => {
    let mx = 0
    rows.forEach((r) => { const v = (r || [])[j]; const w = dispWidth(v); if (w > mx) mx = w })
    mx = Math.max(mx, dispWidth(headers[j]))
    return mx
  })
  const totalW = colWidth.reduce((a, b) => a + b, 0) || headers.length
  const MIN_PCT = 5
  // 3-4 汉字的"短词列"（dispWidth 6~8，如「遁根最远/坐支贴身」）保底 14% 列宽，
  // 否则 nowrap + 列宽不够会溢出/截断。单字/2字列保留原 MIN_PCT=5%。
  const SHORT_COL_MIN_PCT = 14
  const rawPct = colWidth.map((w) => (w / totalW) * 100)
  const headWd = headers.map((hd) => dispWidth(hd))
  const longHead = headWd.map((w) => w >= 10)
  const floor = rawPct.map((_, j) => {
    if (longHead[j]) return Math.max(MIN_PCT, headWd[j] * 0.9)
    if (colWidth[j] >= 6 && colWidth[j] <= 8) return Math.max(SHORT_COL_MIN_PCT, headWd[j] * 1.0)
    return MIN_PCT
  })
  const clamped = rawPct.map((p, j) => Math.max(floor[j], p))
  const excess = clamped.reduce((a, b) => a + b, 0) - 100
  let widths = [...clamped]
  if (excess > 0) {
    let remain = Math.round(excess * 100) / 100
    let guard = 0
    while (remain > 0.5 && guard < 400) {
      guard++
      let best = -1, bestGap = -1
      widths.forEach((w, j) => {
        const gap = w - floor[j]
        if (gap > bestGap) { bestGap = gap; best = j }
      })
      if (best === -1 || bestGap <= 0) break
      const cut = Math.min(1, bestGap, remain)
      widths[best] -= cut
      remain -= cut
    }
    if (remain > 0) {
      const maxIdx = widths.indexOf(Math.max(...widths))
      widths[maxIdx] = Math.max(MIN_PCT, widths[maxIdx] - remain)
    }
  }
  widths = widths.map((w) => Math.round(w))
  const sumW = widths.reduce((a, b) => a + b, 0)
  if (sumW !== 100 && widths.length) widths[widths.length - 1] += (100 - sumW)
  return widths
}

// ── 双轨解释说明：专业术语（可心服）+ 老百姓白话（看得懂）──────────────────
// 用法：字段可以是
//   字符串               → 原样输出（沿用现状）
//   {term, plain}        → 术语层（术语徽标）+ 白话层（"大白话：…"）
//   带「【白话】」的行    → 术语段落 + 白话段落自动分轨
// 让"玄学专业术语 + 老百姓常用话术"在同一条说明里并轨，既显专业又接地气。
// 术语层与白话层合并为单段：白话作正文，术语降级为小字注解。
// 两层措辞不同（互补而非重复），简单拼接只省 ~2%，故采用"主次分层"而非删层——
// 既合并为一个视觉单元，又不丢术语层的精确数据（分数/干支/神煞名目）。
// 若术语层已被白话层完整覆盖，则只留白话层，避免同义重复。
function BrNote({ children }) {
  if (children == null || children === '') return null
  // 长 term 自动按分号切段 + mdLite 解析 **xx**，便于阅读
  const renderTerm = (t) => {
    const segs = splitLongText(t, 100)
    if (segs.length <= 1) return <span className="br-dual-term">{mdLite(segs[0] || '')}</span>
    return (
      <div className="br-zlong">
        {segs.map((s, i) => (
          <span key={i} className="br-zlong-item">{mdLite(s)}</span>
        ))}
      </div>
    )
  }
  // 对象形态 {term, plain}
  if (typeof children === 'object' && !Array.isArray(children)) {
    const { term, plain } = children
    return (
      <div className="br-note br-note-dual br-note-fused">
        {plain ? <span className="br-dual-plain">{mdLite(plain)}</span> : null}
        {term ? renderTerm(term) : null}
      </div>
    )
  }
  const text = String(children)
  // 字符串内【白话】分轨：把【白话】之后的内容作为白话层
  const zi = text.indexOf('【白话】')
  if (zi >= 0) {
    const term = text.slice(0, zi)
    const plain = text.slice(zi + 4)
    return (
      <div className="br-note br-note-dual">
        {renderTerm(term)}
        <span className="br-dual-plain">{mdLite(plain)}</span>
      </div>
    )
  }
  // 普通字符串：原样 + mdLite
  return <p className="br-note">{mdLite(text)}</p>
}

// 五行色：统一降饱和，收敛到同一灰度带内（青绿—赭红—土黄—灰—蓝灰），
// 保留五行辨识度，但不再各自抢眼，避免整版出现五种高饱和撞色。
const wxColor = wx => ({
  木: '#5f7a68', 火: '#a4645f', 土: '#94805e',
  金: '#7c7973', 水: '#5d7382'
}[wx] || '#8a827a')

// 轻量 markdown 解析：仅处理 **bold**，把字符串拆成 React 节点数组。
// 不引第三方依赖，刻意避开原样渲染 **xx**（盲派报告中 `**正印**` 等）的常见痛点。
function mdLite(text) {
  if (text == null || text === '') return null
  const s = String(text)
  if (!s.includes('**')) return s  // 快速路径：无标记直接返回原字符串
  const parts = []
  const re = /\*\*([^*]{1,40})\*\*/g
  let last = 0, m, k = 0
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(<Fragment key={'t' + k++}>{s.slice(last, m.index)}</Fragment>)
    parts.push(<b key={'b' + k++} className="br-md-bold">{m[1]}</b>)
    last = m.index + m[0].length
  }
  if (last < s.length) parts.push(<Fragment key={'t' + k++}>{s.slice(last)}</Fragment>)
  return parts
}

// ═══ 子平派「重要信息高亮」：关键词 → 语义色 ════════════════════════
// good=用神/喜神（绿）  bad=忌神/最忌（赭红）  up=身强/旺（暖赭）
// dn=身弱/弱（灰蓝）    key=调候/格局等关键结论（朱红）
const ZIP_HL = [
  ['最忌', 'bad'], ['用神', 'good'], ['喜神', 'good'], ['忌神', 'bad'],
  ['身极弱', 'dn'], ['身极旺', 'up'], ['身偏弱', 'dn'], ['身偏旺', 'up'],
  ['身强', 'up'], ['身弱', 'dn'], ['偏旺', 'up'], ['偏弱', 'dn'], ['极旺', 'up'], ['极弱', 'dn'], ['中和', 'mid'],
  ['调候', 'key'], ['得令', 'good'], ['得地', 'good'], ['得势', 'good'], ['失令', 'bad'], ['失地', 'bad'],
]
// 盲派「重要信息」：做功/象义/技法词 → 语义色
// good=高潜力/贵人（绿） bad=官非暗损（赭红） up=旺/得财（暖赭） key=做功/结构/技法（朱红）
const BLIND_HL = [
  ['A级', 'good'], ['能拿大头', 'good'], ['贵人', 'good'], ['得财', 'good'], ['成事', 'good'], ['吉', 'good'],
  ['官非', 'bad'], ['暗疾', 'bad'], ['暗损', 'bad'], ['差口气', 'bad'], ['纠纷', 'bad'], ['官司', 'bad'], ['刑罚', 'bad'], ['暗亏', 'bad'],
  ['做功', 'key'], ['体克用', 'key'], ['用克体', 'key'], ['墓库', 'key'], ['空亡', 'key'], ['自刑', 'key'], ['三刑', 'key'], ['六害', 'key'], ['纳音', 'key'],
  ['七杀', 'key'], ['正官', 'key'], ['偏财', 'key'], ['正财', 'key'], ['比劫', 'key'], ['伤官', 'key'],
]
// 在纯文本段内对关键词加高亮 span（不破坏 mdLite 的加粗结构）
function hlSegment(text, dict) {
  let s = String(text == null ? '' : text)
  if (!s) return null
  const parts = []
  let guard = 0
  while (s && guard++ < 30) {
    let best = null
    for (const [kw, cls] of (dict || ZIP_HL)) {
      const idx = s.indexOf(kw)
      if (idx >= 0 && (best === null || idx < best.idx)) best = { idx, len: kw.length, cls, kw }
    }
    if (!best) { parts.push(s); break }
    if (best.idx > 0) parts.push(s.slice(0, best.idx))
    parts.push(<span key={'hl' + parts.length} className={'br-hl hl-' + best.cls}>{best.kw}</span>)
    s = s.slice(best.idx + best.len)
  }
  return parts
}
// 处理 **加粗** + 关键词高亮；dict 缺省用子平词表，盲派传 BLIND_HL
function mdHl(text, dict) {
  if (text == null || text === '') return null
  const s = String(text)
  if (!s.includes('**')) return hlSegment(s, dict)  // 快速路径：仅关键词高亮
  const parts = []
  const re = /\*\*([^*]{1,40})\*\*/g
  let last = 0, m, k = 0
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(<Fragment key={'t' + k++}>{hlSegment(s.slice(last, m.index), dict)}</Fragment>)
    parts.push(<b key={'b' + k++} className="br-md-bold">{m[1]}</b>)
    last = m.index + m[0].length
  }
  if (last < s.length) parts.push(<Fragment key={'t' + k++}>{hlSegment(s.slice(last), dict)}</Fragment>)
  return parts
}

// 长文本自动分段：避免「一坨 300+ 字不分行」的致命阅读体验。
// 优先级 — 1) \n\n 已分段 → 按段落；  2) 含 ； 时按分号切；
//           3) 段仍 > 150 字时按「。」句号切； 4) 段仍 > 200 字时按「，」二级切。
// 顿号「、」默认不切 — 玄学文本里常常连用"文职/教育/房产"，切开反而支离破碎。
function splitLongText(text, maxSeg = 110) {
  const s = String(text || '').trim()
  if (!s) return []
  if (s.length <= maxSeg) return [s]
  if (s.includes('\n\n')) return s.split(/\n\n+/).map(t => t.trim()).filter(Boolean)
  // 一级：分号（玄学报告最常见的"主题分隔符"）
  if (s.includes('；')) {
    const segs = s.split('；').map((t, i, arr) => i < arr.length - 1 ? t + '；' : t).map(t => t.trim()).filter(Boolean)
    return segs.flatMap(g => g.length > 150 ? splitByPeriod(g) : [g])
  }
  // 一级切不动：句号
  if (s.includes('。')) return splitByPeriod(s)
  // 兜底：逗号
  if (s.includes('，')) return splitByComma(s)
  return [s]
}
function splitByPeriod(text) {
  const segs = text.split('。').map((t, i, arr) => i < arr.length - 1 ? t + '。' : t).map(t => t.trim()).filter(Boolean)
  return segs.flatMap(g => g.length > 200 ? splitByComma(g) : [g])
}
function splitByComma(text) {
  const segs = text.split('，').map((t, i, arr) => i < arr.length - 1 ? t + '，' : t).map(t => t.trim()).filter(Boolean)
  return segs.flatMap(g => g.length > 130 ? [g] : [g])
}

// 旺衰等级 / 喜忌类别 → 色标色调（表格单元格自动着色）
// 只保留 4 档语义色：偏旺(暖赭) / 中和(灰) / 偏弱(灰蓝) / 吉(青) / 凶(赭红)。
// 刻意不再按"极旺/旺/偏旺/弱/极弱"细分 6 档——档位太多会让整版变成调色盘，
// 改为"旺—平—弱"三档语义 + 吉凶两色，靠文字区分程度，靠颜色只传达方向。
const LEVEL_TONE = {
  极旺: 'lv-up', 旺: 'lv-up', 偏旺: 'lv-up',
  中和: 'lv-mid',
  偏弱: 'lv-dn', 弱: 'lv-dn', 极弱: 'lv-dn',
  用神: 'lv-good', 喜神: 'lv-good', 忌神: 'lv-bad', 最忌: 'lv-bad',
}
const levelTone = txt => LEVEL_TONE[String(txt ?? '').trim()] || null

// 各门类关键信息概览条字段（取自 report.meta）
const META_ORDER = {
  bazi:    [['baziString', '四柱'], ['solar', '出生'], ['gender', '性别'], ['shengxiao', '生肖'], ['dayMaster', '日主'], ['dayMasterWx', '五行']],
  mangpai: [['baziString', '四柱'], ['solar', '出生'], ['gender', '性别'], ['shengxiao', '生肖'], ['dayMaster', '日主']],
  ziwei:   [['baziString', '命盘'], ['solar', '出生'], ['gender', '性别'], ['shengxiao', '生肖']],
  liuyao:  [['question', '所问'], ['n', '报数'], ['gua', '卦象']],
  huangli: [['date', '日期'], ['lunar', '农历'], ['yiji', '宜忌']],
}

const ReportViewBody = forwardRef(function ReportViewBody({ report, lead, hideLead = false, readonly = false }, ref) {
  const [copied, setCopied] = useState(false)
  const [showTop, setShowTop] = useState(false)

  const accent = BR_ACCENT[report.type] || BR_ACCENT.qimen
  const style = { '--br-accent': accent.hex, '--br-accent-rgb': accent.rgb }

  // 返回顶部按钮：滚动超过阈值后浮现
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 560)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 章节导航：平滑滚动到对应单元
  const jumpTo = key => {
    const el = document.getElementById(`br-sec-${key}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const metaItems = ((META_ORDER[report.type] || []))
    // ⚠ META_ORDER 的每一项是 [字段名, 显示标签]，此前解构成 [label, key] 正好写反：
    // 拿显示标签去 report.meta 里取值，永远取不到，概览条一直是空的。
    .map(([key, label]) => {
      const v = report.meta && report.meta[key]
      if (v === undefined || v === null || v === '') return null
      return { label, value: Array.isArray(v) ? v.join('、') : String(v) }
    })
    .filter(Boolean)



  // 生成完整纯文本报告（markdown → 纯文本 + 头部信息），供复制 / 下载
  const buildFullText = () => {
    const title = report.title || '测算报告'
    const sub = report.sub || ''
    const d = new Date()
    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    // 去除 markdown 标记，保留章节结构与正文
    const clean = (report.markdown || '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^\s*[-*]\s+/gm, '· ')
      .replace(/^\s*>\s?/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return [
      `【${title}】`,
      sub ? `【${sub}】` : '',
      `生成日期：${dateStr}`,
      '',
      clean,
      '',
      '—— 元氣满满 · 仅供娱乐参考 ——'
    ].filter(Boolean).join('\n')
  }

  // 下载：导出完整报告纯文本（.txt）
  const exportMd = () => {
    const blob = new Blob([buildFullText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(report.title || '测算报告').replace(/\s+/g, '')}-${report.sub ? report.sub.slice(0, 10).replace(/[^\d-]/g, '') : ''}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 复制：复制完整报告纯文本
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildFullText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }

  // 分享：生成一个"只读报告链接 + 二维码"。
  // 优先把报告提交到后端换取短链（二维码能承载），失败时降级为把完整报告
  // 序列化到 URL hash 的长链（仅复制，不做二维码，避免超限）。
  const [shared, setShared] = useState(false)
  const [shareModal, setShareModal] = useState(null) // { url, qr, title }
  const [linkCopied, setLinkCopied] = useState(false)
  // 「查看推理依据」折叠块（仅大模型综合报告有 basis 时展示，默认收起）
  const [showBasis, setShowBasis] = useState(false)

  const base = typeof window !== 'undefined' ? window.location.origin : ''

  // 通过后端把报告存成短链；后端不可用返回 null
  const buildShortShareUrl = async () => {
    try {
      const json = JSON.stringify(report)
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: json }),
      })
      if (!res.ok) return null
      const data = await res.json()
      if (!data.ok || !data.id) return null
      return `${base}/#share-id=${data.id}`
    } catch { return null }
  }

  // 兜底长链：完整报告序列化到 URL hash
  const buildFullShareUrl = () => {
    const json = JSON.stringify(report)
    const encoded = typeof btoa !== 'undefined'
      ? btoa(unescape(encodeURIComponent(json)))
      : encodeURIComponent(json)
    return `${base}/#share=${encoded}`
  }

  const share = async () => {
    try {
      const title = report.title || '测算报告'
      // 移动端：优先用原生 Web Share API（可直接唤起微信/QQ/系统分享）
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          const text = (report.markdown || '').split('\n').slice(0, 6).join('\n').replace(/[#*>`]/g, '').trim()
          // ⚠ 这里原先分享的是 `base`，也就是站点首页 —— 收件人点开只看到落地页，
          // 根本打不开这份报告。必须带上真正的报告链接：优先服务端短链，
          // 后端不可用时退回自包含的 #share= 长链。
          let shareUrl = null
          try { shareUrl = await buildShortShareUrl() } catch { shareUrl = null }
          if (!shareUrl) {
            try { shareUrl = buildFullShareUrl() } catch { shareUrl = base }
          }
          await navigator.share({
            title,
            text: `${title}\n\n${text}\n\n这是一份只读报告，访客可阅读但不能再次转发 ↗`,
            url: shareUrl
          })
          setShared(true)
          setTimeout(() => setShared(false), 1600)
          return
        } catch { /* 用户取消则继续走弹窗 */ }
      }
      // 桌面端：先用短链生成二维码；后端不可用则降级为复制长链
      let short = null
      try { short = await buildShortShareUrl() } catch { short = null }
      if (short) {
        const qr = await QRCode.toDataURL(short, { width: 240, margin: 1, color: { dark: '#3d2b47', light: '#ffffff' } })
        setShareModal({ url: short, qr, title, short: true })
        return
      }
      // 降级：后端不可用，弹出含长链的分享面板（无二维码），供复制
      let longUrl
      try { longUrl = buildFullShareUrl() } catch { longUrl = `${base}#share=${Date.now()}` }
      setShareModal({ url: longUrl, qr: null, title, short: false })
    } catch {
      // 兜底：任何异常都降级为可复制的分享面板，避免整页报错
      setShareModal({ url: `${base}#share=${Date.now()}`, qr: null, title: report.title || '测算报告', short: false })
    }
  }

  const copyLink = async () => {
    if (!shareModal) return
    try {
      await navigator.clipboard.writeText(shareModal.url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1600)
    } catch { /* ignore */ }
  }

  // 下载：将 Markdown 文件直接下载到本地（与导出 Markdown 行为一致）
  const download = () => exportMd()

  // 暴露给父组件：当 hideLead=true 时，外部 ChartBoard 通过 ref 触发这些 handler
  useImperativeHandle(ref, () => ({
    exportMd,
    copy,
    share
  }), [report, accent, metaItems])

  // ── 小节渲染器：kvComposite 容器内的「2.1 / 3.1」这类子块 ────────────────
  // 长文本（超过 LONG_TEXT 字）从「行内键值对网格」自动降级为「标签徽章 + 整块正文」
  // 的纵向卡片，避免上百字的判定依据、用神说明挤在窄网格列里难以阅读。
  const LONG_TEXT = 28

  // 抽离 dayunGroup 卡片组的渲染：可被顶层 section（盲派"第七卷"）和子节（子平派"4.3 限运流年"）复用
  const renderDayunGroup = ({ dayuns = [], liunianRows = [] }) => (
    <>
      {/* 重点流年：高亮卡片组 */}
      {liunianRows.length > 0 && (
        <div className="br-dy-group">
          <div className="br-dy-group-title">
            <span className="br-dy-group-dot is-alert" />
            <b>重点流年</b>
            <span className="br-dy-group-hint">未来几年里有合冲 / 财官到位 / 填实 / 变动的年份，先看下面这几张</span>
          </div>
          <div className="br-palace-grid cols-3">
            {liunianRows.map((r, i) => {
              const [yr, gz, evt] = r
              const evtStr = String(evt || '')
              const isFlat = /平顺|无大波澜/.test(evtStr)
              const tone = isFlat ? '' : 'tone-good'
              return (
                <div className={`br-palace-card ${tone} is-keyflow`} key={i}>
                  <div className="br-palace-head">
                    <b className="br-palace-name">{yr} · {gz}</b>
                    <span className="br-palace-mark">{isFlat ? '守成' : '应事'}</span>
                  </div>
                  <div className="br-palace-desc">{mdLite(evtStr)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* 大运全览：每张卡是一个十年窗口；重点大运（用神到位/比劫当旺）在卡片内直接高亮 */}
      {dayuns.length > 0 && (
        <div className="br-dy-group">
          <div className="br-dy-group-title">
            <span className="br-dy-group-dot" />
            <b>大运全览</b>
            <span className="br-dy-group-hint">标「用神到位 / 比劫当旺 / 当前」的即为要盯紧的重点大运，其余是平运节奏</span>
          </div>
          <div className="br-palace-grid cols-3">
            {dayuns.map((it, i) => renderPalaceCard(it, i))}
          </div>
        </div>
      )}
    </>
  )

  const renderSubSection = (sub, pk) => {
    if (!sub) return null
    const key = `${pk}-${sub.key || 'sub'}`
    const head = sub.title ? <div className="br-zsub-title">{sub.title}</div> : null

    if (sub.kind === 'dayunGroup') {
      const { dayuns = [], liunianRows = [] } = sub.data || {}
      return (
        <div className="br-zsub" key={key}>
          {head}
          {sub.note ? <BrNote>{sub.note}</BrNote> : null}
          {renderDayunGroup({ dayuns, liunianRows })}
        </div>
      )
    }

    // ── dayunDetail：「当前/下一步大运」三列网格卡片 + 关键年份内嵌子表 ──
    // 每张卡：卡头(大字干支 + 右上状态chip) + 解读段落；综合判断卡用金色边框+顶部★高亮。
    if (sub.kind === 'dayunDetail') {
      const { cards = [], keyYears = [], state = 'now' } = sub.data || {}
      const isNow = state === 'now'
      const badge = isNow
        ? <span className="br-dy-badge br-dy-badge-now">NOW</span>
        : <span className="br-dy-badge br-dy-badge-next">NEXT</span>
      return (
        <div className="br-zsub" key={key}>
          {head}
          <div className="br-dyd-grid">
            {cards.map((c, i) => {
              const keyed = !!c.key
              const ss = Array.isArray(c.shiShen) ? c.shiShen : (c.shiShen ? [c.shiShen] : [])
              const subTxt = c.wx ? `${c.wx}` : ''
              return (
                <div className={`br-dyd-card${keyed ? ' br-dyd-card-key' : ''}`} key={i}>
                  <div className="br-dyd-head">
                    <div className="br-dyd-ttl">
                      <span className="br-dyd-name">{c.name}</span>
                      <span className="br-dyd-gz">{c.gz}<sub>{subTxt}</sub></span>
                    </div>
                    <div className="br-dyd-chips">
                      {keyed
                        ? badge
                        : ss.map((s, si) => (
                            <span className="br-dyd-chip" key={si}>{s}</span>
                          ))}
                    </div>
                  </div>
                  <p className="br-dyd-desc">{c.desc}</p>
                </div>
              )
            })}
          </div>
          {/* 关键年份表已移除：用户要求删除「关键年份·N 个节点」区块 */}
          {sub.note ? <BrNote>{sub.note}</BrNote> : null}
        </div>
      )
    }

    if (sub.kind === 'table') {
      const tableCls = `br-table ${sub.data?.className || ''}`.trim()
      const headers = sub.data?.headers || []
      const rows = sub.data?.rows || []
      // 列宽策略：若 engine 显式给出 colWidths（字符串数组，含 %/px）则原样使用——
      // 解决"短内容+徽章/长说明"混排表（如喜忌总表）按 dispWidth 算出的首列宽度过窄，
      // lv 徽章被挤竖排的问题。否则按"列内各单元格内容的实际字数"动态分配
      // （与盲派顶层表格一致）：字数多的列宽，字数少的列窄，从而短词不换行、长描述列舒展。
      const explicitWidths = Array.isArray(sub.data?.colWidths) ? sub.data.colWidths : null
      const widths = explicitWidths || planColumnWidths(headers, rows).map(w => `${w}%`)
      const isKpi = sub.data?.className === 'br-table-kpi'
      return (
        <div className="br-zsub" key={key}>
          {head}
          {/* 表格类小节：先给一段"导语"（参考盲派卷首·基础数据的版式：先一句话总评，再表格），
              再上表格，便于读者先有心理预期，再看数据。 */}
          {sub.note ? <BrNote>{sub.note}</BrNote> : null}
          <div className="br-table-wrap">
            <table className={tableCls}>
              <colgroup>
                {isKpi
                  ? (<><col style={{ width: '140px' }} />{headers.slice(1).map((_, i) => <col key={i} />)}</>)
                  : headers.map((_, i) => <col key={i} style={{ width: widths[i] }} />)}
              </colgroup>
              <thead><tr>{headers.map((hd, j) => (
                // 表头少于 5 个字（含数字/符号，如「年份」「干支」「状态」）→ 单行不换行
                <th key={hd} className={dispWidth(hd) < 5 ? 'br-th-short' : ''}>{hd}</th>
              ))}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={sub.data?.current === i ? 'br-current' : ''}>
                    {(r || []).map((c, j) => {
                      // 与盲派顶层表格一致：按单元格自身内容判定短列——视觉宽度 ≤8（≤4 汉字）的短词
                      // （年份「2026」/干支「戊申」/单字✅/4 字档位词「遁根最远」等）或无汉字内容 → 单行不换行；
                      // 较长文本（含汉字且视觉宽度 >8）走可换行的描述列
                      const isShort = dispWidth(c) <= 8 || !/[\u4e00-\u9fa5]/.test((c || '').toString())
                      // 干支列（第 2 列且内容为天干/地支汉字）用衬线粗体；非干支短词（如「数量」的数字）
                      // 不加 br-ganzhi，避免数字被衬线化拉伸
                      const isGanZhi = j === 1 && /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]+$/.test((c || '').toString())
                      const cls = [
                        j === 0 ? 'br-td-k' : '',
                        isGanZhi ? 'br-ganzhi' : '',
                        isShort ? 'br-td-short' : 'br-td-wrap',
                      ].filter(Boolean).join(' ')
                      const tone = levelTone(c)
                      return (
                        <td key={j} className={cls}>
                          {tone ? <span className={`br-lv ${tone}`}>{c}</span> : (c || '')}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── kvCard：「数量 / 状态」紧凑双列 +「解读 / 健康提示」整段铺开 ──
    // 解决通用 kv 自动网格在"短项+长项"混排时挤压/换行尴尬的问题。
    if (sub.kind === 'kvCard') {
      const blocks = (sub.data?.blocks || []).filter(it => it && it.v != null && it.v !== '')
      const headItems = blocks.slice(0, 2)
      const bodyItems = blocks.slice(2)
      return (
        <div className="br-zsub" key={key}>
          {head}
          <div className="br-kvc">
            <div className="br-kvc-head">
              {headItems.map((it, i) => (
                <div className="br-kvc-cell" key={i}>
                  <span className="br-kvc-k">{it.k}</span>
                  <span className={`br-kvc-v ${it.tone === 'good' ? 'br-good' : it.tone === 'bad' ? 'br-bad' : ''}`}>{it.v}</span>
                </div>
              ))}
            </div>
            {bodyItems.length > 0 && (
              <div className="br-kvc-body">
                {bodyItems.map((it, i) => (
                  <div className="br-kvc-row" key={i}>
                    <span className="br-kvc-row-k">{it.k}</span>
                    <span className="br-kvc-row-v">{it.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {sub.note ? <BrNote>{sub.note}</BrNote> : null}
        </div>
      )
    }

    if (sub.kind === 'liuTong') {
      // 兼容旧 diagram 字符串与新的结构化 data
      let nodes = [], stream = [], conflicts = sub.data?.conflicts || []
      if (Array.isArray(sub.data?.chain)) {
        nodes = sub.data.chain
        stream = sub.data.stream || []
      } else {
        // 回退：从老 diagram 字符串解析
        const raw = String(sub.data?.diagram || '')
        const lines = raw.split('\n')
        nodes = Array.from((lines[0] || '').matchAll(/([木火土金水])（([\d.]+)）/g))
          .map(m => ({ wx: m[1], v: Number(m[2]) }))
        stream = lines.slice(1).filter(l => l.trim())
      }
      return (
        <div className="br-zsub" key={key}>
          {head}
          <div className="br-lt">
            {/* 五行力量排序（从旺到弱）：每个节点带分数 + 强弱徽章 */}
            <div className="br-lt-cap">五行力量座次（由旺至弱）</div>
            {nodes.length > 0 ? (
              <div className="br-lt-chain">
                {nodes.map((n, i) => (
                  <Fragment key={n.wx}>
                    {i > 0 && <span className="br-lt-arrow">→</span>}
                    <span className="br-lt-node" style={{ '--lt-c': wxColor(n.wx) }}>
                      <b className="br-lt-wx">{n.wx}</b>
                      <em className="br-lt-v">{n.v}</em>
                      {n.level && <span className={`br-lt-tag ${levelTone(n.level) || 'lv-mid'}`}>{n.level}</span>}
                    </span>
                  </Fragment>
                ))}
              </div>
            ) : null}
            {/* 流通走向：旺→弱 的关键路径 */}
            {stream.length > 0 ? (
              <div className="br-lt-stream">
                <div className="br-lt-cap">主要流通走向</div>
                {stream.map((l, i) => (
                  <div className="br-lt-row" key={'s' + i}>{l}</div>
                ))}
              </div>
            ) : null}
            {/* 关键矛盾（吉凶点） */}
            {conflicts.length ? (
              <div className="br-lt-conflicts">
                <div className="br-lt-cap">关键矛盾</div>
                <ul className="br-lt-list">
                  {conflicts.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
          {sub.note ? <BrNote>{sub.note}</BrNote> : null}
        </div>
      )
    }

    if (sub.kind === 'list') {
      const items = sub.data?.items || []
      return (
        <div className="br-zsub" key={key}>
          {head}
          {/* 列表版式升级：参考盲派「建议卡片」版式，把每条要点渲染为白底圆角卡片；
              若条目含「标题：内容」，则冒号前升格为卡片标题（衬线强调），冒号后为正文 */}
          <div className="br-list-cards">
            {items.map((it, ii) => {
              const txt = String(it || '')
              const cIdx = txt.indexOf('：')
              // 中文冒号在字符串前 40% 处且内容足够多 → 视为「标题：正文」
              const canSplit = cIdx > 0 && cIdx <= 14 && txt.length - cIdx > 6
              const headTxt = canSplit ? txt.slice(0, cIdx) : null
              const bodyTxt = canSplit ? txt.slice(cIdx + 1) : txt
              return (
                <div className="br-advice-item" key={ii}>
                  {headTxt ? <b>{headTxt}</b> : null}
                  <p>{mdHl(bodyTxt, report.type === 'mangpai' ? BLIND_HL : ZIP_HL)}</p>
                </div>
              )
            })}
          </div>
          {sub.note && <BrNote>{sub.note}</BrNote>}
        </div>
      )
    }

    if (sub.kind === 'kv') {
      const blocks = sub.data?.blocks || []
      return (
        <div className="br-zsub" key={key}>
          {head}
          <div className="br-linkage">
            {blocks.map((b, bi) => (
              <div key={bi} className="br-linkage-row">
                <div className="br-linkage-tag">{b.k}</div>
                <div className="br-linkage-plain">{mdHl(b.v, report.type === 'mangpai' ? BLIND_HL : ZIP_HL)}</div>
              </div>
            ))}
          </div>
          {sub.note && <BrNote>{sub.note}</BrNote>}
        </div>
      )
    }

    if (sub.kind === 'note') {
      const text = String(sub.data?.text ?? sub.text ?? '')
      // 口诀多为单行短句（无空行、行短），逐行竖排成诗诀；普通说明按空行分段
      const lines = text.split('\n').filter(l => l.trim())
      const isVerse = lines.length > 1 && lines.every(l => l.length <= 30) && !/\n\s*\n/.test(text)
      return (
        <div className="br-zsub" key={key}>
          {head}
          {isVerse ? (
            <div className="br-verse">
              {lines.map((l, i) => <div className="br-verse-line" key={i}>{l}</div>)}
            </div>
          ) : (
            <BrNote>{text}</BrNote>
          )}
        </div>
      )
    }

    // 默认按 kv 处理：blocks = [{k, v}] —— 标签-值对列表
    // 每项独立行（label 上、value 下），不再被网格挤压成奇怪的"L"型。
    // 含 >=4 项且其中至少一项长文本时，自动拆 head（短项紧凑双列）+ body（长项整段）。
    const blocks = (sub.data?.blocks || []).filter(it => it && it.v != null && it.v !== '')
    if (!blocks.length) return null
    const useList = sub.data?.mode === 'list' // 强制走"一字段一行"列表模式（每项独占一行，标签左/值右）
    const useInline = sub.data?.mode === 'inline' // 每项一行（标签窄列左 + 值宽列右），纯水平排版
    if (useInline) {
      return (
        <div className="br-zsub" key={key}>
          {head}
          <dl className="br-kv-inline">
            {blocks.map((it, i) => (
              <div className="br-kv-inline-row" key={i}>
                {it.k && <dt>{it.k}</dt>}
                <dd className={it.tone === 'good' ? 'br-good' : it.tone === 'bad' ? 'br-bad' : ''}>{it.v}</dd>
              </div>
            ))}
          </dl>
          {sub.note ? <BrNote>{sub.note}</BrNote> : null}
        </div>
      )
    }
    if (useList) {
      return (
        <div className="br-zsub" key={key}>
          {head}
          <ul className="br-kv-list">
            {blocks.map((it, i) => (
              <li key={i}>
                {it.k && <span className="br-kv-list-k">{it.k}</span>}
                <span className={`br-kv-list-v ${it.tone === 'good' ? 'br-good' : it.tone === 'bad' ? 'br-bad' : ''}`}>{it.v}</span>
              </li>
            ))}
          </ul>
          {sub.note ? <BrNote>{sub.note}</BrNote> : null}
        </div>
      )
    }
    const useCard = blocks.length >= 3 && blocks.some(b => String(b.v).length > LONG_TEXT)
    if (useCard) {
      // 复用 kvCard 的结构：前 2 项做 headItems，余下做 bodyItems
      const headItems = blocks.slice(0, 2)
      const bodyItems = blocks.slice(2)
      return (
        <div className="br-zsub" key={key}>
          {head}
          <div className="br-kvc">
            <div className="br-kvc-head">
              {headItems.map((it, i) => (
                <div className="br-kvc-cell" key={i}>
                  <span className="br-kvc-k">{it.k}</span>
                  <span className={`br-kvc-v ${it.tone === 'good' ? 'br-good' : it.tone === 'bad' ? 'br-bad' : ''}`}>{it.v}</span>
                </div>
              ))}
            </div>
            {bodyItems.length > 0 && (
              <div className="br-kvc-body">
                {bodyItems.map((it, i) => (
                  <div className="br-kvc-row" key={i}>
                    <span className="br-kvc-row-k">{it.k}</span>
                    <span className="br-kvc-row-v">{it.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {sub.note ? <BrNote>{sub.note}</BrNote> : null}
        </div>
      )
    }
    // 短内容（<=2 项 或 都是短文本）保持原风格：标签+值同行，靠紧凑网格排版
    return (
      <div className="br-zsub" key={key}>
        {head}
        <div className="br-kv">
          {blocks.map((it, i) => (
            <span key={i}>
              {it.k ? <b>{it.k}</b> : null}
              {it.k ? '：' : ''}
              <b className={it.tone === 'good' ? 'br-good' : it.tone === 'bad' ? 'br-bad' : ''}>{it.v}</b>
            </span>
          ))}
        </div>
        {sub.note ? <BrNote>{sub.note}</BrNote> : null}
      </div>
    )
  }

  const renderPalaceCard = (it, i) => {
    // 重点大运（用神到位/比劫当旺）在卡片内直接高亮；命中带「命」字同样高亮（原 is-ming 逻辑）；mark=重点/高亮则用橙色高亮（重点流月卡）
    const isKeyDayun = it.mark === '用神到位' || it.mark === '比劫当旺'
    const isKeyFlow = it.mark === '重点' || it.mark === '高亮'
    const isMing = it.mark && it.mark.includes('命')
    // mark='NOW' 时挪到卡片右上角作为角标（避免和标题横向挤在一起）
    const isCornerMark = it.mark === 'NOW'
    // wide=true 的卡片跨满整个 grid（如"性格终极画像"内容多、需独占整行展示）
    const isWide = it.wide === true
    // 盲派用象义/做功词表，子平用旺衰词表
    const DICT = report.type === 'mangpai' ? BLIND_HL : ZIP_HL
    return (
    <div className={`br-palace-card ${it.tone ? `tone-${it.tone}` : ''}${isMing ? ' is-ming' : ''}${isKeyDayun ? ' is-keynode' : ''}${isKeyFlow ? ' is-keyflow' : ''}${isCornerMark ? ' is-now' : ''}${isWide ? ' is-wide' : ''}`} key={i}>
      {isCornerMark && <span className="br-palace-mark is-corner">{it.mark}</span>}
      <div className="br-palace-head">
        {it.name && <b className="br-palace-name">{it.name}</b>}
        {it.mark && !isCornerMark && <span className={`br-palace-mark${isMing ? ' is-ming' : ''}${isKeyDayun ? ' is-keydayun' : ''}${isKeyFlow ? ' is-keyflow' : ''}`}>{it.mark}</span>}
        {it.tag && <span className="br-palace-tag">{it.tag}</span>}
      </div>
      {it.badges && it.badges.length ? (
        <div className="br-palace-badges">
          {it.badges.map((b, j) => (
            <span key={j} className={`br-palace-badge${b.tone ? ` badge-${b.tone}` : ''}`}>{b.text}</span>
          ))}
        </div>
      ) : null}
      {it.sub && <div className="br-palace-sub">{mdHl(it.sub, DICT)}</div>}
      {it.desc && typeof it.desc === 'object' && it.desc.term ? (
        <BrNote>{it.desc}</BrNote>
      ) : it.desc ? (
        // 长 desc 自动按分号分段，每段独立成行 + **xx** 加粗解析
        (() => {
          const segs = splitLongText(it.desc, 90)
          if (segs.length <= 1) return <p className="br-palace-desc">{mdHl(segs[0] || '', DICT)}</p>
          return (
            <div className="br-palace-desc-multi">
              {segs.map((s, k) => (
                <p key={k} className="br-palace-desc-line">{mdHl(s, DICT)}</p>
              ))}
            </div>
          )
        })()
      ) : null}
    </div>
    )
  }

  const renderSection = (s, idx) => {
    const num = NUM_CN[idx] || `${idx + 1}`
    const h = <h4><span className="br-sec-num">{num}</span><span className="br-sec-title">{s.title}</span></h4>
    switch (s.kind) {
      case 'kvComposite':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <BrNote>{s.note}</BrNote>
            <div className="br-zcomp">
              {(s.data?.subsections || []).map((sub, i) => renderSubSection(sub, s.key))}
            </div>
          </section>
        )
      case 'liuTong':
        return (
          <section className="br-section" key={s.key}>
            {h}
            {renderSubSection(s, s.key)}
          </section>
        )
      case 'guide': {
        // skill 技法总纲：单行极简展示——由哪套元氣AI技能指导 + 一句话解读思路
        const g = s.data || {}
        return (
          <section className="br-section" key={s.key}>
            {h}
            <div className="br-guide-body" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: 13, lineHeight: 1.8, background: 'rgba(120,92,60,.06)', border: '1px solid rgba(120,92,60,.18)' }}>
              {g.icon ? <span style={{ marginRight: 6 }}>{g.icon}</span> : null}
              <b>元氣AI「{g.name || '排盘引擎'}」</b>
              {g.methodText ? <span style={{ color: 'var(--text-2, #8a857a)' }}>　解读思路：{g.methodText}</span> : null}
            </div>
            {s.note ? <BrNote>{s.note}</BrNote> : null}
          </section>
        )
      }
      case 'baziPillars':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <div className="br-pillars">
              {(s.data.items || []).map(pl => (
                <div className="br-pillar" key={pl.name}>
                  <div className="br-pillar-name">{pl.name}</div>
                  <div className="br-pillar-gan">{pl.gan.char}<em>{pl.gan.ten}</em></div>
                  <div className="br-pillar-zhi">{pl.zhi.char}<em>{(pl.zhi.cang || []).map(c => c.char).join(' ')}</em></div>
                  <div className="br-pillar-meta">纳音 {pl.nayin}</div>
                  <div className="br-pillar-meta">{pl.kong ? `空亡 ${pl.kong}` : ''}</div>
                </div>
              ))}
            </div>
            <BrNote>{s.note}</BrNote>
          </section>
        )
      case 'table':
        return (() => {
          // 列宽策略：完全按"列内各单元格内容的实际字数"动态分配 —— 字数多的列宽，字数少的列窄
          const headers = s.data.headers || []
          const rows = s.data.rows || []
          const widths = planColumnWidths(headers, rows)
          return (
          <section className="br-section" key={s.key}>
            {h}
            <BrNote>{s.note}</BrNote>
            <div className="br-table-wrap">
              <table className="br-table">
                <colgroup>{headers.map((_, i) => <col key={i} style={{ width: `${widths[i]}%` }} />)}</colgroup>
                <thead><tr>{headers.map((hd, j) => (
                  // 表头少于 5 个字（含数字/符号，如「年份」「干支」「风险」「11月」）→ 单行不换行；
                  // 5 字及以上长表头（「与日主·流年关系」「有效距离系数」）才允许换行
                  <th key={j} className={dispWidth(hd) < 5 ? 'br-th-short' : ''}>{hd}</th>
                ))}</tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={s.data.current === i ? 'br-current' : ''}>
                      {(r || []).map((c, j) => {
                        // 按单元格自身内容判定短列：视觉宽度 ≤4 的短词（年份「2026」/月份「11月」/干支「戊申」/单字✅ 等）
                        // 或纯图标/符号内容（风险列 ⚠️🚨 等，不含汉字）→ 一律强制单行不换行；
                        // 较长文本列（含汉字且视觉宽度 >4）才走可换行的描述列
                        const isShort = dispWidth(c) <= 4 || !/[\u4e00-\u9fa5]/.test((c || '').toString())
                        const cls = [
                          j === 1 ? 'br-ganzhi' : '',
                          isShort ? 'br-td-short' : 'br-td-wrap',
                        ].filter(Boolean).join(' ')
                        return (
                          <td key={j} className={cls}>
                            {c || ''}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          )
        })()
      case 'chips':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <div className="br-chips">
              {(s.data.items || []).map((it, i) => (
                <span className="br-chip" key={i}>
                  {it.value !== undefined && <b>{it.label}</b>}
                  {Array.isArray(it.value) ? it.value.join('、') : (it.value ?? it.label)}
                </span>
              ))}
            </div>
          </section>
        )
      case 'identity':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <div className="br-id">
              {/* 八字四柱：四根大柱 */}
              {s.data.pillars && s.data.pillars.length ? (
                <div className="br-id-pillars">
                  {s.data.pillars.map((p, i) => (
                    <div className={'br-id-pillar' + (p.label === '日柱' ? ' br-id-pillar-day' : '')} key={i}>
                      <span className="br-id-pillar-label">
                        {p.label}
                        {p.label === '日柱' ? <i className="br-id-pillar-tag">日主</i> : null}
                        {report.type === 'ziwei' && p.label === '年柱' && s.data.zodiac ? <i className="br-id-pillar-tag">{s.data.zodiac}</i> : null}
                      </span>
                      <b className="br-id-pillar-gan">{p.gan}</b>
                      <b className="br-id-pillar-zhi">{p.zhi}</b>
                    </div>
                  ))}
                </div>
              ) : null}
              {/* 紫微的喜忌与命主身主各自收在单张信息卡内。 */}
              <div className="br-id-tags">
                {report.type === 'ziwei' && ((s.data.favorable && s.data.favorable.length) || (s.data.avoid && s.data.avoid.length)) ? (
                  <div className="br-id-balance-card">
                    <span className="br-id-balance-title">喜忌</span>
                    {(s.data.favorable && s.data.favorable.length) ? (
                      <div className="br-id-balance-row br-id-balance-good">
                        <span className="br-id-balance-label">喜用</span>
                        <b className="br-id-tag-val">{(s.data.favorable || []).map((w, i) => <span className="br-id-tag-chip br-id-tag-chip-good" key={'f' + i}>{w}</span>)}</b>
                      </div>
                    ) : null}
                    {(s.data.avoid && s.data.avoid.length) ? (
                      <div className="br-id-balance-row br-id-balance-bad">
                        <span className="br-id-balance-label">忌用</span>
                        <b className="br-id-tag-val">{(s.data.avoid || []).map((w, i) => <span className="br-id-tag-chip br-id-tag-chip-bad" key={'a' + i}>{w}</span>)}</b>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {report.type !== 'ziwei' && (s.data.favorable && s.data.favorable.length) ? (
                  <div className="br-id-tag br-id-tag-good">
                    <span className="br-id-tag-cap">喜用</span>
                    <b className="br-id-tag-val">{(s.data.favorable || []).map((w, i) => <span className="br-id-tag-chip br-id-tag-chip-good" key={'f' + i}>{w}</span>)}</b>
                  </div>
                ) : null}
                {report.type !== 'ziwei' && (s.data.avoid && s.data.avoid.length) ? (
                  <div className="br-id-tag br-id-tag-bad">
                    <span className="br-id-tag-cap">忌用</span>
                    <b className="br-id-tag-val">{(s.data.avoid || []).map((w, i) => <span className="br-id-tag-chip br-id-tag-chip-bad" key={'a' + i}>{w}</span>)}</b>
                  </div>
                ) : null}
                {report.type === 'ziwei' && ((s.data.soul && s.data.soul.name) || (s.data.body && s.data.body.name)) ? (
                  <div className="br-id-rulers-card">
                    <span className="br-id-rulers-title">命主 · 身主</span>
                    {s.data.soul && s.data.soul.name ? (
                      <div className="br-id-rulers-row"><span>命主</span><b>{s.data.soul.name}</b></div>
                    ) : null}
                    {s.data.body && s.data.body.name ? (
                      <div className="br-id-rulers-row"><span>身主</span><b>{s.data.body.name}</b></div>
                    ) : null}
                  </div>
                ) : null}
                {report.type !== 'ziwei' && s.data.soul && s.data.soul.name ? (
                  <div className="br-id-tag br-id-tag-soul">
                    <span className="br-id-tag-cap">命主</span>
                    <b className="br-id-tag-val">{s.data.soul.name}</b>
                  </div>
                ) : null}
                {report.type !== 'ziwei' && s.data.body && s.data.body.name ? (
                  <div className="br-id-tag br-id-tag-body">
                    <span className="br-id-tag-cap">身主</span>
                    <b className="br-id-tag-val">{s.data.body.name}</b>
                  </div>
                ) : null}
              </div>
              {/* 时间与命盘属性 */}
              <div className={`br-id-meta ${report.type === 'ziwei' ? 'br-id-meta--ziwei' : ''}`}>
                {report.type === 'ziwei' && (s.data.solar || s.data.lunar) ? (
                  <div className="br-id-calendar">
                    <span className="br-id-calendar-title">出生信息</span>
                    {s.data.solar ? (
                      <div className="br-id-calendar-row">
                        <span>公历</span>
                        <b className="br-id-meta-val">{s.data.solar}</b>
                      </div>
                    ) : null}
                    {s.data.lunar ? (
                      <div className="br-id-calendar-row">
                        <span>农历</span>
                        <b className="br-id-meta-val">{s.data.lunar}</b>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {s.data.solar ? (
                      <div className="br-id-meta-cell">
                        <span className="br-id-meta-cap">公历</span>
                        <b className="br-id-meta-val">{s.data.solar}</b>
                      </div>
                    ) : null}
                    {s.data.lunar ? (
                      <div className="br-id-meta-cell">
                        <span className="br-id-meta-cap">农历</span>
                        <b className="br-id-meta-val">{s.data.lunar}</b>
                      </div>
                    ) : null}
                  </>
                )}
                {report.type === 'ziwei' && (s.data.qiyun || s.data.ju) ? (
                  <div className="br-id-start-card">
                    <span className="br-id-start-title">五行局 · 起运</span>
                    {s.data.ju ? (
                      <div className="br-id-start-item">
                        <span>五行局</span>
                        <b className="br-id-meta-val">{s.data.ju}</b>
                      </div>
                    ) : null}
                    {s.data.qiyun ? (
                      <div className="br-id-start-item">
                        <span>起运</span>
                        <b className="br-id-meta-val">{s.data.qiyun.age ? `${s.data.qiyun.age} 岁起运` : s.data.qiyun.text}{s.data.qiyun.date ? <em>{s.data.qiyun.date}</em> : null}</b>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {report.type !== 'ziwei' && s.data.qiyun ? (
                  <div className="br-id-meta-cell">
                    <span className="br-id-meta-cap">起运</span>
                    <b className="br-id-meta-val">{s.data.qiyun.text || `${s.data.qiyun.age} 岁`}{s.data.qiyun.date ? <em>{s.data.qiyun.date}</em> : null}</b>
                  </div>
                ) : null}
                {report.type !== 'ziwei' && s.data.zodiac ? (
                  <div className="br-id-meta-cell">
                    <span className="br-id-meta-cap">生肖</span>
                    <b className="br-id-meta-val">{s.data.zodiac}</b>
                  </div>
                ) : null}
                {report.type !== 'ziwei' && s.data.sign ? (
                  <div className="br-id-meta-cell">
                    <span className="br-id-meta-cap">星座</span>
                    <b className="br-id-meta-val">{s.data.sign}</b>
                  </div>
                ) : null}
                {report.type !== 'ziwei' && s.data.ju ? (
                  <div className="br-id-meta-cell">
                    <span className="br-id-meta-cap">五行局</span>
                    <b className="br-id-meta-val">{s.data.ju}</b>
                  </div>
                ) : null}
              </div>
              {/* 命主 / 身主 已并入上方 br-id-tags 一行 */}
            </div>
            <BrNote>{s.note}</BrNote>
          </section>
        )
      case 'bifold':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <div className="br-bifold">
              {['dec', 'yr'].filter(k => s.data && s.data[k]).map(k => {
                const c = s.data[k]
                return (
                  <div className="br-bfold-card" key={k}>
                    <div className="br-bfold-head">
                      <span className="br-bfold-label">{c.label}</span>
                      {c.range ? <span className="br-bfold-range">{c.range}</span> : null}
                      <span className="br-bfold-note">{c.note}</span>
                    </div>
                    <div className="br-bfold-palace">
                      <b className="br-bfold-name">{c.name}</b>
                      <span className="br-bfold-ganzhi">{c.ganzhi}</span>
                      {c.stars && c.stars.length
                        ? c.stars.map((st, j) => (
                            <span className="br-bfold-star" key={j}>
                              {st.name}
                              {st.brightness ? <em>{st.brightness}</em> : null}
                            </span>
                          ))
                        : null}
                    </div>
                    {c.mutagen && c.mutagen.length ? (
                      <div className="br-bfold-block">
                        <b className="br-bfold-block-title">四化</b>
                        {c.mutagen.map((m, j) => <p key={j}>{m}</p>)}
                      </div>
                    ) : null}
                    {c.quad && c.quad.length ? (
                      <div className="br-bfold-block">
                        <b className="br-bfold-block-title">三方四正</b>
                        <div className="br-bfold-grid">
                          {c.quad.map((q, j) => (
                            <div className="br-bfold-cell" key={j}>
                              <span className="br-bfold-cell-label">{q.label}</span>
                              <i>{q.name}</i>
                              <span className="br-bfold-cell-stars">
                                {q.stars && q.stars.length ? q.stars.map(s => s.name).join('、') : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {c.shensha && c.shensha.length ? (
                      <div className="br-bfold-block">
                        <b className="br-bfold-block-title">流年神煞</b>
                        <span className="br-bfold-shensha">{c.shensha.join('、')}</span>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <BrNote>{s.note}</BrNote>
          </section>
        )
      case 'kv':
        return (
          <section className="br-section br-inline" key={s.key}>
            {h}
            <div className={`br-kv ${s.data.vertical ? 'br-kv-col' : ''}`}>
              {(s.data.items || []).filter(it => it && it.v != null && it.v !== '' && it.v !== '-' && it.v !== '无' && it.v !== '无主星' && it.v !== '无主星（借星安宫）' && it.v !== '无四化入局' && it.v !== '无四化加临').map((it, i) => (
                <span key={i}>
                  {it.k ? <b>{it.k}</b> : null}
                  {it.k ? '：' : ''}
                  <b className={it.tone === 'good' ? 'br-good' : it.tone === 'bad' ? 'br-bad' : ''}>{it.v}</b>
                </span>
              ))}
            </div>
            <BrNote>{s.note}</BrNote>
          </section>
        )
      case 'cards':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <div className={s.data.grid ? 'br-flow-future' : ''}>
              {(s.data.items || []).map((it, i) => (
                <div className={s.data.grid ? 'br-flow-card' : 'br-advice-item'} key={i}>
                  {it.tag ? <b>{it.tag}</b> : it.title ? <b>{it.title}</b> : null}
                  {typeof it.desc === 'object' && it.desc && it.desc.term ? (
                    <BrNote>{it.desc}</BrNote>
                  ) : (
                    <p>
                      {it.sub && <em style={{ fontStyle: 'normal', color: 'var(--br-accent)', fontWeight: 600, marginRight: 4 }}>{it.sub}</em>}
                      {it.desc}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      case 'flow':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <div className="br-flow-cur">
              <div className="br-flow-year">{s.data.current.label} <b>{s.data.current.ganzhi}</b></div>
              <p>{s.data.current.note}</p>
            </div>
            <div className="br-flow-future">
              {(s.data.future || []).map(f => (
                <div className="br-flow-card" key={f.year}>
                  <div className="br-flow-year">{f.year} <b>{f.ganzhi}</b></div>
                  <p>{f.note}</p>
                </div>
              ))}
            </div>
          </section>
        )
      case 'bars':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <BrNote>{s.note}</BrNote>
            <div className="br-bars">
              {(s.data.items || []).map((it, i) => (
                <div className="br-bar-row" key={i}>
                  <span className="br-bar-label">{it.label}</span>
                  <div className="br-bar-track">
                    <div
                      className={`br-bar-fill ${it.tone || ''}`}
                      style={{ width: `${Math.min(100, (it.value / (it.max || 10)) * 100)}%` }}
                    />
                  </div>
                  <span className="br-bar-val">{it.value}</span>
                </div>
              ))}
            </div>
            <BrNote>{s.data.note2}</BrNote>
          </section>
        )
      case 'rating':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <BrNote>{s.note}</BrNote>
            <div className="br-rating">
              {(s.data.items || []).map((it, i) => (
                <div className="br-rating-row" key={i}>
                  <span className="br-rating-label">{it.label}</span>
                  <div className="br-rating-stars">
                    {Array.from({ length: it.max || 5 }).map((_, k) => (
                      <span key={k} className={`br-star ${k < (it.value || 0) ? 'on' : ''}`}>★</span>
                    ))}
                  </div>
                  <span className="br-rating-val">{it.value}/{it.max || 5}</span>
                </div>
              ))}
            </div>
            <BrNote>{s.data.note2}</BrNote>
          </section>
        )
      case 'palaceGrid':
        return (() => {
          // 非空宫（有主星）按主网格铺开；空宫缩小为紧凑小卡，单独横排在该单元下方
          // 主卡 = 有正文（sub 或 desc）的项；空宫 chip = 名称占位但完全无正文。
// 原逻辑只看 sub，会把盲派九卷"职业象/六亲象..."这些 desc 卡错判为空宫、扔进 chips。
const main = (s.data.items || []).filter(it => it.sub || it.desc)
          const empty = (s.data.items || []).filter(it => !it.sub && !it.desc)
          return (
            <section className="br-section" key={s.key}>
              {h}
              <BrNote>{s.note}</BrNote>
              {main.length > 0 && (
                <div className={`br-palace-grid ${s.data.cols ? `cols-${s.data.cols}` : ''}`}>
                  {main.map((it, i) => renderPalaceCard(it, i))}
                </div>
              )}
              {empty.length > 0 && (
                <div className="br-palace-empty">
                  <div className="br-palace-empty-title">空宫</div>
                  <div className="br-palace-empty-list">
                    {empty.map((it, i) => (
                      <span className="br-palace-empty-chip" key={i}>
                        <b>{it.name}</b>
                        {it.tag && <em>{it.tag}</em>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        })()
      case 'dayunGroup':
        return (() => {
          const { dayuns = [], liunianRows = [] } = s.data || {}
          return (
            <section className="br-section" key={s.key}>
              {h}
              <BrNote>{s.note}</BrNote>
              {renderDayunGroup({ dayuns, liunianRows })}
            </section>
          )
        })()
      case 'classics':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <BrNote>{s.note}</BrNote>
            <div className="br-classics">
              {(s.data.entries || []).map((e, i) => (
                <div className={`br-classic-card ${e.noBasis ? 'br-classic-none' : ''}`} key={i}>
                  <div className="br-classic-head">
                    <b className="br-classic-topic">{e.label || e.topic}</b>
                    {e.cite && <span className="br-classic-book">{e.cite.book} · {e.cite.chapter}</span>}
                  </div>
                  {e.cite ? (
                    <>
                      <p className="br-classic-quote">「{e.cite.text}」</p>
                      <p className="br-classic-mean">{e.cite.meaning}</p>
                    </>
                  ) : (
                    <p className="br-classic-none-txt">此点较少对应经典条文，不作生硬套用。</p>
                  )}
                </div>
              ))}
            </div>
            <BrNote>{s.note2}</BrNote>
          </section>
        )
      case 'kline':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <BrNote>{s.note}</BrNote>
            <KlineChart series={s.data.series} flowYears={s.data.flowYears} yearNow={s.data.yearNow} seqWx={s.data.seqWx} avoidWx={s.data.avoidWx} />
          </section>
        )
      case 'safe':
        return (
          <section className="br-section br-safe" key={s.key}>
            {h}
            <div className="br-safe-grid">
              {(s.data.redLines || []).map((r, i) => (
                <div className={`br-safe-item ${r.hit ? 'br-safe-hit' : ''}`} key={i}>
                  <span className="br-safe-ico">{r.hit ? '⚠' : '✓'}</span>
                  <span className="br-safe-txt">{r.desc}</span>
                </div>
              ))}
            </div>
            <div className="br-safe-uncertainty">
              <b>关于不确定性的诚实说明</b>
              <p>{s.data.uncertainty}</p>
            </div>
            {s.note && <p className="br-note br-safe-note">{s.note}</p>}
          </section>
        )
      case 'list':
        return (
          <section className="br-section" key={s.key}>
            {h}
            <ul className="br-list">
              {s.data.items.map((it, ii) => (
                <li key={ii} className="br-list-item">{mdLite(it)}</li>
              ))}
            </ul>
            {s.note && <p className="br-note br-safe-note">{s.note}</p>}
          </section>
        )
      case 'note':
      default:
        return (
          <section className="br-section" key={s.key}>
            {h}
            <div className="br-linkage">{(s.data.text || '').split(/\n\n+/).map((para, pi) => {
              // 口诀：段内为多行短句（单 \n 分隔、每行 ≤30 字）→ 竖排诗诀
              const vlines = para.split('\n').filter(l => l.trim())
              if (vlines.length > 1 && vlines.every(l => l.length <= 30)) {
                return (
                  <div key={pi} className="br-verse">
                    {vlines.map((l, i) => <div className="br-verse-line" key={i}>{mdLite(l)}</div>)}
                  </div>
                )
              }
              // 段内识别【标签】前缀，加粗主色
              const m = para.match(/^(【[^】]+】)([\s\S]*)$/)
              const tag = m ? m[1] : null
              const body = m ? m[2] : para
              // 双轨分轨：段内含【白话】则拆为"术语段 + 白话层"
              const zi = body.indexOf('【白话】')
              if (zi >= 0) {
                const term = body.slice(0, zi)
                const plain = body.slice(zi + 4)
                return (
                  <div key={pi} className="br-linkage-dual">
                    <p className="br-linkage-para">{tag && <span className="br-linkage-tag">{tag}</span>}{mdLite(term)}</p>
                    <p className="br-linkage-plain">{mdLite(plain)}</p>
                  </div>
                )
              }
              // 长段落自动按分号切片，避免大段文字堆成墙
              const segs = splitLongText(body, 110)
              if (segs.length > 1) {
                return (
                  <div key={pi} className="br-zlong">
                    {tag && <span className="br-zlong-tag">{tag}</span>}
                    {segs.map((s, k) => <p key={k} className="br-zlong-p">{mdLite(s)}</p>)}
                  </div>
                )
              }
              return (
                <div key={pi} className="br-linkage-para">
                  {tag && <span className="br-linkage-tag">{tag}</span>}
                  {mdLite(segs[0]).split(/\n+/).map((line, li, arr) => (
                    <p key={li} className="br-linkage-para-line">
                      {line}
                      {li < arr.length - 1 && <br/>}
                    </p>
                  ))}
                </div>
              )
            })}</div>
          </section>
        )
    }
  }

  // 人生K线：SVG 折线图（大运主曲线 + 流年次曲线 + 当前标记）
  function KlineChart({ series, flowYears, yearNow, seqWx, avoidWx }) {
    if (!series || !series.length) return null
    const W = 680, H = 240, PAD = { l: 36, r: 16, t: 18, b: 30 }
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b
    const minS = Math.min(...series.map(p => p.score)), maxS = Math.max(...series.map(p => p.score))
    const lo = Math.max(0, Math.floor((minS - 8) / 10) * 10), hi = Math.min(100, Math.ceil((maxS + 8) / 10) * 10)
    const n = series.length
    const x = i => PAD.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1))
    const y = v => PAD.t + ih - ((v - lo) / (hi - lo)) * ih
    const path = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ')
    const area = `${path} L${x(n - 1).toFixed(1)},${y(lo).toFixed(1)} L${x(0).toFixed(1)},${y(lo).toFixed(1)} Z`
    // 50 中线
    const midY = y(50)
    const nowIdx = series.findIndex(p => p.isNow)
    const gridYs = [lo, (lo + hi) / 2, hi].map(v => y(v))
    return (
      <div className="br-kline">
        <svg viewBox={`0 0 ${W} ${H}`} className="br-kline-svg" role="img" aria-label="人生K线走势图">
          <defs>
            <linearGradient id="klineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(107,127,215,0.32)" />
              <stop offset="100%" stopColor="rgba(107,127,215,0.02)" />
            </linearGradient>
          </defs>
          {gridYs.map((gy, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={gy} x2={W - PAD.r} y2={gy} stroke="rgba(107,127,215,0.12)" strokeDasharray="3 3" />
              <text x={PAD.l - 6} y={gy + 4} textAnchor="end" fontSize="10" fill="#9aa3bd">{i === 0 ? hi : i === 2 ? lo : 50}</text>
            </g>
          ))}
          <line x1={PAD.l} y1={midY} x2={W - PAD.r} y2={midY} stroke="#c9a06a" strokeDasharray="5 4" strokeWidth="1" opacity="0.7" />
          <text x={PAD.l - 6} y={midY - 4} textAnchor="end" fontSize="10" fill="#c9a06a">中</text>
          <path d={area} fill="url(#klineFill)" />
          <path d={path} fill="none" stroke="#6b7fd7" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          {series.map((p, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.score)} r={p.isNow ? 5 : 3.4}
                fill={p.isNow ? '#c8434b' : p.peak ? '#6b7fd7' : '#9aa3bd'}
                stroke="#fff" strokeWidth="1.2" />
              <text x={x(i)} y={y(p.score) - 8} textAnchor="middle" fontSize="10" fontWeight={p.isNow ? 700 : 500}
                fill={p.isNow ? '#c8434b' : '#8a93ac'}>{p.score}</text>
            </g>
          ))}
          {nowIdx >= 0 && (
            <line x1={x(nowIdx)} y1={PAD.t} x2={x(nowIdx)} y2={H - PAD.b} stroke="#c8434b" strokeDasharray="4 3" strokeWidth="1.2" opacity="0.6" />
          )}
        </svg>
        <div className="br-kline-labels">
          {series.map((p, i) => (
            <div className={`br-kline-label ${p.isNow ? 'now' : ''}`} key={i}>
              <b>{p.label}</b>
              <span>{p.years}</span>
            </div>
          ))}
        </div>
        <div className="br-kline-legend">
          <span><i className="lg-dot lg-now" />当前大运</span>
          <span><i className="lg-dot lg-peak" />用神运（高）</span>
          <span><i className="lg-dot lg-flat" />平运</span>
          {flowYears && flowYears.length > 0 && (
            <span className="lg-flow"><i className="lg-bar" />下轴流年</span>
          )}
        </div>
      </div>
    )
  }

  // 上方未定义的子平派专用 case（在主 switch 之外，由 renderSection 重新分发）
  function _zipingDispatch(s, idx) {
    const num = NUM_CN[idx] || `${idx + 1}`
    switch (s.kind) {
      case 'zipingPillars':
        return (() => {
          // 列宽按内容自适应：柱/天干/地支为短列（<5 视觉宽度）单行不换行，十神/藏干长列允许换行
          const pHeaders = ['柱', '天干', '地支', '十神', '藏干']
          const pRows = s.data.rows.map(r => [r.label, r.gan, r.zhi, r.shiShen, r.canggan])
          const pWidths = planColumnWidths(pHeaders, pRows)
          // 前 3 列（柱/天干/地支）内容恒短 → 强制单行
          const pShortCol = pHeaders.map((_, j) => j < 3)
          return (
            <section className="br-section" key={s.key}>
              <h4><span className="br-sec-num">{num}</span><span className="br-sec-title">{s.title}</span></h4>
              <div className="br-zpm">
                <table className="zpm-table">
                  <colgroup>{pHeaders.map((_, j) => <col key={j} style={{ width: `${pWidths[j]}%` }} />)}</colgroup>
                  <thead>
                    <tr>{pHeaders.map((hd, j) => <th key={hd} className={dispWidth(hd) < 5 ? 'br-th-short' : ''}>{hd}</th>)}</tr>
                  </thead>
                  <tbody>
                    {s.data.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="zpm-label" style={pShortCol[0] ? { whiteSpace: 'nowrap' } : undefined}>{r.label}</td>
                        <td className="zpm-gan" style={pShortCol[1] ? { whiteSpace: 'nowrap' } : undefined}>{r.gan}</td>
                        <td className="zpm-zhi" style={pShortCol[2] ? { whiteSpace: 'nowrap' } : undefined}>{r.zhi}</td>
                        <td className="zpm-ss">{r.shiShen}</td>
                        <td className="zpm-cg">{r.canggan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="zpm-foot">
                  <span>空亡：<b>{s.data.kong}</b></span>
                  <span>当前大运：<b className="gold">{s.data.currentDY}</b></span>
                </div>
              </div>
              <BrNote>{s.note}</BrNote>
            </section>
          )
        })()
      case 'zipingNarrate':
        return (
          <section className="br-section" key={s.key}>
            <h4><span className="br-sec-num">{num}</span><span className="br-sec-title">{s.title}</span></h4>
            <div className="br-zpn">
              {s.data.title && <div className="zpn-title">{s.data.title}</div>}
              {s.data.intro && <div className="zpn-intro">{s.data.intro}</div>}
              {s.data.pattern && (
                <div className="zpn-pattern">
                  <span className="zpn-pchip">{s.data.pattern}</span>
                  {s.data.verdict && <span className="zpn-vchip">{s.data.verdict}</span>}
                </div>
              )}
              {s.data.blocks && s.data.blocks.map((b, i) => (
                <div key={i} className="zpn-block">
                  <span className="zpn-k">{b.k}</span>
                  <span className="zpn-v">{b.v}</span>
                </div>
              ))}
              {s.data.paragraphs && s.data.paragraphs.map((p, i) => (
                <p key={i} className="zpn-p">{p}</p>
              ))}
            </div>
          </section>
        )
      case 'zipingKv':
        return (
          <section className="br-section" key={s.key}>
            <h4><span className="br-sec-num">{num}</span><span className="br-sec-title">{s.title}</span></h4>
            <div className="br-zpkv">
              {s.data.blocks.map((b, i) => (
                <div key={i} className="zpkv-item">
                  <div className="zpkv-k">· {b.k}</div>
                  <div className="zpkv-v" style={{ whiteSpace: 'pre-line' }}>{b.v}</div>
                </div>
              ))}
            </div>
          </section>
        )
      case 'zipingDaYunTable':
        return (() => {
          // 列宽按内容自适应；列内内容视觉宽度 <5 的短列强制单行不换行，长列允许换行
          const dyHeaders = s.data.cols || []
          const dyRows = s.data.rows.map(r => [r.name, r.range, r.wx, r.note])
          const dyWidths = planColumnWidths(dyHeaders, dyRows)
          const dyShort = dyHeaders.map((_, j) => {
            let mx = 0
            dyRows.forEach((rr) => { mx = Math.max(mx, dispWidth(rr[j])) })
            return Math.max(mx, dispWidth(dyHeaders[j])) < 5
          })
          const dyTdClass = ['zdy-name', 'zdy-range', 'zdy-wx', 'zdy-note']
          return (
            <section className="br-section" key={s.key}>
              <h4><span className="br-sec-num">{num}</span><span className="br-sec-title">{s.title}</span></h4>
              <div className="br-zdy">
                <table className="zdy-table">
                  <colgroup>{dyHeaders.map((_, j) => <col key={j} style={{ width: `${dyWidths[j]}%` }} />)}</colgroup>
                  <thead>
                    <tr>{dyHeaders.map((c, i) => <th key={i} className={dispWidth(c) < 5 ? 'br-th-short' : ''}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {s.data.rows.map((r, i) => (
                      <tr key={i}>
                        {dyTdClass.map((cls, j) => (
                          <td key={cls} className={cls} style={{
                            color: cls === 'zdy-wx' ? wxColor(r.wx) : undefined,
                            whiteSpace: dyShort[j] ? 'nowrap' : undefined,
                          }}>
                            {cls === 'zdy-wx' ? r.wx : cls === 'zdy-name' ? r.name : cls === 'zdy-range' ? r.range : r.note}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <BrNote>{s.note}</BrNote>
            </section>
          )
        })()
      case 'zipingYearBox':
        return (
          <section className="br-section" key={s.key}>
            <h4><span className="br-sec-num">{num}</span><span className="br-sec-title">{s.title}</span></h4>
            <div className="br-zyb">
              {s.data.items.map((it, i) => (
                <div key={i} className="zyb-card">
                  <div className="zyb-head">
                    <span className="zyb-year">{it.year}</span>
                    <span className="zyb-gz">{it.gz}</span>
                    <span className="zyb-wx" style={{ color: wxColor(it.wx) }}>{it.wx}气流年</span>
                  </div>
                  <div className="zyb-body">{it.text}</div>
                </div>
              ))}
            </div>
          </section>
        )
      case 'zipingSummary':
        return (
          <section className="br-section" key={s.key}>
            <h4><span className="br-sec-num">{num}</span><span className="br-sec-title">{s.title}</span></h4>
            <div className="br-zsum">
              {s.data.lines.map((l, i) => (
                <p key={i} className="zsum-paragraph">
                  <b className="zsum-k">{l.k}：</b>
                  <span className="zsum-v">{l.v}</span>
                </p>
              ))}
              {s.data.tail && (() => {
                const zi = s.data.tail.indexOf('【白话】')
                if (zi >= 0) {
                  return (
                    <div className="zsum-dual">
                      <p className="zsum-paragraph zsum-tail">{s.data.tail.slice(0, zi)}</p>
                      <p className="zsum-paragraph zsum-tail zsum-plain">【白话】{s.data.tail.slice(zi + 4)}</p>
                    </div>
                  )
                }
                return <p className="zsum-paragraph zsum-tail">{s.data.tail}</p>
              })()}
            </div>
          </section>
        )
      default:
        return null
    }
  }

  const render = (s, idx) => {
    if (s.kind && s.kind.startsWith('ziping')) {
      return _zipingDispatch(s, idx)
    }
    return renderSection(s, idx)
  }

  // 「开运建议」模块：已渲染过则跳过（只在综合前插入一次）
  let adviceRendered = false
  const adviceBlock = () => {
    if (!report.advice || adviceRendered) return null
    adviceRendered = true
    return (
      <section className="br-section br-advice">
        <h4><span className="br-sec-num">吉</span><span className="br-sec-title">开运建议</span></h4>
        {typeof report.advice === 'string' ? (
          <p className="br-advice-text">{report.advice}</p>
        ) : (
          <div className="br-advice-grid">
            {Object.entries(report.advice).map(([k, v]) => {
              const names = { career: '事业', wealth: '财运', love: '感情', health: '健康', opening: '开运' }
              if (!v) return null
              return <div className="br-advice-item" key={k}><b>{names[k] || k}</b><p>{v}</p></div>
            })}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className={`bazi-report${report?.type === 'bazi' ? ' br-ziping' : ''}${report?.type === 'ziwei' ? ' br-ziwei' : ''}`} style={style}>
      {!hideLead && !readonly && (lead ? cloneElement(lead, { actions: (
        <div className="br-actions">
          <button className="br-btn" onClick={copy}>{copied ? '已复制 ✓' : '⧉ 复制'}</button>
          <button className="br-btn" onClick={download}>↓ 下载</button>
          <button className="br-btn" onClick={share}>{shared ? '已分享 ✓' : '↗ 分享'}</button>
        </div>
      ) }) : (
        <div className="br-actions">
          <button className="br-btn" onClick={copy}>{copied ? '已复制 ✓' : '⧉ 复制'}</button>
          <button className="br-btn" onClick={download}>↓ 下载</button>
          <button className="br-btn" onClick={share}>{shared ? '已分享 ✓' : '↗ 分享'}</button>
        </div>
      ))}

      {(report.sections || []).length > 3 && (
        <div className="br-nav">
          <span className="br-nav-cap">本章导航</span>
          <div className="br-nav-list">
            {(report.sections || []).map((s, i) => (
              <button key={s.key || i} className="br-nav-chip" onClick={() => jumpTo(s.key || `s${i}`)}>
                <i>{NUM_CN[i] || i + 1}</i>{s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {metaItems.length > 0 && (
        <div className="br-meta">
          {metaItems.map(m => (
            <div className="br-meta-item" key={m.label}>
              <span className="br-meta-label">{m.label}</span>
              <span className="br-meta-value">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {report.headline && (
        <div className="br-headline">
          <span className="br-headline-cap">命格主线</span>
          <p className="br-headline-text">{report.headline}</p>
        </div>
      )}

      {(report.sections || []).map((s, i) => {
        const node = render(s, i)
        const rendered = node
          ? cloneElement(node, {
              id: `br-sec-${s.key || `s${i}`}`,
              style: { ...(node.props.style || {}), animationDelay: `${i * 70}ms` }
            })
          : null
        // 「开运建议」插在「综合」之前
        if (s.kind === 'zipingSummary' && report.advice) {
          return (
            <Fragment key={s.key || `s${i}`}>
              {adviceBlock()}
              {rendered}
            </Fragment>
          )
        }
        return rendered
      })}

      {adviceBlock()}

      {report.basis && report.basis.trim() && (
        <section className="br-section br-basis">
          <h4>
            <span className="br-sec-num">依</span>
            <span className="br-sec-title">推理依据</span>
            <button
              className={`br-basis-toggle${showBasis ? ' open' : ''}`}
              onClick={() => setShowBasis(v => !v)}
              aria-expanded={showBasis}
            >
              {showBasis ? '收起 ▲' : '展开 ▼'}
            </button>
          </h4>
          <div className={`br-basis-body${showBasis ? ' open' : ''}`}>
            {showBasis
              ? report.basis.split(/\n+/).filter(Boolean).map((para, i) => (
                  <p key={i} className="br-basis-para">{para}</p>
                ))
              : <p className="br-basis-hint">点击展开，查看本次断语背后的分析过程与典籍依据</p>}
          </div>
        </section>
      )}

      <div className="br-foot">本报告由元氣AI 高精度排盘引擎生成，仅供娱乐与参考。</div>

      {showTop && (
        <button className="br-topbtn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="返回顶部">↑</button>
      )}

      {shareModal && createPortal(
        <div className="br-share-mask" onClick={() => setShareModal(null)}>
          <div className="br-share-panel" onClick={e => e.stopPropagation()}>
            <button className="br-share-close" onClick={() => setShareModal(null)} aria-label="关闭">×</button>
            {shareModal.qr ? (
              <>
                <div className="br-share-title">扫码查看完整报告</div>
                <div className="br-share-sub">{shareModal.title || '测算报告'}</div>
                <div className="br-share-qr">
                  <img src={shareModal.qr} alt="分享二维码" />
                </div>
                <div className="br-share-hint">手机扫码，即可在手机上阅读完整报告</div>
              </>
            ) : (
              <div className="br-share-fallback">
                <div className="br-share-title">分享完整报告</div>
                <div className="br-share-sub">{shareModal.title || '测算报告'}</div>
                <div className="br-share-fallback-tip">复制下方链接，发送给朋友即可查看</div>
              </div>
            )}
            <div className="br-share-url">
              <span>{shareModal.url}</span>
              <button className="br-share-copy" onClick={copyLink}>{linkCopied ? '已复制 ✓' : '复制链接'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
})

// 「报告失败」这条分支必须待在外层。它原先写在组件体内、且在 useEffect /
// useImperativeHandle 等十来个 Hook 之前就 return —— 失败态只跑 2 个 Hook，成功态跑十几个，
// 同一个组件在 ok↔fail 之间切换时 React 直接抛 “Rendered more hooks than during the
// previous render”。拆成外层守卫 + 内层组件后，两种形态是不同组件，各自的 Hook 表互不干扰。
const ReportView = forwardRef(function ReportView(props, ref) {
  const { report } = props
  if (!report || !report.ok) {
    return <div className="bazi-report br-error">{report?.error || '报告生成失败'}</div>
  }
  return <ReportViewBody {...props} ref={ref} />
})

export default ReportView
