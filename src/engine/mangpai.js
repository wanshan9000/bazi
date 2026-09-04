// 盲派命理分析引擎（盲派命理 · 终极实战操作系统 V3.0 落地）
// 输入：cantian-tymext 排盘结果 bazi 对象
// 输出：结构化盲派分析（三秒定太极 / 体用宾主 / 根基五维 / 做功七法 / 效率评级 / 墓库开合 / 应期算法 / 十神取象 / 伤门判定）
// 设计原则：确定性计算，无玄学依赖，逐节点可复现

export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' }
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' }
const ZHI_CANG = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
}

// ---- 干支关系表 ----
const GAN_HE = { 甲: '己', 乙: '庚', 丙: '辛', 丁: '壬', 戊: '癸' }
const GAN_HE_WX = { 甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火' }
const ZHI_LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' }
const ZHI_LIUHE_WX = { 子丑: '土', 寅亥: '木', 卯戌: '火', 辰酉: '金', 巳申: '水', 午未: '土' }
const SANHE = [
  { zhi: ['申', '子', '辰'], wx: '水' },
  { zhi: ['亥', '卯', '未'], wx: '木' },
  { zhi: ['寅', '午', '戌'], wx: '火' },
  { zhi: ['巳', '酉', '丑'], wx: '金' },
]
const SANHUI = [
  { zhi: ['寅', '卯', '辰'], wx: '木' },
  { zhi: ['巳', '午', '未'], wx: '火' },
  { zhi: ['申', '酉', '戌'], wx: '金' },
  { zhi: ['亥', '子', '丑'], wx: '水' },
]
const ZHI_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' }
const ZHI_HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' }
const XING3 = [['寅', '巳', '申'], ['丑', '戌', '未'], ['子', '卯']]
const ZI_XING = ['辰', '午', '酉', '亥']
const AN_HE = { 寅: '丑', 丑: '寅', 卯: '申', 申: '卯', 午: '亥', 亥: '午', 子: '巳', 巳: '子' }

const WX_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const WX_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
// 五行墓库
const MU_KU = { 木: '未', 火: '戌', 土: '戌', 金: '丑', 水: '辰' }
const KU_STORE = { 辰: '水', 戌: '火', 丑: '金', 未: '木' }

// 禄神表（天干 → 禄支）：甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子
const ZHI_LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' }

// 体用宾主分类
const TI_SET = ['比肩', '劫财', '食神', '伤官', '正印', '偏印'] // 体（我方）
const YONG_SET = ['正财', '偏财', '正官', '七杀'] // 用（目标）
const ZHU_POS = ['日柱', '时柱'] // 主位
const BIN_POS = ['年柱', '月柱'] // 宾位

// 十神：以日干为「我」
function shiShen(dayGan, otherGan) {
  const selfWx = GAN_WX[dayGan]
  const otherWx = GAN_WX[otherGan]
  const sameYang = isYang(dayGan) === isYang(otherGan)
  if (otherWx === selfWx) return sameYang ? '比肩' : '劫财'
  if (WX_SHENG[selfWx] === otherWx) return sameYang ? '食神' : '伤官'
  if (WX_KE[selfWx] === otherWx) return sameYang ? '偏财' : '正财'
  if (WX_KE[otherWx] === selfWx) return sameYang ? '七杀' : '正官'
  if (WX_SHENG[otherWx] === selfWx) return sameYang ? '偏印' : '正印'
  return '比肩'
}
function isYang(g) {
  return ['甲', '丙', '戊', '庚', '壬'].includes(g)
}

// 天干十神表（行=日干，列=其他干）
const TEN_GOD_TABLE = (() => {
  const t = {}
  for (const dm of GAN) {
    t[dm] = {}
    for (const g of GAN) t[dm][g] = shiShen(dm, g)
  }
  return t
})()

// ---- 工具函数 ----

// 60 甲子序号（干支 → 0-59）
function sexagenaryIndex(gan, zhi) {
  const g = GAN.indexOf(gan)
  const z = ZHI.indexOf(zhi)
  for (let n = 0; n < 60; n++) {
    if (n % 10 === g && n % 12 === z) return n
  }
  return 0
}

// 旬空（日柱干支所在旬未出现的两个地支）
export function kongWangOf(gan, zhi) {
  const xun = Math.floor(sexagenaryIndex(gan, zhi) / 10)
  const k1 = ((10 - 2 * xun) % 12 + 12) % 12
  const k2 = ((11 - 2 * xun) % 12 + 12) % 12
  return [ZHI[k1], ZHI[k2]]
}

// 当前年份与干支
export function currentYear() {
  return new Date().getFullYear()
}
export function yearGanzhi(y) {
  return { gan: GAN[(y - 4) % 10], zhi: ZHI[(y - 4) % 12] }
}

// ============ 第一阶段：三秒定太极（预处理） ============

function preprocess(bazi, pillars) {
  const dayGan = bazi.日主
  const dayZhi = pillars[2].zhi
  const dayKong = kongWangOf(dayGan, dayZhi)
  const results = []
  const notes = []

  // P0 天克地冲：与日主直接对冲 / 四柱之间
  const P0 = []
  const allZhi = pillars.map((p, i) => ({ zhi: p.zhi, name: p.name, i }))
  for (let i = 0; i < allZhi.length; i++) {
    for (let j = i + 1; j < allZhi.length; j++) {
      const a = allZhi[i], b = allZhi[j]
      if (ZHI_CHONG[a.zhi] === b.zhi) {
        P0.push(`${a.name}${a.zhi} 与 ${b.name}${b.zhi} 相冲（${a.zhi}${b.zhi}冲）`)
      }
    }
  }
  // 天干相克
  const ganKe = []
  const dayWx = GAN_WX[dayGan]
  for (const p of pillars) {
    if (p.name === '日柱') continue
    const w = GAN_WX[p.gan]
    if (WX_KE[w] === dayWx) ganKe.push(`${p.name}${p.gan}（${w}）克日主`)
    if (WX_KE[dayWx] === w) ganKe.push(`日主克${p.name}${p.gan}（${w}）`)
  }
  if (P0.length) {
    results.push({ key: 'P0', label: '天克地冲', found: true, detail: P0 })
    // 若同时存在 P1 合局，则按"冲合并存，合能解冲，先论合后论冲"处理，此处不单独下"先论冲"结论
  } else {
    results.push({ key: 'P0', label: '天克地冲', found: false, detail: [] })
  }

  // P1 三合 / 三会局
  const P1 = []
  const zhiSet = pillars.map(p => p.zhi)
  for (const s of SANHE) {
    const hit = s.zhi.filter(z => zhiSet.includes(z))
    if (hit.length >= 2) {
      const full = hit.length === 3
      const miss = s.zhi.find(z => !zhiSet.includes(z))
      P1.push(`${hit.join('')}${full ? '三合' : '拱'}${s.wx}局${miss ? `（缺${miss}，为虚神）` : ''}（${s.zhi.join('')}）`)
    }
  }
  for (const s of SANHUI) {
    const hit = s.zhi.filter(z => zhiSet.includes(z))
    if (hit.length >= 2) P1.push(`${hit.join('')}三会${s.wx}局（${s.zhi.join('')}）`)
  }
  if (P1.length) {
    results.push({ key: 'P1', label: '三合/三会局', found: true, detail: P1 })
    // 冲合并存 → 合能解冲，先论合后论冲；仅合无冲 → 先论合
    notes.push(P0.length ? '冲合并存 → 合能解冲，先论合后论冲。' : 'P1有合局 → 先论合。')
  } else {
    results.push({ key: 'P1', label: '三合/三会局', found: false, detail: [] })
  }

  // P2 虚神拱夹：三地支缺中间字（如寅戌拱午）
  const P2 = []
  for (const s of SANHE) {
    const hit = s.zhi.filter(z => zhiSet.includes(z))
    if (hit.length === 2) {
      const miss = s.zhi.find(z => !zhiSet.includes(z))
      const gap = s.zhi.indexOf(miss)
      if (gap === 1) {
        P2.push(`${hit.join('')}拱${miss}（${s.zhi.join('')}缺中字，虚神为${miss}）`)
      }
    }
  }
  if (P2.length) {
    results.push({ key: 'P2', label: '虚神拱夹', found: true, detail: P2 })
    notes.push('P2有虚神 → 虚神填实力翻倍，可改变格局。')
  } else {
    results.push({ key: 'P2', label: '虚神拱夹', found: false, detail: [] })
  }

  // P3 日柱空亡
  const P3 = dayKong.includes(dayZhi)
  results.push({ key: 'P3', label: '日柱空亡', found: P3, detail: P3 ? [`日坐空亡（${dayZhi}，旬空 ${dayKong.join('、')}），日主减分30%，逢填实大运才发力`] : [] })

  // 仅有冲而无合时，才下"先论冲"结论（有合则按 P1 分支的"合能解冲"处理，避免结论自相矛盾）
  if (P0.length && !P1.length) notes.push('P0有冲 → 先论冲。')

  // 结论（按优先级）：冲合并存时合能解冲，先论合后论冲
  let conclusion
  if (P0.length && P1.length) conclusion = `先论合（合能解冲）：${P1[0]}；后论冲：${P0[0]}`
  else if (P0.length) conclusion = '先论冲：' + P0[0]
  else if (P1.length) conclusion = '先论合：' + P1[0]
  else if (P2.length) conclusion = '先论虚神：' + P2[0]
  else if (P3) conclusion = `日坐空亡（${dayZhi}），逢${dayKong[0] || ''}填实之年才发力`
  else conclusion = '无冲无合无空，按常规结构论做功取象'

  const idx = r => (results.find(x => x.key === r) || {}).detail || []
  return { results, notes, conclusion, dayKong, dayZhi, ganKe, P0: idx('P0'), P1: idx('P1'), P2: idx('P2') }
}

// ============ 第二阶段：体用宾主 / 根基五维 / 空亡嵌入 ============

// 提取四柱十神（天干 + 地支藏干）
function pillarTenGods(bazi, pillars) {
  const dayGan = bazi.日主
  const list = []
  for (const p of pillars) {
    const cang = ZHI_CANG[p.zhi] || []
    for (let i = 0; i < cang.length; i++) {
      list.push({
        pos: p.name,
        depth: i === 0 ? '本气' : i === 1 ? '中气' : '余气',
        char: cang[i],
        ten: TEN_GOD_TABLE[dayGan][cang[i]],
      })
    }
    list.push({ pos: p.name, depth: '天干', char: p.gan, ten: p.name === '日柱' ? '日主' : TEN_GOD_TABLE[dayGan][p.gan] })
  }
  return list
}

function tiYongBinZhu(bazi, pillars, tenList) {
  const dayGan = bazi.日主
  const dayWx = GAN_WX[dayGan]
  const ti = []
  const yong = []
  const tiCount = {}
  const yongCount = {}
  for (const t of tenList) {
    const ten = t.ten
    if (TI_SET.includes(ten)) {
      ti.push(`${t.char}(${ten})`)
      tiCount[ten] = (tiCount[ten] || 0) + 1
    } else if (YONG_SET.includes(ten)) {
      yong.push(`${t.char}(${ten})`)
      yongCount[ten] = (yongCount[ten] || 0) + 1
    }
  }
  const zhu = pillars.filter(p => ZHU_POS.includes(p.name)).map(p => p.name).join('、')
  const bin = pillars.filter(p => BIN_POS.includes(p.name)).map(p => p.name).join('、')

  // 飞宫换象：宾位之体合入主位 → 十神变性
  const feiGong = []
  for (const t of tenList) {
    if (!BIN_POS.includes(t.pos)) continue
    const ten = t.ten
    if (ten === '正印' || ten === '偏印') {
      feiGong.push(`${t.pos}${t.char}印星（母/学历/资历）入主 → 变官，因文凭/资历/长辈提携得实权`)
    } else if (ten === '正财' || ten === '偏财') {
      feiGong.push(`${t.pos}${t.char}财星（父/资金）入主 → 变印，因资金/资产获得地位或平台`)
    } else if (ten === '正官' || ten === '七杀') {
      feiGong.push(`${t.pos}${t.char}官杀（权势/压力）入主 → 变财，因职权/地位转化为财富`)
    }
  }
  // 宾位比劫冲入主位
  const binBiJie = tenList.some(t => BIN_POS.includes(t.pos) && (t.ten === '比肩' || t.ten === '劫财'))
  if (binBiJie) feiGong.push('宾位比劫旺 → 团队/资金易被外部借用，给他人做嫁衣（大忌）')

  // 结论
  let conclusion
  if (feiGong.length) conclusion = '有飞宫换象：' + feiGong[0]
  else conclusion = `体（${ti.length ? ti.slice(0, 3).join('、') + '等' : '弱'}）vs 用（${yong.length ? yong.slice(0, 3).join('、') + '等' : '弱'}）`
  if (!ti.length && !yong.length) conclusion = '原局十神偏弱，重看岁运引动'

  return {
    ti, yong, zhu, bin, feiGong,
    tiCount, yongCount,
    conclusion,
    tiIsStrong: ti.length > yong.length,
  }
}

// 根基五维评分（对「体」— 日主五行打分，满分 15）
function genJiScore(bazi, pillars, pre) {
  const dayGan = bazi.日主
  const dayWx = GAN_WX[dayGan]
  const dims = []
  let total = 0

  // 距离映射：坐支3 / 月支2 / 时支1 / 年支0
  const distMap = { 年柱: 0, 月柱: 2, 时柱: 1, 日柱: 3 }

  // 汇总各柱中与日主同五行的根
  const roots = []
  for (const p of pillars) {
    const cang = ZHI_CANG[p.zhi] || []
    cang.forEach((c, i) => {
      if (GAN_WX[c] === dayWx) {
        roots.push({ pos: p.name, depth: i === 0 ? '本气' : i === 1 ? '中气' : '余气', char: c, zhi: p.zhi })
      }
    })
  }

  // 维度1：量级（-5 ~ +8）
  let liang = 0
  for (const r of roots) {
    if (r.depth === '本气') liang += 3
    else if (r.depth === '中气') liang += 2
    else liang -= 1
  }
  liang = Math.min(liang, 8)
  dims.push({ name: '量级', score: liang, desc: roots.length ? roots.map(r => `${r.pos}${r.zhi}${r.depth}${r.char}`).join('、') : '无本气中气根' })
  total += liang

  // 维度2：距离（坐支3/月支2/时支1/年支0，取最高）
  let dist = 0
  let distDesc = []
  for (const r of roots) {
    const d = distMap[r.pos] ?? 0
    if (d > dist) dist = d
    distDesc.push(`${r.pos}${r.zhi} ${r.depth}`)
  }
  dims.push({ name: '距离', score: dist, desc: distDesc.length ? distDesc.join('、') : '无根' })
  total += dist

  // 维度3：状态（被合化走-2 / 被冲动摇-1 / 被墓闭根-2）
  let state = 0
  const stateNotes = []
  const zhiSet = pillars.map(p => p.zhi)
  // 日主根支被合
  for (const r of roots) {
    const pair = zhiSet.filter(z => z !== r.zhi)
    const heWith = pair.find(z => ZHI_LIUHE[r.zhi] === z || ZHI_LIUHE[z] === r.zhi)
    if (heWith) {
      state -= 2
      stateNotes.push(`${r.zhi}与${heWith}六合，根被合化走`)
      break
    }
  }
  // 根支被冲
  for (const r of roots) {
    const chongWith = zhiSet.find(z => ZHI_CHONG[r.zhi] === z)
    if (chongWith) {
      state -= 1
      stateNotes.push(`${r.zhi}被${chongWith}冲，根动摇`)
      break
    }
  }
  // 根支入墓
  for (const r of roots) {
    if (r.zhi !== MU_KU[dayWx] && zhiSet.includes(MU_KU[dayWx])) {
      state -= 2
      stateNotes.push(`根入${MU_KU[dayWx]}墓库，闭根`)
      break
    }
  }
  dims.push({ name: '状态', score: state, desc: stateNotes.length ? stateNotes.join('；') : '根未被合/冲/墓' })
  total += state

  // 维度4：真假（根在体/主位 +2；根在用/宾位/制中 0）
  let truth = 0
  const truthNotes = []
  for (const r of roots) {
    if (ZHU_POS.includes(r.pos)) {
      truth += 2
      truthNotes.push(`${r.pos}${r.zhi}根在体主位，真根`)
    } else {
      truthNotes.push(`${r.pos}${r.zhi}根在宾位，力减`)
    }
  }
  dims.push({ name: '真假', score: truth, desc: truthNotes.length ? truthNotes.join('；') : '无根' })
  total += truth

  // 维度5：护卫（有印旁护 +1）
  let guard = 0
  const guardDesc = []
  const yinWx = Object.keys(WX_SHENG).find(k => WX_SHENG[k] === dayWx) // 生日主之五行（印）
  const yinPresent = pillars.some(p => GAN_WX[p.gan] === yinWx || (ZHI_CANG[p.zhi] || []).some(c => GAN_WX[c] === yinWx))
  if (yinPresent) {
    guard += 1
    guardDesc.push(`印星（${yinWx}）旁护，坚如铁`)
  } else {
    guardDesc.push('无印护，裸根易拔除')
  }
  dims.push({ name: '护卫', score: guard, desc: guardDesc.join('；') })
  total += guard

  // 空亡嵌入：日坐空亡减分 30%
  let kongPenalty = 0
  if (pre.dayKong.includes(pre.dayZhi)) {
    kongPenalty = Math.round(total * 0.3)
    total -= kongPenalty
  }

  // 判定
  let level, conclusion
  if (total >= 8) { level = '体强'; conclusion = '体强（≥8），可独立做功' }
  else if (total >= 4) { level = '体平'; conclusion = '体平（4-7），需借势，靠三合局或平台' }
  else { level = '体虚'; conclusion = '体虚（≤3），不可主攻，只能借势顺势、逢应期再发力' }
  if (kongPenalty > 0) conclusion += `；日坐空亡减分${kongPenalty}分（原${total + kongPenalty}）`

  return { dims, total, level, conclusion, kongPenalty }
}

// ============ 第三阶段：做功七法 / 优先级 / 效率评级 / 墓库 ============

function zuoGongAnalysis(bazi, pillars, ty, genji) {
  const dayGan = bazi.日主
  const dayWx = GAN_WX[dayGan]
  const zhiSet = pillars.map(p => p.zhi)
  const methods = [] // { name, desc, priority }
  const found = []

  const check = (name, desc, prio) => {
    found.push(name)
    methods.push({ name, desc, priority: prio })
  }

  // ① 制：体克用（日主或食伤克财/官）
  const keWoWx = Object.keys(WX_KE).find(k => WX_KE[k] === dayWx) // 克我（官杀）
  const woKeWx = WX_KE[dayWx] // 我克（财）
  const hasKeWealth = pillars.some(p => GAN_WX[p.gan] === woKeWx || (ZHI_CANG[p.zhi] || []).some(c => GAN_WX[c] === woKeWx))
  const hasShiShang = ty.ti.some(x => x.includes('食神') || x.includes('伤官'))
  const hasGuan = ty.yong.some(x => x.includes('正官') || x.includes('七杀'))
  if (hasKeWealth) check('制', `体克用：日主${dayGan}（${dayWx}）克财（${woKeWx}），直接制服取财`, 4)
  else if (hasShiShang && hasGuan) check('制', '食伤制官：以才华/技术制服压力，转化名声', 4)

  // ② 化：印化杀
  const hasYin = ty.ti.some(x => x.includes('正印') || x.includes('偏印'))
  if (hasYin && hasGuan) check('化', `印化杀：以文化/权谋化解压力（${dayGan}生印，印泄杀）`, 5)

  // ③ 合：日主合财 / 官合日主（天干五合，须合神透干才成立）
  const hePair = Object.entries(GAN_HE).find(([a, b]) => a === dayGan)
  if (hePair) {
    const partner = hePair[1]
    // 合神须出现在四柱天干（透干）才算日主被合，否则日主单方无合可论
    const partnerTou = pillars.some(p => p.gan === partner)
    const partnerTen = TEN_GOD_TABLE[dayGan][partner]
    if (partnerTou && (partnerTen === '正财' || partnerTen === '偏财')) check('合', `日主${dayGan}合${partner}（${partnerTen}）：得财被牵制，取用带羁绊`, 0)
    if (partnerTou && (partnerTen === '正官' || partnerTen === '七杀')) check('合', `日主${dayGan}合${partner}（${partnerTen}）：权来绑身`, 0)
  }
  // 地支六合（涉及日支）
  const dayZhi = pillars[2].zhi
  const dayHe = ZHI_LIUHE[dayZhi]
  if (dayHe && zhiSet.includes(dayHe)) check('合', `日支${dayZhi}与${dayHe}六合：锁定/羁绊，${ZHI_LIUHE_WX[dayZhi + dayHe] || ZHI_LIUHE_WX[dayHe + dayZhi]}局`, 0)

  // ④ 冲：冲开库门取物
  const chongs = []
  for (const z of zhiSet) {
    const c = ZHI_CHONG[z]
    if (zhiSet.includes(c) && zhiSet.indexOf(c) > zhiSet.indexOf(z)) chongs.push(`${z}${c}冲`)
  }
  const kuZhi = zhiSet.filter(z => '辰戌丑未'.includes(z))
  if (chongs.length) {
    // 库冲双向判断（chongs 元素为 `${z}${c}冲`，顺序不定：戌辰 / 辰戌 均可）
    const kuChong = chongs.filter(c => (c.includes('辰') && c.includes('戌')) || (c.includes('丑') && c.includes('未')))
    if (kuChong.length) check('冲', `${kuChong[0]}：冲开库门取财官，开门取物`, 1)
    else check('冲', `${chongs[0]}：冲为动/取/破，环境变动之象`, 1)
  }

  // ⑤ 穿（害）：暗中破坏取物
  const chuan = []
  for (const z of zhiSet) {
    const h = ZHI_HAI[z]
    if (zhiSet.includes(h) && zhiSet.indexOf(h) > zhiSet.indexOf(z)) chuan.push(`${z}${h}穿`)
  }
  if (chuan.length) {
    // 库穿双向判断（chuan 元素为 `${z}${h}穿`，顺序不定：午丑 / 丑午 均可）
    const kuChuan = chuan.filter(c => (c.includes('丑') && c.includes('午')) || (c.includes('酉') && c.includes('戌')))
    check('穿', `${chuan[0]}：暗损/隐疾/官司，${kuChuan.length ? '得财带伤，先论心脏/眼目或合作破财' : '暗中破坏取物'}`, 2)
  }

  // ⑥ 刑：刑罚之制
  const xings = []
  for (const group of XING3) {
    const hit = group.filter(z => zhiSet.includes(z))
    if (hit.length >= 2) xings.push(hit.join('') + '三刑')
  }
  for (const z of zhiSet) {
    if (ZI_XING.includes(z) && zhiSet.filter(x => x === z).length >= 2) xings.push(`${z}${z}自刑`)
  }
  if (xings.length) check('刑', `${xings[0]}：刑罚/自我缠绕，三刑入命必应非官即病`, 3)

  // ⑦ 暗合：隐形做功
  const anhe = []
  for (const z of zhiSet) {
    const a = AN_HE[z]
    if (a && zhiSet.includes(a) && zhiSet.indexOf(a) > zhiSet.indexOf(z)) anhe.push(`${z}${a}暗合`)
  }
  if (anhe.length) check('暗合', `${anhe[0]}：隐形做功，主灰色收入/地下情/隐秘合作`, 6)

  // 排序（优先级 合0 > 冲1 > 穿2 > 刑3 > 制4 > 化5 > 暗合6）
  methods.sort((a, b) => a.priority - b.priority)

  // 主做功方式
  let main
  if (methods.length) main = methods[0]

  // 效率评级 S/A/B/C
  const wealthGan = pillars.some(p => {
    const ten = TEN_GOD_TABLE[dayGan][p.gan]
    return ten === '正财' || ten === '偏财'
  })
  const guanGan = pillars.some(p => {
    const ten = TEN_GOD_TABLE[dayGan][p.gan]
    return ten === '正官' || ten === '七杀'
  })
  // 用神根气：财/官在地支有无根
  const yongWx = [WX_KE[dayWx], Object.keys(WX_KE).find(k => WX_KE[k] === dayWx)]
  const yongRoot = pillars.some(p => (ZHI_CANG[p.zhi] || []).slice(0, 2).some(c => yongWx.includes(GAN_WX[c])))
  // —— 开库爆发加成（V12.0）：体根或用神根落在墓库，且被冲/穿开库 →
  //    视为「闭锁-冲开」型爆发格，向上升级，而非按静态「库根闭锁」降级
  const kuZhi2 = zhiSet.filter(z => '辰戌丑未'.includes(z))
  const rootInKu = rootsInKu(pillars, dayWx, yongWx) // 体/用神根是否入墓库
  // 库冲/穿检测：命中「辰戌」或「丑未」对（顺序不固定，如"戌辰冲"）
  const hasKuChongPair = s => (s.includes('辰') && s.includes('戌')) || (s.includes('丑') && s.includes('未'))
  const kuChongOpen = chongs.some(c => hasKuChongPair(c)) && rootInKu
  const kuChuanOpen = chuan.some(c => hasKuChongPair(c)) && rootInKu
  const kaiKu = kuChongOpen || kuChuanOpen // 库门被冲/穿开
  // —— 做功结构加成（V12.0）：双库对冲（三支以上）、伤官生财、伤官坐禄生财、虚神拱夹
  const shangGuanShengCai = hasShiShang && hasKeWealth
  // 伤官/食神坐禄（本气根）且透干生财 → 「才华禄根生财」，V12.0 视为高效明路
  const shiShang = ty.ti.find(x => /\((食神|伤官)\)/.test(x))
  const shiShangGan = shiShang ? shiShang.match(/^[甲乙丙丁戊己庚辛壬癸]/)?.[0] : ''
  const shiShangYouLu = shiShangGan && pillars.some(p => p.gan === shiShangGan && ZHI_LU[shiShangGan] === p.zhi)
  const shiShangShengCaiLu = shiShangYouLu && hasKeWealth
  const doubleKuChong = kuChongOpen && kuZhi2.length >= 3
  const structBonus = (shangGuanShengCai ? 1 : 0) + (shiShangShengCaiLu ? 1 : 0) + (doubleKuChong ? 1 : 0) + (kaiKu ? 1 : 0)
  const xiaoLv = gradeXiaoLv({ genji: genji.level, main: main && main.name, yongRoot, wealthGan, guanGan, hasShiShang, kaiKu, structBonus })

  return { methods, main, chongs, chuan, xings, anhe, xiaoLv, kaiKu, structBonus, rootInKu }
}

// 判断日主体根 / 财官用神根 是否落在墓库（辰戌丑未）之中
function rootsInKu(pillars, dayWx, yongWx) {
  return pillars.some(p => {
    if (!'辰戌丑未'.includes(p.zhi)) return false
    const cang = ZHI_CANG[p.zhi] || []
    return cang.some(c => GAN_WX[c] === dayWx || yongWx.includes(GAN_WX[c]))
  })
}

// 效率评级（V12.0 校准：引入「开库爆发」与「做功结构」加成）
function gradeXiaoLv(o) {
  const { genji, main, yongRoot, kaiKu, structBonus = 0 } = o
  // 制尽：用神虚透无根（财/官在天干，地支无根）
  const xuTou = o.wealthGan || o.guanGan
  if (xuTou && !yongRoot && genji === '体强' && (main === '制' || main === '冲')) {
    return { grade: 'S', desc: 'S级（大富大贵）：用神虚透无根，被彻底制服 → 制尽，效率100%' }
  }
  // —— 开库爆发格（V12.0）：库根待冲、冲开翻倍，即便体平也属爆发型，A/A+ 级
  if (kaiKu && genji !== '体虚') {
    if (structBonus >= 3 || genji === '体强') {
      return { grade: 'A+', desc: 'A+级（暴富贵格）：库门被冲开 + 做功结构齐备（伤官生财/双库对冲），闭锁-冲开型爆发，三年不开张开张吃三年' }
    }
    return { grade: 'A', desc: 'A级（中富中贵偏上）：库根被冲开，闭锁待冲之格，冲库之年可跃升，非静态普通命' }
  }
  if (yongRoot && genji === '体强') {
    return { grade: 'A', desc: 'A级（中富中贵）：用神有中气根，体强能压制住 → 制不尽但拿大头' }
  }
  if (yongRoot && genji === '体平') {
    // 体平但有伤官生财结构 → 借势技术取财，略高于纯静态 B
    if (structBonus >= 2) {
      return { grade: 'B+', desc: 'B+级（中富偏上）：体平但伤官生财结构清晰，靠才华/技术借势取财，逢旺财大运可再上探' }
    }
    return { grade: 'B', desc: 'B级（小康/小贵）：用神有强根，体只能压制一半 → 有天花板，伴随竞争' }
  }
  if (genji === '体虚') {
    return { grade: 'C', desc: 'C级（普通/辛苦）：体虚或被反制 → 做功效率低下' }
  }
  return { grade: 'B', desc: 'B级（小康/小贵）：常规格局，稳中求进' }
}

// 墓库开合十二法则
function muKuAnalysis(pillars) {
  const zhiSet = pillars.map(p => p.zhi)
  const kuZhi = zhiSet.filter(z => '辰戌丑未'.includes(z))
  const out = []
  if (!kuZhi.length) return { found: false, details: [], conclusion: '原局无墓库，不涉开合' }

  const unique = [...new Set(kuZhi)]
  // 单冲
  const hasChenXu = unique.includes('辰') && unique.includes('戌')
  const hasChouWei = unique.includes('丑') && unique.includes('未')
  if (hasChenXu || hasChouWei) {
    const pair = hasChenXu ? '辰戌' : '丑未'
    const count = kuZhi.filter(z => pair.includes(z)).length
    if (count >= 3) {
      out.push({ rule: '双冲', desc: `${pair}冲且其中一支双现（${count}个库支）→ 库门破，能量散尽，大破财或失控（不可逆）` })
    } else {
      out.push({ rule: '单冲', desc: `${pair}冲 → 库门开，可取财官，但过程激烈（破产式发财）` })
    }
  }
  // 穿刑开库
  const chuan = []
  for (const z of kuZhi) {
    const h = ZHI_HAI[z]
    if (zhiSet.includes(h)) chuan.push(`${z}${h}穿`)
  }
  if (chuan.length) out.push({ rule: '穿刑开库', desc: `${chuan[0]} → 暗开带伤，得偏财但惹官司/暗疾` })

  // 三合引化
  for (const s of SANHE) {
    if (s.zhi.every(z => zhiSet.includes(z)) && s.zhi.some(z => '辰戌丑未'.includes(z))) {
      out.push({ rule: '三合引化', desc: `${s.zhi.join('')}三合${s.wx}局 → 库气被合化，改变做功方向，守财变投资` })
    }
  }

  const conclusion = out.length
    ? `墓库操作：${out[0].rule}。` + out[0].desc
    : '墓为容器，冲刑穿为钥匙；无匙不开库。原局库支静守，逢岁运冲刑穿开库。'
  return { found: true, details: out, conclusion, kuZhi: unique }
}

// ============ 第三阶段补：做功十二法全筛查 + 功神废神 + 做功链条图 ============

// V12.0 第五卷：十二种做功手段全筛查（逐项打勾），返回结构化表格数据
function zuoFullScreen(bazi, pillars, ty, zuo, muku) {
  const dayGan = bazi.日主
  const dayWx = GAN_WX[dayGan]
  const zhiSet = pillars.map(p => p.zhi)
  const ganSet = pillars.map(p => p.gan)
  const kuZhi = zhiSet.filter(z => '辰戌丑未'.includes(z))
  const rows = []

  const add = (name, exists, detail, stars) => {
    rows.push({ name, exists: !!exists, detail, stars: exists ? stars : 0 })
  }

  // 1. 冲（主功：开库）
  const chongs = zuo.chongs || []
  add('冲', chongs.length, chongs.length ? (chongs[0] + '（开库之王，主做功）') : '', 5)
  // 2. 六合（辅功：智取绑定）
  const liuhe = []
  for (const z of zhiSet) { const h = ZHI_LIUHE[z]; if (zhiSet.includes(h) && zhiSet.indexOf(h) > zhiSet.indexOf(z)) liuhe.push(`${z}${h}合`) }
  add('六合', liuhe.length, liuhe.length ? (liuhe[0] + '（智取绑定）') : '', 4)
  // 3. 穿（害，暗功）
  add('穿（害）', (zuo.chuan || []).length, (zuo.chuan || []).length ? (zuo.chuan[0] + '（杀敌一千自损八百）') : '', 3)
  // 4. 刑（内耗）
  add('刑', (zuo.xings || []).length, (zuo.xings || []).length ? (zuo.xings[0] + '（内耗）') : '', 2)
  // 5. 墓（开库特型）
  add('墓', kuZhi.length, kuZhi.length ? (kuZhi.join('') + '为库（' + kuZhi.map(z => KU_STORE[z]).join('/') + '），对冲即开库') : '', kuZhi.length ? 4 : 0)
  // 6. 克（天干制）
  const keList = []
  for (const g of ganSet) {
    const keTarget = WX_KE[GAN_WX[g]]
    const hit = ganSet.filter(o => GAN_WX[o] === keTarget)
    if (hit.length) keList.push(`${g}克${hit.join('')}`)
  }
  add('克', keList.length, keList.length ? (keList[0] + '（直制）') : '', 2)
  // 7. 生（伤官生财等）
  const shengList = []
  for (const g of ganSet) {
    const shengWx = WX_SHENG[GAN_WX[g]]
    const hit = ganSet.filter(o => GAN_WX[o] === shengWx)
    if (hit.length) shengList.push(`${g}生${hit.join('')}`)
  }
  add('生', shengList.length, shengList.length ? (shengList[0] + '（伤官生财之明路）') : '', 4)
  // 8. 泄（日主泄于食伤）
  const dayShengWx = WX_SHENG[dayWx]
  const xie = ganSet.some(g => GAN_WX[g] === dayShengWx) || zhiSet.some(z => (ZHI_CANG[z] || []).some(c => GAN_WX[c] === dayShengWx))
  add('泄', xie, xie ? ('日主' + dayGan + '泄于' + dayShengWx + '（才华输出）') : '', 3)
  // 9. 伏吟（同柱重现）
  const fuyin = {}
  for (const p of pillars) fuyin[p.zhi] = (fuyin[p.zhi] || 0) + 1
  const fuyinZhi = Object.entries(fuyin).filter(([, c]) => c >= 2)
  add('伏吟', fuyinZhi.length, fuyinZhi.length ? (fuyinZhi[0][0] + '×' + fuyinZhi[0][1] + '（事情反复牵扯）') : '', 2)
  // 10. 反吟（六冲反吟）
  add('反吟', chongs.length, chongs.length ? (chongs[0] + '（六冲反吟，颠覆求变）') : '', 5)
  // 11. 暗合（隐形功）
  add('暗合', (zuo.anhe || []).length, (zuo.anhe || []).length ? (zuo.anhe[0] + '（隐形功/地下合作）') : '', 3)

  // —— 功神 / 废神 / 半废神定位（V12.0：按参与做功量与贡献排序）
  // 地支：参与冲/穿/合的为功神（贡献高）；被冲/穿的目标支为目标神（供出财官）；余为废神
  // 天干：做功（克/生目标）为功神或半废；财/官/杀为目标神；比劫/闲神为废神
  const gongShen = [] // 功神
  const feiShen = []  // 废神（含目标神）
  const half = []     // 半废神
  const seenG = {}
  const contribZhi = (z) => {
    let c = 0
    if ((zuo.chongs || []).some(x => x.includes(z))) c += 80 // 冲：主功
    if ((liuhe || []).some(x => x.includes(z))) c += 40       // 六合：辅功
    if ((zuo.chuan || []).some(x => x.includes(z))) c += 30   // 穿：暗功（消耗主体）
    return c
  }
  // 用神五行（财=我克，官杀=克我）
  const caiWx = WX_KE[dayWx]        // 财
  const guanWx = Object.keys(WX_KE).find(k => WX_KE[k] === dayWx) // 官杀
  // 目标神 = 被冲/穿，且该支是「财库」或「官杀库」（火/土等墓库），冲开即取财官
  // 注：辰为水库（比劫），非财官库 → 辰属功神（开财库者），不列目标神
  const beTargetZhi = (z) => {
    const isBeiChong = ZHI_CHONG[z] && zhiSet.includes(ZHI_CHONG[z])
    const isBeiChuan = ZHI_HAI[z] && zhiSet.includes(ZHI_HAI[z])
    if (!isBeiChong && !isBeiChuan) return false
    const kuOf = Object.entries(MU_KU).find(([, ku]) => ku === z)
    if (!kuOf) return false
    const storeWx = kuOf[0] // 该库所藏之五行（如戌→火/土）
    return storeWx === caiWx || storeWx === guanWx // 财库或官杀库 → 猎物
  }
  for (const p of pillars) {
    if (seenG[p.zhi]) continue
    seenG[p.zhi] = true
    const l = contribZhi(p.zhi)
    if (beTargetZhi(p.zhi)) {
      // V12.0：被冲/穿且藏用神的库/根（如戌火库含丁财戊杀）→ 目标神，供出财官
      feiShen.push({ char: p.zhi, role: '目标神', contrib: 0, note: '被冲/穿取，供出财官' + (l > 0 ? '（亦参与做功）' : '') })
    } else if (l > 0) {
      gongShen.push({ char: p.zhi, role: '功神', contrib: l, note: l >= 80 ? '承担主要做功量' : l >= 60 ? '参与做功量' : '暗做功，消耗主体' })
    } else {
      feiShen.push({ char: p.zhi, role: '废神', contrib: 0, note: '未参与做功' })
    }
  }
  // 天干功神/废神（V12.0：财/官/杀为目标神，劫财为废神，做功之干为功神/半废）
  const ganSeen = {}
  for (const g of ganSet) {
    if (ganSeen[g] || g === dayGan) { ganSeen[g] = true; continue } // 日主不列
    ganSeen[g] = true
    const ten = TEN_GOD_TABLE[dayGan][g]
    const isKeGong = keList.some(k => k.startsWith(g + '克'))     // 此干克他人（做功）
    const isShengGong = shengList.some(s => s.startsWith(g + '生')) // 此干生他人（做功）
    if (ten === '正财' || ten === '偏财' || ten === '正官' || ten === '七杀') {
      feiShen.push({ char: g, role: '目标神', contrib: 0, note: '猎物，不作为功神' })
    } else if (isKeGong || isShengGong) {
      // 做功之干：若坐禄/有根为功神，虚透为半废
      const youLu = ZHI_LU[g] === pillars.find(p => p.gan === g)?.zhi
      const role = youLu ? '功神' : '半废神'
      ;(youLu ? gongShen : half).push({ char: g, role, contrib: youLu ? 60 : 30, note: (isKeGong ? '克' : '生') + '目标做功' })
    } else if (ten === '劫财' || ten === '比肩') {
      feiShen.push({ char: g, role: '废神', contrib: 0, note: '分夺目标，徒增内耗' })
    } else {
      half.push({ char: g, role: '半废神', contrib: 10, note: '间接参与' })
    }
  }
  gongShen.sort((a, b) => b.contrib - a.contrib)
  half.sort((a, b) => b.contrib - a.contrib)
  feiShen.sort((a, b) => b.contrib - a.contrib)

  // —— 做功链条（能量流向：投入端 → 博弈端 → 收获端）
  const workChain = buildWorkChain(bazi, pillars, ty, zuo)

  return { rows, gongShen, feiShen, half, workChain }
}

// 做功链条可视化（V12.0 第五卷：投入端 → 博弈端 → 收获端）
function buildWorkChain(bazi, pillars, ty, zuo) {
  const lines = []
  const zhiSet = pillars.map(p => p.zhi)
  const dayGan = bazi.日主
  // 投入端：体（比劫食伤印）中参与做功者
  const tiChars = ty.ti.map(x => (x.match(/^[甲乙丙丁戊己庚辛壬癸]/) || [])[0]).filter(Boolean)
  const tou = [...new Set(tiChars)].join('、') || dayGan
  // 博弈端：被冲/穿/合的目标支
  const bo = (zuo.chongs || [])[0] || (zuo.chuan || [])[0] || (zuo.anhe || [])[0] || '财库'
  // 收获端：取出的用神
  const shou = [...new Set(ty.yong.map(x => (x.match(/\(([^)]+)\)/) || [])[1]).filter(Boolean))].join('、') || '财官'
  lines.push(`【投入端】${tou}（体/才华/根基）`)
  lines.push(`        ↓ ${(zuo.main && zuo.main.name) || '冲'} `)
  lines.push(`【博弈端】${bo}（用/目标/库）`)
  lines.push(`        ↓ 开库取物`)
  lines.push(`【收获端】${shou}（财/官/杀）到手`)
  return lines
}

