// 三门命理 · 塔罗牌知识库
// 78 张：大阿尔克那 22 + 小阿尔克那 56（权杖/圣杯/宝剑/星币 各 14）
// 解读：每张牌含正位/逆位含义、关键词、视觉符号

export const SUIT_META = {
  wands: { name: '权杖', en: 'Wands', el: '🔥', elem: '火', theme: '行动·创造·事业' },
  cups: { name: '圣杯', en: 'Cups', el: '🏆', elem: '水', theme: '情感·关系·直觉' },
  swords: { name: '宝剑', en: 'Swords', el: '⚔️', elem: '风', theme: '思想·冲突·真相' },
  pentacles: { name: '星币', en: 'Pentacles', el: '🪙', elem: '土', theme: '物质·事业·健康' }
}

// 大阿尔克那（22 张）
export const MAJOR = [
  { id: 'm0',  num: 0,  name: '愚者',     en: 'The Fool',          glyph: '🃏', up: '新的开始、纯真、自由与冒险的勇气。怀揣赤子之心踏上未知道路。', rev: '鲁莽冲动、不计后果、错失准备良机。', kw: ['新开始', '纯真', '自由'] },
  { id: 'm1',  num: 1,  name: '魔术师',   en: 'The Magician',      glyph: '∞',  up: '创造力被唤醒，技能齐备，万物皆为你所用。这是行动的时机。', rev: '才能浪费、被人操纵、言行不一。', kw: ['创造', '技能', '行动'] },
  { id: 'm2',  num: 2,  name: '女祭司',   en: 'The High Priestess',glyph: '☽',  up: '直觉与潜意识之门敞开，倾听内心低语，答案已在其中。', rev: '忽视直觉、隐藏秘密、表象迷惑。', kw: ['直觉', '神秘', '内在'] },
  { id: 'm3',  num: 3,  name: '女皇',     en: 'The Empress',       glyph: '♀',  up: '丰盛与滋养的能量场，关系与事业皆欣欣向荣。享受当下。', rev: '过度依赖、创造力阻塞、关系冷淡。', kw: ['丰盛', '滋养', '母性'] },
  { id: 'm4',  num: 4,  name: '皇帝',     en: 'The Emperor',       glyph: '♈',  up: '权威与秩序的建立者，结构稳固，目标坚定可期。', rev: '专制僵化、家长作风、控制欲过强。', kw: ['权威', '秩序', '稳定'] },
  { id: 'm5',  num: 5,  name: '教皇',     en: 'The Hierophant',    glyph: '⚜',  up: '传统、信仰与正统智慧的引领。在师者指点下豁然开朗。', rev: '教条束缚、形式主义、需自寻出路。', kw: ['传统', '教育', '信仰'] },
  { id: 'm6',  num: 6,  name: '恋人',     en: 'The Lovers',        glyph: '♡',  up: '爱与选择的十字路口，心意已动，答案在于你真正想要什么。', rev: '失衡、错误选择、关系失谐。', kw: ['爱情', '选择', '结合'] },
  { id: 'm7',  num: 7,  name: '战车',     en: 'The Chariot',       glyph: '⚡',  up: '意志力驾驭一切，凭决心与方向感冲破阻碍，所向披靡。', rev: '失控、失去方向、内心矛盾。', kw: ['胜利', '意志', '进展'] },
  { id: 'm8',  num: 8,  name: '力量',     en: 'Strength',          glyph: '🦁',  up: '柔能克刚，以耐心与爱驯服内在的野性。真正的力量源于内在。', rev: '软弱、自我怀疑、压抑情绪。', kw: ['内力', '勇气', '柔克刚'] },
  { id: 'm9',  num: 9,  name: '隐者',     en: 'The Hermit',        glyph: '🏮',  up: '内省的灯塔，独处之中看见更深的自己。退后一步，海阔天空。', rev: '过度孤立、拒绝引导、自闭。', kw: ['内省', '独处', '智慧'] },
  { id: 'm10', num: 10, name: '命运之轮', en: 'Wheel of Fortune',  glyph: '☸',  up: '转动的轮盘带来契机，顺势而为，乘风而起。', rev: '逆境、抗拒改变、低谷循环。', kw: ['转变', '循环', '机遇'] },
  { id: 'm11', num: 11, name: '正义',     en: 'Justice',           glyph: '⚖',  up: '因果昭昭，公平裁决。此刻所做的一切都将得到相应回报。', rev: '不公、逃避责任、判断失衡。', kw: ['公平', '真相', '因果'] },
  { id: 'm12', num: 12, name: '倒吊人',   en: 'The Hanged Man',    glyph: '🙃',  up: '换个视角看世界，主动的暂停带来新启示。', rev: '无谓牺牲、停滞、抗拒放手。', kw: ['新视角', '暂停', '放下'] },
  { id: 'm13', num: 13, name: '死神',     en: 'Death',             glyph: '🦋',  up: '旧的篇章终要翻过。蜕变之痛过后，是全然的新生。', rev: '抗拒改变、停滞不前、拖延终结。', kw: ['终结', '转化', '新生'] },
  { id: 'm14', num: 14, name: '节制',     en: 'Temperance',        glyph: '🕊',  up: '平衡与调和的艺术，两股力量对流融合，节奏恰当。', rev: '失衡、过度、情绪化。', kw: ['平衡', '调和', '耐心'] },
  { id: 'm15', num: 15, name: '恶魔',     en: 'The Devil',         glyph: '⛓',  up: '束缚你的锁链往往由自己的欲望所铸。看见阴影，方能解脱。', rev: '挣脱束缚、觉醒、面对阴影。', kw: ['束缚', '欲望', '阴影'] },
  { id: 'm16', num: 16, name: '塔',       en: 'The Tower',         glyph: '🗼',  up: '突如其来的崩塌是必要的重塑。废墟之上重建更坚固。', rev: '逃避必然的崩塌、苟延残喘、险中求生。', kw: ['突变', '崩塌', '启示'] },
  { id: 'm17', num: 17, name: '星星',     en: 'The Star',          glyph: '⭐',  up: '希望之光重新点亮，相信宇宙的温柔指引。', rev: '失望、信心动摇、迷失方向。', kw: ['希望', '灵感', '宁静'] },
  { id: 'm18', num: 18, name: '月亮',     en: 'The Moon',          glyph: '🌙',  up: '迷雾之中，潜意识呈现幻象。保持觉察，不被表象所惑。', rev: '释放恐惧、走出迷雾、真相显现。', kw: ['幻象', '直觉', '潜意识'] },
  { id: 'm19', num: 19, name: '太阳',     en: 'The Sun',           glyph: '☀',  up: '最明媚的一张牌：成功、活力、喜悦。光明正大地向前。', rev: '暂时挫折、过度乐观、倦怠。', kw: ['成功', '活力', '喜悦'] },
  { id: 'm20', num: 20, name: '审判',     en: 'Judgement',         glyph: '📯',  up: '觉醒的号角响起，回应内心的召唤，开启新阶段。', rev: '自我怀疑、错失机会、拒绝改变。', kw: ['觉醒', '更新', '召唤'] },
  { id: 'm21', num: 21, name: '世界',     en: 'The World',         glyph: '🌍',  up: '一个完整循环的圆满达成。整合所有经验，迎接新旅程。', rev: '未完成、延迟、缺乏收尾。', kw: ['完成', '圆满', '整合'] }
]

