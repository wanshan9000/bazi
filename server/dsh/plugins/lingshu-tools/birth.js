// 出生参数：所有排盘类工具共用。模型必须显式给出，不再依赖前端闭包里的命盘。
export const BIRTH_PARAMS = {
  year: { type: 'integer', required: true, description: '出生年（四位）' },
  month: { type: 'integer', required: true, description: '出生月 1-12' },
  day: { type: 'integer', required: true, description: '出生日 1-31' },
  hour: { type: 'integer', description: '出生小时 0-23；用户只知道时辰时取时辰中点（如午时→12）。**完全不知道时辰就不要传这个参数**，工具会按未知处理并在结果里标注时柱为估算——不要自己编一个 12 冒充确定值' },
  gender: { type: 'string', required: true, enum: ['男', '女'], description: '性别' },
  calendar: { type: 'string', enum: ['solar', 'lunar'], description: '年月日是公历(solar)还是农历(lunar)。用户未明确说农历/阴历时必须传 solar；不能把“9月”擅自理解为农历九月' },
  leapMonth: { type: 'boolean', description: '农历闰月时为 true' },
}

// 与 BIRTH_PARAMS 相同，但去掉 required：供不要求必填出生参数的工具（如需要额外可选出生信息时）复用。
export const OPTIONAL_BIRTH_PARAMS = Object.fromEntries(
  Object.entries(BIRTH_PARAMS).map(([k, v]) => {
    const { required, ...rest } = v
    return [k, rest]
  })
)

/** 出生参数基本校验：非法值必须显式失败，不能让引擎"修正"成一张看不出问题的错盘。 */
function assertBirth(args) {
  const y = Number(args.year), m = Number(args.month), d = Number(args.day)
  if (!Number.isInteger(y) || y < 1900 || y > 2100) throw new Error(`出生年超出支持范围（1900-2100）：${args.year}`)
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error(`出生月不合法（1-12）：${args.month}`)
  if (!Number.isInteger(d) || d < 1 || d > 31) throw new Error(`出生日不合法（1-31）：${args.day}`)
  if (args.hour != null) {
    const h = Number(args.hour)
    if (!Number.isInteger(h) || h < 0 || h > 23) throw new Error(`出生小时不合法（0-23）：${args.hour}`)
  }
  if (args.gender != null && args.gender !== '男' && args.gender !== '女') {
    throw new Error(`性别只接受「男」或「女」：${args.gender}`)
  }
}

export function chartFromArgs(E, args) {
  assertBirth(args)
  let { year, month, day } = args
  if (args.calendar === 'lunar') {
    // lunarToSolar 现在对不存在的农历日期会抛错（而不是原样当公历用），这正是我们要的
    ;({ year, month, day } = E.lunarToSolar(year, month, day, !!args.leapMonth))
  }
  // hour 缺省 → 时辰未知。仍按 12 点排出一张可用的盘，但把「未知」这个事实记在
  // chart 上（hourKnown=false），让报告与回答能如实标注时柱为估算，
  // 而不是把一个编出来的时柱当成确定信息交给用户。
  const hourKnown = args.hour != null
  const chart = E.buildChart(year, month, day, hourKnown ? args.hour : 12, args.gender)
  if (!chart || !chart.pillars || chart.pillars.length !== 4) throw new Error('排盘失败：出生信息无效')
  chart.hourKnown = hourKnown
  return chart
}

export function birthLine(chart) {
  const hour = chart.hourKnown === false ? '时辰未知（时柱按午时估算）' : `${chart.hour ?? 12}时`
  return `${chart.gender === '女' ? '坤造' : '乾造'} ${chart.year}年${chart.month}月${chart.day}日 ${hour}（公历）`
}
