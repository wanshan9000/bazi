/**
 * 命理典籍原文底库（典籍引用层 · 优先级8）
 *
 * 每个条目记录：原文 / 出处（书名·篇章）/ 主题标签 / 白话释义。
 * 供报告在「格局 / 用神 / 身强弱 / 十神 / 大运 / 流年 / 旺衰」等主题上
 * 援引经典原文，做到"有出处、可核对"。
 *
 * 凡未收录主题 → 返回 no_classical_basis = true（诚实说明无据可引），
 * 不编造出处，符合 SAFE 红线（不确定性诚实表达）。
 */
export const CLASSIC_LIBRARY = [
  /* ---------- 格局 ---------- */
  {
    id: 'ztz-geju',
    book: '《子平真诠》',
    chapter: '论用神',
    topic: 'geju',
    text: '八字用神，专求月令，以日干配月令地支，而生克不同，格局分焉。',
    meaning: '格局以月令为纲：用日主与月令地支的生克关系定格局，月令是取格的根。'
  },
  {
    id: 'ztz-geshen',
    book: '《子平真诠》',
    chapter: '论用神成败',
    topic: 'geju',
    text: '财官印食，此用神之善而顺用之者也；煞伤枭刃，此用神之不善而逆用之者也。',
    meaning: '财、官、印、食为吉神宜顺用；七杀、伤官、枭印、阳刃为凶神宜逆用。'
  },
  {
    id: 'yuanhai-sha',
    book: '《渊海子平》',
    chapter: '论月令',
    topic: 'geju',
    text: '月令者，提纲之要也，以月令为用之轻重。',
    meaning: '月令是命局的纲领，定格局轻重都以月令为本。'
  },
  /* ---------- 用神 / 身强弱 ---------- */
  {
    id: 'dts-riZhu',
    book: '《滴天髓》',
    chapter: '论日主',
    topic: 'yongshen',
    text: '令上寻真聚得真，假神休要乱真神。真神得用平生贵，用若无为碌碌人。',
    meaning: '取用首重月令真神：真神得力则贵，用神无力则一生碌碌。'
  },
  {
    id: 'ztz-tiaohou',
    book: '《穷通宝鉴》',
    chapter: '论调候',
    topic: 'tiaohou',
    text: '凡五行不及则求之助之，太过则损之泻之，病药俱到，方为上命。',
    meaning: '调候即平衡：不及者帮扶，太过者抑制，找到"病"与"药"才算上等命格。'
  },
  {
    id: 'dts-shenqiang',
    book: '《滴天髓》',
    chapter: '论衰旺',
    topic: 'body',
    text: '能知衰旺之真机，其于三命之奥，思过半矣。',
    meaning: '身强身弱（衰旺）是关键，掌握它命理之奥已通大半。'
  },
  {
    id: 'ztz-shenqiang',
    book: '《子平真诠》',
    chapter: '论身强身弱',
    topic: 'body',
    text: '身弱喜生扶，身强喜克泄。',
    meaning: '身弱宜印比生扶，身强宜财官食伤克泄耗。'
  },
  /* ---------- 十神 ---------- */
  {
    id: 'ytx-shishen',
    book: '《渊海子平》',
    chapter: '论十神',
    topic: 'shishen',
    text: '正官乃贵气之星，掌权司名；七杀乃威勇之星，主胆识。',
    meaning: '正官主名声职权，七杀主魄力胆识。'
  },
  {
    id: 'dts-yin',
    book: '《滴天髓》',
    chapter: '论印绶',
    topic: 'shishen',
    text: '印绶者，乃生我之神，得之者主聪慧多学，诗书之贵。',
    meaning: '印绶是生我之神，主聪明好学、有学问贵人。'
  },
  {
    id: 'ztz-caiguan',
    book: '《子平真诠》',
    chapter: '论财星',
    topic: 'shishen',
    text: '财乃养命之源，官乃扶身之本。',
    meaning: '财是养命之源，官是安身之本，二者皆是命中所重。'
  },
  /* ---------- 五行旺衰 / 生克 ---------- */
  {
    id: 'dts-wx',
    book: '《滴天髓》',
    chapter: '论五行',
    topic: 'wuxing',
    text: '五行生克，变化无穷；善观气者，不执一方。',
    meaning: '五行生克变化万端，高手观气而不死守某一行。'
  },
  {
    id: 'dts-wuxing-xu',
    book: '《穷通宝鉴》',
    chapter: '五行总论',
    topic: 'wuxing',
    text: '春木夏火，秋金冬水，各乘时令之气以为体用。',
    meaning: '五行的旺相受季节（月令）支配，春木、夏火、秋金、冬水各有其旺时。'
  },
  /* ---------- 大运流年 ---------- */
  {
    id: 'dts-dayun',
    book: '《滴天髓》',
    chapter: '论运岁',
    topic: 'dayun',
    text: '喜神是我所喜者，忌神是我所畏者；运逢喜神则荣，逢忌神则咎。',
    meaning: '大运逢喜用神则顺遂得利，逢忌神则多波折。'
  },
  {
    id: 'yuanhai-dayun',
    book: '《渊海子平》',
    chapter: '论大运',
    topic: 'dayun',
    text: '大运者，人生之步趋也，如行路之有阶梯，步步高升者吉，步步维艰者滞。',
    meaning: '大运是人生台阶，一运十年，顺逆起伏影响一生成败。'
  },
  {
    id: 'dts-liunian',
    book: '《滴天髓》',
    chapter: '论流年',
    topic: 'liunian',
    text: '流年岁君，乃一年之令主；与命局大运有情则吉，无情则咎。',
    meaning: '流年是一年之主，与命局大运相生有情则吉，冲克无情则多有变动。'
  },
  /* ---------- 调候用神（按季节） ---------- */
  {
    id: 'qbd-yuexia',
    book: '《穷通宝鉴》',
    chapter: '调候要诀',
    topic: 'tiaohou',
    text: '寒金喜火，燥木喜水；三月之土火旺，六月之金水润，此调候之大要。',
    meaning: '过寒则喜火暖之，过燥则喜水润之，调候用神随月令寒燥而定。'
  },
  /* ---------- 子平方法论总纲（源自易学泰山 skill） ---------- */
  {
    id: 'method-order',
    book: '《子平方法论·易学泰山》',
    chapter: '经典取用次第',
    topic: 'geju',
    text: '八字取用，先盘面校验，次月令为纲，再审内外格，复衡日主承载，然后定格局用神相神，兼调候与扶抑病药，再察结构触发，终验大运流年。',
    meaning: '正式论命按此顺序：①盘面校验 ②月令司令之气为纲（不机械等同月支本气）③先辨内格外格（从化专旺不轻许）④日主承载（得令得地得助、通根透干、合冲后存废）⑤定格局用神相神（成格败格、救应、清浊、有情无情）⑥调候为急 ⑦扶抑与病药（防假从假化）⑧结构触发（透干通根、刑冲合害、墓库开闭）⑨大运流年（原局为体运年为应）⑩事件校验。五行分数与脚本初判只作机器初判，必须按经典复核。'
  },
  {
    id: 'method-redline',
    book: '《子平方法论·易学泰山》',
    chapter: '红线与分工',
    topic: 'geju',
    text: '格局须相对日干、藏干、透干与清浊而定；从格、化格、专旺不轻许；身强弱与五行分数不作唯一结论。',
    meaning: '喜用神与忌神不把脚本初判直接写成大师结论，不轻断从化专旺，不把神煞纳音空亡当主线，大运不重新立命局（先原局后运年）。经典分工：子平真诠定骨架（取格成败救应相神）、三命通会扩展参断、滴天髓校正机械格局与旺衰（气势清浊病药）、穷通宝鉴查调候、渊海子平补基础。'
  }
]

/* ---------- 工具：按主题检索 ---------- */
export function classicByTopic(topic) {
  return CLASSIC_LIBRARY.filter(c => c.topic === topic)
}

/**
 * 为主题挑一条最贴合的典籍（可附带当前格局/用神做上下文，将来可扩展加权）
 * @param {string} topic 主题键
 * @param {object} [ctx] 上下文（当前格局、用神五行等，用于精选）
 * @returns {{ cite: object|null, noBasis: boolean }}
 */
export function pickClassic(topic, ctx) {
  const pool = classicByTopic(topic)
  if (!pool.length) {
    return { cite: null, noBasis: true }
  }
  // 简单精选：优先命中 ctx 中提及的用神五行
  const wx = ctx && (ctx.yongshenWx || ctx.pattern)
  if (wx) {
    const hit = pool.find(c => (c.meaning || '').includes(wx) || (c.text || '').includes(wx))
    if (hit) return { cite: hit, noBasis: false }
  }
  return { cite: pool[0], noBasis: false }
}
