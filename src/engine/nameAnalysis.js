// 姓名学算法：基于「五格剖象法」+ 汉字五行，喜忌可结合八字喜用神
// 主要参考：熊崎氏《姓名学新考》、日本"五格剖象派"的通行做法。
// 注：本算法以学术参考为目标，非命运决定论。
// 笔画/五行查询优先使用康熙字典字库（src/data/kangxi.json，20794 字全量康熙笔画），
// 本地 200 字表作为兜底。
import { kangxiStrokes, charWuxing } from '../data/kangxi.js'

// 单字笔画（含繁体，普通简体取康熙笔画）
// 简体优先，找不到再用繁体常用字笔画
const STROKE_MAP = {
  // A
  阿: 9, 啊: 11, 艾: 9, 爱: 13, 安: 6,
  // B
  八: 2, 巴: 9, 白: 5, 百: 6, 柏: 9, 班: 13, 包: 5, 宝: 8, 保: 9, 北: 5, 贝: 7, 本: 5, 冰: 7, 博: 12, 不: 4, 布: 6,
  // C
  才: 4, 财: 10, 彩: 11, 灿: 17, 草: 12, 茶: 12, 辰: 7, 晨: 11, 成: 7, 城: 10, 诚: 14, 程: 12, 初: 7, 川: 3, 春: 9, 辞: 14, 聪: 17, 翠: 15, 存: 7,
  // D
  达: 12, 大: 3, 丹: 4, 淡: 15, 道: 16, 德: 15, 的: 8, 登: 12, 迪: 12, 典: 9, 鼎: 13, 东: 5, 冬: 5, 豆: 7, 端: 14,
  // E / F
  尔: 6, 发: 12, 凡: 8, 飞: 9, 芳: 10, 菲: 14, 锋: 16, 夫: 4, 福: 13, 富: 12,
  // G
  刚: 10, 高: 10, 歌: 14, 根: 10, 公: 4, 功: 5, 谷: 7, 国: 11, 光: 6, 归: 18, 贵: 10, 桂: 10, 过: 11,
  // H
  海: 11, 涵: 12, 翰: 16, 好: 6, 和: 8, 合: 6, 何: 7, 河: 9, 红: 9, 鸿: 17, 后: 9, 厚: 10, 虎: 8, 桦: 16, 环: 18, 辉: 15, 回: 6, 慧: 15, 惠: 12, 火: 4, 霍: 16,
  // J
  嘉: 14, 佳: 8, 家: 10, 简: 12, 建: 9, 健: 11, 江: 7, 杰: 12, 金: 8, 锦: 16, 进: 15, 晋: 10, 京: 8, 净: 8, 静: 16, 君: 7, 俊: 9,
  // K
  开: 4, 凯: 12, 康: 11, 可: 5, 空: 8, 宽: 10, 矿: 13, 奎: 9, 坤: 8,
  // L
  兰: 23, 蓝: 20, 朗: 10, 乐: 15, 黎: 15, 力: 2, 立: 5, 莲: 19, 良: 7, 林: 8, 凌: 10, 灵: 24, 玲: 10, 岭: 13, 柳: 9, 龙: 16, 露: 21, 律: 10, 绿: 14,
  // M
  梅: 11, 美: 9, 孟: 8, 梦: 11, 名: 6, 明: 8, 鸣: 14, 墨: 15, 木: 4, 沐: 8,
  // N
  娜: 10, 南: 9, 楠: 13, 宁: 14, 牛: 4,
  // P
  攀: 19, 培: 11, 佩: 8, 鹏: 19, 平: 5, 萍: 14,
  // Q
  七: 2, 奇: 8, 琪: 13, 祺: 13, 琪: 13, 启: 7, 千: 3, 钱: 16, 茜: 12, 强: 11, 桥: 16, 琴: 13, 青: 8, 清: 12, 秋: 9, 泉: 9, 群: 13,
  // R
  然: 12, 仁: 4, 荣: 14, 柔: 9, 如: 6, 茹: 12, 锐: 15, 瑞: 14,
  // S
  三: 3, 森: 12, 杉: 7, 莎: 11, 山: 3, 善: 12, 裳: 12, 韶: 14, 绍: 11, 深: 12, 升: 4, 生: 5, 声: 17, 诗: 13, 石: 5, 时: 10, 识: 13, 士: 3, 世: 5, 书: 10, 树: 16, 双: 18, 水: 4, 思: 9, 松: 8, 素: 8, 岁: 6,
  // T
  太: 4, 泰: 10, 天: 4, 听: 7, 同: 6, 桐: 10, 童: 10, 土: 3,
  // W
  万: 15, 文: 4, 问: 10, 武: 8, 五: 4, 午: 4,
  // X
  西: 6, 希: 7, 溪: 14, 喜: 12, 夏: 10, 先: 6, 贤: 13, 仙: 5, 湘: 13, 香: 9, 祥: 11, 向: 6, 小: 3, 晓: 16, 心: 4, 新: 13, 信: 9, 星: 9, 行: 6, 兴: 15, 秀: 7, 学: 16, 雪: 11,
  // Y
  雅: 12, 亚: 7, 岩: 8, 延: 7, 颜: 18, 眼: 12, 阳: 17, 瑶: 15, 耀: 20, 一: 1, 伊: 6, 怡: 9, 宜: 8, 易: 8, 义: 13, 艺: 21, 银: 14, 隐: 11, 英: 8, 盈: 9, 颖: 16, 永: 5, 勇: 9, 宇: 6, 语: 14, 玉: 5, 御: 17, 远: 17, 月: 4, 云: 12, 韵: 19,
  // Z
  再: 6, 则: 9, 泽: 17, 展: 10, 张: 11, 章: 11, 哲: 10, 真: 10, 振: 11, 正: 5, 之: 3, 知: 9, 芝: 10, 志: 7, 致: 15, 中: 4, 忠: 8, 钟: 17, 周: 8, 竹: 6, 祝: 10, 子: 3, 紫: 14, 自: 6, 宗: 9, 走: 7
}