// 小阿尔克那（4 花色 × 14 张）
const RANK_NAME = {
  1: 'Ace', 11: '侍从', 12: '骑士', 13: '王后', 14: '国王'
}
const RANK_NAME_EN = {
  1: 'Ace', 11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King'
}

const W = [
  { n: 1,  up: '灵感火花迸发，新事业或计划的种子已具雏形，勇敢点燃它。', rev: '延迟、缺乏动力、计划搁浅。', kw: ['灵感', '新机', '行动'] },
  { n: 2,  up: '权衡利弊之后做出决定，前路虽远，方向已定。', rev: '犹豫不决、信息不足、错失良机。', kw: ['抉择', '计划', '权衡'] },
  { n: 3,  up: '事业扬帆，远方的召唤已清晰。扩张与寻路的最佳时机。', rev: '延宕、视野受限、计划受挫。', kw: ['扩张', '远见', '启航'] },
  { n: 4,  up: '稳固基础、家庭与节日的喜悦、归属感的达成。', rev: '家庭矛盾、迁移不顺、根基动摇。', kw: ['根基', '家庭', '庆典'] },
  { n: 5,  up: '良性的张力与竞争，摩擦中激发出更好的创意。', rev: '冲突、内耗、群体失和。', kw: ['竞争', '张力', '磨练'] },
  { n: 6,  up: '凯旋而归，胜利的号角响彻，认可与荣耀接踵而来。', rev: '胜利延迟、自我怀疑、众口难调。', kw: ['胜利', '认可', '荣耀'] },
  { n: 7,  up: '坚持立场，捍卫信念。守住阵地，下一波胜利已在路上。', rev: '防御过度、不安全感、被围攻。', kw: ['坚守', '立场', '防御'] },
  { n: 8,  up: '风驰电掣，消息与变化同步抵达，节奏快而有力。', rev: '延误、节奏失控、信息混乱。', kw: ['疾速', '讯息', '突破'] },
  { n: 9,  up: '最后的坚守即将胜利，肩上的疲惫也暗示了内在的警备过重。', rev: '疲惫、偏执、孤立无援。', kw: ['戒备', '坚守', '警觉'] },
  { n: 10, up: '肩上承担的多重责任，负重前行，临近完成的曙光。', rev: '不堪重负、放下重担、卸责。', kw: ['责任', '承重', '完成'] },
  { n: 11, up: '热情的探索者，对世界充满好奇，新的灵感闪现。', rev: '计划不周、鲁莽、缺乏方向。', kw: ['热情', '探索', '灵感'] },
  { n: 12, up: '勇敢的行动派，大胆奔赴新战场，行动力极强。', rev: '急躁、半途而废、鲁莽冲动。', kw: ['行动', '勇气', '奔赴'] },
  { n: 13, up: '独立自信的女王，磁石一般的魅力，磁力场中万物归心。', rev: '自我中心、嫉妒、情绪化。', kw: ['魅力', '自信', '独立'] },
  { n: 14, up: '远见的领导者，诚实与权威并存，事业版图在你手中扩张。', rev: '专制、滥用权力、刚愎自用。', kw: ['领导', '远见', '权威'] }
]
const C = [
  { n: 1,  up: '情感之杯满溢，新关系或内心的喜悦正向你涌来。', rev: '情感受阻、空虚、情感封闭。', kw: ['情感', '新缘', '丰盈'] },
  { n: 2,  up: '两颗心的双向奔赴，关系中最美的呼应。', rev: '失衡、错位、关系疏离。', kw: ['相吸', '默契', '互应'] },
  { n: 3,  up: '欢庆、共聚、友谊的丰盛。珍惜此刻的连接。', rev: '过度社交、闲言碎语、群体疏离。', kw: ['欢庆', '友谊', '连接'] },
  { n: 4,  up: '情绪上的倦怠与漠然，对身外之事提不起兴趣。', rev: '重新接受、走出冷漠、发现新机。', kw: ['倦怠', '沉思', '抽离'] },
  { n: 5,  up: '聚焦于失去而忽视尚存的丰盛。睁眼可见的另一份完整。', rev: '走出失落、接受支持、重拾希望。', kw: ['失落', '执念', '觉醒'] },
  { n: 6,  up: '童年的纯真与家的温暖，被熟悉的气息包围。', rev: '困于过去、不愿长大、停滞。', kw: ['纯真', '乡愁', '温暖'] },
  { n: 7,  up: '多重选择与幻想，小心翼翼地抉择。守住内心真实。', rev: '执迷、幻想破灭、清晰浮现。', kw: ['幻想', '选择', '诱惑'] },
  { n: 8,  up: '放下一段关系或执念，踏上新的情感旅程。', rev: '不愿放手、困守、拒绝前行。', kw: ['放下', '告别', '启程'] },
  { n: 9,  up: '愿望成真的满足，与所愿之事拥抱。', rev: '愿望未遂、自我怀疑、心愿错位。', kw: ['如愿', '满足', '成就'] },
  { n: 10, up: '情感的圆满与家庭的和乐，长期情感投资的回报。', rev: '家庭失和、价值观错位、不被理解。', kw: ['圆满', '和乐', '归属'] },
  { n: 11, up: '敏感而灵性的求索者，倾听内心低语的新信息。', rev: '不成熟、情绪化、误信幻象。', kw: ['灵性', '敏感', '讯号'] },
  { n: 12, up: '情感的追寻者，向理想中的情感奔赴，可能有些浪漫化。', rev: '不切实际、情绪失控、幻象。', kw: ['追寻', '浪漫', '提案'] },
  { n: 13, up: '慈悲与直觉并存的疗愈者，情感深厚而稳定。', rev: '情绪依赖、过度付出、自我牺牲。', kw: ['慈悲', '疗愈', '直觉'] },
  { n: 14, up: '情感成熟而稳健的领导，能将心比心、统御人心。', rev: '情绪操控、偏执、心术不正。', kw: ['情感领袖', '稳重', '包容'] }
]
const S = [
  { n: 1,  up: '思想的锋芒毕露，新的洞见与突破正在突破云层。', rev: '思维混乱、沟通失败、判断失误。', kw: ['洞见', '突破', '锋芒'] },
  { n: 2,  up: '困境中的两难抉择，眼罩蒙蔽，需以智慧破局。', rev: '打破僵局、看清真相、做出决断。', kw: ['两难', '眼罩', '僵局'] },
  { n: 3,  up: '心碎与悲伤，但也意味着深度感受的存在。给悲伤一个出口。', rev: '疗愈、走出阴霾、自我和解。', kw: ['心碎', '悲伤', '疗愈'] },
  { n: 4,  up: '暂停、休息与反思，战场之外需要一片静土。', rev: '重返战场、结束休息、躁动不安。', kw: ['休整', '反思', '静止'] },
  { n: 5,  up: '冲突与争斗，输赢皆有代价，问问自己真正想要的是什么。', rev: '和解、放下敌意、走出阴影。', kw: ['冲突', '争斗', '代价'] },
  { n: 6,  up: '从动荡走向平静的过渡，渐离风浪，接近港湾。', rev: '难以平静、旧事重提、归途延宕。', kw: ['过渡', '平静', '归航'] },
  { n: 7,  up: '策略与计谋的运用，聪明却需警惕欺骗与反欺骗。', rev: '诚以待人、放下戒备、回到光明。', kw: ['策略', '智取', '戒备'] },
  { n: 8,  up: '自我束缚的困局，看似被缚，却因真相而获得自由。', rev: '挣脱、放下执念、自我解放。', kw: ['束缚', '真相', '自由'] },
  { n: 9,  up: '焦虑与噩梦缠绕的夜晚，但更深处有觉醒在酝酿。', rev: '走出焦虑、看到转机、卸下重压。', kw: ['焦虑', '噩梦', '觉醒'] },
  { n: 10, up: '最痛的谷底已经触底，反转即将来临。', rev: '触底反弹、回光返照、最坏已过。', kw: ['谷底', '反转', '终局'] },
  { n: 11, up: '好奇的求真者，勇敢探索思想与未知。', rev: '流言、消息失真、八卦。', kw: ['求真', '敏锐', '探索'] },
  { n: 12, up: '勇往直前的行动派，但需警惕鲁莽与固执。', rev: '鲁莽、停滞、知错不改。', kw: ['勇进', '冲刺', '执念'] },
  { n: 13, up: '独立清醒的女性，冷静而富洞察，远离纷扰。', rev: '刻薄、孤立、情绪疏离。', kw: ['清醒', '独立', '洞察'] },
  { n: 14, up: '理智与权威的象征，以公正与理性统御大局。', rev: '专制、冷酷、滥用理性。', kw: ['理智', '权威', '公正'] }
]
const P = [
  { n: 1,  up: '物质新机遇的种子显化，财富与稳定的开端。', rev: '错失良机、现实感缺失、贪小失大。', kw: ['新机', '丰盛', '物质'] },
  { n: 2,  up: '两副牌之间的平衡与权衡，需以灵活应对多重需求。', rev: '失衡、信息过载、顾此失彼。', kw: ['平衡', '权衡', '灵活'] },
  { n: 3,  up: '技艺精湛的工匠，合作的成果丰硕而稳固。', rev: '团队失和、技艺不精、协作不顺。', kw: ['匠艺', '合作', '成果'] },
  { n: 4,  up: '占有与守护，但需警惕过度攥紧。安全感的双面。', rev: '放下控制、慷慨分享、走出小我。', kw: ['占有', '守护', '安全'] },
  { n: 5, up: '物质与情感的双重匮乏，但也因困境获得真正的支持。', rev: '走出困境、找到援助、重建信心。', kw: ['匮乏', '求助', '支持'] },
  { n: 6, up: '慷慨与公平的给予，资源在流动中升值。', rev: '不公、吝啬、被剥削感。', kw: ['慷慨', '公平', '流通'] },
  { n: 7, up: '耐心评估后出手，长期耕耘即将收获。', rev: '耐心不足、急功近利、错失良机。', kw: ['评估', '耐心', '收成'] },
  { n: 8, up: '专注技艺的精进，沉浸于工坊/学业的精修时光。', rev: '分心、浅尝辄止、技艺不精。', kw: ['精修', '专注', '匠心'] },
  { n: 9, up: '享受独自的丰盛与自在，单身的幸福也可圆满。', rev: '孤独、空虚、过度自我。', kw: ['独享', '自在', '独立'] },
  { n: 10, up: '家族的传承与长期的富足，世代积累的稳定。', rev: '家族矛盾、财产纠纷、世代隔阂。', kw: ['传承', '富足', '家业'] },
  { n: 11, up: '勤勉的学徒，认真学习新技能，未来可期。', rev: '学艺不精、缺乏恒心、半途而废。', kw: ['勤勉', '学习', '新芽'] },
  { n: 12, up: '可靠而稳重的执行者，责任心强，按部就班达成目标。', rev: '迟滞、固执、缺乏变通。', kw: ['可靠', '稳重', '执行'] },
  { n: 13, up: '务实而温暖的滋养者，将丰盛转化为安全感。', rev: '过度控制、物质化、忽略精神。', kw: ['务实', '滋养', '丰盛'] },
  { n: 14, up: '事业上成熟的王者，财富与社会地位双丰收。', rev: '贪婪、物质至上、唯利是图。', kw: ['王者', '成就', '富贵'] }
]