// ============ 第四阶段：大运流年应期 ============

function yingQiAnalysis(bazi, pillars, pre) {
  const dayGan = bazi.日主
  const dayZhi = pillars[2].zhi
  const dayKong = pre.dayKong
  const yNow = currentYear()
  const nowGz = yearGanzhi(yNow)
  const yunList = (bazi.大运 && bazi.大运.大运) || []
  const curYun = yunList.find(d => yNow >= d.开始年份 && yNow <= d.结束) || null

  const out = { year: yNow, ganzhi: `${nowGz.gan}${nowGz.zhi}`, dayun: null, triggers: [], conclusion: '' }

  // 大运换象审查：大运干支与日主合/化
  if (curYun) {
    const dyGan = curYun.干支[0]
    const dyZhi = curYun.干支[1]
    const he = GAN_HE[dayGan]
    const yunHe = he === dyGan ? `${dayGan}${dyGan}合` : ''
    const yunChong = ZHI_CHONG[dayZhi] === dyZhi ? `${dayZhi}${dyZhi}冲` : ''
    const yunSanhe = SANHE.find(s => s.zhi.includes(dyZhi) && s.zhi.filter(z => pillars.some(p => p.zhi === z)).length >= 2)
    let note = `当前大运：${curYun.干支}（${curYun.天干十神 || ''}，${curYun.开始年龄}-${curYun.结束年龄}岁）`
    const xiang = []
    if (yunHe) xiang.push(`${yunHe}：运来改象，功随运转`)
    if (yunSanhe) xiang.push(`与${yunSanhe.zhi.join('')}构成${yunSanhe.wx}局：换象质变`)
    if (yunChong) xiang.push(`${yunChong}：大运冲日，十年变动`)
    if (xiang.length) note += '；' + xiang.join('；')
    out.dayun = { ganzhi: curYun.干支, age: `${curYun.开始年龄}-${curYun.结束年龄}岁`, years: `${curYun.开始年份}-${curYun.结束}`, note, change: xiang }
  }

  // 流年三大引爆点
  const triggers = []
  // P0 空亡填实
  if (dayKong.includes(nowGz.zhi)) {
    triggers.push({ key: 'P0', label: '空亡填实', desc: `流年${nowGz.zhi}＝日柱空亡（${dayKong.join('、')}），必应事，吉凶翻倍` })
  }
  // P1 冲合大运
  if (curYun) {
    const dyZhi = curYun.干支[1]
    if (ZHI_CHONG[nowGz.zhi] === dyZhi || ZHI_CHONG[dyZhi] === nowGz.zhi) {
      triggers.push({ key: 'P1', label: '冲大运', desc: `流年${nowGz.zhi}冲大运${dyZhi} → 环境剧变（调岗/搬家/婚变）` })
    }
    const heOf = ZHI_LIUHE[nowGz.zhi]
    if (heOf === dyZhi || heOf === nowGz.zhi) {
      triggers.push({ key: 'P1', label: '合大运', desc: `流年${nowGz.zhi}合大运${dyZhi} → 新合作/锁定关系` })
    }
  }
  // P2 伏吟反吟
  if (nowGz.gan === dayGan && nowGz.zhi === dayZhi) {
    triggers.push({ key: 'P2', label: '伏吟日柱', desc: `${nowGz.gan}${nowGz.zhi}年伏吟日柱${dayGan}${dayZhi} → 自我意识极强，成败系于自身` })
  }
  const yearZhi = yearGanzhi(yNow).zhi
  const yearGanNow = yearGanzhi(yNow).gan
  const ypGan = pillars[0].gan, ypZhi = pillars[0].zhi
  if (yearGanNow === ypGan && yearZhi === ypZhi) {
    triggers.push({ key: 'P2', label: '伏吟年柱', desc: '流年与年柱伏吟 → 自我意识强，成败系于自身' })
  }
  if (ZHI_CHONG[yearZhi] === ypZhi) {
    triggers.push({ key: 'P2', label: '反吟年柱', desc: `流年${yearGanNow}${yearZhi}反吟年柱 → 根基动摇，长辈/祖业/大本营有事` })
  }

  out.triggers = triggers
  if (triggers.length) {
    out.conclusion = `流年${nowGz.gan}${nowGz.zhi}年引爆点：` + triggers.map(t => t.label).join('、')
  } else {
    out.conclusion = `流年${nowGz.gan}${nowGz.zhi}年无明显引爆点，按大运走势稳步推进`
  }
  return out
}