// 单字五行（简体常用字）
const WUXING_MAP = {
  阿: '木', 啊: '木', 艾: '木', 爱: '土', 安: '土',
  八: '木', 巴: '水', 白: '水', 百: '水', 柏: '木', 班: '水', 包: '水', 宝: '火', 保: '水', 北: '水', 贝: '水', 本: '木', 冰: '水', 博: '水', 不: '水', 布: '水',
  才: '金', 财: '金', 彩: '金', 灿: '火', 草: '木', 茶: '木', 辰: '土', 晨: '火', 成: '金', 城: '土', 诚: '金', 程: '木', 初: '金', 川: '金', 春: '木', 辞: '金', 聪: '金', 翠: '金', 存: '金',
  达: '火', 大: '木', 丹: '火', 淡: '水', 道: '火', 德: '火', 的: '火', 登: '火', 迪: '火', 典: '火', 鼎: '火', 东: '木', 冬: '火', 豆: '火', 端: '火',
  尔: '火', 发: '水', 凡: '水', 飞: '水', 芳: '木', 菲: '木', 锋: '金', 夫: '水', 福: '水', 富: '水',
  刚: '金', 高: '木', 歌: '木', 根: '木', 公: '木', 功: '木', 谷: '木', 国: '木', 光: '火', 归: '木', 贵: '木', 桂: '木', 过: '木',
  海: '水', 涵: '水', 翰: '水', 好: '水', 和: '水', 合: '水', 何: '木', 河: '水', 红: '水', 鸿: '水', 后: '土', 厚: '火', 虎: '木', 桦: '木', 环: '金', 辉: '水', 回: '土', 慧: '水', 惠: '水', 火: '火', 霍: '水',
  嘉: '木', 佳: '木', 家: '木', 简: '木', 建: '木', 健: '木', 江: '水', 杰: '木', 金: '金', 锦: '金', 进: '火', 晋: '火', 京: '木', 净: '金', 静: '金', 君: '木', 俊: '火',
  开: '木', 凯: '木', 康: '木', 可: '木', 空: '木', 宽: '木', 矿: '金', 奎: '木', 坤: '土',
  兰: '木', 蓝: '木', 朗: '火', 乐: '火', 黎: '火', 力: '火', 立: '火', 莲: '木', 良: '火', 林: '木', 凌: '水', 灵: '火', 玲: '火', 岭: '土', 柳: '木', 龙: '土', 露: '水', 律: '火', 绿: '木',
  梅: '木', 美: '水', 孟: '水', 梦: '木', 名: '火', 明: '火', 鸣: '水', 墨: '水', 木: '木', 沐: '水',
  娜: '火', 南: '火', 楠: '木', 宁: '火', 牛: '土',
  攀: '木', 培: '土', 佩: '水', 鹏: '水', 平: '水', 萍: '木',
  七: '金', 奇: '木', 启: '金', 千: '金', 钱: '金', 茜: '木', 强: '木', 桥: '木', 琴: '木', 青: '金', 清: '水', 秋: '金', 泉: '水', 群: '木',
  然: '金', 仁: '金', 荣: '木', 柔: '木', 如: '金', 茹: '木', 锐: '金', 瑞: '金',
  三: '金', 森: '木', 杉: '木', 莎: '木', 山: '土', 善: '金', 韶: '金', 绍: '金', 深: '水', 升: '金', 生: '金', 声: '金', 诗: '金', 石: '金', 时: '金', 识: '金', 士: '金', 世: '金', 书: '金', 树: '木', 双: '金', 水: '水', 思: '金', 松: '木', 素: '金', 岁: '金',
  太: '火', 泰: '火', 天: '火', 听: '火', 同: '火', 桐: '木', 童: '火', 土: '土',
  万: '水', 文: '水', 问: '水', 武: '水', 五: '木', 午: '火',
  西: '金', 希: '水', 溪: '水', 喜: '水', 夏: '木', 先: '金', 贤: '木', 仙: '金', 湘: '水', 香: '水', 祥: '金', 向: '水', 小: '金', 晓: '火', 心: '金', 新: '金', 信: '金', 星: '金', 行: '水', 兴: '水', 秀: '金', 学: '水', 雪: '水',
  雅: '木', 亚: '土', 岩: '土', 延: '土', 颜: '木', 眼: '木', 阳: '土', 瑶: '火', 耀: '火', 一: '木', 伊: '土', 怡: '土', 宜: '木', 易: '火', 义: '木', 艺: '木', 银: '金', 隐: '木', 英: '木', 盈: '水', 颖: '木', 永: '水', 勇: '土', 宇: '土', 语: '木', 玉: '木', 御: '木', 远: '土', 月: '木', 云: '水', 韵: '水',
  再: '金', 则: '金', 泽: '水', 展: '火', 张: '火', 章: '火', 哲: '火', 真: '金', 振: '火', 正: '金', 之: '火', 知: '火', 芝: '木', 志: '火', 致: '火', 中: '火', 忠: '火', 钟: '金', 周: '金', 竹: '木', 祝: '火', 子: '水', 紫: '金', 自: '火', 宗: '金', 走: '金'
}

