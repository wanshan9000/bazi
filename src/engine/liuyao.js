// 六爻起卦引擎（基于 iching-shifa 真实纳甲装卦）
// 保持原接口 castHexagram(n1,n2,n3,seed) 兼容，内部升级为完整纳甲排盘。
import { threeNumberQiGua, decodePan, getGuaName, getZhiGua, getHuGua, getGaoDaoYiDuan, solarToLunar } from 'iching-shifa'
import { getHexagram } from '../data/hexagram.js'

// 六爻从下往上：6老阴 7少阳 8少阴 9老阳 → 转 1阳 / 0阴
const YANG = [7, 9]
function toBit(v) {
  return YANG.includes(v) ? 1 : 0
}

// 从 yaostring 拆出本卦/变卦的二进制爻线
function linesFromYao(yaoString) {
  return yaoString.split('').map(Number).map(toBit)
}

export function castHexagram(n1, n2, n3, seed) {
  const a = normalize(n1, seed, 0)
  const b = normalize(n2, seed, 1)
  const c = normalize(n3, seed, 2)

  const yaoString = threeNumberQiGua(a, b, c)
  const now = new Date()
  const pan = decodePan(yaoString, {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes()
  })

  const benName = getGuaName(yaoString)
  const zhiYao = getZhiGua(yaoString)
  const bianName = getGuaName(zhiYao)
  const huName = getGuaName(getHuGua(yaoString))

  // 兼容字段：本卦/变卦对象（含卦名、卦辞、简释）
  const ben = getHexagramByName(benName)
  const bian = getHexagramByName(bianName)

  // 动爻（1-6 从下往上），兼容原 movingLine
  const movingPositions = yaoString.split('').map(Number)
    .map((v, i) => (v === 6 || v === 9) ? i + 1 : 0)
    .filter(Boolean)
  const movingLine = movingPositions[0] || 0
  const movingIn = movingLine <= 3 ? '下卦（内卦）' : '上卦（外卦）'

  const allLines = linesFromYao(yaoString)
  const lowerLines = allLines.slice(0, 3)
  const upperLines = allLines.slice(3, 6)

  // 纳甲/六亲/六兽/世应
  const yaoList = pan.benGua.yaoList
  const zhiYaoList = pan.zhiGua.yaoList

  return {
    ben, bian,
    movingLine,
    movingIn,
    upperLines, lowerLines,
    a, b, c,
    // 新增：真实排盘数据
    pan,
    yaoString,
    benName, bianName, huName,
    movingPositions,
    gz: {
      year: pan.ganZhiYear.gz,
      month: pan.ganZhiMonth.gz,
      day: pan.ganZhiDay.gz,
      hour: pan.ganZhiHour.gz
    },
    lunar: pan.lunarDate,
    dayKong: pan.dayKong,
    hourKong: pan.hourKong,
    monthJian: pan.monthJian,
    solarTerm: pan.solarTerm,
    shenSha: pan.shenSha,
    yaoList,
    zhiYaoList,
    // 高岛易断
    gaodao: getGaoDaoYiDuan(yaoString),
    // 世应标记
    shiYing: yaoList.map(y => y.shiYing || '').join('')
  }
}

const HEX_NAME_LOOKUP = (() => {
  const m = {}
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const h = getHexagram(i, j)
      m[h.name] = h
    }
  }
  return m
})()

function getHexagramByName(name) {
  return HEX_NAME_LOOKUP[name] || { name, juci: '', desc: '' }
}

function normalize(v, seed, k) {
  let n = parseInt(v, 10)
  if (Number.isNaN(n) || n <= 0) {
    const rnd = seededRandom(seed, k)
    n = Math.floor(rnd * 99) + 1
  }
  return n
}

// 简单种子随机（用于"帮我摇一卦"）
function seededRandom(seed, k) {
  const x = Math.sin(seed * 9301 + k * 49297 + 233280) * 233280
  return x - Math.floor(x)
}

