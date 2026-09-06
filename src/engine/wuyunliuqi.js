/**
 * 五运六气：按出生年干支排中运/司天在泉/主气/客运 + 属相六大体质（健康养生用）
 *
 * 依据：年干定中运（甲己土/乙庚金/丙辛水/丁壬木/戊癸火），阳干太过、阴干不及；
 *       年支定司天在泉（三阴三阳），主气六步固定，属相定六大体质。
 * 供 agentTools（LLM 工具上下文）与 baziReport（子平派健康养生章节）共用。
 */
import { Solar } from 'lunar-typescript'

const WY_YUN = { 甲: '土', 乙: '金', 丙: '水', 丁: '木', 戊: '火', 己: '土', 庚: '金', 辛: '水', 壬: '木', 癸: '火' }
const WY_SITIAN = { 子: '少阴君火', 午: '少阴君火', 丑: '太阴湿土', 未: '太阴湿土', 寅: '少阳相火', 申: '少阳相火', 卯: '阳明燥金', 酉: '阳明燥金', 辰: '太阳寒水', 戌: '太阳寒水', 巳: '厥阴风木', 亥: '厥阴风木' }
const WY_ZAIQUAN = { 子: '阳明燥金', 午: '阳明燥金', 丑: '太阳寒水', 未: '太阳寒水', 寅: '厥阴风木', 申: '厥阴风木', 卯: '少阴君火', 酉: '少阴君火', 辰: '太阴湿土', 戌: '太阴湿土', 巳: '少阳相火', 亥: '少阳相火' }
/**
 * 主气六步。
 *
 * ⚠ 原实现按**公历月份**分箱，而且分得既不均匀、区间标注也与名称对不上
 * （厥阴风木占 1-3 月、少阴君火只占 4 月、少阳相火占了 5-8 月四个月）。
 * 六气各约 60.9 天、以**节气**为界：大寒 → 春分 → 小满 → 大暑 → 秋分 → 小雪 → 次年大寒。
 * 现在按当年真实节气日期判定，跨年（小雪至次年大寒属终之气）也一并处理。
 */
const WY_ZHUQI = [
  { name: '厥阴风木', start: '大寒', end: '春分', note: '初之气（大寒-春分）' },
  { name: '少阴君火', start: '春分', end: '小满', note: '二之气（春分-小满）' },
  { name: '少阳相火', start: '小满', end: '大暑', note: '三之气（小满-大暑）' },
  { name: '太阴湿土', start: '大暑', end: '秋分', note: '四之气（大暑-秋分）' },
  { name: '阳明燥金', start: '秋分', end: '小雪', note: '五之气（秋分-小雪）' },
  { name: '太阳寒水', start: '小雪', end: '大寒', note: '终之气（小雪-次年大寒）' },
]

/** 取某公历年的六气分界日（毫秒时间戳），节气不可用时回落到多年平均近似日期 */
function qiBoundaries(year) {
  const NAMES = ['大寒', '春分', '小满', '大暑', '秋分', '小雪']
  const FALLBACK = [[1, 20], [3, 21], [5, 21], [7, 23], [9, 23], [11, 22]]
  try {
    const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable()
    const out = NAMES.map((n, i) => {
      const s = table[n]
      if (!s) return new Date(year, FALLBACK[i][0] - 1, FALLBACK[i][1]).getTime()
      return new Date(s.getYear(), s.getMonth() - 1, s.getDay()).getTime()
    })
    return out
  } catch {
    return FALLBACK.map(([m, d]) => new Date(year, m - 1, d).getTime())
  }
}

/**
 * 判断某个公历日期落在哪一步主气。
 * @returns {{name:string,start:string,end:string,note:string}}
 */