// ============ 第五阶段：十神取象 / 伤门判定 ============

const QU_XIANG = {
  正印: { career: '文职/教育/房产/合同', liuqin: '母/长辈/贵人', body: '头/心/血', high: ['印带文昌 → 文贵', '印带羊刃 → 军政/执法背景'] },
  偏印: { career: '文职/研究/玄学/医疗', liuqin: '继母/长辈/偏门贵人', body: '脑/神经', high: ['偏印多 → 思想独特，宜玄学/偏门技艺'] },
  比肩: { career: '团队/同行/合伙/体力', liuqin: '兄弟/朋友/同辈', body: '手足/肌/骨', high: [] },
  劫财: { career: '竞争/合作/财务操作', liuqin: '姐妹/合伙人/同事', body: '手足/血液', high: ['劫财旺 → 破财风险，合作分账要清'] },
  食神: { career: '技术/口才/艺术/投资', liuqin: '子女/下属/学生', body: '生殖/排泄', high: [] },
  伤官: { career: '创意/表达/创新/冒险', liuqin: '子女/叛逆下属', body: '生殖/口舌', high: ['伤官见官 → 是非多，忌锋芒过露'] },
  正财: { career: '贸易/金融/实体/现金', liuqin: '妻/正财/父', body: '内分泌/代谢', high: ['财带墓库（辰戌丑未）→ 存量财（房产/仓储）', '财虚透无根 → 现金流快钱'] },
  偏财: { career: '投资/流通/副业/偏门', liuqin: '父/情人/流动财', body: '肝胆', high: ['财带驿马（寅申巳亥）→ 动态财（外贸/物流）'] },
  正官: { career: '管理/公职/传统行业', liuqin: '夫/领导/名誉', body: '筋骨/胆/泌尿', high: ['官带桃花 → 职场上位靠异性贵人', '官带刑穿 → 权谋上位，有暗敌'] },
  七杀: { career: '军警/武职/开拓/高压', liuqin: '夫/小人/压力', body: '筋骨/胆/泌尿', high: ['七杀有制 → 威权，无制 → 压力成疾'] },
}