// 复姓字典（常见复姓 + 笔画）
// 已知复姓集合。
// ⚠ 这里原本是「复姓 → 笔画数」的映射表，而且填的是**简体**笔画（欧阳记 12），
// 但同一个文件里 strokesOf 走的是**康熙**笔画（欧 15 + 阳 17 = 32）。
// 两套笔画混在一份五格里，会算出总格小于人格、外格为负这种不可能的结果
// （欧阳修：人格 27 > 总格 22，外格 -4）。五格剖象法一律以康熙笔画为准，
// 所以这里只保留「哪些是复姓」这一个信息，笔画统一由 strokesOf 逐字累加。
const COMPOUND_SURNAMES = new Set([
  '欧阳', '司马', '上官', '诸葛', '东方', '独孤', '慕容', '尉迟', '皇甫', '令狐',
  '公孙', '宇文', '长孙', '司徒', '司空', '申屠', '夏侯', '贺兰', '南宫', '完颜', '拓跋',
])

// 笔画查询：优先康熙字典字库（全量），本地表兜底
function strokesOf(ch) {
  const kx = kangxiStrokes(ch)
  if (kx) return kx
  return STROKE_MAP[ch] || 8
}
// 五行查询：优先康熙字典字库
function wuxingOf(ch) {
  const wx = charWuxing(ch)
  if (wx) return wx
  return WUXING_MAP[ch] || '水'
}