// 解卦文案：保留原 interpret(ben,bian,movingLine) 签名
export function interpret(ben, bian, movingLine) {
  const same = ben.name === bian.name
  const movingDesc = {
    1: '初爻动，事情尚在萌芽，重在打好根基',
    2: '二爻动，时机渐明，宜守中道、稳步推进',
    3: '三爻动，多有波折，需警惕半途而废',
    4: '四爻动，接近关键处，进退之间需谨慎',
    5: '五爻动，居于尊位，是成事的关键节点',
    6: '上爻动，事态已至终局，宜见好就收'
  }[movingLine]

  const relation = same
    ? '本卦与变卦相同，说明此事贵在持之以恒，坚持你所选择的道路，便会抵达应许之地。'
    : `本卦「${ben.name}」动而后成变卦「${bian.name}」——${bian.desc}`

  return [
    `本卦为「${ben.name}」，卦辞曰：${ben.juci}。`,
    `${ben.desc}`,
    `${movingDesc}。${relation}`,
    `占事之要：顺势而为，心诚则灵。此卦仅供参详，真正的方向，在你心底早已有数。`
  ]
}

// 完整纳甲排盘文本（供元气AI技能使用）
export function buildLiuyaoPan(chart) {
  const now = new Date()
  const n1 = chart?.n1 || (seedRand() % 99 + 1)
  const n2 = chart?.n2 || (seedRand() % 99 + 1)
  const n3 = chart?.n3 || (seedRand() % 99 + 1)
  const r = castHexagram(n1, n2, n3, Date.now())
  const p = r.pan

  const lines = []
  lines.push(`【六爻纳甲排盘】`)
  lines.push(`占问时间：${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
  lines.push(`四柱：${r.gz.year}年 ${r.gz.month}月 ${r.gz.day}日 ${r.gz.hour}时 ｜ 农历${r.lunar.month}月${r.lunar.day}日${r.lunar.isLeap ? '（闰）' : ''}`)
  lines.push(`月建：${r.monthJian}｜日旬空：${r.dayKong}｜时旬空：${r.hourKong}｜节气：${r.solarTerm}`)

  const shenShaStr = Object.entries(r.shenSha)
    .filter(([, v]) => v && v.length)
    .map(([k, v]) => `${k}:${v.join('、')}`)
    .join('｜')
  if (shenShaStr) lines.push(`神煞：${shenShaStr}`)

  lines.push('')
  lines.push(`本卦「${r.benName}」之卦「${r.bianName}」互卦「${r.huName}」`)
  lines.push(`卦辞：${p.benGua.guaCi}｜宫：${p.benGua.palace}（${p.benGua.palaceWuXing}）`)

  lines.push('')
  lines.push(`【六爻详列】（自初爻往上）`)
  for (const y of r.yaoList) {
    const moving = y.isMoving ? '【动】' : ''
    lines.push(`第${y.position}爻：${y.naJia}｜${y.wuXing}｜六亲${y.liuQin}｜六兽${y.liuShou}｜纳音${y.naYin || '无'}${y.shiYing ? `（${y.shiYing}）` : ''}${moving}`)
  }
  if (r.movingPositions.length) {
    lines.push(`动爻：${r.movingPositions.join('、')}爻`)
    if (p.explanation) lines.push(`动爻断语：${p.explanation}`)
  }
  if (r.gaodao && r.gaodao.intro) {
    lines.push('')
    lines.push(`高岛易断：${r.gaodao.intro}`)
    if (r.movingPositions[0]) {
      const line = r.gaodao.movingLines && r.gaodao.movingLines[r.movingPositions[0] - 1]
      if (line) lines.push(`第${r.movingPositions[0]}爻详解：${line.yaoCi || line.explanation || ''}`)
    }
  }
  return lines.join('\n')
}

let _seedCounter = 0
function seedRand() {
  _seedCounter = (_seedCounter + 1) % 1000
  return Math.floor(Math.random() * 100000) + _seedCounter
}