function quXiangAnalysis(bazi, ty) {
  const items = []
  const seen = {}
  const push = (ten, info) => {
    if (seen[ten]) return
    seen[ten] = true
    items.push({
      ten, career: info.career, liuqin: info.liuqin, body: info.body,
      high: info.high.filter(Boolean).slice(0, 2),
    })
  }
  for (const key of Object.keys(QU_XIANG)) {
    if ((ty.tiCount[key] || 0) > 0 || (ty.yongCount[key] || 0) > 0) push(key, QU_XIANG[key])
  }
  return items
}

// 伤门判定：三刑/六害/自刑
function shangMenAnalysis(pillars) {
  const zhiSet = pillars.map(p => p.zhi)
  const issues = []
  // 三刑俱全
  for (const group of XING3) {
    const hit = group.filter(z => zhiSet.includes(z))
    if (hit.length >= 3) {
      issues.push({ name: '三刑俱全', desc: `${hit.join('')}三刑俱全 → 自我缠绕，运发非官即病；有制则大发，无制大灾` })
    } else if (hit.length === 2) {
      issues.push({ name: '三刑半见', desc: `${hit.join('')}刑 → 谨防口舌是非、刑伤小疾` })
    }
  }
  // 六害入命
  for (const z of zhiSet) {
    const h = ZHI_HAI[z]
    if (zhiSet.includes(h)) {
      issues.push({ name: '六害（穿）', desc: `${z}${h}穿 → 一生暗疾或小人不断；旺者得利，弱者受损` })
      break
    }
  }
  // 自刑
  for (const z of zhiSet) {
    if (ZI_XING.includes(z) && zhiSet.filter(x => x === z).length >= 2) {
      issues.push({ name: '自刑', desc: `${z}${z}自刑 → 自寻烦恼/自我纠结，运发易抑郁或决策反复` })
      break
    }
  }
  return issues
}