// 解析姓名（支持复姓）
function splitName(surname, fullName) {
  // 优先自动识别
  if (surname && surname.length) return { surname, given: fullName.replace(surname, '') }
  const two = fullName.slice(0, 2)
  if (COMPOUND_SURNAMES.has(two)) return { surname: two, given: fullName.slice(2) }
  return { surname: fullName.charAt(0), given: fullName.slice(1) }
}

// 数理吉凶 → 大白话引导：文言判词之外，给普通人一句能直接看懂的话
const NAME_LUCK_PLAIN = {
  大吉: '这格数理很不错，是旺人、旺事的好数，用这个名字心里有底气。',
  中吉: '这格数理偏顺，多数时候平稳向好，偶有小波折也能过去。',
  吉: '这格数理平顺，踏踏实实过日子最合适，不宜好高骛远。',
  中: '这格数理好坏参半，起起落落属正常，关键是心态稳。',
  中凶: '这格数理略有波折，容易多操心、多费神，做事多留一手。',
  凶: '这格数理不太顺，容易走弯路、遇阻碍，改名时尽量避开。',
  大凶: '这格数理是明显不利的数，常主劳心伤神、事多不顺，建议优先避开。',
  待评: '这格数理不在通行表中，仅作参考，不必过度在意。',
  default: '这格数理有起有落，顺境别骄傲、逆境别灰心。',
}

