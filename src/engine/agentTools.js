// 技能工具：命中的 skill 若带 tool，则调用本地引擎生成真实数据
// 返回结构化文本，供 LLM 结合生成回答（LLM 模式下作为工具上下文）

import { buildLiuyaoPan } from './liuyao.js'
import { drawCards, interpret as interpretTarot } from '../data/tarot.js'
import { buildContext } from './chat.js'
import { buildZiwei } from './ziwei.js'
import { buildQimenFull } from './qimen.js'
import { buildBaziFull, generateHuangli } from './cantian.js'
import { analyzeName, recommendName } from './nameAnalysis.js'
import { analyzeFengshui } from './fengshui.js'
import { skillByKey } from '../data/skills.js'
import { buildBaziReport } from './baziReport.js'
import { buildReport } from './reports.js'
import { buildWuyunliuqi } from './wuyunliuqi.js'

// 六爻：真实纳甲装卦（基于 iching-shifa）
function toolLiuyao(chart) {
  const pan = buildLiuyaoPan(chart)
  // question 由 runToolByName 合并进来（schema 里声明过），带上它模型才知道这卦问的是什么
  const q = chart && chart.question
  return q ? `【所问】${q}\n${pan}` : pan
}

// 塔罗：单张牌
function toolTarot() {
  const result = drawCards('single', Date.now())
  if (!result) return '（塔罗牌阵加载失败，请稍后再试）'
  const interp = interpretTarot(result, '')
  const card = result.cards[0]
  const head = [
    `【塔罗抽牌结果】`,
    `牌阵：单张牌 · 今日指引`,
    `抽到：${card.name}（${card.reversed ? '逆位' : '正位'}）｜关键词：${card.kw.join('、')}`
  ]
  if (!interp) return head.join('\n')
  const segs = [head.join('\n'), interp.summary]
  if (interp.perCard && interp.perCard[0]) {
    segs.push(`牌意：${interp.perCard[0].text}`)
  }
  if (interp.suggestion) segs.push(`行动建议：${interp.suggestion}`)
  return segs.join('\n')
}