// ============ 第六阶段：神煞 + 四柱纳音 + 通根距离系数 ============

// 禄神（天干 → 禄支）
const LU_SHEN = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' }
// 天乙贵人（日干 → 贵人支）
const GUI_REN = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['寅', '午'],
}
// 三合局 → 对应之 华盖 / 桃花 / 驿马 支
const SANHE_SYMBOL = {
  '申子辰': { huaGai: '辰', taoHua: '酉', yiMa: '寅' },
  '寅午戌': { huaGai: '戌', taoHua: '卯', yiMa: '申' },
  '巳酉丑': { huaGai: '丑', taoHua: '午', yiMa: '亥' },
  '亥卯未': { huaGai: '未', taoHua: '子', yiMa: '巳' },
}

// 神煞全查（V12.0 第六卷）：禄神 / 天乙贵人 / 华盖 / 桃花 / 驿马
export function shenShaAnalysis(pillars, dayGan) {
  const zhiSet = pillars.map(p => p.zhi)
  const ganSet = pillars.map(p => p.gan)
  const items = []
  const add = (name, find, pos, note) => {
    items.push({ name, found: !!find, pos: pos || '', note })
  }

  // 禄神：日干之禄在地支（缺失也列出，V12.0 专讲「禄神缺失」）
  const lu = LU_SHEN[dayGan]
  const luHit = zhiSet.includes(lu)
  add('禄神', luHit, pillars.find(p => p.zhi === lu)?.name, luHit ? `${dayGan}见${lu}，身有其本，食禄不缺` : `${dayGan}禄在${lu}，原局不现 → 禄神缺失，一生多奔波求食，不守一城一池`)

  // 天乙贵人：日干之贵人在支
  const gui = GUI_REN[dayGan] || []
  const guiHit = gui.filter(g => zhiSet.includes(g))
  add('天乙贵人', guiHit.length, guiHit.map(g => pillars.find(p => p.zhi === g)?.name).filter(Boolean).join('、'), guiHit.length ? `贵人${guiHit.join('、')}，逢贵人支应事有助` : `贵人在${gui.join('、')}，原局不现，贵人不显`)

  // 三合局确定华盖/桃花/驿马基准（按日支）
  const dayZhi = pillars[2]?.zhi || ''
  const sanhe = Object.entries(SANHE_SYMBOL).find(([s]) => s.includes(dayZhi))
  const sym = sanhe ? sanhe[1] : null

  // 华盖 / 桃花 / 驿马：命中列出，缺失亦列出（V12.0 明确标注缺失之象）
  if (sym) {
    const hg = sym.huaGai
    const hgHit = zhiSet.includes(hg)
    add('华盖', hgHit, pillars.find(p => p.zhi === hg)?.name, hgHit ? `自坐${hg}华盖，技术精湛、性格孤高、不喜阿谀` : `华盖在${hg}，原局不现`)
    const th = sym.taoHua
    const thHit = zhiSet.includes(th)
    add('桃花', thHit, pillars.find(p => p.zhi === th)?.name, thHit ? `自坐${th}桃花，异性缘强` : `桃花在${th}，原局不现 → 异性缘平淡，不靠色相吃饭`)
    const ym = sym.yiMa
    const ymHit = zhiSet.includes(ym)
    add('驿马', ymHit, pillars.find(p => p.zhi === ym)?.name, ymHit ? `自坐${ym}驿马，一生多动` : `驿马在${ym}，原局不现 → 平时不爱动，逢${ym}年引动必大迁徙/转型`)
  }

  return items
}