// 数理吉凶判定
const LUCK_TABLE = {
  1: { 吉: false, desc: '首领之数，过于刚强，多成多败', category: '大凶' },
  2: { 吉: false, desc: '混沌未定，分化矛盾，志望难达', category: '大凶' },
  3: { 吉: true,  desc: '有才艺，品性和雅，谋略齐备', category: '大吉' },
  4: { 吉: false, desc: '凶变遭难，身劳困苦，灾害不绝', category: '大凶' },
  5: { 吉: true,  desc: '阴阳合和，福禄久远，温和雅量', category: '大吉' },
  6: { 吉: true,  desc: '安稳余庆，温和雅量，福寿绵长', category: '大吉' },
  7: { 吉: false, desc: '刚毅果断，独立权行，缺少人和', category: '凶' },
  8: { 吉: true,  desc: '坚刚运隆，志愿可达，官禄克成', category: '大吉' },
  9: { 吉: false, desc: '大成之数，终运凶变，品行有缺', category: '中凶' },
  10: { 吉: false, desc: '万事终局，万物灭度，丧失生机', category: '大凶' },
  11: { 吉: true,  desc: '旱苗逢雨，枯木逢春，强大之运', category: '大吉' },
  12: { 吉: false, desc: '薄弱无力，孤独之运，志望难达', category: '大凶' },
  13: { 吉: true,  desc: '天赋吉运，能得名誉，繁荣富贵', category: '大吉' },
  14: { 吉: false, desc: '家庭缘薄，沦落天涯，多成多败', category: '凶' },
  15: { 吉: true,  desc: '福寿双全，温和雅量，德泽四方', category: '大吉' },
  16: { 吉: true,  desc: '化凶为吉，异路成功，绵长厚德', category: '大吉' },
  17: { 吉: false, desc: '刚强之数，冲突不安，浮沉不定', category: '中' },
  18: { 吉: true,  desc: '权力显达，铁石心肠，志竟成功', category: '中吉' },
  19: { 吉: false, desc: '多难之数，薄弱之运，多成多败', category: '中凶' },
  20: { 吉: false, desc: '破灭之数，破屋坏垣，劳而无获', category: '大凶' },
  21: { 吉: true,  desc: '明月光照，独立权威，权威有余', category: '大吉' },
  22: { 吉: false, desc: '秋草逢霜，薄弱之运，困苦多忧', category: '大凶' },
  23: { 吉: true,  desc: '旭日东升，壮丽之数，繁荣发达', category: '大吉' },
  24: { 吉: true,  desc: '掘藏得金，财力蓄积，门庭荣耀', category: '大吉' },
  25: { 吉: false, desc: '桃李之数，温和雅量，自立成家', category: '中吉' },
  26: { 吉: false, desc: '波澜起伏，变幻莫测，凶中带吉', category: '中' },
  27: { 吉: false, desc: '欲望太大，诽谤多难，志难遂心', category: '凶' },
  28: { 吉: false, desc: '浮沉不定，灾祸水象，难得其志', category: '凶' },
  29: { 吉: true,  desc: '草木逢春，欲望太大，权威智谋', category: '中吉' },
  30: { 吉: false, desc: '一成一败，浮沉不定，慎始慎终', category: '中' },
  31: { 吉: true,  desc: '春日花开，智达四方，繁荣富贵', category: '大吉' },
  32: { 吉: true,  desc: '意外之数，权利有望，柔中带刚', category: '大吉' },
  33: { 吉: true,  desc: '旭日升天，权禄显达，才谋兼备', category: '大吉' },
  34: { 吉: false, desc: '破家亡身，沦落绝境，困顿难成', category: '大凶' },
  35: { 吉: true,  desc: '温和平顺，中庸之数，品行端正', category: '中吉' },
  36: { 吉: false, desc: '波澜重叠，终成大困，一生多忧', category: '大凶' },
  37: { 吉: true,  desc: '权威显达，太平之象，立业可期', category: '大吉' },
  38: { 吉: true,  desc: '磨铁成钢，潜运如龙，功业有望', category: '中吉' },
  39: { 吉: true,  desc: '富贵之数，吉祥之象，立业可期', category: '大吉' },
  40: { 吉: false, desc: '刚强之数，谋事有成，进退有度', category: '中' },
  41: { 吉: true,  desc: '德望兼备，名利双收，声望尊崇', category: '大吉' },
  42: { 吉: false, desc: '寒蝉悲秋，薄弱之数，难达志愿', category: '凶' },
  43: { 吉: false, desc: '散财破产，沦落无极，多成多败', category: '大凶' },
  44: { 吉: false, desc: '破家亡身，暗淡无光，困顿穷困', category: '大凶' },
  45: { 吉: true,  desc: '顺风扬帆，精神爽快，万事如意', category: '大吉' },
  46: { 吉: false, desc: '坎坷不平，破坏重重，进退维谷', category: '大凶' },
  47: { 吉: true,  desc: '草木逢春，荣华显达，权威兼备', category: '大吉' },
  48: { 吉: true,  desc: '青松立鹤，智谋兼备，德泽四方', category: '大吉' },
  49: { 吉: false, desc: '吉凶参半，浮沉不定，顺风扬帆', category: '中' },
  50: { 吉: false, desc: '吉凶参半，失败遂难，操心劳神', category: '大凶' },
  51: { 吉: true,  desc: '振翅高飞，权威达官，繁荣发达', category: '大吉' },
  52: { 吉: true,  desc: '先见之明，理想实现，成功发达', category: '大吉' },
  53: { 吉: false, desc: '外枯内实，外望丰满，内里虚空', category: '中凶' },
  54: { 吉: false, desc: '石上栽花，难达之数，困苦多忧', category: '大凶' },
  55: { 吉: true,  desc: '外美内苦，外观隆昌，内里虚无', category: '中' },
  56: { 吉: false, desc: '浪里行舟，历尽艰辛，凶中带吉', category: '凶' },
  57: { 吉: true,  desc: '努力成功，先难后易，吉而有终', category: '中吉' },
  58: { 吉: false, desc: '晚景困顿，心灰意冷，多成多败', category: '中' },
  59: { 吉: false, desc: '寒蝉悲秋，困难重重，进退维谷', category: '凶' },
  60: { 吉: false, desc: '凶多吉少，沦落天涯，空劳心力', category: '大凶' },
  61: { 吉: true,  desc: '名利双收，繁荣发达，左右逢源', category: '大吉' },
  62: { 吉: false, desc: '基础不稳，运途多难，难达志愿', category: '大凶' },
  63: { 吉: true,  desc: '万物化育，繁荣至极，权威之象', category: '大吉' },
  64: { 吉: false, desc: '骨肉分离，孤独之运，命途多舛', category: '大凶' }
}

