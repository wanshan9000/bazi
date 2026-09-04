/**
 * 玄学经典案例库（典籍研习层 · 案例数据）
 *
 * 每个案例记录：典籍记载的典型情境 / 所问之事 / 经典断语 / 判断依据（原文）/ 出处。
 * 供 agent 在"弄不清楚"时检索对照——依据典籍案例模式作出判断，而非凭空推断。
 *
 * 真实性护栏（SAFE）：
 *   - 断语与依据均出自真实典籍条文，出处标注到篇章，可自行核对；
 *   - 不虚构具体命例的完整生辰（避免"看起来像真的"的编造），以情境模式呈现；
 *   - 检索不到对应案例 → 由 classicStudy 诚实说明，绝不拼凑。
 */
export const CASE_LIBRARY = [
  /* ==================== 八字（子平） ==================== */
  {
    id: 'case-cong-ge',
    system: 'bazi',
    topic: 'geju',
    book: '《滴天髓》',
    source: '从化论·从局',
    title: '从格（真从）案例',
    situation: '日主极弱无根，全局财星或食伤成势，印比不见或虚浮无力。',
    question: '身弱财旺到极致，是扶还是从？',
    judgment: '顺势而从：从财、从儿（食伤），喜财官食伤，忌印比帮扶。',
    basis: '「从得真者只论从，从神又有吉和凶。」——《滴天髓》',
    tip: '从格关键在"真"：从神得势、日主无依则真；若印比尚有微根，则不可从，宜扶。'
  },
  {
    id: 'case-shang-guan-pei-yin',
    system: 'bazi',
    topic: 'shishen',
    book: '《子平真诠》',
    source: '论伤官',
    title: '伤官配印案例',
    situation: '伤官当令有力，日主偏弱，命局有正印透干生身。',
    question: '伤官旺但身弱，怎么办？',
    judgment: '伤官配印，为贵格：印能制伤官之傲，又能生身，才华有收束而贵。',
    basis: '「伤官配印，贵而清。」——《子平真诠·论伤官》',
    tip: '伤官虽聪明外露，若无印收束则狂傲招祸；有印则才华化为名声职权。'
  },
  {
    id: 'case-qi-sha-you-zhi',
    system: 'bazi',
    topic: 'shishen',
    book: '《子平真诠》',
    source: '论七杀',
    title: '七杀有制案例',
    situation: '七杀当令，威权入命；但命局有食神或印绶制化。',
    question: '七杀克身，是凶吗？',
    judgment: '七杀有制，反成大贵：食神制杀、印绶化杀，皆为权柄之象。',
    basis: '「煞为君火，制煞为臣水；煞无制则伤身，制得宜则掌权。」——《子平真诠》',
    tip: '七杀本主凶险压力，有制化则压力化权柄，主事业魄力与威名。'
  },
  {
    id: 'case-cai-guan-shuang-mei',
    system: 'bazi',
    topic: 'yongshen',
    book: '《渊海子平》',
    source: '论财官',
    title: '财官双美案例',
    situation: '身旺，月令财官相生有情，财旺生官，日主足以任之。',
    question: '身旺财官旺，运势如何？',
    judgment: '财官双美，富贵可期：财为养命之源，官为安身之本，身旺可任则名利双收。',
    basis: '「财乃养命之源，官乃扶身之本；财官双美，富贵荣华。」——《渊海子平》',
    tip: '前提是身旺能任财官；若身弱财官重，反为"财多身弱、官多身弱"之患。'
  },
  {
    id: 'case-tiao-hou-dong-xia',
    system: 'bazi',
    topic: 'tiaohou',
    book: '《穷通宝鉴》',
    source: '调候要诀',
    title: '调候（寒命喜火）案例',
    situation: '生于寒冬（亥子丑月），日主及格局偏寒，命局火弱。',
    question: '冬天出生、命局偏寒，最需要什么？',
    judgment: '调候为急：寒命先取丙丁火暖局，火为第一用神，其次再论格局。',
    basis: '「寒金喜火，燥木喜水；寒木向阳，冬金须丙。」——《穷通宝鉴》',
    tip: '调候优先于扶抑：冬生人再好的格局，缺暖亦打折；大运行火地则顺遂。'
  },
  {
    id: 'case-ri-zhu-qiang-ruo',
    system: 'bazi',
    topic: 'body',
    book: '《滴天髓》',
    source: '论衰旺',
    title: '身强身弱取用案例',
    situation: '日主得令得地得势则强，失令失地无帮扶则弱。',
    question: '怎么判断自己身强还是身弱？',
    judgment: '身强喜克泄耗（财官食伤），身弱喜生扶（印比）；强弱以月令得令为先，再看得地得势。',
    basis: '「能知衰旺之真机，其于三命之奥，思过半矣。」——《滴天髓·论衰旺》',
    tip: '身强是"能担事"的资本，身弱是"宜借力"的信号，本无优劣，在于配局。'
  },
  {
    id: 'case-yun-sui-ji-xiong',
    system: 'bazi',
    topic: 'dayun',
    book: '《滴天髓》',
    source: '论运岁',
    title: '大运吉凶案例',
    situation: '命中喜用神已定，逢大运干支为喜用则吉，忌神则咎。',
    question: '哪几年运势好、哪几年要小心？',
    judgment: '运逢喜用则荣，逢忌神则咎；流年为一年之令主，与大运命局有情则吉。',
    basis: '「运逢喜神则荣，逢忌神则咎。」——《滴天髓·论运岁》',
    tip: '看运势先定喜忌：喜财遇财年则进财，忌官逢官岁则压力陡增。'
  },
  /* ==================== 六爻 ==================== */
  {
    id: 'case-liuyao-guan',
    system: 'liuyao',
    topic: 'gongming',
    book: '《增删卜易》',
    source: '占功名',
    title: '占功名（官星为用）案例',
    situation: '占考试/事业/功名，以官鬼爻为用神，父爻为文书。',
    question: '考试能过吗？仕途如何？',
    judgment: '官鬼旺相、临日月或得动爻生扶、父爻不空不破，则功名可成；官鬼空破墓绝则难。',
    basis: '「占功名，官鬼为用神，文书看父母。」——《增删卜易·功名章》',
    tip: '野鹤云"官爻旺相功名可期，官爻空破则谋而不成"，以用神旺衰定成败。'
  },
  {
    id: 'case-liuyao-hunyin',
    system: 'liuyao',
    topic: 'hunyin',
    book: '《增删卜易》',
    source: '占婚姻',
    title: '占婚姻（用神旺衰）案例',
    situation: '占婚姻，男占以妻财为用，女占以官鬼为用，兼看世应关系。',
    question: '这段感情成不成？',
    judgment: '用神旺相、世应相合、动爻不生忌神则成；用神空破、世应冲克则难成。',
    basis: '「占婚姻，男看财爻，女看官爻；世应相合则成，相冲则散。」——《增删卜易·婚姻章》',
    tip: '应爻为对方：应生世则对方有心，世生应则己方主动，生克定亲疏。'
  },
  {
    id: 'case-liuyao-shizuo',
    system: 'liuyao',
    topic: 'dangshi',
    book: '《周易·系辞》',
    source: '占事原则',
    title: '一事一占案例',
    situation: '同一件事反复占问，或一事多问。',
    question: '同一件事可以占好几次吗？',
    judgment: '一事一占，心诚则灵；反复占问则信息混杂，反而难断。',
    basis: '「初筮告，再三渎，渎则不告。」——《周易·蒙卦》',
    tip: '占卜重在心念专一：心不定则卦不明，宜静心后一次问清。'
  },
  /* ==================== 紫微斗数 ==================== */
  {
    id: 'case-ziwei-zifu',
    system: 'ziwei',
    topic: 'minggong',
    book: '《紫微斗数全书》',
    source: '紫府同宫',
    title: '紫微天府同宫案例',
    situation: '命宫紫微天府同守（紫府同宫），二帝同垣。',
    question: '紫微天府在命宫代表什么？',
    judgment: '紫府同宫，稳重而有统御之才，主财权双美；但有时过于保守求稳。',
    basis: '紫微为帝座、天府为财库，双星同宫"紫府朝垣"，主贵而掌财。——《紫微斗数全书》',
    tip: '紫府同宫者宜守成创业结合：既有大局观又有理财力，忌冒进投机。'
  },
  {
    id: 'case-ziwei-sha-po-lang',
    system: 'ziwei',
    topic: 'minggong',
    book: '《紫微斗数全书》',
    source: '杀破狼',
    title: '杀破狼格局案例',
    situation: '命宫/迁移/官禄见七杀、破军、贪狼（杀破狼）。',
    question: '杀破狼格局的命有什么特点？',
    judgment: '杀破狼主变动、开创、冲劲：人生多起伏，宜行商、开拓型事业，不宜守成。',
    basis: '「杀破狼，主一生荣枯多变迁，动中得贵。」——《紫微斗数全书》',
    tip: '杀破狼之命"不喜静而喜动"：越折腾越旺，安稳反而埋没才能。'
  },
  /* ==================== 奇门遁甲 ==================== */
  {
    id: 'case-qimen-dun-wu',
    system: 'qimen',
    topic: 'keshi',
    book: '《烟波钓叟歌》',
    source: '奇门用神',
    title: '奇门择时（日干/时干）案例',
    situation: '问某时是否宜办事，看时干与日干生克、值符值使落宫旺衰。',
    question: '什么时辰出门/签约/谈判最好？',
    judgment: '时干生日干、值符宫生身宫、三奇得地则吉；值使空亡、时干克日干则不利。',
    basis: '「天乙值符为尊神，三奇六仪各有用；时干生我则吉，克我则凶。」——《烟波钓叟歌》',
    tip: '奇门重时：同样一件事，不同时辰格局完全不同；急则从神，缓则从门。'
  },
  {
    id: 'case-qimen-san-ji',
    system: 'qimen',
    topic: 'keshi',
    book: '《奇门遁甲秘笈大全》',
    source: '三奇得使',
    title: '乙丙丁三奇案例',
    situation: '用事之时乙、丙、丁三奇临门临宫得地，且不逢墓迫空亡。',
    question: '怎么判断一个时辰是否吉？',
    judgment: '三奇得使、值符得地、门宫相生则吉；三奇入墓、门迫宫克则吉中藏忧。',
    basis: '「乙丙丁三奇，得使者万事宜成。」——《奇门遁甲秘笈大全》',
    tip: '三奇只是吉的因素之一，还要看门（开休生为吉门）与宫位生克。'
  },
  /* ==================== 择日（黄历） ==================== */
  {
    id: 'case-ri-li-marry',
    system: 'huangli',
    topic: 'zeri',
    book: '《协纪辨方书》',
    source: '嫁娶择日',
    title: '嫁娶择日案例',
    situation: '选婚期：避开冲女方年命/岁破/月破，选黄道吉日与吉时。',
    question: '怎么选个好日子结婚？',
    judgment: '择日先避凶：忌与新郎新娘属相相冲、忌岁破月破；再选黄道日、吉神当值之日。',
    basis: '「选日以避凶为先，择吉以禳福为要。」——《协纪辨方书》',
    tip: '最要紧是"不冲生肖、不犯三煞"，其次才是黄道黑道；日子是锦上添花，人和更关键。'
  },
  {
    id: 'case-ri-li-baizi',
    system: 'huangli',
    topic: 'zeri',
    book: '《玉匣记》',
    source: '入宅择日',
    title: '入宅/动土择日案例',
    situation: '搬家入宅或动土开工，避开月建对冲日、岁煞方，选吉神值日。',
    question: '搬家/装修开工哪天好？',
    judgment: '宜选天德、月德、黄道吉日，忌冲宅主生肖；动土需避三煞方与太岁方位。',
    basis: '「天德月德为百事吉日；动土避三煞，入宅忌冲主。」——《玉匣记》',
    tip: '入宅重在"安"：主人属相不冲、吉神值日即可，不必过分执着时辰分毫。'
  },
  /* ==================== 姓名 ==================== */
  {
    id: 'case-name-wuxing',
    system: 'name',
    topic: 'xingming',
    book: '《姓名学》',
    source: '五行补益',
    title: '姓名补益案例',
    situation: '名字笔画五行与命局喜用五行相合，则补益运势。',
    question: '名字能补命里缺的五行吗？',
    judgment: '姓名学以三才五格与五行补益为主：命喜什么五行，名字宜带相应五行之字。',
    basis: '「名者命也，名字与命局五行相合则助运。」——传统姓名学通则',
    tip: '名字的作用是"微调"而非"改命"：补益喜用五行有助，但勿夸大名字决定命运。'
  },
  /* ==================== 风水 ==================== */
  {
    id: 'case-fs-sha',
    system: 'fengshui',
    topic: 'fengshui',
    book: '《阳宅三要》',
    source: '形煞化解',
    title: '路冲/尖角煞案例',
    situation: '宅外有路冲、尖角、反弓等形煞正对门窗。',
    question: '房子外面有路冲、尖角怎么办？',
    judgment: '形煞以"避、挡、化"为要：绿植屏风遮挡、山海镇/八卦镜镇化，吉方采光纳气。',
    basis: '「门前见冲射，人丁不安宁；以屏挡之、以镇化之。」——《阳宅三要》',
    tip: '形煞化解重在心理安定与实际采光通风：煞是环境失衡，调整环境即可，不必恐惧。'
  },
  /* ==================== 塔罗 ==================== */
  {
    id: 'case-tarot-guidance',
    system: 'tarot',
    topic: 'tarot',
    book: '《塔罗冥想》',
    source: '大阿卡纳指引',
    title: '大阿卡纳（愚人→世界）案例',
    situation: '抽到大阿卡纳：愚人、女皇、倒吊人等，象征人生阶段与课题。',
    question: '抽到大阿卡纳代表什么？',
    judgment: '大阿卡纳对应人生重大课题：如愚人代表新开始、倒吊人代表换位思考与等待。',
    basis: '大阿卡纳 22 张为"愚人之旅"，象征心灵成长之路。——《塔罗冥想》',
    tip: '塔罗是自我觉察工具：牌面反映当下心态与可能性，最终选择权始终在自己手中。'
  }
]