// 四柱纳音（V12.0 模块一：纳音四柱 + 高维势能共振）
const NAYIN_60 = (() => {
  // 60甲子 → 纳音：五行 + 水二物
  const seq = [
    ['海中金', '水'], ['炉中火', '火'], ['大林木', '木'], ['路旁土', '土'], ['剑锋金', '金'],
    ['山头火', '火'], ['涧下水', '水'], ['城头土', '土'], ['白蜡金', '金'], ['杨柳木', '木'],
    ['泉中水', '水'], ['屋上土', '土'], ['霹雳火', '火'], ['松柏木', '木'], ['长流水', '水'],
    ['沙中金', '金'], ['山下火', '火'], ['平地木', '木'], ['壁上土', '土'], ['金箔金', '金'],
    ['覆灯火', '火'], ['天河水', '水'], ['大驿土', '土'], ['钗钏金', '金'], ['桑柘木', '木'],
    ['大溪水', '水'], ['沙中土', '土'], ['天上火', '火'], ['石榴木', '木'], ['大海水', '水'],
  ]
  const map = {}
  for (let i = 0; i < 60; i++) {
    const gan = GAN[i % 10]
    const zhi = ZHI[i % 12]
    const pair = seq[Math.floor(i / 2)]
    map[gan + zhi] = { nayin: pair[0], wx: pair[1] }
  }
  return map
})()