// 数理取余 1-81 范围
function reduceNumber(n) {
  while (n > 81) n -= 80
  if (n <= 0) n += 81
  return n
}

// 五行关系（吉凶判定辅助）
const WX_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const WX_KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' }

// 评分给出反馈
function scoreName(gegeArr, favorable) {
  let score = 60
  gegeArr.forEach(g => {
    if (LUCK_TABLE[g.num]?.吉) score += 8
    if (!LUCK_TABLE[g.num]?.吉) score -= 6
    if (favorable && favorable.includes(g.wuxing)) score += 5
  })
  return Math.max(0, Math.min(100, score))
}

// 主入口：分析姓名
export function analyzeName({ fullName, surname, chart }) {
  const parsed = splitName(surname || '', fullName)
  const surName = parsed.surname
  const givenName = parsed.given

  if (!surName) throw new Error('请输入姓名')
  if (!givenName && fullName.length === 1) {
    // 单字名
    givenName
  }

  // 复姓也逐字用康熙笔画累加，与名字侧口径一致
  const surStrokes = surName.split('').reduce((a, c) => a + strokesOf(c), 0)
  const givenChars = (givenName || '').split('').filter(Boolean)
  const givenStrokes = givenChars.map(g => strokesOf(g))

  // 单名特殊处理：用 1+1 补足
  const tianGeValue = surStrokes + 1
  const diGeBase = givenStrokes.length === 1
    ? strokesOf(givenChars[0]) + 1
    : givenStrokes.reduce((a, b) => a + b, 0)

  // 人格 = 姓的最后一字 + 名的第一字。
  // ⚠ 原来对单字名写的是 `slice(0, 0)` —— 名字那一半被整个丢掉，人格退化成
  // 姓氏的笔画数。单字名在中文里极其常见，这条错误影响面很大。
  // 例：王(4)明(8) 人格应为 12，原实现算成 4。
  const renGeChars = [surName.slice(-1), ...givenChars.slice(0, 1)]
  const renGeValue = renGeChars.reduce((a, c) => a + strokesOf(c), 0)

  const zongGeValue = surStrokes + givenStrokes.reduce((a, b) => a + b, 0)

  // 外格 = 总格 - 人格 + 1。
  // 等价于传统定义「(姓总笔画 - 姓末字) + (名总笔画 - 名首字) + 1」，单姓/复姓、
  // 单名/双名都成立。原来漏了 +1，单姓单名会算出 0（如王明：12 - 12 = 0，应为 1）。
  const waiGeValue = zongGeValue - renGeValue + 1

  // 化为 1-81 范围（保留两位数则取模 80 后 + 1）
  const normalize = (n) => {
    while (n > 81) n -= 80
    if (n <= 0) n += 80
    return n
  }

  // 三才（天人地）
  const tianWx = wuxingOf(surName[surName.length - 1])
  const renWx = wuxingOf(givenChars[0] || surName[0])
  const diWx = givenChars.length >= 2 ? wuxingOf(givenChars[givenChars.length - 1]) : wuxingOf(givenChars[0] || surName[0])
  // 三才配置吉凶
  const sanCaiGood = (() => {
    const seq = [tianWx, renWx, diWx]
    // 相生更好（天人同、人地生）
    if (WX_SHENG[seq[0]] === seq[1] || seq[0] === seq[1]) {
      if (WX_SHENG[seq[1]] === seq[2] || seq[1] === seq[2]) return '吉'
    }
    if (WX_KE[seq[0]] === seq[1] || WX_KE[seq[1]] === seq[2]) return '凶'
    return '中'
  })()

  const grid = [
    { name: '天格', value: normalize(tianGeValue), desc: '代表父母、长辈、事业之根源',  wuxing: tianWx, num: normalize(tianGeValue) },
    { name: '人格', value: normalize(renGeValue),  desc: '代表本人之主要性格与运势', wuxing: renWx,  num: normalize(renGeValue) },
    { name: '地格', value: normalize(diGeBase),   desc: '代表晚辈、下属、家运之基础',  wuxing: diWx,   num: normalize(diGeBase) },
    { name: '外格', value: normalize(Math.abs(waiGeValue)), desc: '代表外在人际、机缘、桃花', wuxing: surName.length > 1 ? wuxingOf(surName[0]) : wuxingOf(surName), num: normalize(Math.abs(waiGeValue)) },
    { name: '总格', value: normalize(zongGeValue), desc: '代表一生整体运势（35 岁后凸显）', wuxing: renWx, num: normalize(zongGeValue) }
  ]

  grid.forEach(g => {
    g.luck = LUCK_TABLE[g.num] || { 吉: false, desc: '该数不在通行数理表中', category: '待评' }
    // 为文言判词补一句"大白话"层：让普通人一眼看懂这格数理是福是波折
    g.luck.plain = NAME_LUCK_PLAIN[g.luck.category] || NAME_LUCK_PLAIN.default
  })

  const favorable = chart?.favorable || []
  const score = scoreName(grid, favorable)

  // 评语
  const grade = score >= 85 ? '上吉' : score >= 70 ? '中吉' : score >= 55 ? '中平' : '偏弱'
  const summaryText = (() => {
    const rg = grid.find(g => g.name === '人格')
    const tg = grid.find(g => g.name === '总格')
    const rLuck = rg.luck.吉
    const tLuck = tg.luck.吉
    if (rLuck && tLuck) return '人格、总格皆主吉，性情爽朗、事业可期、人生稳中有进。'
    if (rLuck) return '人格主吉、内秀外彰，处事得体；总格稍弱，宜修身以养名。'
    if (tLuck) return '总格主吉、后运渐隆；人格稍逊，需待人接物多下功夫。'
    return '主格与总格数理稍显单薄，宜结合八字喜用神综合取名。'
  })()

  return {
    input: { fullName, surname: surName, given: givenName },
    grid,
    sanCai: { tian: tianWx, ren: renWx, di: diWx, verdict: sanCaiGood },
    score,
    grade,
    summaryText,
    favorable
  }
}