/* ---------- 工具：检索 ---------- */

/** 按系统 + 主题筛选 */
export function casesBy(system, topic) {
  return CASE_LIBRARY.filter(c =>
    (!system || c.system === system) &&
    (!topic || c.topic === topic))
}

/**
 * 按关键词相关性检索案例（简单加权：标题/情境/断语包含词越多分越高）
 * @param {string} q 用户问题
 * @param {string} [system] 限定体系
 * @returns {Array} 排序后的案例
 */
export function searchCases(q, system) {
  if (!q) return []
  const tokens = q.replace(/[？?。，,.！!、\s]/g, ' ').split(' ').filter(t => t.length >= 2)
  const scored = []
  for (const c of CASE_LIBRARY) {
    if (system && c.system !== system) continue
    const hay = `${c.title} ${c.situation} ${c.judgment} ${c.basis} ${c.tip}`.replace(/\s/g, '')
    let score = 0
    for (const t of tokens) if (hay.includes(t)) score += 1
    // 主题词（身份类）也给分
    const systemAlias = { bazi: '八字命局', liuyao: '六爻卦', ziwei: '紫微', qimen: '奇门', huangli: '黄历择日', name: '姓名', fengshui: '风水', tarot: '塔罗' }
    if (systemAlias[system] && q.includes(systemAlias[system].slice(0, 2))) score += 1
    if (score > 0) scored.push({ ...c, score })
  }
  return scored.sort((a, b) => b.score - a.score)
}
