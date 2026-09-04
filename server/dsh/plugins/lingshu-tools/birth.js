// 出生参数：所有排盘类工具共用。模型必须显式给出，不再依赖前端闭包里的命盘。
export const BIRTH_PARAMS = {
  year: { type: 'integer', required: true, description: '出生年（四位）' },
  month: { type: 'integer', required: true, description: '出生月 1-12' },
  day: { type: 'integer', required: true, description: '出生日 1-31' },
  hour: { type: 'integer', required: true, description: '出生小时 0-23；用户只知道时辰时取时辰中点（如午时→12）；完全不知则传 12 并在回答中说明' },
  gender: { type: 'string', required: true, enum: ['男', '女'], description: '性别' },
  calendar: { type: 'string', enum: ['solar', 'lunar'], description: '年月日是公历(solar)还是农历(lunar)，默认公历' },
  leapMonth: { type: 'boolean', description: '农历闰月时为 true' },
}

// 与 BIRTH_PARAMS 相同，但去掉 required：供不要求必填出生参数的工具（如需要额外可选出生信息时）复用。
export const OPTIONAL_BIRTH_PARAMS = Object.fromEntries(
  Object.entries(BIRTH_PARAMS).map(([k, v]) => {
    const { required, ...rest } = v
    return [k, rest]
  })
)

export function chartFromArgs(E, args) {
  let { year, month, day } = args
  if (args.calendar === 'lunar') ({ year, month, day } = E.lunarToSolar(year, month, day, !!args.leapMonth))
  const chart = E.buildChart(year, month, day, args.hour ?? 12, args.gender)
  if (!chart || !chart.pillars || chart.pillars.length !== 4) throw new Error('排盘失败：出生信息无效')
  return chart
}

export function birthLine(chart) {
  return `${chart.gender === '女' ? '坤造' : '乾造'} ${chart.year}年${chart.month}月${chart.day}日 ${chart.hour ?? 12}时（公历）`
}