// 推荐名字（结合八字喜用神）
export function recommendName(chart, fullName) {
  const sur = fullName.slice(0, 1)
  const targetWx = chart?.favorable?.[0] || '木'

  // 几个常用字库（按目标五行筛选）
  const POOL = {
    木: ['林', '森', '奕', '潇', '简', '行', '蕴', '吟', '雅', '晋', '奕', '卿', '锦', '竹', '雪'],
    火: ['晟', '昕', '烁', '之', '黎', '达', '腾', '彰', '晗', '晴', '昭', '灿', '鸣', '烁', '灵'],
    土: ['宇', '逸', '峥', '坤', '砚', '远', '野', '安', '岩', '亦', '硕', '岱', '峰', '硕', '羽'],
    金: ['钧', '诚', '辞', '靖', '琨', '宁', '初', '尚', '承', '思', '钟', '宸', '钦', '锦', '锐'],
    水: ['清', '海', '沐', '雨', '灵', '溪', '沁', '润', '潇', '荷', '韵', '雪', '云', '露', '凝']
  }
  const pool = POOL[targetWx] || POOL['木']

  const candidates = []
  for (let i = 0; i < 8 && i < pool.length; i++) {
    const ch1 = pool[i]
    const ch2 = pool[(i + 5) % pool.length]
    const fakeInput = { fullName: sur + ch1 + ch2, surname: sur }
    try {
      const a = analyzeName({ ...fakeInput, chart })
      candidates.push(a)
    } catch (e) {}
  }
  return candidates.sort((x, y) => y.score - x.score).slice(0, 3)
}
