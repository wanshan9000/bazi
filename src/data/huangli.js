// 老黄历 · 基础数据层
// 提供：农历转换（浏览器内置 Intl）、节气、星期、每日宜忌规则、干支五行冲合、当代生活场景素材

import { TIAN_GAN, DI_ZHI, GAN_WUXING, ZHI_WUXING, WUXING_SHENG, WUXING_KE, SHENGXIAO } from './ganzhi.js'
import { dayPillar, yearPillar, monthPillar, currentYearGanzhi } from '../engine/bazi.js'

// ---------- 节气（黄历月令以节气为界，与八字月柱一致） ----------
export const JIEQI_LIST = [
  { name: '立春', month: 2, day: 4, zhi: '寅' },
  { name: '雨水', month: 2, day: 19, zhi: '寅' },
  { name: '惊蛰', month: 3, day: 6, zhi: '卯' },
  { name: '春分', month: 3, day: 21, zhi: '卯' },
  { name: '清明', month: 4, day: 5, zhi: '辰' },
  { name: '谷雨', month: 4, day: 20, zhi: '辰' },
  { name: '立夏', month: 5, day: 6, zhi: '巳' },
  { name: '小满', month: 5, day: 21, zhi: '巳' },
  { name: '芒种', month: 6, day: 6, zhi: '午' },
  { name: '夏至', month: 6, day: 21, zhi: '午' },
  { name: '小暑', month: 7, day: 7, zhi: '未' },
  { name: '大暑', month: 7, day: 23, zhi: '未' },
  { name: '立秋', month: 8, day: 8, zhi: '申' },
  { name: '处暑', month: 8, day: 23, zhi: '申' },
  { name: '白露', month: 9, day: 8, zhi: '酉' },
  { name: '秋分', month: 9, day: 23, zhi: '酉' },
  { name: '寒露', month: 10, day: 8, zhi: '戌' },
  { name: '霜降', month: 10, day: 23, zhi: '戌' },
  { name: '立冬', month: 11, day: 7, zhi: '亥' },
  { name: '小雪', month: 11, day: 22, zhi: '亥' },
  { name: '大雪', month: 12, day: 7, zhi: '子' },
  { name: '冬至', month: 12, day: 22, zhi: '子' },
  { name: '小寒', month: 1, day: 6, zhi: '丑' },
  { name: '大寒', month: 1, day: 20, zhi: '丑' }
]

// 立春定年、节气定月令（黄历节气序列从立春起，小寒/大寒为上年末）
export function solarTerm(date) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  // 1月：处上年黄历年末段（冬至→小寒→大寒）
  if (m === 1) {
    if (d >= 20) return JIEQI_LIST[23] // 大寒
    if (d >= 6) return JIEQI_LIST[22] // 小寒
    return JIEQI_LIST[21] // 冬至（1月1-5日仍处冬至后）
  }
  // 2-12月：从前往后找当天所处节气区间（跳过1月）
  let last = JIEQI_LIST[0] // 立春兜底
  for (const jq of JIEQI_LIST) {
    if (jq.month === 1) continue
    if (m > jq.month || (m === jq.month && d >= jq.day)) last = jq
    else break
  }
  return last
}

// ---------- 农历（用浏览器 Intl 的汉历，最可靠） ----------
const lunarMonthFmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long' })
const lunarDayFmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { day: 'numeric' })

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
function cnDay(n) {
  if (n === 10) return '初十'
  if (n < 10) return '初' + CN_NUM[n]
  if (n < 20) return '十' + (n % 10 ? CN_NUM[n % 10] : '')
  if (n === 20) return '二十'
  if (n < 30) return '廿' + (n % 10 ? CN_NUM[n % 10] : '')
  return '三十'
}

export function lunarInfo(date) {
  try {
    const parts = lunarDayFmt.formatToParts(date)
    const dayNum = parts.find(p => p.type === 'day')
    const dayStr = cnDay(Number(dayNum && dayNum.value) || 1)
    const m = lunarMonthFmt.format(date) // 例：闰四月 / 八月
    return { month: m, day: dayStr, label: `${m}${dayStr}`, md: dayStr }
  } catch {
    return { month: '', day: '', label: '', md: '' }
  }
}

// ---------- 星期 ----------
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
export function weekday(date) {
  return WEEKDAYS[date.getDay()]
}

// ---------- 干支（直接复用八字引擎的算法，供外部使用） ----------
export { dayPillar, yearPillar, monthPillar, currentYearGanzhi }

// ---------- 生肖 ----------
export function zodiacOfYear(date) {
  const yp = yearPillar(date)
  return SHENGXIAO[DI_ZHI.indexOf(yp.zhi)]
}

// ---------- 地支六冲（老黄历"冲煞"用） ----------
export const ZHI_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' }

