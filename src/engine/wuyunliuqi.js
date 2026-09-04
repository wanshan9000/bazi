/**
 * 五运六气：按出生年干支排中运/司天在泉/主气/客运 + 属相六大体质（健康养生用）
 *
 * 依据：年干定中运（甲己土/乙庚金/丙辛水/丁壬木/戊癸火），阳干太过、阴干不及；
 *       年支定司天在泉（三阴三阳），主气六步固定，属相定六大体质。
 * 供 agentTools（LLM 工具上下文）与 baziReport（子平派健康养生章节）共用。
 */
const WY_YUN = { 甲: '土', 乙: '金', 丙: '水', 丁: '木', 戊: '火', 己: '土', 庚: '金', 辛: '水', 壬: '木', 癸: '火' }
const WY_SITIAN = { 子: '少阴君火', 午: '少阴君火', 丑: '太阴湿土', 未: '太阴湿土', 寅: '少阳相火', 申: '少阳相火', 卯: '阳明燥金', 酉: '阳明燥金', 辰: '太阳寒水', 戌: '太阳寒水', 巳: '厥阴风木', 亥: '厥阴风木' }
const WY_ZAIQUAN = { 子: '阳明燥金', 午: '阳明燥金', 丑: '太阳寒水', 未: '太阳寒水', 寅: '厥阴风木', 申: '厥阴风木', 卯: '少阴君火', 酉: '少阴君火', 辰: '太阴湿土', 戌: '太阴湿土', 巳: '少阳相火', 亥: '少阳相火' }
const WY_ZHUQI = [
  { name: '厥阴风木', m: [1, 2, 3], note: '初之气（大寒-清明）' },
  { name: '少阴君火', m: [4], note: '二之气（谷雨-小满前）' },
  { name: '少阳相火', m: [5, 6, 7, 8], note: '三之气（小满-处暑）' },
  { name: '太阴湿土', m: [9, 10], note: '四之气（白露-霜降后）' },
  { name: '阳明燥金', m: [11], note: '五之气（霜降-大雪前）' },
  { name: '太阳寒水', m: [12], note: '终之气（大雪-大寒）' },
]
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
  const zhuqi = WY_ZHUQI.find(q => q.m.includes(chart.month)) || WY_ZHUQI[0]
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
