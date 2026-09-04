// 六爻起卦引擎（梅花易数·报数起卦法）
// 上卦 = 第一数 mod 8（1乾 2兑 3离 4震 5巽 6坎 7艮 8坤）
// 下卦 = 第二数 mod 8
// 动爻 = 第三数 mod 6（1-6，从下往上）

import { getHexagram } from '../data/hexagram.js'

const GUA_BY_NUM = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 0: 7 }

// 六爻从下往上：1=阳，0=阴
function toLines(trigramIdx) {
  // 乾111 兑110 离101 震100 巽011 坎010 艮001 坤000
  const map = { 0: [1, 1, 1], 1: [1, 1, 0], 2: [1, 0, 1], 3: [1, 0, 0], 4: [0, 1, 1], 5: [0, 1, 0], 6: [0, 0, 1], 7: [0, 0, 0] }
  return map[trigramIdx]
}

export function castHexagram(n1, n2, n3, seed) {
  const a = normalize(n1, seed, 0)
  const b = normalize(n2, seed, 1)
  const c = normalize(n3, seed, 2)

  const upperIdx = GUA_BY_NUM[a % 8]
  const lowerIdx = GUA_BY_NUM[b % 8]
  const m = c % 6
  const movingLine = m === 0 ? 6 : m // 1-6，从下往上

  const ben = getHexagram(lowerIdx, upperIdx)

  // 变卦：动爻处阴阳互变
  const upperLines = toLines(upperIdx)
  const lowerLines = toLines(lowerIdx)
  const all = [...lowerLines, ...upperLines] // 从下往上6爻
  const changed = all.map((v, i) => (i + 1 === movingLine ? 1 - v : v))
  const cLower = changed.slice(0, 3).join('')
  const cUpper = changed.slice(3, 6).join('')
  const toTrigram = { '111': 0, '110': 1, '101': 2, '100': 3, '011': 4, '010': 5, '001': 6, '000': 7 }
  const bianLowerIdx = toTrigram[cLower]
  const bianUpperIdx = toTrigram[cUpper]
  const bian = getHexagram(bianLowerIdx, bianUpperIdx)

  // 动爻所在卦名
  const movingIn = movingLine <= 3 ? '下卦（内卦）' : '上卦（外卦）'

  return {
    ben, bian,
    movingLine,
    movingIn,
    upperLines, lowerLines,
    a, b, c
  }
}

function normalize(v, seed, k) {
  let n = parseInt(v, 10)
  if (Number.isNaN(n) || n <= 0) {
    // 无效数时用种子随机
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

// 解卦文案
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
    : `由「${ben.name}」变为「${bian.name}」，代表事态的发展走向：从${ben.name.split('为').pop() || ben.name}之势，转向${bian.name.split('为').pop() || bian.name}之局，${bian.desc}`

  return [
    `本卦为「${ben.name}」，卦辞曰：${ben.juci}。`,
    `${ben.desc}`,
    `${movingDesc}。${relation}`,
    `占事之要：顺势而为，心诚则灵。此卦仅供参详，真正的方向，在你心底早已有数。`
  ]
}
