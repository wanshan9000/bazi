// 统一报告 Schema：所有测算门类共用的报告契约
// 每个门类只产出结构化数据（sections），前端统一渲染，markdown 统一序列化导出
//
// 报告对象结构：
// {
//   ok: true,
//   type: 'bazi' | 'ziwei' | 'liuyao' | 'qimen' | 'huangli' | 'tarot' | 'name' | 'fengshui',
//   icon, title, sub,
//   hero: { chars: [], main, caption },          // 可选：顶部大字区
//   meta: {},                                    // 结构化元信息（可存档/检索）
//   sections: [ { key, title, kind, data, note? } ],
//   advice: { career, wealth, love, health, opening } | null,
//   markdown
// }
//
// 渲染块 kind 契约：
//   baziPillars { items:[{name,gan:{char,ten},zhi:{char,cang:[{char,ten}]},nayin,kong}] }
//   table       { headers:[], rows:[[]], current?:number }
//   chips       { items:[{label, value?}] }      // value 可为 string 或 array
//   kv          { items:[{k, v, tone?:'good'|'bad'}] }
//   cards       { items:[{title, sub?, desc?, tag?}] }
//   flow        { current:{label, ganzhi, note}, future:[{year, ganzhi, note}] }
//   note        { text }

import { guideSectionOf } from './skillGuide.js'

export const REPORT_META = {
  bazi:    { icon: '🌿', title: '八字命理完整报告',   tool: 'bazi_report',    name: '八字' },
  ziwei:   { icon: '✨', title: '紫微斗数全盘报告',   tool: 'ziwei_report',   name: '紫微' },
  liuyao:  { icon: '☯️', title: '六爻纳甲占卜报告',  tool: 'liuyao_report',  name: '六爻' },
  qimen:   { icon: '🧭', title: '奇门遁甲综合报告',   tool: 'qimen_report',   name: '奇门' },
  huangli: { icon: '📜', title: '老黄历详报',        tool: 'huangli_report', name: '黄历' },
  tarot:   { icon: '🃏', title: '塔罗牌阵解读报告',   tool: 'tarot_report',   name: '塔罗' },
  name:    { icon: '🪶', title: '姓名五格分析报告',   tool: 'name_report',    name: '取名' },
  fengshui:{ icon: '🏠', title: '家居风水布局报告',   tool: 'fengshui_report', name: '风水' },
  mangpai: { icon: '🀄', title: '盲派命理完整报告',   tool: 'mangpai_report',  name: '盲派' },
  hehun:   { icon: '💞', title: '合婚 · 双人合盘报告', tool: 'hehun_report',    name: '合婚' },
  zejiri:  { icon: '📅', title: '择吉 · 择日报告',     tool: 'zejiri_report',   name: '择吉' },
  consult: { icon: '🔀', title: '多流派 · 命理会诊报告', tool: 'consult_report',  name: '会诊' },
  full:    { icon: '🧿', title: '三门 · 命局综合完整报告', tool: 'full_report',     name: '综合' },
}

export function metaOf(type) {
  return REPORT_META[type] || { icon: '📄', title: '测算报告', tool: `${type}_report`, name: type }
}

// 生成统一报告外壳（各门类引擎调用）
// 自动读取元氣 AI 技能库，在报告开头注入「技法总纲」导读区块
export function makeReport(type, { sub, hero, meta, sections, advice }) {
  const m = metaOf(type)
  const guide = guideSectionOf(type)
  const allSections = []
  if (guide) allSections.push(guide)
  if (sections) allSections.push(...sections)
  const report = {
    ok: true,
    type,
    icon: m.icon,
    title: m.title,
    sub: sub || '',
    hero: hero || null,
    meta: meta || {},
    sections: allSections,
    advice: advice || null,
    markdown: '',
  }
  report.markdown = schemaToMarkdown(report)
  return report
}

export function failReport(error) {
  return { ok: false, error }
}

// ============ Markdown 序列化 ============

function mdTable(headers, rows, current) {
  const L = []
  L.push(`| ${headers.join(' | ')} |`)
  L.push(`| ${headers.map(() => '---').join(' | ')} |`)
  rows.forEach((r, i) => {
    const mark = current === i ? ' **（当前）**' : ''
    L.push(`| ${r.map(c => c ?? '-').join(' | ')} |${mark}`)
  })
  return L.join('\n')
}