export function naYinAnalysis(pillars) {
  return pillars.map(p => ({
    pos: p.name, gan: p.gan, zhi: p.zhi, ...(NAYIN_60[p.gan + p.zhi] || { nayin: '未知', wx: '' }),
  }))
}

// 通根距离系数（V12.0 第二卷：本柱根 / 别柱根 / 有效距离系数 / 力量评分 / 虚实）
// 分值体系：本气禄=100% / 中气根=60% / 墓库根=60%（待冲×2=120%）/ 别柱遥根按距离折扣
export function tongGenAnalysis(pillars, dayGan) {
  const distFactor = { 日柱: 1.0, 月柱: 0.8, 时柱: 0.6, 年柱: 0.4 } // 别柱遥根距离折扣
  const rows = []
  for (const p of pillars) {
    const g = p.gan
    const gWx = GAN_WX[g]
    const benZhuCang = ZHI_CANG[p.zhi] || []
    let strength = 0
    let desc = []
    let kuDaiChong = false // 是否库根待冲
    // 本柱根：坐支藏干含本干五行
    const mainDepth = benZhuCang.findIndex(c => GAN_WX[c] === gWx)
    if (mainDepth !== -1) {
      const isKu = '辰戌丑未'.includes(p.zhi)
      if (isKu) {
        // 库根：闭锁 60%，待冲后 ×2 → 120%
        strength += 60
        kuDaiChong = true
        desc.push(`本柱库根（${p.zhi}，闭锁60%${kuDaiChong ? '，待冲后×2→120%' : ''}）`)
      } else if (mainDepth === 0) {
        strength += 100
        desc.push(`本柱禄根（${p.zhi}本气100%）`)
      } else if (mainDepth === 1) {
        strength += 60
        desc.push(`本柱中气根（${p.zhi}中气60%）`)
      } else {
        strength += 40
        desc.push(`本柱余气根（${p.zhi}余气40%）`)
      }
    }
    // 别柱遥根：其他柱藏干含本干五行，按距离折扣（V12.0：年→时隔月日 20%）
    for (const o of pillars) {
      if (o.name === p.name) continue
      const oCang = ZHI_CANG[o.zhi] || []
      const oDepth = oCang.findIndex(c => GAN_WX[c] === gWx)
      if (oDepth !== -1) {
        const f = distFactor[o.name] ?? 0.4
        const d = (oDepth === 0 ? 0.5 : 0.3) * f // 遥根进一步折扣
        const add = Math.round(100 * d)
        strength += add
        desc.push(`别柱${o.zhi}${oCang[oDepth]}（遥根${add}%）`)
      }
    }
    if (strength > 100) strength = 100 + Math.round((strength - 100) * 0.2) // 超强封顶防溢出
    const virtual = strength === 0
    // 0-10 分换算（与 V12.0 观感对齐：100%→9~10分，60%→6分，0→1分）
    const score = virtual ? 0 : Math.max(1, Math.round((strength / 100) * 9 * 10) / 10)
    // 有效距离系数：取整百分比，浮点抖动（110.00000000000001）一律截掉
    const coeff = virtual ? 0 : Math.min(100, Math.round(strength))
    rows.push({
      pos: p.name, gan: g, zhi: p.zhi,
      roots: desc.length ? desc.join('；') : '无根',
      coeff, // 整数百分比（60 表示 60%）
      score, // 0-10 力量分
      kuDaiChong,
      virtual: virtual ? '虚·假' : (strength >= 80 ? '实·真' : (strength >= 40 ? '实·真（待发）' : '实·偏弱')),
    })
  }
  return rows
}

