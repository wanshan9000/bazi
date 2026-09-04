/**
 * SAFE 红线 + 不确定性诚实表达（优先级10 · yueyuan-bazi）
 *
 * 命理测算必须守住四条 SAFE 红线，避免"宿命恐吓 / 医疗越界 / 绝对化断言"：
 *  S - 不制造宿命恐吓（Shun fatalism-threat）
 *  A - 不越权医疗诊断（Avoid medical overreach）
 *  F - 不搞玄学祛灾敛财（Forbid divination-remedy scams）
 *  E - 保持诚实与不确定（Express honesty & uncertainty）
 *
 * 对外能力：
 *  - scanRedLine(text)   ：扫描文本，返回命中的红线类别与原文片段
 *  - sanitize(text)      ：净化越界措辞（把"注定/必死/克夫/绝症"替换为温和表达）
 *  - uncertaintyTail(kind)：为预测类报告生成不确定性诚实声明
 *  - buildSafeSection(chart)：生成可插入报告的 safe 声明 section
 */
export const RED_LINES = {
  fatalism: {
    label: '宿命断言',
    patterns: [/注定[^由]/, /(必然|必定|一定)(会|能|要)?(倒霉|出事|离婚|失败|破财|短命|不得善终|克夫|克妻)/,
      /(短命|早夭|夭折|不得善终)(之相|之命)?/, /命(里|中)(注定|该)/, /寿数(不永|已定)/,
      /(活不过|熬不过)(\d+|岁)/, /(命中|八字|命盘)(注定|已定)/],
    replacement: '命理上倾向（不构成定论）'
  },
  medical: {
    label: '医疗越界',
    patterns: [/得(了)?(癌|绝症|重病|肿瘤)/, /(患|得)(癌|肿瘤|绝症)/, /(必有|定有)大病/,
      /(会|要)得(重病|绝症)/, /(无药可救|药石无灵|不治之症)/, /命(里|中)?带(病|疾)(难医)?/],
    replacement: '健康状况上宜多加注意（建议以正规体检为准）'
  },
  scam: {
    label: '祛灾敛财',
    patterns: [/破财消灾/, /(请|买|供|开光)(什么)?(符|咒|法事|灵物|宝物)/, /必须(做|请|供奉)(法事|超度|辟邪|符)/,
      /(不(做|请|供)|没有)(法事|符|开光)(就|会|将)(倒霉|遭灾|破财|不顺)/, /收费(改命|消灾|转运)/],
    replacement: '不建议相信任何"付费改命/消灾"服务'
  },
  absolute: {
    label: '绝对化断言',
    patterns: [/(一辈子|一生)(都)?(不会|不可能|注定|必然|一定)/, /(永远|绝对|百分之百)(会|能|成|好|坏)/,
      /(必定|必然)大(吉|凶|富|贵)/, /(必(然|定|将)?|注定)(成|败|离|散)/],
    replacement: '趋势上倾向于（存在变数）'
  }
}

export const ALL_RED_PATTERNS = Object.values(RED_LINES).flatMap(r => r.patterns)

/** 扫描文本，返回命中的红线（去重后） */
export function scanRedLine(text) {
  if (!text) return []
  const hits = []
  for (const [key, rule] of Object.entries(RED_LINES)) {
    const m = text.match(new RegExp(rule.patterns.map(p => p.source).join('|'), 'g'))
    if (m) {
      const unique = [...new Set(m)]
      hits.push({ key, label: rule.label, matched: unique.slice(0, 3) })
    }
  }
  return hits
}

/** 净化越界措辞：把命中的红线原文替换为温和表达 */
export function sanitize(text) {
  if (!text) return text
  let out = text
  for (const rule of Object.values(RED_LINES)) {
    for (const p of rule.patterns) {
      const re = new RegExp(p.source, 'g')
      // 命中的红线原文统一替换为温和表达
      out = out.replace(re, rule.replacement)
    }
  }
  return out
}

/** 为预测类报告生成不确定性诚实声明 */
export function uncertaintyTail(kind) {
  const tips = {
    fortune: '运势描述基于命理模型推断，属于趋势参考而非事实预言；人生走向终究由个人选择与努力决定，请以理性心态对待。',
    love: '情感走势受现实互动、成长与选择影响远大于命盘，命理仅供自我认知参考，切勿据此草率决定感情去留。',
    health: '健康相关判断绝不构成医疗建议，如有不适请务必咨询正规医疗机构。',
    wealth: '财运走势仅为趋势参考，绝不构成投资建议；理性理财、量入为出方为正道。',
    career: '事业方向建议基于命局特质，实际发展取决于能力、机遇与行动，切勿依赖命理替代职业规划。'
  }
  return tips[kind] || '本报告基于传统命理模型的推演，仅为参考与自我认知之用，不构成任何形式的事实断言或决策依据。'
}

/**
 * 生成 SAFE 声明 section（插入报告尾部）
 * @param {object} opts { kind, pattern, hitCount }
 */
export function buildSafeSection(opts) {
  const { kind, hitCount, pattern } = opts || {}
  return {
    key: 'safe',
    title: '理性提示',
    kind: 'safe',
    data: {
      redLines: Object.values(RED_LINES).map(r => ({
        label: r.label,
        hit: (hitCount && hitCount[r.label] ? hitCount[r.label] : 0),
        desc: r.label === '宿命断言' ? '绝不输出"注定/短命/克夫克妻"等宿命恐吓' :
              r.label === '医疗越界' ? '健康判断绝不越权医疗诊断' :
              r.label === '祛灾敛财' ? '绝不诱导付费改命/消灾' :
              '避免绝对化断言，保留变数空间'
      })),
      uncertainty: uncertaintyTail(kind),
      pattern: pattern || ''
    },
    note: '元气AI 承诺 SAFE 红线：不算命定宿命、不越医疗边界、不推销祛灾服务、不隐瞒不确定性。'
  }
}
