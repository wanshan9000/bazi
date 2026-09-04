// 合婚 / 双人合盘引擎：基于双方八字命盘做关系契合度分析
// 借鉴 bazi-skill / taibu 的合盘思路：天干五合、地支六合三合六冲、五行互补、夫妻宫、生肖
// 输出统一 report 对象（sections + advice），前端 ReportView 渲染

import { GAN_HE, ZHI_LIUHE, ZHI_SANHE, ZHI_CHONG, ZHI_XING, ZHI_CHUAN, WUXING_SHENG, WUXING_KE } from '../data/ganzhi.js'
import { buildChart } from './bazi.js'
import { makeReport, failReport } from './reportSchema.js'

// 判断某支是否在指定三合局中
function inSanHe(zhi, ref) {
  return ZHI_SANHE.some(group => group.includes(zhi) && group.includes(ref))
}

// 分析两位日主的五行相生相克
function relOf(gx, gy) {
  if (gx === gy) return '同'
  if (WUXING_SHENG[gx] === gy) return '相生'
  if (WUXING_SHENG[gy] === gx) return '相生'
  if (WUXING_KE[gx] === gy) return '相克'
  if (WUXING_KE[gy] === gx) return '相克'
  return '平'
}

// 生肖六合 / 三合 / 六冲描述
function shengxiaoRel(aZhi, bZhi) {
  if (ZHI_LIUHE[aZhi] === bZhi) return '六合'
  if (inSanHe(aZhi, bZhi)) return '三合'
  if (ZHI_CHONG[aZhi] === bZhi) return '六冲'
  return null
}