// ---------- 传统黄历每日宜忌规则库 ----------
// 键 = 日支（十二地支），值为当日的基本宜/忌（传统老黄历通则）
export const DAY_RULES = {
  子: { yi: ['沐浴', '扫舍', '求医', '安床'], ji: ['开市', '出行', '动土', '嫁娶'] },
  丑: { yi: ['祭祖', '会友', '修屋', '求嗣'], ji: ['远行', '破土', '谈判', '签约'] },
  寅: { yi: ['开市', '纳财', '签约', '出行'], ji: ['安葬', '动土', '修缮'] },
  卯: { yi: ['读书', '会友', '置产', '出行'], ji: ['开仓', '屠宰', '诉讼'] },
  辰: { yi: ['祭祀', '安床', '修造', '入学'], ji: ['开市', '远行', '破土'] },
  巳: { yi: ['婚嫁', '开市', '置业', '动工'], ji: ['诉讼', '远行', '求医'] },
  午: { yi: ['开市', '祈福', '出行', '栽种'], ji: ['安葬', '修缮', '动土'] },
  未: { yi: ['会友', '祭祖', '修屋', '纳财'], ji: ['开仓', '出行', '签约'] },
  申: { yi: ['出行', '签约', '求职', '考试'], ji: ['动土', '安床', '开仓'] },
  酉: { yi: ['婚嫁', '会友', '庆贺', '纳财'], ji: ['开市', '破土', '出行'] },
  戌: { yi: ['祭祀', '扫舍', '纳财', '修库'], ji: ['开市', '动土', '远行'] },
  亥: { yi: ['沐浴', '静修', '安床', '求医'], ji: ['开市', '签约', '动土'] }
}

// 干支日的五行（日干五行 + 日支五行），用于与命局喜忌结合
export function dayElement(date) {
  const dp = dayPillar(date)
  return { gan: dp.gan, zhi: dp.zhi, ganWx: GAN_WUXING[TIAN_GAN.indexOf(dp.gan)], zhiWx: ZHI_WUXING[DI_ZHI.indexOf(dp.zhi)] }
}

// 天干对应的"当代生活主题词"（传统十天干意象映射到现代生活）
export const GAN_THEME = {
  甲: { title: '生发 · 行动', tone: '开创', scene: ['推进新项目', '运动健身', '外勤跑动', '注册新号', '装修开工'] },
  乙: { title: '柔韧 · 协作', tone: '调和', scene: ['团队协作', '拜访客户', '修补关系', '居家整理', '学习新技能'] },
  丙: { title: '热烈 · 表达', tone: '亮相', scene: ['公开演讲', '作品发布', '面试面谈', '直播开播', '社交亮相'] },
  丁: { title: '细腻 · 洞察', tone: '打磨', scene: ['改稿复盘', '钻研细节', '数据分析', '理财记账', '体检保养'] },
  戊: { title: '沉稳 · 承载', tone: '推进', scene: ['签约落地', '处理重务', '购房置产', '制定规划', '稳扎执行'] },
  己: { title: '内敛 · 积累', tone: '蓄力', scene: ['内功修炼', '整理复盘', '布置居家', '静心阅读', '储蓄理财'] },
  庚: { title: '锋利 · 决断', tone: '攻坚', scene: ['谈价谈判', '解决难题', '清理杂物', '维权处理', '果断决策'] },
  辛: { title: '精工 · 品质', tone: '打磨', scene: ['匠心打磨', '购买好物', '美容护肤', '文案精修', '验收交付'] },
  壬: { title: '流动 · 畅达', tone: '开拓', scene: ['出差旅行', '人脉拓展', '直播销售', '渠道开拓', '灵感迸发'] },
  癸: { title: '润泽 · 潜行', tone: '沉淀', scene: ['潜心思索', '深度沟通', '泡茶冥想', '补水养生', '夜读充电'] }
}

// ---------- 五行 × 生活场景的当代提示素材 ----------
// 用于把命局喜用神 / 当日五行结合，生成生活化建议
export const WX_LIFE = {
  木: {
    good: ['适合启动新计划、报班学习', '适合健身、瑜伽、亲近绿植', '适合谈成长类合作、创意提案', '吃青菜、规律作息助生发'],
    color: '青绿色', part: '肝胆与眼睛', wealth: '正财稳步 · 忌冲动加仓',
    relationship: '多表达、主动邀约，关系更鲜活'
  },
  火: {
    good: ['适合公开表达、发作品、做直播', '适合搞团建、见朋友、热闹场合', '适合推进需要热情的谈判与展示', '吃暖色食物、适度晒太阳提阳气'],
    color: '红紫色', part: '心与睡眠', wealth: '偏财有兴 · 见好就收',
    relationship: '真诚热烈，但忌情绪上头说狠话'
  },
  土: {
    good: ['适合签约、置产、处理事务性工作', '适合整理、归档、复盘、定规划', '适合深耕专业、稳扎执行', '吃五谷、规律三餐养脾胃'],
    color: '黄棕色', part: '脾胃与消化', wealth: '守成生息 · 稳健为宜',
    relationship: '务实担当，答应的事一定做到'
  },
  金: {
    good: ['适合谈价、谈判、解决难题', '适合断舍离、清理杂物', '适合专业攻坚、升级装备', '吃白色食物、润肺防燥'],
    color: '白金色', part: '肺与呼吸道', wealth: '财运有刃 · 宜落袋为安',
    relationship: '言出必行，锋芒对事不对人'
  },
  水: {
    good: ['适合出行、出差、拓展人脉', '适合创意构思、头脑风暴', '适合渠道、销售、谈合作', '多喝水、泡脚、早睡养肾'],
    color: '黑蓝色', part: '肾与骨骼', wealth: '流动生财 · 忌孤注一掷',
    relationship: '以柔克刚，先倾听再表态'
  }
}

export { WUXING_SHENG, WUXING_KE }
