// 三门命理 · 塔罗牌知识库
// 78 张：大阿尔克那 22 + 小阿尔克那 56（权杖/圣杯/宝剑/星币 各 14）
// 解读：每张牌含正位/逆位含义、关键词、视觉符号
// 深度：补充语境化解读（love/career）与 yes/no 快问快答，见 tarotDeep.js

import { DEEP_CARD } from './tarotDeep.js'

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
  1: 'Ace', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十',
  11: '侍从', 12: '骑士', 13: '王后', 14: '国王'
}
const RANK_NAME_EN = {
  1: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
  11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King'
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
  },
  // ── 新增牌阵（来自参考图，去重后追加）──
  // 注意：与现有 SPREADS 重复的牌阵（如 single/time）已省略，由现有 6 个核心牌阵提供
  {
    id: 'gainloss',
    name: '得与失牌阵',
    nameEn: 'Gain & Loss',
    diff: '入门',
    count: 2,
    short: '看清你会失去什么、得到什么',
    desc: '当某个选择让你纠结"我会失去什么，又将得到什么"，用两张牌一目了然。',
    positions: [
      { name: '将失去', desc: '做这件事你将放弃的' },
      { name: '将得到', desc: '做这件事你将收获的' }
    ],
    layout: 'row',
    theme: '取舍·权衡·洞察'
  },
  {
    id: 'three',
    name: '无牌阵',
    nameEn: 'Three Cards',
    diff: '入门',
    count: 3,
    short: '任何问题都适用的三牌通解',
    desc: '可测基础感情、事业、财运等通用问题。三张牌代表起承转合，任何事都能在此找到线索。',
    positions: [
      { name: '起因', desc: '问题的缘起' },
      { name: '现状', desc: '目前的状态' },
      { name: '建议', desc: '塔罗的指引' }
    ],
    layout: 'row',
    theme: '通用·基础·普及'
  },
  {
    id: 'loverPyramid',
    name: '恋人金字塔',
    nameEn: 'Lover Pyramid',
    diff: '入门',
    count: 4,
    short: '4 张牌看清双方与未来',
    desc: '4 张牌分别代表：问卜者自己、对象、彼此的关系、未来发展的走向——一层一层看清两人。',
    positions: [
      { name: '你', desc: '你在这段关系里的状态' },
      { name: '对象', desc: '对方的状态' },
      { name: '关系', desc: '你们彼此的牵绊' },
      { name: '未来', desc: '未来发展的走向' }
    ],
    layout: 'cross',
    layoutSpec: [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    theme: '情感·结构·对照'
  },
  {
    id: 'loveTriangle',
    name: '爱情三角阵',
    nameEn: 'Love Triangle',
    diff: '入门',
    count: 3,
    short: '你 · 对方 · 关系',
    desc: '三张牌对应问卜者自己、对方，以及两人之间的关系/潜力。简单直白，适合初步了解一段感情。',
    positions: [
      { name: '你', desc: '你在感情中的位置' },
      { name: '对方', desc: '对方在感情中的位置' },
      { name: '潜力', desc: '两人关系的潜力' }
    ],
    layout: 'cross',
    layoutSpec: [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 2 }],
    theme: '情感·三人·潜力'
  },
  {
    id: 'exReturn',
    name: '恋人回归阵',
    nameEn: 'Ex Return',
    diff: '入门',
    count: 4,
    short: '前任是否还想着你',
    desc: '4 张牌揭示前任对你的看法、前任对复合的想法、复合的阻碍、两人关系未来走向。',
    positions: [
      { name: '对你的看法', desc: '前任此刻对你的印象' },
      { name: '对复合的看法', desc: '前任对复合的态度' },
      { name: '复合的阻碍', desc: '拦在你们之间的事' },
      { name: '未来', desc: '两人关系的未来' }
    ],
    layout: 'row',
    theme: '前任·回归·阻碍'
  },
  {
    id: 'loveCross',
    name: '爱情十字阵',
    nameEn: 'Love Cross',
    diff: '进阶',
    count: 5,
    short: '你态度 · 对方态度 · 现状 · 未来 · 结果',
    desc: '5 张牌呈十字形，剖析双方态度、当前关系、未来发展与最终结果，关系走向一目了然。',
    positions: [
      { name: '你态度', desc: '你内心的态度' },
      { name: '对方态度', desc: '对方内心的态度' },
      { name: '现阶段', desc: '关系当下的状态' },
      { name: '未来发展', desc: '关系的发展趋势' },
      { name: '结果', desc: '最终的结果' }
    ],
    layout: 'cross',
    layoutSpec: [{ r: 0, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
    theme: '情感·十字·因果'
  },
  {
    id: 'loveRelationship',
    name: '爱情关系阵',
    nameEn: 'Love Relationship',
    diff: '进阶',
    count: 6,
    short: '看双方在感情中的成长',
    desc: '6 张牌从双方角色、各自收获、共同成长、需要成长、塔罗建议五个角度，立体呈现一段情感。',
    positions: [
      { name: '你', desc: '你在这段感情里' },
      { name: '对方', desc: '对方在这段感情里' },
      { name: '你的收获', desc: '你在这段感情中的成长' },
      { name: '共同成长', desc: '两人如何一起成长' },
      { name: '你的功课', desc: '你还需要成长的部分' },
      { name: '建议', desc: '塔罗的建议' }
    ],
    layout: 'grid',
    theme: '情感·成长·功课'
  },
  {
    id: 'careerBlueprint',
    name: '职业蓝图阵',
    nameEn: 'Career Blueprint',
    diff: '进阶',
    count: 6,
    short: '6 维看清一份工作的全貌',
    desc: '从适配度、发展空间、人际、上级看法、风险、外部可能性 6 个维度评估一份工作。',
    positions: [
      { name: '适配度', desc: '工作与你的匹配程度' },
      { name: '发展空间', desc: '这份工作的上升空间' },
      { name: '人际关系', desc: '与同事的关系' },
      { name: '上级看法', desc: '上级对你的看法' },
      { name: '风险提示', desc: '潜在的风险与要点' },
      { name: '外部可能', desc: '公司外的可能机会' }
    ],
    layout: 'grid',
    theme: '事业·评估·6维'
  },
  {
    id: 'opportunity',
    name: '机遇选择阵',
    nameEn: 'Opportunity Choice',
    diff: '进阶',
    count: 5,
    short: '在机会面前看清概率与阻碍',
    desc: '5 张牌剖析：你内心纠结的问题、眼前的工作机会、成功的几率、目前的阻碍、最终的结果。',
    positions: [
      { name: '纠结', desc: '你内心纠结的问题' },
      { name: '眼前机会', desc: '当下摆在面前的机会' },
      { name: '成功几率', desc: '成功的概率' },
      { name: '阻碍', desc: '目前的阻碍' },
      { name: '结果', desc: '最终的结果' }
    ],
    layout: 'grid',
    theme: '机会·概率·阻碍'
  },
  {
    id: 'careerMove',
    name: '事业前进阵',
    nameEn: 'Career Move',
    diff: '进阶',
    count: 5,
    short: '向理想工作迈进的 5 步',
    desc: '5 张牌：理想工作的发展、如何得到理想工作、需要具备的技能和品质、从何处得到帮助、需要注意的事项。',
    positions: [
      { name: '理想发展', desc: '理想工作的发展方向' },
      { name: '如何得到', desc: '如何得到理想的工作' },
      { name: '所需技能', desc: '需要具备的技能与品质' },
      { name: '何处帮助', desc: '从何处获得帮助' },
      { name: '注意', desc: '需要注意的事项' }
    ],
    layout: 'grid',
    theme: '事业·进阶·路径'
  },
  {
    id: 'careerPanorama',
    name: '职业发展全景阵',
    nameEn: 'Career Panorama',
    diff: '进阶',
    count: 7,
    short: '一份工作的 7 维全景',
    desc: '7 张牌剖析：是否适合、晋升空间、人际关系、领导看法、注意事项、外部机会、其他可能。',
    positions: [
      { name: '是否适合', desc: '这份工作是否适合你' },
      { name: '晋升空间', desc: '晋升与发展的空间' },
      { name: '人际发展', desc: '工作人际关系的发展' },
      { name: '领导看法', desc: '领导对你的看法' },
      { name: '注意事项', desc: '工作中的注意事项' },
      { name: '外部机会', desc: '其他工作机会' },
      { name: '其他可能', desc: '其他可能性' }
    ],
    layout: 'grid',
    theme: '事业·全景·7维'
  },
  {
    id: 'vision',
    name: '愿景启航阵',
    nameEn: 'Vision Launch',
    diff: '进阶',
    count: 6,
    short: '为愿景绘制行动地图',
    desc: '6 张牌呈现愿景实现路径：现有条件、外部支持、当前状态、可执行计划、核心指引、长远可能。',
    positions: [
      { name: '现有条件', desc: '你目前拥有的条件与资源' },
      { name: '外部支持', desc: '外部支持与助力' },
      { name: '当前状态', desc: '你当前所处状态' },
      { name: '行动计划', desc: '可执行的行动计划' },
      { name: '核心指引', desc: '核心的行动指引' },
      { name: '长远可能', desc: '长远发展的可能' }
    ],
    layout: 'grid',
    theme: '愿景·行动·路径'
  },
  {
    id: 'workplaceCrisis',
    name: '职场危机应对阵',
    nameEn: 'Workplace Crisis',
    diff: '进阶',
    count: 5,
    short: '在危机中看清根源与影响',
    desc: '5 张牌剖析危机的根源、他人的反应、当前应对方式、短期后果、长期影响。',
    positions: [
      { name: '危机根源', desc: '危机的根源所在' },
      { name: '他人反应', desc: '周围人的反应' },
      { name: '当前应对', desc: '你目前的应对方式' },
      { name: '短期后果', desc: '短期内可能的后果' },
      { name: '长期影响', desc: '长期的影响' }
    ],
    layout: 'grid',
    theme: '危机·应对·影响'
  },
  {
    id: 'careerShift',
    name: '职业转型阵',
    nameEn: 'Career Shift',
    diff: '进阶',
    count: 5,
    short: '转型路上的阻碍与策略',
    desc: '5 张牌：转型潜在阻碍、过渡策略、外部支持、所需技能、所需职业领悟。',
    positions: [
      { name: '潜在阻碍', desc: '转型路上的潜在阻碍' },
      { name: '过渡策略', desc: '过渡期的策略' },
      { name: '外部支持', desc: '外部的支持' },
      { name: '所需技能', desc: '需要补足的技能' },
      { name: '职业领悟', desc: '需要获得的职业领悟' }
    ],
    layout: 'grid',
    theme: '转型·策略·技能'
  },
  {
    id: 'workplaceRelations',
    name: '职场人际关系阵',
    nameEn: 'Workplace Relations',
    diff: '入门',
    count: 4,
    short: '职场人际三角',
    desc: '4 张牌呈现你、上司、同事三个方向的职场关系与自我形象。',
    positions: [
      { name: '自我形象', desc: '你在职场的自我形象' },
      { name: '上司关系', desc: '与上司的关系' },
      { name: '同事协作', desc: '与同事的协作' },
      { name: '三角合力', desc: '三角合力的整体走向' }
    ],
    layout: 'cross',
    layoutSpec: [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    theme: '职场·人际·三角'
  },
  {
    id: 'careerTalent',
    name: '职业天赋阵',
    nameEn: 'Career Talent',
    diff: '进阶',
    count: 5,
    short: '看清你的天赋版图',
    desc: '5 张牌：核心天赋、人际天赋、学习天赋、执行天赋，加上整体建议。',
    positions: [
      { name: '核心天赋', desc: '你最核心的天赋' },
      { name: '人际天赋', desc: '人际关系方面的天赋' },
      { name: '学习天赋', desc: '学习能力方面的天赋' },
      { name: '执行天赋', desc: '执行力方面的天赋' },
      { name: '综合建议', desc: '天赋综合的发展建议' }
    ],
    layout: 'grid',
    theme: '天赋·职业·发现'
  },
  {
    id: 'selfExplore',
    name: '自我探索阵',
    nameEn: 'Self-Exploration',
    diff: '入门',
    count: 4,
    short: '向内看见真实的自己',
    desc: '4 张牌对应：当前状态、外在表现、内在渴望、内在意识。看见表里如一的自己。',
    positions: [
      { name: '当前状态', desc: '你目前的状态' },
      { name: '外在表现', desc: '你外在的表现' },
      { name: '内在渴望', desc: '你内在的渴望' },
      { name: '内在意识', desc: '你内在的意识' }
    ],
    layout: 'cross',
    layoutSpec: [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    theme: '自我·探索·向内'
  },
  {
    id: 'bodymindspirit',
    name: '身心灵阵',
    nameEn: 'Body · Mind · Spirit',
    diff: '入门',
    count: 3,
    short: '身 · 心 · 灵',
    desc: '身心灵三层面结合：身体、情绪、灵性——看见失衡点，给出整合建议。',
    positions: [
      { name: '身', desc: '身体的讯息' },
      { name: '心', desc: '情绪的讯息' },
      { name: '灵', desc: '灵性的讯息' }
    ],
    layout: 'cross',
    layoutSpec: [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 2 }],
    theme: '身心灵·平衡·整合'
  },
  {
    id: 'jungArchetype',
    name: '荣格原型阵',
    nameEn: 'Jung Archetype',
    diff: '进阶',
    count: 5,
    short: '5 张牌照见你的内在原型',
    desc: '5 张牌呈现：自性、人格面具、阴影、阿尼玛/阿尼姆斯、智慧老人——荣格心理学中的人之原型。',
    positions: [
      { name: '自性/面具', desc: '你的自性与外在面具' },
      { name: '阴影身份', desc: '你压抑的阴影身份' },
      { name: '智慧老人', desc: '内在的智慧老人' },
      { name: '阿尼玛/阿尼姆斯', desc: '内在异性原型' },
      { name: '阴性', desc: '阴性能量与中心' }
    ],
    layout: 'grid',
    theme: '荣格·原型·深度'
  },
  {
    id: 'twoChoice',
    name: '二选一阵',
    nameEn: 'Two Choices',
    diff: '进阶',
    count: 5,
    short: 'A · B 的影响与当前状态',
    desc: '5 张牌：本人/问题现状、选择 A 的现状、选择 B 的现状、选择 A 的影响、选择 B 的影响。',
    positions: [
      { name: '当前现状', desc: '本人/问题的现状' },
      { name: 'A 现状', desc: '选择 A 的现状' },
      { name: 'B 现状', desc: '选择 B 的现状' },
      { name: 'A 影响', desc: '选择 A 的影响' },
      { name: 'B 影响', desc: '选择 B 的影响' }
    ],
    layout: 'grid',
    theme: '抉择·A·B'
  },
  {
    id: 'innerTalent',
    name: '内在天赋阵',
    nameEn: 'Inner Talent',
    diff: '进阶',
    count: 6,
    short: '6 维发现你的内在天赋',
    desc: '6 张牌：如何使用、与生具来、发挥长处、面对短板、综合建议、发展天赋。',
    positions: [
      { name: '使用方式', desc: '如何使用我的天赋' },
      { name: '天生天赋', desc: '我与生具来的天赋' },
      { name: '发挥长处', desc: '如何发挥我的长处' },
      { name: '面对短板', desc: '如何面对我的短板' },
      { name: '综合建议', desc: '某方面的综合建议' },
      { name: '发展天赋', desc: '发展天赋的方向' }
    ],
    layout: 'grid',
    theme: '天赋·内在·发展'
  },
  {
    id: 'singleGuide',
    name: '脱单指南',
    nameEn: 'Single Guide',
    diff: '进阶',
    count: 6,
    short: '脱单路上的 6 张地图',
    desc: '6 张牌指明：当前阻碍、改变方向、选择之力、可能的外助、力量根源、选择外因。',
    positions: [
      { name: '现状', desc: '你目前的状况' },
      { name: '阻碍', desc: '脱单的阻碍' },
      { name: '选择', desc: '你应作的选择' },
      { name: '改变', desc: '需要做的改变' },
      { name: '外助', desc: '可能的外在助力' },
      { name: '外因', desc: '选择之外的外因' }
    ],
    layout: 'grid',
    theme: '脱单·指引·6维'
  },
  {
    id: 'seekLove',
    name: '寻爱方向阵',
    nameEn: 'Seek Love',
    diff: '进阶',
    count: 7,
    short: '遇见爱情的方向与因果',
    desc: '7 张牌：恋爱的可能性、阻碍、方向、外助、建议、因果、最终结果。',
    positions: [
      { name: '可能性', desc: '恋爱的可能性' },
      { name: '阻碍', desc: '遇到的阻碍' },
      { name: '方向', desc: '该去的方向' },
      { name: '外助', desc: '外部的助力' },
      { name: '建议', desc: '塔罗的建议' },
      { name: '因果', desc: '背后的因果' },
      { name: '结果', desc: '最终的结果' }
    ],
    layout: 'grid',
    theme: '寻爱·方向·因果'
  },
  {
    id: 'peach',
    name: '桃花牌阵',
    nameEn: 'Peach Blossom',
    diff: '入门',
    count: 5,
    short: '5 张牌看桃花运势',
    desc: '5 张牌：缘分、沟通、障碍、现状、本质——看清你的桃花运势与本心。',
    positions: [
      { name: '缘分', desc: '桃花的缘分' },
      { name: '沟通', desc: '与对象的沟通' },
      { name: '障碍', desc: '遇到的障碍' },
      { name: '现状', desc: '当前的现状' },
      { name: '本质', desc: '关系的本质' }
    ],
    layout: 'grid',
    theme: '桃花·缘分·本质'
  },
  {
    id: 'hexStar',
    name: '六芒星桃花阵',
    nameEn: 'Hexagram Peach',
    diff: '进阶',
    count: 7,
    short: '六芒星形 7 维桃花',
    desc: '7 张牌以六芒星形铺开，剖析：共识、友谊、共鸣、关系、对方、过去、未来。',
    positions: [
      { name: '共识', desc: '双方的共识' },
      { name: '友谊', desc: '友谊层面的基础' },
      { name: '共鸣', desc: '情感的共鸣' },
      { name: '关系', desc: '关系本身的状态' },
      { name: '对方', desc: '对方的状态' },
      { name: '过去', desc: '过去的因素' },
      { name: '未来', desc: '未来的走向' }
    ],
    layout: 'grid',
    theme: '六芒·桃花·7维'
  },
  {
    id: 'futureLover',
    name: '未来恋人阵',
    nameEn: 'Future Lover',
    diff: '进阶',
    count: 7,
    short: '看见未来的那位 TA',
    desc: '7 张牌：缘分、阻碍、改变、状态、能力、选择、外因——勾勒未来恋人画像。',
    positions: [
      { name: '缘分', desc: '缘分的远近' },
      { name: '阻碍', desc: '阻碍的因素' },
      { name: '改变', desc: '需要做出的改变' },
      { name: '状态', desc: '未来时的状态' },
      { name: '能力', desc: '你需具备的能力' },
      { name: '选择', desc: '需要做的选择' },
      { name: '外因', desc: '外部的促成因素' }
    ],
    layout: 'grid',
    theme: '未来·恋人·画像'
  },
  {
    id: 'peekHim',
    name: '窥探他的心',
    nameEn: 'Peek His Heart',
    diff: '入门',
    count: 5,
    short: '5 张牌读懂他的真实想法',
    desc: '5 张牌：你的现状、他的真实、他的想法、他对你的看法、未来的发展因素。',
    positions: [
      { name: '你的现状', desc: '你目前的状况' },
      { name: '他的真实', desc: '他的真实样貌' },
      { name: '他的想法', desc: '他内心的想法' },
      { name: '他的看法', desc: '他对你的看法' },
      { name: '未来因素', desc: '未来的发展因素' }
    ],
    layout: 'grid',
    theme: '他心·真实·窥探'
  },
  {
    id: 'trueHeart',
    name: '真心的占卜',
    nameEn: 'True Heart',
    diff: '进阶',
    count: 9,
    short: '9 张牌占卜两人真心',
    desc: '9 张牌：过去与未来、两人的心、今天、朋友、朋友状态、对方、对方需求、行动、结果。',
    positions: [
      { name: '过去', desc: '过去的脉络' },
      { name: '未来', desc: '未来的脉络' },
      { name: '你心', desc: '你的真心' },
      { name: '他心', desc: '对方的真心' },
      { name: '今天', desc: '今天的状态' },
      { name: '朋友', desc: '朋友的影响' },
      { name: '对方需求', desc: '对方的需求' },
      { name: '行动', desc: '该采取的行动' },
      { name: '结果', desc: '最终的结果' }
    ],
    layout: 'grid',
    theme: '真心·占卜·9维'
  },
  {
    id: 'destinyLove',
    name: '正缘牌阵',
    nameEn: 'Destined Love',
    diff: '入门',
    count: 5,
    short: '5 张牌找到正缘',
    desc: '5 张牌：现状、对方、感情核心、现在与未来——定位正缘的方向。',
    positions: [
      { name: '现状', desc: '你目前的感情现状' },
      { name: '对方', desc: '正缘对象的样子' },
      { name: '感情核心', desc: '感情的本质' },
      { name: '现在', desc: '当前的状态' },
      { name: '未来', desc: '未来的可能' }
    ],
    layout: 'grid',
    theme: '正缘·命定·方向'
  },
  {
    id: 'gypsyCross',
    name: '吉普赛十字',
    nameEn: 'Gypsy Cross',
    diff: '进阶',
    count: 5,
    short: '5 张牌的爱情吉普赛十字',
    desc: '5 张牌：已知、已发生、关键因素、挑战、建议/结果。',
    positions: [
      { name: '已知', desc: '已知的部分' },
      { name: '已发生', desc: '已经发生的事' },
      { name: '关键因素', desc: '关系中的关键因素' },
      { name: '挑战', desc: '面对的挑战' },
      { name: '建议/结果', desc: '塔罗的建议与结果' }
    ],
    layout: 'cross',
    layoutSpec: [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
    theme: '吉普赛·十字·异域'
  },
  {
    id: 'venus8',
    name: '爱情维纳斯阵',
    nameEn: 'Love Venus',
    diff: '进阶',
    count: 8,
    short: '8 张牌的爱情维纳斯',
    desc: '8 张牌：你、对方、爱人的心、对方的爱、交流、问题原因、未来发展、关系走向。',
    positions: [
      { name: '你', desc: '你在这段关系里' },
      { name: '对方', desc: '对方在这段关系里' },
      { name: '爱人的心', desc: '爱人内心的状态' },
      { name: '对方的爱', desc: '对方对你的爱' },
      { name: '交流', desc: '两人交流的方式' },
      { name: '问题原因', desc: '问题的根本原因' },
      { name: '未来发展', desc: '未来的发展' },
      { name: '关系走向', desc: '关系的最终走向' }
    ],
    layout: 'grid',
    theme: '维纳斯·爱情·8维'
  },
  {
    id: 'loveTree',
    name: '爱情之树',
    nameEn: 'Tree of Love',
    diff: '进阶',
    count: 6,
    short: '6 张牌的爱情之树',
    desc: '6 张牌：现在、阻碍、建议、行动、能力、结果——像一棵树，从根到果实看清爱情。',
    positions: [
      { name: '现在', desc: '现在的状况' },
      { name: '阻碍', desc: '遇到的阻碍' },
      { name: '建议', desc: '塔罗的建议' },
      { name: '行动', desc: '该采取的行动' },
      { name: '能力', desc: '你需具备的能力' },
      { name: '结果', desc: '最终的结果' }
    ],
    layout: 'grid',
    theme: '树·生长·果实'
  },
  {
    id: 'marriage',
    name: '婚姻占卜阵',
    nameEn: 'Marriage Divination',
    diff: '进阶',
    count: 7,
    short: '7 张牌占卜婚姻',
    desc: '7 张牌：婚恋状态、对方看法、婚姻走势、关系状态、阻碍、姻缘匹配、未来婚恋。',
    positions: [
      { name: '婚恋状态', desc: '你目前的婚恋状态' },
      { name: '对方看法', desc: '对方对婚恋的看法' },
      { name: '婚姻走势', desc: '婚姻的走势' },
      { name: '关系状态', desc: '两人的关系状态' },
      { name: '阻碍', desc: '婚恋中的阻碍' },
      { name: '姻缘', desc: '姻缘的匹配度' },
      { name: '未来婚恋', desc: '未来的婚恋状态' }
    ],
    layout: 'grid',
    theme: '婚姻·婚恋·占卜'
  },
  {
    id: 'reconcile',
    name: '破镜重圆阵',
    nameEn: 'Reconcile',
    diff: '进阶',
    count: 8,
    short: '8 张牌的破镜重圆',
    desc: '8 张牌：当前状态、复合可能性、对方反应、自身原因、复合关键、沟通方式、复合概率、未来发展。',
    positions: [
      { name: '当前状态', desc: '你目前的感情状态' },
      { name: '复合可能性', desc: '复合的可能性' },
      { name: '对方反应', desc: '对方对复合的反应' },
      { name: '自身原因', desc: '分离的自身原因' },
      { name: '复合关键', desc: '复合的关键' },
      { name: '沟通方式', desc: '合适的沟通方式' },
      { name: '复合概率', desc: '复合的概率' },
      { name: '未来发展', desc: '未来的发展' }
    ],
    layout: 'grid',
    theme: '复合·破镜·重圆'
  },
  {
    id: 'exRecon',
    name: '恋人复合阵',
    nameEn: 'Lover Reconcile',
    diff: '进阶',
    count: 9,
    short: '9 张牌的复合诊断',
    desc: '9 张牌：现状、对方状态、对方的心、复婚可能、外因、阻碍、行动、复合走势、长期可能。',
    positions: [
      { name: '现状', desc: '你目前的现状' },
      { name: '对方状态', desc: '对方的状态' },
      { name: '对方的心', desc: '对方内心的状态' },
      { name: '复婚', desc: '复婚的可能性' },
      { name: '外因', desc: '外部的促成因素' },
      { name: '阻碍', desc: '遇到的阻碍' },
      { name: '行动', desc: '该采取的行动' },
      { name: '复合走势', desc: '复合的走势' },
      { name: '长期可能', desc: '长期的可能性' }
    ],
    layout: 'grid',
    theme: '复合·恋人·诊断'
  }
]

export const SPREAD_MAP = Object.fromEntries(SPREADS.map(s => [s.id, s]))

// ───────────────────────────────────────────
// 牌阵主题分类（塔罗页分类筛选）
// general 通用综合 / love 爱情桃花 / career 事业职场
// decision 决策选择 / self 自我成长
// ───────────────────────────────────────────
const SPREAD_CATS = {
  time: 'general',
  single: 'general',
  relation: 'general',
  choice: 'decision',
  love: 'love',
  celtic: 'general',
  gainloss: 'decision',
  three: 'general',
  loverPyramid: 'love',
  loveTriangle: 'love',
  exReturn: 'love',
  loveCross: 'love',
  loveRelationship: 'love',
  careerBlueprint: 'career',
  opportunity: 'career',
  careerMove: 'career',
  careerPanorama: 'career',
  vision: 'career',
  workplaceCrisis: 'career',
  careerShift: 'career',
  workplaceRelations: 'career',
  careerTalent: 'career',
  selfExplore: 'self',
  bodymindspirit: 'self',
  jungArchetype: 'self',
  twoChoice: 'decision',
  innerTalent: 'self',
  singleGuide: 'love',
  seekLove: 'love',
  peach: 'love',
  hexStar: 'love',
  futureLover: 'love',
  peekHim: 'love',
  trueHeart: 'love',
  destinyLove: 'love',
  gypsyCross: 'love',
  venus8: 'love',
  loveTree: 'love',
  marriage: 'love',
  reconcile: 'love',
  exRecon: 'love'
}
SPREADS.forEach(s => { s.cat = SPREAD_CATS[s.id] || 'general' })

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

// ───────────────────────────────────────────
// 深度解读引擎
// ───────────────────────────────────────────

// 提问主题识别：从问题关键词推断生活领域，以调整解读侧重
const THEME_KEYWORDS = {
  love: ['爱', '情', '恋', '对象', '配偶', '婚姻', '结婚', '喜欢', '暧昧', '分手', '复合', '桃花', '缘分', '他', '她'],
  career: ['工作', '事业', '职场', '跳槽', '升职', '创业', '项目', '面试', '领导', '同事', '客户', '公司'],
  money: ['钱', '财', '投资', '生意', '收入', '财运', '赚钱', '负债', '买房', '股票', '基金'],
  health: ['健康', '身体', '病', '睡眠', '情绪', '压力', '焦虑', '作息'],
  choice: ['选择', '决定', '要不要', '哪个', 'A', 'B', '选项', '路', '方向'],
  study: ['学业', '考试', '学习', '读书', '考研', '升学', '成绩', '论文']
}

function detectTheme(question) {
  if (!question) return null
  let best = null
  let bestScore = 0
  for (const [key, words] of Object.entries(THEME_KEYWORDS)) {
    let s = 0
    for (const w of words) if (question.includes(w)) s++
    if (s > bestScore) { bestScore = s; best = key }
  }
  return bestScore > 0 ? best : null
}

const THEME_META = {
  love: { name: '情感', icon: '❤', lead: '这段缘分里，最重要的是回到自己的心——你真正渴望的连接是什么样的。' },
  career: { name: '事业', icon: '🏛', lead: '事业之路上，方向比速度更重要，先厘清你真正想抵达的位置。' },
  money: { name: '财运', icon: '🪙', lead: '物质议题的背后往往藏着对安全感的诉求，钱是能量流动的显化。' },
  health: { name: '身心', icon: '🌿', lead: '身体的信号是内在的来信，先照顾好自己，一切才有立足之地。' },
  choice: { name: '抉择', icon: '⚖', lead: '抉择的答案不在选项里，而在你放下权衡后仍然记挂的那一处。' },
  study: { name: '学业', icon: '📚', lead: '学途之上，坚持与方法的共鸣胜过一时天赋。' }
}

// 大阿尔克那（Major Arcana）判定：以 id 前缀 m 为准（大牌），小牌 id 以花色字母开头
function isMajor(c) { return c && typeof c.id === 'string' && c.id[0] === 'm' }
function isMinor(c) { return !isMajor(c) }

// 元素统计：含四元素 + 大阿尔克那 + 小阿尔克那
function analyzeElements(cards) {
  const elem = { wands: 0, cups: 0, swords: 0, pentacles: 0, major: 0 }
  for (const c of cards) {
    if (isMinor(c)) elem[c.suit] = (elem[c.suit] || 0) + 1
    else elem.major++
  }
  return elem
}

// 四元素原型：主导元素指向的深层课题与能量品质（塔罗学传统）
const ELEMENT_ARCHETYPE = {
  wands: { name: '火 · 权杖', quality: '意志与行动力', focus: '你正被内在的渴望与行动冲动推动，重点在「敢不敢走出第一步」，让热情有方向地燃烧。' },
  cups: { name: '水 · 圣杯', quality: '情感与直觉', focus: '当下议题落在心的层面——关系的温度、感受的流动。重点在「诚实面对自己的情绪」，让直觉指引你。' },
  swords: { name: '风 · 宝剑', quality: '思维与判断', focus: '头脑正扮演主角，你在权衡、分析、厘清。重点在「看清真相、切断执念」，以清晰的判断破开迷雾。' },
  pentacles: { name: '土 · 星币', quality: '现实与积累', focus: '能量集中在务实层面——身体、金钱、根基。重点在「把想法落地」，用耐心和积累换稳定的成果。' }
}

// 主导元素判定：取数量最多的小阿尔克那花色
function dominantElement(elements) {
  const suits = ['wands', 'cups', 'swords', 'pentacles']
  let best = null, bestN = 0
  for (const s of suits) {
    if (elements[s] > bestN) { best = s; bestN = elements[s] }
  }
  return best
}

// 元素相生相克叙事：两两火水风土的相互作用
const ELEMENT_NARRATIVE = [
  { a: 'wands', b: 'cups', text: '权杖(火)与圣杯(水)同现，暗示激情与情感在彼此拉扯——热情想向前冲，心却在等回应。' },
  { a: 'swords', b: 'pentacles', text: '宝剑(风)与星币(土)同现，是理想与现实的对话：头脑的蓝图，需要落地的耐心。' },
  { a: 'wands', b: 'swords', text: '权杖(火)与宝剑(风)同现，风助火势——行动力被清晰的思考点燃，宜趁势而进。' },
  { a: 'cups', b: 'pentacles', text: '圣杯(水)与星币(土)同现，水润土生——情感滋养现实，稳定的根基里藏着温度。' },
  { a: 'wands', b: 'pentacles', text: '权杖(火)与星币(土)同现，火暖土厚——把热情转化为看得见的成果，务实推进。' },
  { a: 'cups', b: 'swords', text: '圣杯(水)与宝剑(风)同现，风过水面泛起涟漪——感性直觉与理性分析需要调和。' }
]

// 占卜指数：0-100，综合正逆、大牌占比、元素集中度
function computeIndex(cards) {
  const upright = cards.filter(c => !c.reversed).length
  const energy = upright / cards.length
  const major = cards.filter(isMajor).length
  const majorRatio = major / cards.length
  let idx = 40 + Math.round(energy * 40)
  if (majorRatio >= 0.6) idx += 10         // 大阿尔克那增多，重大课题浮现，节点鲜明
  if (majorRatio >= 0.9) idx += 5
  const elem = analyzeElements(cards)
  const minorTotal = cards.filter(isMinor).length
  const maxElem = minorTotal ? Math.max(elem.wands, elem.cups, elem.swords, elem.pentacles) : 0
  if (minorTotal && maxElem / minorTotal >= 0.6) idx += 5  // 元素高度集中，主题聚焦
  return Math.max(5, Math.min(100, idx))
}

function indexLabel(idx) {
  if (idx >= 80) return { word: '高能明朗', desc: '牌面清朗有力，正位主导，时机已近成熟，可顺势推进', color: '#2f9e6e' }
  if (idx >= 60) return { word: '平稳上升', desc: '能量持续向好，逆位渐少，稳步累积，宜稳中求进', color: '#7fb85e' }
  if (idx >= 45) return { word: '势均力敌', desc: '正逆交织、元素并立，需静观内心，让直觉与理性和解再作抉择', color: '#d9a03c' }
  if (idx >= 30) return { word: '内省蓄势', desc: '逆位偏多，牌面指向内在功课，宜向内看、缓步修正', color: '#c96a4a' }
  return { word: '谷底转机', desc: '能量沉寂于低处，而低处正是转机蛰伏之处', color: '#a0513a' }
}

// 叙事弧：将逐位牌串成一段有起承转合的故事（融入语境解读与逆位提示）
function buildNarrative(spread, perCard) {
  const arc = perCard.map((pc, i) => {
    const c = pc.card
    let seg = `${pc.position}之位是「${c.name}${pc.isReversed ? '·逆' : ''}」${c.kw[0]}。`
    // 语境深度：在关键牌位（首/中/末）补充落地解读
    if (i === 0 || i === perCard.length - 1 || i === Math.floor(perCard.length / 2)) {
      if (pc.contextText) seg += pc.contextText
      else if (pc.revAdvice) seg += pc.revAdvice
    }
    return seg
  }).join('')
  return arc
}

// 交叉合成：从所有牌的共性提炼贯穿主题
function synthTheme(cards, theme) {
  const kwPool = {}
  for (const c of cards) {
    for (const k of c.kw) kwPool[k] = (kwPool[k] || 0) + 1
  }
  const top = Object.entries(kwPool).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0])
  const hasMajor = cards.some(isMajor)
  const allUpright = cards.every(c => !c.reversed)
  const allReversed = cards.every(c => c.reversed)
  const parts = []
  if (allUpright) parts.push('整副牌面皆正位，能量纯粹而顺畅，是一个难得的好兆头。')
  else if (allReversed) parts.push('牌面整体逆位，提示当前正处于需要沉淀与转念的关口。')
  else if (hasMajor) parts.push('大阿尔克那的出现，意味着此事已超出日常琐碎，牵动更深的原型与生命课题。')
  if (top.length) parts.push(`贯穿牌面的关键词是「${top.join(' · ')}」，是这段解读的核心线索。`)
  if (theme) parts.push(`以${THEME_META[theme].name}为聚焦，${THEME_META[theme].lead}`)
  return parts.join(' ')
}

// 行动清单：根据末位牌 + 能量 + 主题 + 深度语境生成 3 条可执行建议
function buildActions(perCard, cards, energy, theme) {
  const last = cards[cards.length - 1]
  const first = cards[0]
  const lastPc = perCard[perCard.length - 1]
  const actions = []
  const push = (t) => { if (actions.length < 3) actions.push(t) }

  // 第一条：能量基调（正/逆）
  if (energy > 0.6) {
    push(`正位气场支持你向前：抓住「${last.name}」带来的${last.kw[0]}能量，趁势果断行动。`)
  } else if (energy < 0.4) {
    push(`逆位偏多，先别急着推进：用「${last.name}」的${last.kw[0]}提醒自己，向内沉淀、修正方向。`)
  } else {
    push(`正逆交杂，顺势而为：以「${last.name}」的${last.kw[0]}为指引，择机而动，不过度执着。`)
  }
  // 第二条：末位牌的深度语境解读（若有）
  if (lastPc.contextText) {
    push(`聚焦当下：${lastPc.contextText}`)
  } else {
    push(`留意开局之牌「${first.name}」：它往往暗示你此刻最真实的起点与内在状态。`)
  }
  // 第三条：主题建议 或 末位逆位转正建议
  const revAdv = lastPc && lastPc.revAdvice ? lastPc.revAdvice : null
  if (revAdv) {
    push(revAdv)
  } else if (theme === 'love') push('情感议题上，多倾听对方真实的声音，而非头脑中的想象。')
  else if (theme === 'career') push('事业议题上，先想清楚长期方向，再决定眼前这一步怎么迈。')
  else if (theme === 'money') push('财务议题上，把安全感建立在清晰的规划上，而非情绪化的冒险。')
  else if (theme === 'health') push('身心议题上，规律作息与情绪疏导是本卦最重要的功课。')
  else if (theme === 'choice') push('抉择之刻，写下每个选项的得与失，答案会在纸上浮现。')
  else if (theme === 'study') push('学业之路上，拆解大目标为每日小步，坚持自有回响。')
  else push('把牌面的提示落到可执行的一小步，迈出去再回看。')
  return actions
}

// 解读：根据牌阵与抽到的牌生成深度结构化解读
export function interpret(result, question) {
  if (!result) return null
  const { spread, cards } = result
  const uprightCount = cards.filter(c => !c.reversed).length
  const majorCount = cards.filter(isMajor).length
  const energy = uprightCount / cards.length
  const elements = analyzeElements(cards)
  const domSuit = dominantElement(elements)
  const domElem = domSuit ? ELEMENT_ARCHETYPE[domSuit] : null
  const theme = detectTheme(question)
  const index = computeIndex(cards)
  const idxMeta = indexLabel(index)

  // 整体氛围
  let tone = '中性'
  if (energy > 0.7) tone = '明朗积极'
  else if (energy < 0.4) tone = '内省警醒'
  if (majorCount >= cards.length * 0.6) tone = '命运之流涌动，关键节点已至'

  // 总论
  const synth = []
  synth.push(`本次「${spread.name}」，${cards.length} 张牌已为你展开。`)
  if (question) synth.push(`你的提问：「${question.slice(0, 40)}${question.length > 40 ? '…' : ''}」`)
  synth.push(`占卜指数 ${index}，整体能量：${tone}。`)
  const elemParts = []
  if (elements.wands) elemParts.push(`权杖 ${elements.wands}`)
  if (elements.cups) elemParts.push(`圣杯 ${elements.cups}`)
  if (elements.swords) elemParts.push(`宝剑 ${elements.swords}`)
  if (elements.pentacles) elemParts.push(`星币 ${elements.pentacles}`)
  if (elements.major) elemParts.push(`大阿尔克那 ${elements.major}`)
  if (elemParts.length) synth.push(`元素分布：${elemParts.join(' · ')}。`)
  if (domElem) synth.push(`本次主导元素为${domElem.name}（${domElem.quality}）：${domElem.focus}`)

  // 主题 → 语境选配：love 用情感语境，career/money 用事业语境，其余用通用含义
  const contextKey = theme === 'love' ? 'love' : (theme === 'career' || theme === 'money') ? 'career' : null

  // 逐位解读（含深度语境）
  const perCard = cards.map((c, i) => {
    const pos = spread.positions[i]
    const deep = DEEP_CARD[c.id] || null
    // 语境解读：优先取正/逆位对应的深度语境，其次回退通用含义
    const contextText = deep
      ? (contextKey
          ? (c.reversed
              ? deep[`${contextKey}Rev`] || deep[contextKey] || ''
              : deep[contextKey] || '')
          : '')
      : ''
    // 逆位"如何转正"建议
    const revAdvice = c.reversed && deep ? deep.revAdvice || '' : ''
    // 是非倾向（正/逆）
    const verdict = deep ? (c.reversed ? deep.yesNoRev : deep.yesNo) : null
    const verdictMap = { yes: '是', no: '否', maybe: '需观望' }
    const verdictText = verdict ? `方向倾向：${verdictMap[verdict]}。` : ''
    // 正位/逆位通用含义 + 语境 + 逆位建议
    const base = c.reversed ? c.rev : c.up
    return {
      position: pos.name,
      positionDesc: pos.desc,
      card: c,
      text: base,
      isReversed: c.reversed,
      contextText,
      revAdvice,
      verdict,
      verdictText,
      // 牌面意象（来自《塔羅解牌研究所》知识库）：一句话点出画面与象征
      image: deep ? deep.image || '' : '',
      // 综合解读：含义 + 语境 + 逆位转正建议，供详情展示
      fullText: [base, contextText, revAdvice].filter(Boolean).join('\n')
    }
  })

  // 叙事弧
  const narrative = buildNarrative(spread, perCard)

  // 元素相生相克叙事
  const elemNarratives = []
  const present = new Set(cards.filter(isMinor).map(c => c.suit))
  for (const r of ELEMENT_NARRATIVE) {
    if (present.has(r.a) && present.has(r.b)) elemNarratives.push(r.text)
  }

  // 交叉合成
  const crossTheme = synthTheme(cards, theme)

  // 行动清单
  const actions = buildActions(perCard, cards, energy, theme)

  // 行动建议（保留原风格，作为总建议）
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
    index,
    indexWord: idxMeta.word,
    indexDesc: idxMeta.desc,
    indexColor: idxMeta.color,
    tone,
    energy: Math.round(energy * 100),
    elements,
    dominantElement: domElem,
    majorCount,
    theme,
    perCard,
    narrative,
    crossTheme,
    elemNarratives,
    actions,
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