// 主入口：输入两人出生信息（或已有命盘），输出合婚报告
export function buildHehunReport(partyA, partyB) {
  // partyA / partyB 可为 chart 对象，也可为 { year, month, day, hour, gender, label }
  const chartA = partyA && partyA.pillars ? partyA : (partyA ? buildChart(partyA.year, partyA.month, partyA.day, partyA.hour ?? 12, partyA.gender) : null)
  const chartB = partyB && partyB.pillars ? partyB : (partyB ? buildChart(partyB.year, partyB.month, partyB.day, partyB.hour ?? 12, partyB.gender) : null)

  if (!chartA || !chartB || chartA.pillars.length !== 4 || chartB.pillars.length !== 4) {
    return failReport('合婚需要双方完整的出生信息（出生年月日、性别，时辰可缺省）。')
  }
  const labelA = partyA?.label || (chartA.gender === '女' ? '女方' : '男方')
  const labelB = partyB?.label || (chartB.gender === '女' ? '女方' : '男方')

  const pA = chartA.pillars.map(p => p.gan + p.zhi)
  const pB = chartB.pillars.map(p => p.gan + p.zhi)
  const dayA = chartA.pillars[2] // 日柱
  const dayB = chartB.pillars[2]
  const dayWxA = chartA.dayMasterWx
  const dayWxB = chartB.dayMasterWx
  const zhiA = chartA.pillars[2].zhi // 日支（夫妻宫）
  const zhiB = chartB.pillars[2].zhi
  const yzhiA = chartA.pillars[0].zhi // 年支
  const yzhiB = chartB.pillars[0].zhi

  const signals = [] // { text, score, good }
  let score = 0

  // ① 日干天干五合：强烈吸引
  const dayGanHe = (GAN_HE[dayA.gan] === dayB.gan) || (GAN_HE[dayB.gan] === dayA.gan)
  if (dayGanHe) { score += 3; signals.push({ text: `日干相合（${dayA.gan}${dayB.gan}天干五合）：天然吸引，气场契合，是极佳的婚配信号。`, good: true, plain: '你俩天生就"对味儿"，互相吸引、投缘，这是很难得的默契。' }) }

  // ② 日支（夫妻宫）六合
  if (ZHI_LIUHE[zhiA] === zhiB) { score += 2.5; signals.push({ text: `夫妻宫相合（${zhiA}${zhiB}六合）：婚后感情融洽，家庭和谐。`, good: true, plain: '你们过日子"搭得住"，婚后的家庭氛围容易和睦、少吵架。' }) }
  // ③ 日支三合
  if (inSanHe(zhiA, zhiB)) { score += 2; signals.push({ text: `夫妻宫三合（${zhiA}${zhiB}）：志趣相投，相处投缘。`, good: true, plain: '你们兴趣相近、聊得来，平时相处特别自然。' }) }
  // ④ 日支六冲
  if (ZHI_CHONG[zhiA] === zhiB) { score -= 2; signals.push({ text: `夫妻宫相冲（${zhiA}${zhiB}六冲）：性格差异明显，易生摩擦，需多包容磨合。`, good: false, plain: '你俩性格反差大，容易火星撞地球，得多包容、互相让一步。' }) }
  // ⑤ 日支相刑
  if (ZHI_XING[zhiA] === zhiB) { score -= 1.5; signals.push({ text: `夫妻宫相刑（${zhiA}${zhiB}）：时有口角分歧，沟通是经营关键。`, good: false, plain: '在一起免不了拌嘴，能不能过好，全看会不会好好说话。' }) }
  // ⑥ 日支相害 / 相穿（六害即六穿，暗中受制，需多化解）
  if (ZHI_CHUAN[zhiA] === zhiB) { score -= 1.5; signals.push({ text: `夫妻宫相穿（六害）（${zhiA}${zhiB}）：暗中易生嫌隙，坦诚沟通是经营关键。`, good: false, plain: '有些别扭不会明说，容易在心里积攒，有想法就摊开讲，别憋着。' }) }

  // ⑥ 日主五行相生相克
  const rel = relOf(dayWxA, dayWxB)
  if (rel === '相生') { score += 2; signals.push({ text: `日主五行相生（${dayWxA}${dayWxB}）：彼此滋养扶持，互补共生。`, good: true, plain: '你俩在一起能互相成就、互相托底，属于"你补我短处、我圆你长处"的组合。' }) }
  else if (rel === '同') { score += 1; signals.push({ text: `日主五行相同（同为${dayWxA}）：观念相近，但有同质竞争的隐忧。`, good: true, plain: '你们想法挺合拍，但也容易都犟着、都想要主导权，得学会轮流做主。' }) }
  else if (rel === '相克') { score -= 1.5; signals.push({ text: `日主五行相克（${dayWxA}克${dayWxB}）：个性反差大，需找到相处平衡点。`, good: false, plain: '你们一个急一个慢、一个强一个倔，容易互相"较劲"，得找到彼此都能接受的节奏。' }) }

  // ⑦ 五行互补（用神互补）：一方喜用的五行是对方所旺
  let complement = ''
  for (const fav of (chartA.favorable || [])) {
    if ((chartB.wuxing?.[fav] || 0) >= 2) { complement = fav; break }
  }
  if (!complement) {
    for (const fav of (chartB.favorable || [])) {
      if ((chartA.wuxing?.[fav] || 0) >= 2) { complement = fav; break }
    }
  }
  if (complement) { score += 2; signals.push({ text: `五行互补：一方所喜正是另一方所旺（${complement}五行），彼此补足，运势相济。`, good: true, plain: '你们一个缺的正好是另一个多的，天生互补，在一起运势都能互相带旺。' }) }

  // ⑧ 生肖关系（年支）
  const sxRel = shengxiaoRel(yzhiA, yzhiB)
  if (sxRel === '六合') { score += 1.5; signals.push({ text: `生肖六合（${chartA.shengxiao}${chartB.shengxiao}）：家宅和睦，长辈缘好。`, good: true, plain: '生肖很配，家里和和气气，长辈也容易认可这段关系。' }) }
  else if (sxRel === '三合') { score += 1; signals.push({ text: `生肖三合（${chartA.shengxiao}${chartB.shengxiao}）：相处默契，默契有加。`, good: true, plain: '属相合拍，平时相处默契，互相配合得很顺。' }) }
  else if (sxRel === '六冲') { score -= 1; signals.push({ text: `生肖相冲（${chartA.shengxiao}${chartB.shengxiao}）：观念易碰撞，需彼此尊重差异。`, good: false, plain: '属相相冲，看待事情的角度容易顶牛，得学会求同存异、互相尊重。' }) }

  // 综合定级
  const maxScore = 15
  const pct = Math.max(0, Math.min(1, score / maxScore))
  const level = pct >= 0.75 ? '上等婚配' : pct >= 0.55 ? '中上婚配' : pct >= 0.4 ? '中平婚配' : pct >= 0.25 ? '中下婚配' : '磨合型婚配'
  const overall = pct >= 0.7
    ? `${labelA}与${labelB}的缘分相当契合，命理层面的「合」信号明显（日干合、夫妻宫合、五行互补），是颇为般配的一对。若能把握彼此节奏、互相包容，感情根基稳固，利于长久。`
    : pct >= 0.5
    ? `${labelA}与${labelB}的契合度中上，两人互有吸引也互有需要磨合之处。感情走向很大程度取决于相处方式：多一些主动沟通、少一些针锋相对，感情仍可经营得不错。`
    : pct >= 0.35
    ? `${labelA}与${labelB}缘分尚可，但命理上有需要留意的地方（如夫妻宫相冲相刑、五行相克）。这类搭配更考验包容与经营，若能各退一步、尊重差异，感情依然可期，只是要比一般情侣付出更多磨合的耐心。`
    : `${labelA}与${labelB}属于「磨合型」组合，双方性格与节奏差异偏大。合婚看的是适配与相处之道，命理上虽冲克较多，但真正决定感情的是彼此的珍惜与经营。建议多沟通、多理解，慎重考虑进入婚姻的节奏。`

  const advice = {
    career: `双方在事业上可互相扶持，若日主五行互补则更宜共同打拼；注意不要因观念差异而影响彼此决策。`,
    wealth: `家庭财库宜统一规划，两人用神若互补，则财运可互旺；避免在财务上较劲。`,
    love: `经营之道：${signals.some(s => !s.good) ? '主动化解夫妻宫相冲相刑带来的摩擦（两人性格或节奏有冲撞是正常事），多包容对方，把「争执」变成「沟通」的契机。' : '感情基础较好，保持日常的小惊喜与深度沟通，感情会更稳固。'}`,
    health: `彼此关心对方健康，五行互补者可互为对方的「养生顾问」（互相照应，就是最好的养生）。`,
    opening: `居家或结婚择日可参考双方喜用神（各自最需要的五行），选五行相合的日期更利感情气场。`,
  }

  return makeReport('hehun', {
    sub: `${labelA}（${pA.join(' ')}） × ${labelB}（${pB.join(' ')}）`,
    hero: { chars: [dayA.gan + dayB.gan], main: `${labelA} × ${labelB} · ${level}（契合度 ${Math.round(pct * 100)}%）` },
    meta: {
      a: { label: labelA, birth: `${chartA.year}-${chartA.month}-${chartA.day}`, pillars: pA, dayMaster: chartA.dayMaster },
      b: { label: labelB, birth: `${chartB.year}-${chartB.month}-${chartB.day}`, pillars: pB, dayMaster: chartB.dayMaster },
      level, score: Math.round(pct * 100)
    },
    sections: [
      {
        key: 'both', title: '双方命盘对照', kind: 'table',
        data: {
          headers: ['', '男方 / 女方', '四柱', '日主', '生肖', '喜用神'],
          rows: [
            [labelA, pA.join(' '), `${chartA.dayMaster}${chartA.dayMasterWx}`, chartA.shengxiao, (chartA.favorable || []).join('、') || '-'],
            [labelB, pB.join(' '), `${chartB.dayMaster}${chartB.dayMasterWx}`, chartB.shengxiao, (chartB.favorable || []).join('、') || '-'],
          ]
        }
      },
      {
        key: 'signals', title: '契合信号分析', kind: 'cards',
        data: { items: signals.map(s => ({ title: s.good ? '✓ ' : '△ ', desc: { term: s.text, plain: s.plain }, tag: s.good ? '加分' : '留意' })) }
      },
      {
        key: 'score', title: '契合度评分', kind: 'rating',
        data: {
          items: [
            { label: '感情和谐', value: Math.round(pct * 5) },
            { label: '性格默契', value: Math.round(Math.min(5, (pct * 5) + (signals.some(s => s.good && s.text.includes('五行')) ? 0.5 : 0))) },
            { label: '缘分契合', value: Math.round(Math.min(5, (pct * 5) + (signals.some(s => s.text.includes('相合')) ? 0.5 : 0))) },
          ],
          note2: `综合契合度：${Math.round(pct * 100)}%（${level}）`
        }
      },
      {
        key: 'overall', title: '综合评断', kind: 'note',
        data: { text: overall }
      }
    ],
    advice
  })
}

export default buildHehunReport