function sectionToMd(s) {
  const L = []
  L.push(`### ${s.title}`)
  L.push('')
  switch (s.kind) {
    case 'guide': {
      L.push(`> 🧭 本报告由元氣AI「${s.data.name}」技能指导。解读思路：${s.data.methodText}`)
      break
    }
    case 'note': {
      L.push(s.data.text)
      break
    }
    case 'baziPillars': {
      L.push(mdTable(
        ['柱', '天干', '十神', '地支', '本气藏干', '纳音', '空亡'],
        s.data.items.map(p => [
          p.name, p.gan.char, p.gan.ten, p.zhi.char,
          (p.zhi.cang || []).map(c => `${c.char}(${c.ten})`).join(' '),
          p.nayin, p.kong || '-'
        ])
      ))
      break
    }
    case 'table': {
      L.push(mdTable(s.data.headers, s.data.rows, s.data.current))
      break
    }
    case 'chips': {
      for (const it of (s.data.items || [])) {
        const v = Array.isArray(it.value) ? it.value.join('、') : it.value
        L.push(v ? `- **${it.label}**：${v}` : `- ${it.label}`)
      }
      break
    }
    case 'kv': {
      // 两种数据形状都要认：baziReport 用的是 blocks，其它构建器用 items。
      // 只认 items 的话，子平派报告一到「格局定位」这一段就抛
      // 「s.data.items is not iterable」，整份报告直接失败。
      for (const it of (s.data.items || s.data.blocks || [])) L.push(`- **${it.k}**：${it.v ?? '-'}`)
      break
    }
    case 'cards': {
      for (const it of (s.data.items || [])) {
        L.push(`- **${it.title}**${it.sub ? `（${it.sub}）` : ''}`)
        if (it.desc) L.push(`  - ${it.desc}`)
      }
      break
    }
    case 'flow': {
      L.push(`**${s.data.current.label}** ${s.data.current.ganzhi}`)
      L.push('')
      L.push(s.data.current.note)
      L.push('')
      L.push('| 年份 | 干支 | 点评 |')
      L.push('| --- | --- | --- |')
      for (const f of s.data.future) L.push(`| ${f.year} | ${f.ganzhi} | ${f.note} |`)
      break
    }
    case 'bars': {
      for (const it of (s.data.items || [])) {
        const pct = Math.round((it.value / (it.max || 10)) * 100)
        L.push(`- **${it.label}**：${it.value}（${pct}%）`)
      }
      if (s.data.note2) L.push(s.data.note2)
      break
    }
    case 'rating': {
      for (const it of (s.data.items || [])) {
        const stars = '★'.repeat(it.value || 0) + '☆'.repeat((it.max || 5) - (it.value || 0))
        L.push(`- **${it.label}**：${stars}（${it.value}/${it.max || 5}）`)
      }
      if (s.data.note2) L.push(s.data.note2)
      break
    }
    case 'palaceGrid': {
      for (const it of (s.data.items || [])) {
        L.push(`- **${it.name}**${it.tag ? `〔${it.tag}〕` : ''}${it.sub ? `（${it.sub}）` : ''}`)
        if (it.desc) L.push(`  - ${it.desc}`)
      }
      break
    }
    case 'list': {
      for (const it of (s.data.items || [])) L.push(typeof it === 'string' ? `- ${it}` : `- ${it.text ?? JSON.stringify(it)}`)
      break
    }
    case 'dayunGroup': {
      L.push('| 大运 | 阶段 | 区间 | 说明 |')
      L.push('| --- | --- | --- | --- |')
      for (const d of (s.data.dayuns || [])) {
        L.push(`| ${d.name} | ${(d.tag || '').trim()} | ${d.sub || ''} | ${(d.desc || '').replace(/\|/g, '／')} |`)
      }
      break
    }
    case 'dayunDetail': {
      for (const c of (s.data.cards || [])) {
        const gz = c.gz ? ` ${c.gz}` : ''
        const wx = c.wx ? `（${c.wx}）` : ''
        const ss = Array.isArray(c.shiShen) ? c.shiShen.join('、') : (c.shiShen || '')
        L.push(`- **${c.name}**${gz}${wx}${ss ? ` · ${ss}` : ''}${c.desc ? `：${c.desc}` : ''}`)
      }
      break
    }
    case 'identity': {
      const d = s.data || {}
      const pillars = (d.pillars || []).map(p => `${p.label || ''}${p.gan || ''}${p.zhi || ''}`).filter(Boolean)
      if (pillars.length) L.push(`- **四柱**：${pillars.join(' · ')}`)
      if (d.dayMaster?.name) L.push(`- **日主**：${d.dayMaster.name}${d.dayMaster.wuxing ? `（${d.dayMaster.wuxing}）` : ''}`)
      if (d.favorable?.length) L.push(`- **喜用**：${d.favorable.join('、')}`)
      if (d.avoid?.length) L.push(`- **忌用**：${d.avoid.join('、')}`)
      if (d.qiyun?.text) L.push(`- **起运**：${d.qiyun.text}${d.qiyun.date ? ` · ${d.qiyun.date}` : ''}`)
      const basics = [['公历', d.solar], ['农历', d.lunar], ['生肖', d.zodiac], ['五行局', d.ju], ['命主', d.soul?.name], ['身主', d.body?.name]]
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}：${value}`)
      if (basics.length) L.push(`- **盘面资料**：${basics.join(' · ')}`)
      break
    }
    case 'bifold': {
      for (const block of ['dec', 'yr'].map(key => s.data?.[key]).filter(Boolean)) {
        const lead = [block.label, block.range, block.name, block.ganzhi].filter(Boolean).join(' · ')
        if (lead) L.push(`- **${lead}**`)
        if (block.note) L.push(`  - ${block.note}`)
        if (block.stars?.length) L.push(`  - 星曜：${block.stars.join('、')}`)
        if (block.mutagen?.length) L.push(`  - 四化：${block.mutagen.join('；')}`)
        if (block.shensha?.length) L.push(`  - 神煞：${block.shensha.join('、')}`)
      }
      break
    }
    // 复合章节：内部再套一组子章节，逐个递归渲染。
    // ⚠ 没有这一支的话会掉进下面的 default，把整块结构原样 JSON.stringify 出来 ——
    // 子平派完整报告的第一章就是 kvComposite，导出的 markdown 里因此夹着一大段
    // 裸 JSON，用户复制/下载拿到的是这个。
    case 'kvComposite': {
      for (const sub of s.data.subsections || []) {
        L.push(sectionToMd({ ...sub, title: sub.title || '' }).replace(/^### \n/, '').trim())
        L.push('')
      }
      break
    }
    default:
      // 兜底也不要吐 JSON：宁可少一段，也不要把内部结构塞给用户
      if (s.data && typeof s.data.text === 'string') L.push(s.data.text)
      else console.warn(`[reportSchema] 未处理的 section kind: ${s.kind}`)
  }
  L.push('')
  return L.join('\n')
}

export function schemaToMarkdown(report) {
  if (!report || !report.ok) return ''
  const m = metaOf(report.type)
  const L = []
  L.push(`# ${report.title}`)
  L.push('')
  if (report.sub) L.push(`> ${report.sub}`)
  if (report.hero) {
    L.push('')
    if (report.hero.chars && report.hero.chars.length) L.push(report.hero.chars.join(' '))
    if (report.hero.main) L.push(`> ${report.hero.main}`)
  }
  L.push('')
  let idx = 0
  for (const s of report.sections) {
    idx += 1
    L.push(`## ${idx}、${s.title}`)
    L.push('')
    L.push(sectionToMd({ ...s, title: '' }).replace(/^### \n/, '').trim())
    L.push('')
  }
  if (report.advice) {
    L.push('## 建议')
    L.push('')
    for (const [k, v] of Object.entries(report.advice)) {
      const names = { career: '事业', wealth: '财运', love: '感情', health: '健康', opening: '开运' }
      L.push(`- **${names[k] || k}**：${v}`)
    }
    L.push('')
  }
  L.push('---')
  L.push(`> 本报告由元氣AI「${m.name}」高精度引擎生成，仅供娱乐与参考，不构成任何决策依据。`)
  return L.join('\n')
}

export default REPORT_META