function makeMinor(suitKey, data) {
  return data.map(d => ({
    id: `${suitKey[0]}${d.n}`,
    suit: suitKey,
    num: d.n,
    rank: RANK_NAME[d.n],
    rankEn: RANK_NAME_EN[d.n],
    name: `${SUIT_META[suitKey].name}${RANK_NAME[d.n]}`,
    en: `${RANK_NAME_EN[d.n]} of ${SUIT_META[suitKey].en}`,
    up: d.up,
    rev: d.rev,
    kw: d.kw
  }))
}

export const MINOR = [
  ...makeMinor('wands', W),
  ...makeMinor('cups', C),
  ...makeMinor('swords', S),
  ...makeMinor('pentacles', P)
]

export const DECK = [...MAJOR, ...MINOR]

// 6 种牌阵
export const SPREADS = [
  {
    id: 'time',
    name: '时间流牌阵',
    nameEn: 'Past-Present-Future',
    diff: '入门',
    count: 3,
    short: '最简洁的因果三问',
    desc: '三张牌依序代表过去、现在与未来。如一卷时间轴，呈现事物的来龙去脉与可能走向。',
    positions: [
      { name: '过去', desc: '已成之因' },
      { name: '现在', desc: '当下之势' },
      { name: '未来', desc: '可能的果' }
    ],
    layout: 'row',
    theme: '因果·趋势·节点'
  },
  {
    id: 'single',
    name: '单卡直答',
    nameEn: 'One Card',
    diff: '入门',
    count: 1,
    short: '一问一答，一牌一决',
    desc: '当心中已有一个明确的小问题，宇宙只需一张牌为你指个方向。',
    positions: [{ name: '当下指引', desc: '唯一的答案' }],
    layout: 'center',
    theme: '速答·指引·聚焦'
  },
  {
    id: 'relation',
    name: '关系解析牌阵',
    nameEn: 'Relationship Analysis',
    diff: '入门',
    count: 5,
    short: '看清一段关系中你与对方',
    desc: '五张牌分别代表你、对方、关系现状、关系核心以及走向，深度解析一段人际或情感。',
    positions: [
      { name: '你', desc: '你在这段关系中的状态' },
      { name: '对方', desc: '对方的真实样貌' },
      { name: '现状', desc: '关系目前的状态' },
      { name: '核心', desc: '关系最深处的本质' },
      { name: '走向', desc: '未来发展的趋势' }
    ],
    layout: 'fan',
    theme: '关系·契合·了解'
  },
  {
    id: 'choice',
    name: '抉择矩阵',
    nameEn: 'Decision Matrix',
    diff: '进阶',
    count: 5,
    short: '在两条路之间看清全貌',
    desc: '面对 A/B 选择时使用：两张牌剖析选项 A 的优势与风险，另两张剖析选项 B，最后一张给出建议。',
    positions: [
      { name: 'A 优势', desc: '选项 A 的潜力' },
      { name: 'A 风险', desc: '选项 A 的暗面' },
      { name: 'B 优势', desc: '选项 B 的潜力' },
      { name: 'B 风险', desc: '选项 B 的暗面' },
      { name: '建议', desc: '塔罗的建议' }
    ],
    layout: 'grid',
    theme: '抉择·对比·智慧'
  },
  {
    id: 'love',
    name: '配对指数牌阵',
    nameEn: 'Compatibility',
    diff: '进阶',
    count: 7,
    short: '两人之间的深度契合度',
    desc: '七张牌分四个维度剖析两人关系：性格、需求、相处模式与综合契合度，给出配对指数。',
    positions: [
      { name: '你性格', desc: '你的性格底色' },
      { name: '他/她性格', desc: '对方的性格底色' },
      { name: '你需求', desc: '你对关系的核心需求' },
      { name: '他/她需求', desc: '对方的核心需求' },
      { name: '相处模式', desc: '日常互动模式' },
      { name: '深层契合', desc: '灵魂层面的契合度' },
      { name: '综合指数', desc: '整体契合度评分' }
    ],
    layout: 'grid',
    theme: '爱情·契合·灵魂'
  },
  {
    id: 'celtic',
    name: '凯尔特十字',
    nameEn: 'Celtic Cross',
    diff: '进阶',
    count: 10,
    short: '古典十牌，全方位深度解读',
    desc: '最经典的塔罗牌阵。十张牌从现状、助力阻碍、意识潜意识、过去未来、内外环境、希望恐惧到最终结果，给你一个全景式的人生剖面。',
    positions: [
      { name: '现状', desc: '当下核心' },
      { name: '助力/阻碍', desc: '横亘的力量' },
      { name: '意识', desc: '你头脑的想法' },
      { name: '潜意识', desc: '你心底的真相' },
      { name: '过去', desc: '已过去的根基' },
      { name: '未来', desc: '即将到来的影响' },
      { name: '自我', desc: '你此刻的状态' },
      { name: '环境', desc: '外部的影响' },
      { name: '希望/恐惧', desc: '内心的期待与担忧' },
      { name: '结果', desc: '最终走向' }
    ],
    layout: 'cross',
    theme: '全景·深度·经典'
  }
]