function toolHuangli(chart) {
  const today = new Date()
  const dateStr = chart && chart.date ? chart.date : `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
  return generateHuangli({
    chart,
    date: dateStr,
    scenario: chart && chart.scenario,
    mode: chart && chart.mode,
    tone: chart && chart.tone,
    format: 'markdown',
  })
}

// 紫微斗数：真实排盘（供 LLM 解读）
function toolZiwei(chart) {
  return buildZiwei(chart)
}

// 奇门遁甲：完整排盘（时家 + 日家 + 月家 + 年家）
function toolQimen(chart) {
  return buildQimenFull(chart && chart.date ? new Date(chart.date) : new Date())
}

// 风水：八宅 + 五行房间布局分析
function toolFengshui(chart) {
  const layout = chart && chart.layout
  const birthInfo = chart && chart.birthInfo
  if (!layout || !layout.door) {
    return '（请提供户型信息，如：大门朝东、客厅在东、主卧在北、厨房在西等）'
  }
  try {
    const res = analyzeFengshui({ layout, birthInfo })
    const segs = [
      `【风水布局分析】门向${layout.door}`,
      `喜用神：${res.favorable.join('、')}｜忌神：${res.avoid.join('、')}`
    ]
    if (res.luckyDirs && res.luckyDirs.length) {
      segs.push(`四吉方：${res.luckyDirs.join('、')}`)
    }
    if (res.rooms && res.rooms.length) {
      segs.push('')
      segs.push('【逐空间分析】')
      for (const r of res.rooms) {
        segs.push(`${r.name}（${r.dir}，五行${r.wuxing}）：${r.score}分。${r.tips.join('；')}`)
      }
    }
    if (res.overall) segs.push('', `【总评】${res.overall}`)
    return segs.join('\n')
  } catch (e) {
    return `（风水分析失败：${e.message}）`
  }
}

// 取名：康熙笔画五格三才分析 + 推荐
function toolName(chart) {
  const fullName = chart && chart.name
  const fav = chart && chart.favorable
  if (fullName) {
    try {
      const a = analyzeName({ fullName, surname: chart.surname, chart })
      const grid = a.grid.map(g => `${g.name}${g.num}画（${g.luck.category}）`).join('、')
      const san = `三才${a.sanCai.tian}${a.sanCai.ren}${a.sanCai.di}（${a.sanCai.verdict}）`
      return [
        `【姓名五格分析】${fullName}`,
        `五格：${grid}`,
        san,
        `评分：${a.score}（${a.grade}）`,
        a.summaryText
      ].join('\n')
    } catch (e) {
      return `（姓名分析失败：${e.message}）`
    }
  }
  // 无具体名字 → 结合八字喜用推荐
  try {
    const recs = recommendName(chart, chart && chart.surname || '')
    if (!recs.length) return '（请提供姓氏以推荐名字）'
    const out = recs.map(r => {
      const g = r.grid.map(x => `${x.name}${x.num}`).join(' ')
      return `${r.input.fullName}｜${r.score}分｜${g}｜${r.sanCai.verdict}`
    })
    return ['【取名推荐】（结合八字喜用神）', ...out].join('\n')
  } catch (e) {
    return `（取名推荐失败：${e.message}）`
  }
}

// 八字：高精度排盘（cantian-tymext）+ 本地命局画像
function toolBazi(chart) {
  if (!chart) return '（尚未排盘，可提示用户先去八字门排盘）'
  const highPrecision = buildBaziFull(chart)
  // 若 cantian 失败，回退到本地画像
  if (!highPrecision.startsWith('（')) {
    const c = buildContext(chart)
    return [
      highPrecision,
      '',
      '【命局画像（本地引擎）】',
      `日主：${c.dayMaster}（${c.dayMasterWx}），生肖${c.shengxiao}`,
      `四柱：${c.pillars}；身${c.strength}`,
      `喜用神：${c.fav}；忌神：${c.avoid}`,
      `事业类型：${c.careerType}，宜从事：${c.careerField}`,
      `感情特质：${c.loveTrait}；${c.loveStar}`,
      `健康关注：${c.healthOrgans}`,
      `流年：${c.yearRemark}`,
      '',
      `【八字大运】本局八字大运按节气交运（阳男阴女顺排、阴男阳女逆排），具体起运日期与起运年龄请以精确排盘结果为准；此处不涉及紫微大限（紫微按五行局起限，与八字大运不同）。`
    ].join('\n')
  }
  const c = buildContext(chart)
  const segs = [
    `【用户命盘画像】`,
    `日主：${c.dayMaster}（${c.dayMasterWx}），生肖${c.shengxiao}`,
    `四柱：${c.pillars}；身${c.strength}`,
    `喜用神：${c.fav}；忌神：${c.avoid}`,
    `事业类型：${c.careerType}，宜从事：${c.careerField}`,
    `感情特质：${c.loveTrait}；${c.loveStar}`,
    `健康关注：${c.healthOrgans}`,
    `流年：${c.yearRemark}`
  ]
  // 精确大运（cantian）失败回退时，尽量用本地 chart 上的大运字段兜底，避免模型无据可依而编造
  if (chart && chart.daYunList && chart.daYunList.length) {
    const cur = chart.daYunList.find(d => d.isNow)
    segs.push(
      `【八字大运】起运 ${chart.qiYunText || `${chart.qiYunAge} 岁`}（${chart.qiYunDate || ''}）。当前大运：${cur ? `${cur.g}${cur.z}（${cur.startAge}-${cur.endAge} 岁，${cur.start}-${cur.end}）` : '见报告'}。`
    )
  }
  segs.push('【体系声明·必须遵守】八字大运按节气交运（阳男阴女顺排、阴男阳女逆排），起运日期/起运年龄以此处八字数据为准；紫微大限按五行局起限（每限十年），是另一套算法。回答"几岁起运/大运/什么时候交运"只用八字大运数据；回答"大限/起限"只用紫微数据。两者数字严禁混用、严禁编造。')
  return segs.join('\n')
}

// 五运六气：按出生年干支排中运/司天在泉/主气/客运 + 属相六大体质（健康养生用）
// 算法实现在共享模块 wuyunliuqi.js，与 baziReport 健康养生章节共用
function toolWuyunliuqi(chart) {
  return buildWuyunliuqi(chart).text
}

export function runSkillTool(skillKey, chart) {
  switch (skillKey) {
    case 'liuyao': return toolLiuyao(chart)
    case 'tarot': return toolTarot()
    case 'huangli': return toolHuangli(chart)
    case 'bazi': return toolBazi(chart)
    case 'ziwei': return toolZiwei(chart)
    case 'qimen': return toolQimen(chart)
    case 'name': return toolName(chart)
    case 'fengshui': return toolFengshui(chart)
    case 'wuyunliuqi': return toolWuyunliuqi(chart)
    case 'bazi_report':
    case 'ziwei_report':
    case 'liuyao_report':
    case 'qimen_report':
    case 'huangli_report':
    case 'tarot_report':
    case 'name_report':
    case 'fengshui_report':
    case 'mangpai_report':
    case 'hehun_report': {
      const type = skillKey.replace('_report', '')
      const rep = buildReport(type, chart, {})
      return rep.ok ? rep.markdown : `（报告生成失败：${rep.error}）`
    }
    default: return null
  }
}

// 供 function calling 的 runTool 分发：与 runSkillTool 相同签名（chart 由外部闭包注入）
export function runToolByName(name, args, chart) {
  // 报告类工具 → 统一报告引擎（可携带 args）
  if (name.endsWith('_report')) {
    const type = name.replace('_report', '')
    const rep = buildReport(type, chart, args || {})
    return rep.ok ? rep.markdown : `（报告生成失败：${rep.error}）`
  }
  // ⚠ 下面这些工具在 TOOL_SCHEMAS 里都声明了参数，但此前一律走
  // `runSkillTool(name, chart)`，args 被整个丢掉：模型按 schema 传了「所问之事」
  // 「指定日期」「要分析的姓名」，执行时全部当没看见 —— 声明与实现对不上，
  // 模型以为自己问的是甲，工具算的是乙。
  const merged = chart ? { ...chart } : {}
  if (args && typeof args === 'object') {
    // 只合并该工具确实声明过的字段，避免模型乱传的键污染命盘对象
    const ALLOWED = {
      huangli: ['date', 'scenario', 'mode', 'tone'],
      liuyao: ['question'],
      qimen: ['date'],
      name: ['name', 'surname'],
      fengshui: ['layout'],
    }
    for (const key of (ALLOWED[name] || [])) {
      if (args[key] !== undefined) merged[key] = args[key]
    }
  }
  if (name === 'huangli') return toolHuangli(merged)
  return runSkillTool(name, merged)
}

// OpenAI 兼容 function calling 工具清单（Agent 自主决策用）
export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'bazi',
      description: '获取用户八字的精确排盘数据与命局画像（四柱、十神、藏干、纳音、空亡、神煞、身强弱、喜用神、大运排盘、事业感情健康概述、流年概述）。八字大运按节气交运（阳男阴女顺排、阴男阳女逆排，含起运日期与起运年龄）。回答八字大运、几岁起运/交运时调用（注意：紫微的是"大限"按五行局起限，与八字大运不同，勿混用）。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bazi_report',
      description: '生成用户完整的八字命理报告，包含四柱排盘、十神配置、大运排盘（八字大运按节气交运，含起运日期/起运年龄）、命宫胎元、神煞、刑冲合会、命局画像、当前流年与未来三年运势、事业财运感情健康开运建议。用户要求"出报告"或需要系统性详解八字时调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ziwei',
      description: '获取用户紫微斗数的十二宫排盘（命宫五行局、十二宫主辅星、大限流年四化）。紫微"大限"按五行局起限（如金四局从某岁起，每限十年），与八字"大运"（按节气交运）算法不同，切勿混用。回答紫微大限、几岁起限、人生方向、格局时调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'liuyao',
      description: '为用户起一个六爻卦（纳甲装卦），返回本卦、变卦、六亲、六神、世应、动爻与用神。用户想占卜问事时调用。',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: '所问之事，可选' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'qimen',
      description: '获取奇门遁甲排盘（时家/日家/月家/年家），返回四盘九宫格局。回答奇门、择时、方位吉凶问题时调用。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期 YYYY-M-D，默认今天' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'huangli',
      description: '统一黄历生成器：先返回传统黄历数据（宜忌、冲煞、彭祖百忌、方位、农历干支），再按 mode 决定是否融合八字和身份场景；tone 可选实用或幽默表达。场景解读不覆盖传统宜忌。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期 YYYY-MM-DD，缺省今天' },
          scenario: { type: 'string', description: '场景：打工人/学生党/自由族/享受族（退休人士），缺省按生辰推断或打工人' },
          mode: { type: 'string', enum: ['standard', 'personalized'], description: 'standard 只看传统黄历；personalized 有生辰时结合八字与身份场景，缺省自动判断' },
          tone: { type: 'string', enum: ['practical', 'humorous'], description: 'practical 实用生活解读；humorous 幽默表达，缺省 practical' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tarot',
      description: '为用户抽取一张塔罗牌作为今日指引。用户想抽牌、占卜心情或求今日建议时调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'name',
      description: '结合八字喜用神为用户推荐名字，或分析给定姓名的五格三才。用户问取名、改名、名字吉凶时调用。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '要分析的姓名，可选；不传则推荐名字' },
          surname: { type: 'string', description: '姓氏，推荐名字时使用' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fengshui',
      description: '分析用户户型风水的八宅吉凶与五行布局。用户提供大门朝向、房间方位等信息后可调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ziwei_report',
      description: '生成用户完整的紫微斗数报告：命盘信息、十二宫星曜表、命宫解析、大限（紫微按五行局起限，每限十年，非八字节气起运）流年四化，以及事业财运感情健康开运建议。用户要求"出紫微报告"或需要系统性详解紫微时调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'liuyao_report',
      description: '生成完整的六爻占卜报告：起卦信息、本卦变卦互卦、六爻详列、神煞、高岛易断与动爻断语，以及逐项建议。用户要求"出六爻报告"或需要系统性断卦详解时调用。',
      parameters: { type: 'object', properties: { question: { type: 'string', description: '所问之事，可选' } }, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'qimen_report',
      description: '生成完整的奇门遁甲报告：时家盘面、九宫盘面表、吉凶方位、日家奇门、年家奇门与逐项建议。用户要求"出奇门报告"或需要系统性择时方位详解时调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'huangli_report',
      description: '生成今日个性化黄历报告：今日基本信息、宜忌、主题基调、行动建议与开运提示（结合用户八字喜用神）。用户要求"出黄历报告"或需要今日完整吉凶宜忌详解时调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tarot_report',
      description: '生成完整的塔罗解读报告：牌阵总论、逐位解读与行动指引。用户要求"出塔罗报告"或需要系统性牌阵详解时调用。',
      parameters: { type: 'object', properties: { question: { type: 'string', description: '所问之事，可选' }, spreadId: { type: 'string', description: '牌阵 id：time(时间流)/choice(二选一)/relationship(关系), 默认 time' } }, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'name_report',
      description: '生成完整的姓名分析报告：五格数理表、三才配置、综合评分、评语与结合八字喜用神的推荐名字。用户要求"出取名报告"或需要系统性姓名详解时调用，需要提供姓名。',
      parameters: { type: 'object', properties: { fullName: { type: 'string', description: '要分析的姓名，可选；不传则推荐名字' }, surname: { type: 'string', description: '姓氏，推荐名字时使用' } }, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fengshui_report',
      description: '生成完整的家宅风水报告：整体评估、房间布局分析、风水总评与逐项建议。用户要求"出风水报告"或需要系统性布局详解时调用，需要提供户型信息。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mangpai_report',
      description: '生成完整的盲派命理报告：三秒定太极（冲合虚神空亡）、体用宾主、根基五维评分、做功七法、效率评级（S/A/B/C）、墓库开合、大运流年应期、十神取象与伤门判定。用户要求"出盲派报告"或需要以盲派做功视角系统性分析命局时调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'hehun_report',
      description: '生成两人的合婚·双人合盘报告：双方命盘对照、日干五合、夫妻宫六合三合六冲、五行互补、生肖关系与契合度评分、感情经营建议。用户询问两人八字合不合、是否般配、婚配吉凶、合盘配对时调用。需提供两人出生信息（partner 为对方出生信息）。',
      parameters: {
        type: 'object',
        properties: {
          partner: {
            type: 'object',
            description: '对方的出生信息（label 为称呼，如"女方"）',
            properties: {
              label: { type: 'string', description: '对方称呼' },
              year: { type: 'number', description: '对方出生年' },
              month: { type: 'number', description: '对方出生月' },
              day: { type: 'number', description: '对方出生日' },
              hour: { type: 'number', description: '对方出生小时，可选' },
              gender: { type: 'string', description: '对方性别：男/女' }
            }
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wuyunliuqi',
      description: '获取用户出生年干支对应的五运六气格局（中运及太过不及、司天在泉、主气、客气、客运）与属相六大体质判断（牛羊湿/鼠马热/虎猴火/兔鸡燥/龙狗寒/蛇猪风），给出健康风险倾向与饮食作息情志养生建议。用户问"五运六气""我的体质""怎么养生""健康风险"时调用。仅提供体质分析与生活调养建议，不做医疗诊断。',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  }
]

// 汇总当前启用的技能描述（注入 system）
export function skillSystem(enabledSkills, customSkills) {
  if (!enabledSkills || !enabledSkills.length) return ''
  const list = enabledSkills
    .map(k => skillByKey(k, customSkills))
    .filter(Boolean)
    .map(s => `- ${s.name}：${s.desc}`)
  return list.length ? `你当前可用的技能如下，根据问题选用合适技能：\n${list.join('\n')}` : ''
}