// ============ 主入口：盲派全盘分析 ============

export function analyzeMangpai(bazi) {
  if (!bazi) return null
  // 提取四柱
  const pillars = ['年柱', '月柱', '日柱', '时柱']
    .filter(k => bazi[k])
    .map(k => ({ name: k, gan: bazi[k].天干.天干, zhi: bazi[k].地支.地支 }))

  const pre = preprocess(bazi, pillars)
  const tenList = pillarTenGods(bazi, pillars)
  const ty = tiYongBinZhu(bazi, pillars, tenList)
  const genji = genJiScore(bazi, pillars, pre)
  const zuo = zuoGongAnalysis(bazi, pillars, ty, genji)
  const muku = muKuAnalysis(pillars)
  const yingqi = yingQiAnalysis(bazi, pillars, pre)
  const quxiang = quXiangAnalysis(bazi, ty)
  const shangmen = shangMenAnalysis(pillars)
  const zuoFull = zuoFullScreen(bazi, pillars, ty, zuo, muku)
  const shensha = shenShaAnalysis(pillars, bazi.日主)
  const nayin = naYinAnalysis(pillars)
  const tonggen = tongGenAnalysis(pillars, bazi.日主)

  return {
    pre, tenList, ty, genji, zuo, zuoFull, muku, yingqi, quxiang, shangmen,
    shensha, nayin, tonggen,
    pillars, dayGan: bazi.日主, dayWx: GAN_WX[bazi.日主],
  }
}

// 盲派建议生成（事业/财运/感情/健康/开运 5 维）
export function mangpaiAdvice(m) {
  if (!m) return null
  const { genji, zuo, ty, muku, pre } = m
  const main = zuo.main ? zuo.main.name : '制'
  const yongTxt = [...new Set((ty.yong || []).map(y => (y.match(/\(([^)]+)\)/) || [])[1]).filter(Boolean))].slice(0, 2).join('、') || '财官'

  return {
    career: `你吃这碗饭最稳：靠「${main}」的路子成事（详见正文）。${genji.level === '体强' ? `你底子${genji.total}分、很扎实，可以自己扛事、主动出击，事业就往${yongTxt}方向走。` : genji.level === '体平' ? `你底子${genji.total}分、中等，最好借平台、团队或贵人的力，别一个人硬扛。` : `你底子${genji.total}分、偏虚，先求稳再求进，别逆势冒进。`}`,
    wealth: `来财路子：${wealthPlain(zuo, muku)}${pre.dayKong.includes(pre.dayZhi) ? '你日坐空亡，财官要等关键年份补上才发力，得手后别拖、速战速决。' : ''}`,
    love: `感情：${ty.feiGong.length ? '你命里有些"位置会转换"，早年的压力/地位，往后能转化成实打实的财富和底气' : '感情贵在自然、重在沟通'}。${(ty.yongCount['正财'] || 0) > 0 || (ty.yongCount['偏财'] || 0) > 0 ? '你命带财星，异性缘分是有落脚处的。' : ''}${shangMenText(m)}`,
    health: `身体：${m.shangmen.length ? `命里带${m.shangmen.map(s => s.name).join('、')}，平时多注意作息、少操心、别太累` : '命里没有明显刑冲穿害，先天底子不错，正常保养即可'}。`,
    opening: `开运：开运看的是"应期"不是"方位"。${pre.dayKong.includes(pre.dayZhi) ? `你日坐空亡，财官之事逢${pre.dayKong.join('、')}填实之年才会真正发力，那几年要主动把握；` : ''}${muku.found && muku.details.length ? '命里还藏着一个"财库"（逢开库的年份能得一笔偏财，见好就收），可遇不可求，平时攒住就行。' : ''}${pre.P2.length ? `命里有个虚神${pre.P2[0]}，逢到相应年份容易有大变化，可以提前布局。` : ''}平时把「${main}」这步功练扎实，等到应期年份自然水到渠成。`,
  }
}

// 来财效率的大白话解读
function wealthPlain(zuo, muku) {
  const grade = zuo.xiaoLv.grade
  const gradeTxt = {
    S: '你是能赚大钱的格局，财路开得大，放心往大处想',
    A: '来财效率高，能拿大头，但别指望不劳而获，付出和回报成正比',
    B: '小康小贵的命，财来得稳，但有一定天花板，伴随竞争',
    C: '来财平顺，先求安稳立足，财要一点一点攒',
  }[grade] || '来财效率中规中矩，细水长流'
  const mukuTxt = muku.found ? '命里有个"财库"，逢开库的年份能得一笔偏财，但往往带点代价，见好就收。' : '命里没现成的"财库"，钱主要靠持续挣、攒着更稳。'
  return `${gradeTxt}。${mukuTxt}`
}

function shangMenText(m) {
  const s = m.shangmen
  if (!s || !s.length) return ''
  if (s.some(x => x.name === '三刑俱全')) return '三刑入命，感情宜多包容、防口舌。'
  return ''
}

export default analyzeMangpai
