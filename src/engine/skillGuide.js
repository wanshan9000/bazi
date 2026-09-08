// 报告 → 元氣AI 技能映射与技法总纲
// 让每类测算报告"读取"元氣 AI 技能库（skills.js）的专业知识，生成技法总纲导读
// 子平报告读「易学-泰山」技能、盲派报告读「盲派」技能；
// 优先读管理后台配置的同 key 技能（skillByKey），未配置时回退内置技能。
import { skillByKey, loadCustomSkills } from '../data/skills.js'

// 报告类型 → 技能 key（子平→易学-泰山，盲派→盲派）
const REPORT_SKILL = {
  bazi: 'yixue-taishan',
  mangpai: 'mangpai',
  liuyao: 'liuyao',
  huangli: 'huangli',
  ziwei: 'ziwei',
  qimen: 'qimen',
  tarot: 'tarot',
  name: 'name',
  fengshui: 'fengshui',
}

export function skillOfReport(type) {
  const key = REPORT_SKILL[type]
  if (!key) return null
  // 管理后台若配置了同 key 技能则优先采用（管理员审核过的方法论口径），否则回退内置
  return skillByKey(key, loadCustomSkills()) || null
}

// 每类报告一句精简导读（面向用户，替代把 sys 提示词全文展示；与具体技能解耦，后台自定义技能同样适用）
const METHOD_HINT = {
  bazi: '子平取用精断：格局→用神→调候→扶抑，先结论后依据',
  mangpai: '盲派做功体系：定太极→辨宾主→做功效率→应期引爆',
  liuyao: '六爻纳甲：本卦变卦、动爻位置，依卦辞爻辞断吉凶',
  huangli: '老黄历宜忌 + 八字开运提示，择吉避凶',
  ziwei: '紫微斗数：十二宫星曜组合，论断命盘格局',
  qimen: '奇门遁甲：九宫八门星神，定方位与时运',
  tarot: '塔罗牌阵：牌面意象解读当下，给行动指引',
  name: '姓名学：五行配置与数理，论断取名吉凶',
  fengshui: '风水布局：方位理气与形峦，论居家办公开运',
}

// 把技能 sys 指令转述为面向用户的「解读思路」文案（精简版）
export function friendlyMethod(skill, type) {
  if (!skill) return ''
  // 优先取该报告一句精简导读
  if (type && METHOD_HINT[type]) return METHOD_HINT[type]
  // 回退：清洗 sys 提示词并截断，绝不把超长原文展示给用户
  let t = skill.sys || ''
  t = t.replace(/^你(?:精通|通晓|擅长)\S{0,12}[，,]\s*/, '').replace(/^你(?:精通|通晓|擅长)\S{0,12}。/s, '')
  t = t.replace(/^你是\S{0,14}(?:宗师|体系)[，,]\s*/, '')
  const cleaned = t.trim()
  if (!cleaned) return skill.desc || ''
  return cleaned.length > 40 ? cleaned.slice(0, 40) + '…' : cleaned
}

export function guidePointsOf(type) {
  const skill = skillOfReport(type)
  if (!skill) return null
  return {
    icon: skill.icon,
    name: skill.name,
    desc: skill.desc,
    methodText: friendlyMethod(skill, type),
  }
}

// 生成技法总纲区块（kind:'guide'），在 makeReport 中注入到报告开头
export function guideSectionOf(type) {
  const g = guidePointsOf(type)
  if (!g) return null
  return {
    key: 'guide',
    kind: 'guide',
    title: '技法总纲',
    data: g,
  }
}