export const SPREAD_MAP = Object.fromEntries(SPREADS.map(s => [s.id, s]))

// 抽牌：从牌堆中抽取 count 张，随机正逆位
export function drawCards(spreadId, seed) {
  const spread = SPREAD_MAP[spreadId]
  if (!spread) return null
  const pool = [...DECK]
  // Fisher-Yates with seeded random
  let s = seed || Date.now()
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const drawn = pool.slice(0, spread.count).map(c => ({
    ...c,
    reversed: rand() < 0.32 // 32% 概率逆位，更贴近真实占卜
  }))
  return { spread, cards: drawn, drawnAt: Date.now() }
}

// 解读：根据牌阵与抽到的牌生成结构化解读
export function interpret(result, question) {
  if (!result) return null
  const { spread, cards } = result
  const uprightCount = cards.filter(c => !c.reversed).length
  const majorCount = cards.filter(c => MAJOR.find(m => m.id === c.id)).length
  const energy = uprightCount / cards.length
  const elements = cards.reduce((acc, c) => {
    if (MAJOR.find(m => m.id === c.id)) { acc.major++; return acc }
    const minor = MINOR.find(m => m.id === c.id)
    if (minor) acc[minor.suit] = (acc[minor.suit] || 0) + 1
    return acc
  }, { major: 0, wands: 0, cups: 0, swords: 0, pentacles: 0 })

  // 整体氛围
  let tone = '中性'
  if (energy > 0.7) tone = '明朗积极'
  else if (energy < 0.4) tone = '内省警醒'
  if (majorCount >= cards.length * 0.6) tone = '命运之流涌动，关键节点已至'

  // 总论
  const synth = []
  synth.push(`本次「${spread.name}」，${cards.length} 张牌已为你展开。`)
  if (question) synth.push(`你的提问：「${question.slice(0, 40)}${question.length > 40 ? '…' : ''}」`)
  synth.push(`整体能量：${tone}。大阿尔克那出现 ${majorCount} 张${majorCount > 0 ? '，命数已介入；' : '，日常流转为主；'}`)
  const elemParts = []
  if (elements.wands) elemParts.push(`权杖 ${elements.wands}`)
  if (elements.cups) elemParts.push(`圣杯 ${elements.cups}`)
  if (elements.swords) elemParts.push(`宝剑 ${elements.swords}`)
  if (elements.pentacles) elemParts.push(`星币 ${elements.pentacles}`)
  if (elemParts.length) synth.push(`元素分布：${elemParts.join(' · ')}。`)

  // 逐位解读
  const perCard = cards.map((c, i) => {
    const pos = spread.positions[i]
    return {
      position: pos.name,
      positionDesc: pos.desc,
      card: c,
      text: c.reversed ? c.rev : c.up,
      isReversed: c.reversed
    }
  })

  // 行动建议（基于整体能量 + 末位牌）
  const lastCard = cards[cards.length - 1]
  const lastKw = lastCard.kw.join('、')
  const suggestion = `基于最后一张「${lastCard.name}${lastCard.reversed ? '（逆）' : ''}」的能量，建议你以"${lastKw}"为关键词顺势而为。` +
    (energy > 0.6
      ? '多数牌呈正位，气场支持你向前推进，宜果断行动。'
      : energy < 0.4
        ? '逆位偏多，提示你需向内看、慢下来、修正方向。'
        : '正逆交杂，凡事顺势而为，不过度执着。')

  return {
    summary: synth.join(' '),
    perCard,
    suggestion
  }
}

// 占卜历史（内存 localStorage）
const LS_KEY = 'sanmen-tarot-history'
export function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
export function saveHistory(entry) {
  try {
    const list = loadHistory()
    const next = [{ ...entry, id: Date.now() }, ...list].slice(0, 12)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    return next
  } catch { return [] }
}
