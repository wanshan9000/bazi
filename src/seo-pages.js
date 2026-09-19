// This module deliberately has no Vite/browser globals so the build-time
// prerenderer and the React runtime use exactly the same public-page data.
export const DEFAULT_SITE_URL = 'https://keymm.me'

const BAZI_EDITORIAL = {
  byline: '三门先生',
  publisher: '元氣满满',
  datePublished: '2026-09-19',
  dateModified: '2026-09-19',
  method: {
    zh: '术语与历法口径：年、月柱以节气为分界，年柱以立春为界，月柱依节令转换；日、时沿用传统干支与时辰表达。输入使用公历日期；出生时刻不明时，不补定时柱。',
    en: 'Terminology and calendar convention: the year and month pillars use solar terms as their boundaries. The year pillar changes at Start of Spring, and the month pillar follows the seasonal nodes; day and hour use traditional stem-branch and double-hour expressions. Inputs use Gregorian dates, and an unknown birth time is not filled in.',
  },
  sources: [
    { title: '《渊海子平》', url: 'https://zh.wikisource.org/wiki/%E6%B7%B5%E6%B5%B7%E5%AD%90%E5%B9%B3' },
    { title: '《三命通会》（四库全书本）', url: 'https://zh.wikisource.org/wiki/%E4%B8%89%E5%91%BD%E9%80%9A%E6%9C%83_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)' },
    { title: '《滴天髓》', url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93' },
    { title: '《子平真诠》' },
  ],
}

export const SEO_ROUTES = {
  home: {
    path: '/',
    title: '元氣满满｜八字排盘、紫微斗数、黄历与元氣AI',
    description: '元氣满满提供免费八字排盘、紫微斗数、今日黄历、个性化黄历、塔罗与元氣AI 解读。传统文化内容仅供学习与娱乐参考。',
    heading: '元氣满满：随时在身边的玄学助手',
    summary: '用八字、紫微斗数、黄历与元氣AI，整理属于你的人生出厂说明书。',
    sections: [
      ['传统文化工具', '八字排盘、紫微斗数、黄历、塔罗、姓名与家居风水，提供清晰的传统文化学习入口。'],
      ['元氣AI 解读', '先核对盘面与日期等事实，再根据你的问题给出结构化的解读参考和行动提示。'],
    ],
  },
  bazi: {
    path: '/bazi',
    title: '免费八字排盘｜八字五行、喜用神与八字AI 解读 - 元氣满满',
    description: '在线八字排盘，查看四柱、五行、十神、喜用神与大运信息；可继续向元氣AI 提问，获得基于盘面事实的解读参考。',
    heading: '八字排盘',
    summary: '输入出生日期、时间与性别，在线查看四柱、五行、十神、喜用神及大运信息。',
    sections: [
      ['查看命盘基础信息', '排盘结果包含年、月、日、时四柱及五行分布，帮助你理解传统八字的基础结构。'],
      ['继续向元氣AI 提问', '完成排盘后，可围绕事业、感情、财运与人生规划提问；内容仅供传统文化学习和娱乐参考。'],
    ],
  },
  baziGuide: {
    path: '/learn/bazi-four-pillars',
    title: 'What Is BaZi? A Four Pillars of Destiny Guide | Genki',
    description: 'Learn how BaZi, also called the Four Pillars of Destiny, organizes birth year, month, day and hour into a traditional Chinese metaphysics chart. Includes key terms, calculation inputs and FAQs.',
    heading: 'BaZi, explained without the mystique',
    summary: 'BaZi, or the Four Pillars of Destiny, is a traditional Chinese system that organizes a birth date and time into four paired symbols. This guide explains the vocabulary, inputs and limits before you explore a chart.',
    language: 'en',
    sections: [
      ['A traditional framework, not a factual forecast', 'BaZi is used as a cultural and reflective framework. It does not establish medical, legal, financial or scientific facts, and it should not replace qualified advice or personal judgement.'],
      ['The four pillars at a glance', 'Year, month, day and hour each form one pillar. Every pillar contains a Heavenly Stem and an Earthly Branch, which are then read through relationships among the Five Elements and Ten Gods.'],
      ['Inputs make the chart reproducible', 'A chart begins with a birth date, birth time and stated sex. A missing or approximate birth time can change the hour pillar, so a careful reading should label that uncertainty instead of inventing precision.'],
      ['Use a chart as a starting point', 'The useful next step is a specific question about work, relationships or timing. Treat the result as a prompt for reflection and practical planning, not as a guaranteed outcome.'],
    ],
    guide: {
      terms: [
        ['BaZi (八字)', 'Literally “eight characters”: the eight stem-and-branch characters across the four pillars.'],
        ['Four Pillars', 'The year, month, day and hour pillars, each made from a Heavenly Stem and an Earthly Branch.'],
        ['Five Elements (五行)', 'Wood, Fire, Earth, Metal and Water: a traditional vocabulary for describing relationships in a chart.'],
        ['Day Master (日主)', 'The Heavenly Stem of the day pillar. Many BaZi readings use it as the reference point for the rest of the chart.'],
        ['Ten Gods (十神)', 'Ten relationship labels used to describe how other stems and branches relate to the Day Master.'],
      ],
      steps: [
        'Enter a Gregorian birth date, birth time and stated sex.',
        'The calculator derives the four pillars and presents the chart data first.',
        'Review the chart inputs before asking a focused follow-up question.',
      ],
      faqs: [
        ['What does BaZi mean?', 'BaZi means “eight characters.” It refers to the two characters in each of the year, month, day and hour pillars of a traditional Chinese birth chart.'],
        ['Is BaZi the same as the Four Pillars of Destiny?', 'In English, BaZi and Four Pillars of Destiny commonly refer to the same traditional system. “Four Pillars” describes the chart structure; “BaZi” describes its eight stem-and-branch characters.'],
        ['What information is needed for a BaZi chart?', 'At minimum, a birth date, birth time and stated sex are needed. The birth time matters because it determines the hour pillar; when it is unknown, any reading should keep that limitation visible.'],
        ['Can a BaZi chart predict my future?', 'No. BaZi is a traditional cultural framework, not a verified method for predicting outcomes. Use it for learning and reflection, and keep real decisions grounded in evidence and professional advice where appropriate.'],
      ],
    },
    schema: {
      article: {
        headline: 'What Is BaZi? A Four Pillars of Destiny Guide',
        datePublished: '2026-09-19',
        dateModified: '2026-09-19',
      },
      application: {
        name: 'Genki BaZi Chart Calculator',
        description: 'A web calculator for exploring a traditional BaZi / Four Pillars chart using birth date, time and stated sex.',
      },
    },
    editorial: BAZI_EDITORIAL,
  },
  baziBasics: {
    path: '/learn/bazi-basics',
    title: '八字是什么？四柱、五行、十神与八字排盘入门 - 元氣满满',
    description: '八字入门指南：用清晰的语言说明四柱八字、天干地支、五行、日主、十神与大运，介绍八字排盘需要的出生信息与阅读边界。',
    heading: '八字入门：先读懂盘，再谈解读',
    summary: '八字是以出生年、月、日、时为基础的传统文化表达体系。这里先说明四柱、五行与十神分别在说什么，以及一份排盘需要哪些可核对的输入。',
    language: 'zh-CN',
    sections: [
      ['八字是传统文化框架，不是确定性结论', '八字排盘以干支历法组织出生时间信息，常用于传统文化学习与自我观察。它不能替代医疗、法律、投资等专业判断，也不应被用于承诺确定结果。'],
      ['四柱对应出生年、月、日、时', '年柱、月柱、日柱、时柱合称四柱；每一柱由一个天干和一个地支组成，因此称为“八字”。排盘的第一步是核对这些基础数据。'],
      ['时辰不明要保留不确定性', '出生时刻决定时柱。若只知道大概时段或完全不清楚，应在结果中明确这一限制，而不是把一个猜测的时柱当成既定事实。'],
      ['把问题落到现实行动', '完成排盘后，更适合围绕工作节奏、关系沟通或个人规划提出具体问题；把传统文化信息当作思考素材，而不是代替自己做决定。'],
    ],
    guide: {
      terms: [
        ['四柱', '出生年、月、日、时对应的四组干支，依次称为年柱、月柱、日柱、时柱。'],
        ['天干地支', '传统历法中记录时间的符号系统。每一柱由一个天干和一个地支配对组成。'],
        ['五行', '木、火、土、金、水，是传统文化中描述关系与变化的一套分类语言。'],
        ['日主', '日柱天干，又称日元。许多八字阅读会以它作为观察其他干支关系的参照点。'],
        ['十神', '依据其他干支与日主的关系形成的十类传统标签，用于组织命盘中的关系信息。'],
        ['大运', '传统八字体系中按阶段排列的干支序列，阅读时需先核对起运时间与当前阶段。'],
      ],
      steps: [
        '填写公历出生年月日、出生时间与性别；时间不确定时如实标注。',
        '先核对四柱、五行与起运等基础数据，再进入后续解读。',
        '围绕一个具体生活问题提问，并把建议与现实条件一起判断。',
      ],
      faqs: [
        ['八字和四柱是同一个意思吗？', '日常语境里常指同一套传统体系。“四柱”强调年、月、日、时四组结构；“八字”强调四柱中共八个天干地支字符。'],
        ['八字排盘需要提供哪些信息？', '至少需要公历出生年月日、出生时间和性别。出生时间决定时柱；若时辰不明，结果应保留相应的不确定性。'],
        ['不知道出生时辰还能排八字吗？', '可以先排出年、月、日三柱，但不能把时柱当作已知信息。涉及细节的传统解读应明确说明时辰缺失带来的限制。'],
        ['八字可以准确预测未来吗？', '不能。八字属于传统文化与民俗表达，不是经过验证的预测方法。请将它用于学习、反思与话题整理，不要以此替代现实决策或专业意见。'],
      ],
    },
    schema: {
      article: {
        headline: '八字是什么？四柱、五行、十神与八字排盘入门',
        datePublished: '2026-09-19',
        dateModified: '2026-09-19',
      },
      application: {
        name: '元氣满满八字排盘',
        description: '基于出生日期、时间与性别展示传统四柱八字盘面的在线工具。',
      },
    },
    editorial: BAZI_EDITORIAL,
  },
  fiveElementsMissing: {
    path: '/learn/wuxing-que-shenme-yisi',
    title: '五行缺什么是什么意思？八字五行“缺”与“喜用”的区别 - 元氣满满',
    description: '说明八字里“五行缺什么”的传统含义，区分五行缺、偏弱与喜用，解释为什么不能把“缺”直接理解为必须补足。',
    heading: '五行缺什么，是什么意思？',
    summary: '“五行缺什么”是对一张八字盘中某类五行显现情况的传统描述，不等于现实中缺少某种东西，更不等于必须立刻“补”它。',
    language: 'zh-CN',
    topic: 'bazi',
    sections: [
      ['先看见“缺”，不要急着下结论', '在八字的传统语境里，“五行缺”通常指木、火、土、金、水中某一类没有明显出现，或在表层干支中显现较少。它是盘面信息的起点，不是对一个人身体、财富、关系或未来的事实判断。'],
      ['“缺”不等于“弱”，也不等于“要补”', '五行是否偏弱，还要结合藏干、月令、日主和全局关系来看。传统说法中的喜用，也是在整体关系中讨论的取向；不能只凭一个“缺”字就决定颜色、名字、商品，更不应据此作医疗、投资、婚恋等重要决定。'],
      ['先核对排盘条件，再理解传统术语', '出生日期、出生时刻和节气口径都会影响四柱。时辰不明时只能确认三柱，任何涉及整体关系的理解都应保留这个限制。把盘面当作传统文化学习和自我观察的材料，而不是确定性结论。'],
    ],
    faqs: [
      ['五行缺什么是什么意思？', '它是传统八字中对盘面五行显现情况的描述，常指某一类五行未在表层干支出现或显现较少。它不等于现实中“缺少”某种东西，也不能单独推导出人生结论。'],
      ['五行缺和五行弱一样吗？', '不一样。“缺”侧重是否出现，“弱”需要结合季节、藏干、日主和其他干支的关系判断。只看四柱表面字符，无法把两者简单画上等号。'],
      ['五行缺某个元素就一定要补吗？', '不一定。传统语境中的“喜用”讨论的是整张盘的关系，不是看到缺什么就补什么。请不要据此购买商品或作医疗、投资、婚恋等决定。'],
      ['不知道出生时辰还能看五行吗？', '可以先查看年、月、日三柱的基本信息，但时柱缺失会让盘面不完整。涉及五行整体关系的传统解读，应明确这一限制。'],
    ],
    definedTerms: [
      ['五行缺什么', '传统八字中对一张盘内某类五行未在表层干支出现或显现较少的描述；不等于现实中缺少某种事物，也不自动等于需要补足。'],
      ['五行偏弱', '在传统阅读中，需要结合月令、藏干、日主及全局关系理解的相对状态，不能只按表层字符判断。'],
      ['喜用', '传统八字中用于讨论整张盘关系与取向的术语；不应从单一五行“缺失”直接推出。'],
    ],
    schema: {
      article: {
        headline: '五行缺什么是什么意思？八字五行“缺”与“喜用”的区别',
        datePublished: '2026-09-19',
        dateModified: '2026-09-19',
      },
      application: {
        name: '元氣满满八字排盘',
        description: '基于出生日期、时间与性别展示传统四柱八字盘面的在线工具。',
      },
    },
    termPage: {
      eyebrow: '传统文化术语 · 八字',
      definitionLabel: '一句话定义',
      definition: '“五行缺什么”描述的是八字盘里五行的显现情况；它不是现实诊断，也不是“缺什么就要补什么”的指令。',
      calculatorLabel: '核对我的八字盘',
      related: [
        { href: '/learn/bazi-basics', label: '八字入门：四柱、五行与十神' },
        { href: '/ai-bazi', label: '元氣 Agent：继续了解术语' },
      ],
    },
    editorial: BAZI_EDITORIAL,
  },
  baziDayMaster: {
    path: '/learn/what-is-a-day-master-in-bazi',
    title: 'What Is a Day Master in BaZi? Meaning and Role in Four Pillars | Genki',
    description: 'Learn what the Day Master means in BaZi: the Heavenly Stem of the Day Pillar, its relationship to the Five Elements and Ten Gods, and the limits of a chart reading.',
    heading: 'What is a Day Master in BaZi?',
    summary: 'In BaZi, the Day Master is the Heavenly Stem of the Day Pillar. It is a traditional reference point for describing relationships in a chart, not a personality label or a score for someone’s future.',
    language: 'en',
    topic: 'bazi',
    sections: [
      ['The Day Master is one part of the Day Pillar', 'Each BaZi pillar contains a Heavenly Stem and an Earthly Branch. The Day Master, also called the Day Stem, is specifically the Heavenly Stem in the day pillar. It is not the whole Day Pillar and it is not the whole chart.'],
      ['A reference point for traditional relationships', 'Many BaZi readings use the Day Master as a reference point when describing Five Elements and Ten Gods. These are traditional labels for symbolic relationships among chart components, not verified measurements of personality, health, wealth or future events.'],
      ['The calculation still depends on traceable inputs', 'A reproducible chart needs a birth date, birth time and stated sex under a stated calendar convention. An unknown time leaves the hour pillar unresolved; it should remain an uncertainty rather than be filled in with a guess.'],
    ],
    faqs: [
      ['Is the Day Master the same as the Day Pillar?', 'No. The Day Pillar contains both a Heavenly Stem and an Earthly Branch. The Day Master is the Heavenly Stem portion of that one pillar.'],
      ['Does a Day Master determine personality or future?', 'No. It is a reference term within a traditional cultural framework, not a verified personality test or a way to guarantee future outcomes.'],
      ['What if my birth time is unknown?', 'You can still identify the year, month and day pillars, including the Day Master, from a date under a stated calendar convention. The hour pillar remains unknown, so a complete chart reading should keep that limitation visible.'],
      ['How are the Ten Gods related to the Day Master?', 'In traditional BaZi vocabulary, the Ten Gods are ten labels for how other stems and branches relate to the Day Master through the Five Elements. They organize chart relationships; they are not factual diagnoses or professional advice.'],
    ],
    definedTerms: [
      ['Day Master (日主)', 'The Heavenly Stem of the Day Pillar in a BaZi chart; often used as the reference point for traditional relationships in the rest of the chart.'],
      ['Day Pillar', 'The day’s paired Heavenly Stem and Earthly Branch, one of the Four Pillars. The Day Master is only its Heavenly Stem.'],
      ['Ten Gods (十神)', 'Ten traditional relationship labels that describe how other chart components relate to the Day Master through the Five Elements.'],
    ],
    schema: {
      article: {
        headline: 'What Is a Day Master in BaZi? Meaning and Role in Four Pillars',
        datePublished: '2026-09-19',
        dateModified: '2026-09-19',
      },
      application: {
        name: 'Genki BaZi Chart Calculator',
        description: 'A web calculator for exploring a traditional BaZi / Four Pillars chart using birth date, time and stated sex.',
      },
    },
    termPage: {
      eyebrow: 'TRADITIONAL CULTURE TERM · BAZI',
      definitionLabel: 'IN ONE SENTENCE',
      definition: 'The Day Master is the Heavenly Stem of the Day Pillar: a reference point in traditional BaZi vocabulary, not a label that determines a person or their future.',
      calculatorLabel: 'Check a BaZi chart',
      related: [
        { href: '/learn/bazi-four-pillars', label: 'BaZi / Four Pillars guide' },
        { href: '/ai-bazi', label: 'Genki Agent: explore a term' },
      ],
    },
    editorial: BAZI_EDITORIAL,
  },
  ziwei: {
    path: '/ziwei',
    title: '紫微斗数排盘｜十二宫、主星与大限解读 - 元氣满满',
    description: '在线生成紫微斗数命盘，查看十二宫、主星、四化与大限。内容以传统文化学习和娱乐参考为目的。',
    heading: '紫微斗数排盘',
    summary: '在线生成紫微斗数命盘，查看十二宫、主星、四化与大限等传统命理信息。',
    sections: [
      ['十二宫与主星', '从命宫、事业、财帛、夫妻等宫位认识紫微斗数的基本阅读方式。'],
      ['大限参考', '结合大限与流年查看阶段主题，结果用于传统文化学习与个人思考参考。'],
    ],
  },
  huangli: {
    path: '/huangli',
    title: '今日黄历与个性化黄历｜宜忌、择日与八字参考 - 元氣满满',
    description: '查询今日黄历、农历、宜忌、冲煞和吉时；填写生辰后可获得结合个人八字与生活场景的个性化黄历参考。',
    heading: '今日黄历与个性化黄历',
    summary: '查询农历、节气、宜忌、冲煞与吉时，也可结合个人八字取得生活场景参考。',
    sections: [
      ['今日黄历', '查看日期对应的农历、节气、宜忌、冲煞和时辰信息。'],
      ['个性化参考', '填写出生信息后，可把日常安排与八字信息一并纳入传统择日参考。'],
    ],
  },
  agent: {
    path: '/ai-bazi',
    title: '元氣 Agent｜随时在身边的玄学 AI 助手 - 元氣满满',
    description: '元氣 Agent 是随时在身边的玄学 AI 助手，可结合八字、紫微、黄历等工具结果，回答传统文化问题并给出结构化的思考参考。',
    heading: '元氣 Agent：随时在身边的玄学 AI 助手',
    summary: '围绕八字、紫微斗数、黄历与生活里的具体困惑提问。元氣 Agent 会先核对可计算的信息，再用清晰、可继续追问的方式整理传统文化视角。',
    sections: [
      ['先核对信息，再讨论问题', '涉及命盘、日期和择日的问题，元氣 Agent 会优先调用相应工具核对基础信息；出生时辰不明等限制会保留在回答中。'],
      ['用一个具体问题开始', '可以围绕事业节奏、关系沟通、生活安排或传统文化概念发问。在同一会话中可继续追问，避免反复提供已确认的信息。'],
      ['传统文化参考，而非确定性结论', '回答用于传统文化学习、反思与话题整理，不构成医疗、法律、投资或其他专业建议，也不承诺预测结果。'],
    ],
    faqs: [
      ['元氣 Agent 是什么？', '元氣 Agent 是元氣满满提供的玄学 AI 助手，面向八字、紫微斗数、黄历等传统文化问题。它会结合站内可用工具结果与用户的具体问题，整理可继续讨论的参考。'],
      ['元氣 Agent 能回答哪些问题？', '你可以询问八字和紫微斗数的基础概念、排盘后的盘面信息、黄历与择日的传统说法，或围绕事业、关系和生活安排提出一个具体问题。涉及盘面时，应先提供或核对必要的出生与时间信息。'],
      ['元氣 Agent 会直接预测结果吗？', '不会。元氣 Agent 不提供确定性预测，也不替代医疗、法律、投资或其他专业意见。它将传统文化内容作为学习、反思和整理问题的材料。'],
      ['没有排盘也可以咨询元氣 Agent 吗？', '可以。你可以先从概念或现实中的具体困惑开始。若问题需要命盘、日期或择日信息，元氣 Agent 会提示你补充或先核对相应输入。'],
    ],
    schema: {
      article: {
        headline: '元氣 Agent：随时在身边的玄学 AI 助手',
        datePublished: '2026-09-19',
        dateModified: '2026-09-19',
      },
      application: {
        name: '元氣 Agent',
        description: '可围绕八字、紫微斗数与黄历问题提供工具核对和结构化传统文化参考的网页 AI 助手。',
        url: '/ai-bazi',
        featureList: ['八字与四柱问题整理', '紫微斗数基础问答', '黄历与择日信息核对', '基于会话的继续追问'],
      },
    },
  },
  tarot: {
    path: '/tarot',
    title: '在线塔罗牌阵解读｜单牌与多牌阵 - 元氣满满',
    description: '在线抽取塔罗牌，提供单牌与多牌阵的牌意整理和行动提示，仅供自我觉察与娱乐参考。',
    heading: '在线塔罗牌阵解读',
    summary: '选择单牌或多牌阵，整理当前问题的牌面象征和可执行的行动提示。',
    sections: [
      ['单牌与多牌阵', '按问题选择适合的牌阵，查看每张牌在位置与主题中的含义。'],
      ['自我觉察参考', '塔罗内容用于整理想法和自我觉察，不作为医疗、投资、法律或其他专业决策依据。'],
    ],
  },
  fengshui: {
    path: '/fengshui',
    title: '家居风水分析｜户型方位与书桌座位建议 - 元氣满满',
    description: '根据大门朝向、房间布局与个人五行偏好，查看家居风水与座位布置的传统文化参考。',
    heading: '家居风水分析',
    summary: '从大门朝向、房间布局与个人偏好出发，获取家居和座位布置的传统文化参考。',
    sections: [
      ['空间信息整理', '提交户型、方位与房间功能信息，按传统风水的常用框架查看建议。'],
      ['生活场景建议', '建议服务于居住舒适度和空间整理，不替代建筑、消防或其他专业意见。'],
    ],
  },
  name: {
    path: '/name',
    title: '姓名分析与起名参考｜五格三才与八字喜用 - 元氣满满',
    description: '提供姓名五格、三才配置分析与结合八字喜用的起名参考，适合传统姓名文化学习。',
    heading: '姓名分析与起名参考',
    summary: '查看姓名五格、三才配置，并结合八字喜用获取传统姓名文化参考。',
    sections: [
      ['姓名文化分析', '从笔画、五格和三才配置等传统姓名学角度理解名字的结构。'],
      ['起名方向参考', '可结合出生信息与五行偏好整理起名方向，最终命名请兼顾读音、语义与实际使用。'],
    ],
  },
  wenku: {
    path: '/wenku',
    title: '命理文库｜八字、紫微、黄历与传统文化文章 - 元氣满满',
    description: '阅读八字、紫微斗数、黄历择日、风水和姓名文化文章，用清晰的内容了解传统命理知识。',
    heading: '命理文库',
    summary: '阅读八字、紫微斗数、黄历择日、风水和姓名文化文章，建立清晰的传统文化知识框架。',
    sections: [
      ['基础知识', '从常见术语、排盘方法与历史文化背景入门，理解不同传统体系的适用边界。'],
      ['持续更新', '发布有明确主题、来源和实际阅读价值的内容，避免同质化的自动生成页面。'],
    ],
  },
}

export function languageAlternatesForPage(page, siteUrl = DEFAULT_SITE_URL) {
  if (page.path !== '/learn/bazi-basics' && page.path !== '/learn/bazi-four-pillars') return []
  return [
    { language: 'zh-CN', href: `${siteUrl}/learn/bazi-basics` },
    { language: 'en', href: `${siteUrl}/learn/bazi-four-pillars` },
    { language: 'x-default', href: `${siteUrl}/learn/bazi-four-pillars` },
  ]
}

export function structuredDataForPage(page, canonicalUrl, siteUrl = DEFAULT_SITE_URL) {
  const language = page.language || 'zh-CN'
  const faqs = page.guide?.faqs || page.faqs || []
  const terms = page.definedTerms || page.guide?.terms || []
  const isBaziTopic = page.topic === 'bazi' || Boolean(page.guide)
  const organizationId = `${siteUrl}/#organization`
  const websiteId = `${siteUrl}/#website`
  const pageId = `${canonicalUrl}#webpage`
  const articleId = `${canonicalUrl}#article`
  const faqId = `${canonicalUrl}#faq`
  const applicationId = `${siteUrl}${page.schema?.application?.url || '/bazi'}#application`
  const baziTopicId = `${siteUrl}/#bazi-four-pillars`
  const termSetId = `${canonicalUrl}#terms`
  const primaryTermId = terms.length ? `${termSetId}-1` : null
  const editorialPersonId = `${canonicalUrl}#byline`
  const organization = {
    '@type': 'Organization',
    '@id': organizationId,
    name: 'Genki',
    alternateName: '元氣满满',
    url: siteUrl,
  }
  const website = {
    '@type': 'WebSite',
    '@id': websiteId,
    name: 'Genki',
    alternateName: '元氣满满',
    url: siteUrl,
    publisher: { '@id': organizationId },
  }
  const hasArticle = Boolean(page.schema?.article)
  const nodes = [organization, website, {
    '@type': page.path === '/wenku' ? 'CollectionPage' : 'WebPage',
    '@id': pageId,
    name: page.title,
    description: page.description,
    url: canonicalUrl,
    isPartOf: { '@id': websiteId },
    inLanguage: language,
    ...(hasArticle ? {
      mainEntity: { '@id': articleId },
    } : {}),
    ...(isBaziTopic ? {
      about: { '@id': baziTopicId },
    } : {}),
  }]

  if (page.editorial) {
    nodes.push({
      '@type': 'Person',
      '@id': editorialPersonId,
      name: page.editorial.byline,
      description: '元氣满满内容编辑署名，不代表学术或其他专业资质。',
    })
  }

  if (isBaziTopic) {
    nodes.push({
      '@type': 'DefinedTerm',
      '@id': baziTopicId,
      name: 'BaZi',
      alternateName: ['八字', 'Four Pillars', 'Four Pillars of Destiny'],
      description: 'A traditional Chinese system that represents a birth year, month, day and hour as four stem-and-branch pillars.',
    })
    nodes.push({
      '@type': 'DefinedTermSet',
      '@id': termSetId,
      name: language === 'en' ? 'BaZi / Four Pillars key terms' : '八字核心术语',
      description: page.description,
      inLanguage: language,
      about: { '@id': baziTopicId },
      hasDefinedTerm: terms.map(([name, description], index) => ({
        '@type': 'DefinedTerm',
        '@id': `${termSetId}-${index + 1}`,
        name,
        description,
        url: `${canonicalUrl}#terms`,
        inDefinedTermSet: { '@id': termSetId },
      })),
    })
  }

  if (page.schema?.article) {
    nodes.push({
      '@type': 'Article',
      '@id': articleId,
      headline: page.schema.article.headline,
      description: page.description,
      datePublished: page.schema.article.datePublished,
      dateModified: page.schema.article.dateModified,
      mainEntityOfPage: { '@id': pageId },
      author: page.editorial ? { '@id': editorialPersonId } : { '@id': organizationId },
      publisher: { '@id': organizationId },
      inLanguage: language,
      ...(page.editorial ? {
        editor: { '@id': editorialPersonId },
        ...(page.editorial.sources?.length ? { citation: page.editorial.sources.map(source => source.url || source.title) } : {}),
      } : {}),
      ...(isBaziTopic ? {
        about: { '@id': baziTopicId },
        ...(primaryTermId ? { mainEntity: { '@id': primaryTermId } } : {}),
        mentions: [{ '@id': termSetId }, { '@id': applicationId }, { '@id': `${siteUrl}/ai-bazi#application` }],
      } : {}),
    })
  }
  if (faqs.length) {
    nodes.push({
      '@type': 'FAQPage',
      '@id': faqId,
      mainEntity: faqs.map(([name, text]) => ({
        '@type': 'Question',
        name,
        acceptedAnswer: { '@type': 'Answer', text },
      })),
      inLanguage: language,
      ...(isBaziTopic ? { about: { '@id': primaryTermId || baziTopicId } } : {}),
    })
  }
  if (page.schema?.application) {
    nodes.push({
      '@type': 'WebApplication',
      '@id': applicationId,
      name: page.schema.application.name,
      description: page.schema.application.description,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      url: `${siteUrl}${page.schema.application.url || '/bazi'}`,
      isAccessibleForFree: true,
      inLanguage: language,
      ...(page.schema.application.featureList ? { featureList: page.schema.application.featureList } : {}),
      ...(isBaziTopic ? { about: { '@id': baziTopicId } } : {}),
    })
  }
  return { '@context': 'https://schema.org', '@graph': nodes }
}