export function zhuqiOf(year, month, day) {
  const t = new Date(year, (month || 1) - 1, day || 1).getTime()
  const b = qiBoundaries(year)
  // 大寒之前属于「上一年小雪起算」的终之气
  if (t < b[0]) return WY_ZHUQI[5]
  for (let i = 0; i < 5; i++) {
    if (t >= b[i] && t < b[i + 1]) return WY_ZHUQI[i]
  }
  return WY_ZHUQI[5] // 小雪及以后
}
const WY_TIZHI = {
  鼠: { tz: '热性', wx: '火', risk: '心火旺、焦虑、血压高' },
  牛: { tz: '湿性', wx: '土', risk: '脾胃湿气、痰湿、腹胀' },
  虎: { tz: '火性', wx: '火', risk: '心脑热病、失眠、口疮' },
  兔: { tz: '燥性', wx: '金', risk: '肺大肠燥、皮肤干、咳嗽' },
  龙: { tz: '寒性', wx: '水', risk: '肾寒、腰腿冷、尿频' },
  蛇: { tz: '风性', wx: '木', risk: '肝风、偏头痛、抽筋' },
  马: { tz: '热性', wx: '火', risk: '心火旺、焦虑、血压高' },
  羊: { tz: '湿性', wx: '土', risk: '脾胃湿气、痰湿、腹胀' },
  猴: { tz: '火性', wx: '火', risk: '心脑热病、失眠、口疮' },
  鸡: { tz: '燥性', wx: '金', risk: '肺大肠燥、皮肤干、咳嗽' },
  狗: { tz: '寒性', wx: '水', risk: '肾寒、腰腿冷、尿频' },
  猪: { tz: '风性', wx: '木', risk: '肝风、偏头痛、抽筋' },
}
const WY_YANGSHENG = {
  土: '健脾祛湿：宜食薏米、山药、茯苓、冬瓜，少食甜腻生冷；适度运动助排湿，忌久坐湿地。',
  火: '清心降火：宜食莲子、绿豆、百合、苦瓜，少熬夜、戒怒控情绪；午间小憩，忌辛辣燥热。',
  金: '润肺生津：宜食梨、银耳、百合、蜂蜜，多饮水，注意保湿；忌烟酒与辛辣，防燥咳。',
  水: '温阳散寒：宜食生姜、羊肉、桂圆，艾灸保暖、睡前泡脚；忌贪凉饮冷，防腰膝冷痛。',
  木: '疏肝理气：宜食玫瑰、陈皮、山楂，多做伸展运动，情绪宜舒展忌郁结；春季养肝为重。',
}

/**
 * 结构化排五运六气盘 + 体质判断
 * @param {object} chart 排盘结果（需含 pillars[0] 年柱、shengxiao 属相、month 数字月份）
 * @returns {{ok:boolean,text?:string,yg?:string,yz?:string,sx?:string,zhongyun?:string,guojibu?:string,
 *   sitian?:string,zaiquan?:string,keyun?:string,zhuqi?:{name:string,note:string},
 *   tizhi?:{tz:string,wx:string,risk:string}|null,yangsheng?:string}}
 */
export function buildWuyunliuqi(chart) {
  if (!chart || !chart.pillars || !chart.pillars[0]) {
    return { ok: false, text: '（缺少出生信息，无法排五运六气）' }
  }
  const yg = chart.pillars[0].gan
  const yz = chart.pillars[0].zhi
  const sx = chart.shengxiao
  const zhongyun = WY_YUN[yg] || '?'
  const guojibu = '甲丙戊庚壬'.includes(yg) ? '太过' : '不及'
  const sitian = WY_SITIAN[yz] || '?'
  const zaiquan = WY_ZAIQUAN[yz] || '?'
  const keyun = WY_YUN[yg] || '?'
  const zhuqi = zhuqiOf(chart.year, chart.month, chart.day)
  const tizhi = WY_TIZHI[sx] || null
  const result = { ok: true, yg, yz, sx, zhongyun, guojibu, sitian, zaiquan, keyun, zhuqi, tizhi }
  if (tizhi) result.yangsheng = WY_YANGSHENG[tizhi.wx] || ''
  result.text = [
    `【五运六气盘】${yg}${yz}年（${sx}肖）`,
    `中运：${zhongyun}（${guojibu}）｜司天：${sitian}｜在泉：${zaiquan}｜客运初运：${keyun}`,
    `主气（出生当令）：${zhuqi.name}（${zhuqi.note}）；客气司天之气加临于三之气（小满-处暑）。`,
    ...(tizhi
      ? [
          `【体质判断】${sx}肖 → ${tizhi.tz}体质（本气${tizhi.wx}），易见健康倾向：${tizhi.risk}。`,
          `【养生建议】${result.yangsheng || ''}`,
          `【安全声明】以上为传统五运六气/体质理论的养生参考，仅供生活调养，不构成医疗诊断；如有不适请及时就医。`
        ]
      : []),
  ].join('\n')
  return result
}
