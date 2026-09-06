/* ============ 元氣滿滿 · 会员与积分引擎 ============
 *
 * 设计原则：
 *   · 不消耗 token 的纯本地排盘/展示 → 游客免费（详见 FREE_FEATURES）
 *   · 游客：本地功能全免费 + 元氣 AI 100 积分体验额度（token 换算，见 freeQuota.js）
 *   · 凡境 ¥18.8 / 月 = 200 积分；玄境 ¥99 / 月 = 500；天机境 ¥188 / 月 = 1000
 *   · 积分按订阅价倒推（留 20% 毛利）；游客 100 < 凡境 200 < 玄境 500 < 天机 1000 依次递增
 *   · 定价依据详见《会员体系设计方案.md》
 *   · 消耗 token 的 AI 解读/完整命书/AI 对话 → 按 FEATURE_COSTS 扣积分
 *   · 每月（30 天）额度自动重置，积分以月度配额内扣减
 *
 * 注意：本模块是「演示实现」的会员策略 —— 数据存于浏览器本地（localStorage），
 *       真实部署需将积分余额迁到后端由服务端鉴权扣减。
 */

const MONTH_MS = 30 * 86400000 // 30 天视为「一个月度周期」

/* ---- 三档会员方案 ----
 * field 释义：
 *   key         档位键
 *   icon        装饰 emoji
 *   en          英文/拼音副标题
 *   name        中文名称
 *   tag         定位标签（如"入门 / 进阶 / 至臻"）
 *   price       月费（元）
 *   credits     本月可用积分数
 *   desc        一句话描述
 *   perks       列表权益（与 Landing / Profile 展示对齐）
 *   featured    是否在 Landing 标记为「推荐」
 *   benefits    用于 Profile 内层卡（短句权益列表）
 *   legacy      true 表示兼容旧文案（用户中心右侧卡）
 */
export const PLANS = [
  {
    key: 'earth',
    icon: '☁️',
    en: 'Earth Realm',
    name: '凡境',
    tag: '入门',
    price: 18.8,
    credits: 200,
    desc: '入门体验，个人黄历订阅 + 日常小测，轻松踏入玄学世界。',
    unit: '/月',
    cta: '从凡境开始',
    perks: [
      '本地排盘全部免费（八字 / 紫微 / 塔罗 / 奇门 / 称骨 / 风水 / 星座 / 姓名）',
      '个人黄历订阅推送（结合八字 · 晨起 / 午间 / 晚归）',
      '每月 200 积分 · 完整命书与 AI 对话按需消耗',
      '基础测算每日 5 次（积分制）',
      '历史记录自动保存',
    ],
    featured: false,
    benefits: [
      '本地排盘 全部免费',
      '个人黄历订阅推送',
      '完整命书 / AI 对话 · 200 积分/月',
      '历史记录自动保存',
    ],
  },
  {
    key: 'heaven',
    icon: '✦',
    en: 'Heaven Realm',
    name: '玄境',
    tag: '进阶',
    price: 99,
    credits: 500,
    desc: '深度解读，全量解锁，大多数人选择的心仪之境。',
    unit: '/月',
    cta: '跃升玄境',
    perks: [
      '全部测算不限次数（积分额度内）',
      '每月 500 积分 · 完整深度报告与 AI 问答畅聊',
      '完整深度报告（子平 / 盲派 / 紫微 / 奇门 / 塔罗牌阵）',
      '无限历史记录 · 流年 · 节气推送',
      '玄学会员专属精读文章',
    ],
    featured: true,
    hot: true,
    benefits: [
      '全部测算 不限次数（积分额度内）',
      '完整深度报告',
      '无限历史记录',
      '流年 · 节气推送',
      '会员专属精读文章',
    ],
  },
  {
    key: 'oracle',
    icon: '☼',
    en: 'Oracle Realm',
    name: '天机境',
    tag: '至臻',
    price: 188,
    credits: 1000,
    desc: '至尊专属，大师 1v1 精批，天机尽握于掌。',
    unit: '/月',
    cta: '问鼎天机',
    perks: [
      '玄境全部权益',
      '每月 1000 积分 · 大师 1v1 精批（每月 1 次额度内）',
      '年度流年深度精批',
      '专属客服优先响应',
      '玄学新功能优先体验',
    ],
    featured: false,
    benefits: [
      '玄境全部权益',
      '大师 1v1 精批',
      '年度流年深度精批',
      '专属客服优先响应',
    ],
  },
]

/* ---- 免费档（不可购买，仅作为「未订阅 / 已过期」的落点） ----
 *
 * 三档 PLANS 全是付费档，注册时直接发 30 天 earth，planExpiresAt 到期后
 * 却没有任何去处 —— 于是「到期」这个字段写了也白写，谁都不会真的降级。
 * 设计方案里本来就写着「游客：本地功能全免费 + 元氣 AI 100 积分体验额度」，
 * 这里把那句话落成一个具体档位，作为过期用户的落点。
 * 它不出现在 PLANS 里，所以不会进购买列表、不影响定价页。
 */
export const FREE_PLAN = {
  key: 'free',
  icon: '○',
  en: 'Mortal',
  name: '凡人',
  tag: '未订阅',
  price: 0,
  credits: 100,
  unit: '',
  desc: '本地排盘全部免费，AI 解读每月 100 积分体验额度。',
  perks: [
    '本地排盘全部免费（八字 / 紫微 / 塔罗 / 奇门 / 称骨 / 风水 / 星座 / 姓名）',
    '每月 100 积分体验额度',
  ],
  benefits: ['本地排盘 全部免费', 'AI 体验额度 100 积分/月'],
}

/** 会员是否已过期（free 档不会过期） */
export function isPlanExpired(user, now = Date.now()) {
  if (!user) return false
  if (!user.plan || user.plan === FREE_PLAN.key) return false
  const exp = user.planExpiresAt || 0
  return exp > 0 && exp <= now
}

/* ---- 游客完全免费的功能（不消耗 token 的本地计算/展示） ----
 * 路径与 App 路由对齐；下方所有未列出的「消耗 token」功能 → 登录 + 积分
 */
export const FREE_FEATURES = new Set([
  'bazi.chart',    // 八字盘面 + 五行 + 喜忌神
  'ziwei.chart',   // 紫微盘面 + 主星
  'tarot.draw',    // 塔罗抽牌（不消耗解读）
  'qimen.build',   // 奇门起盘（不消耗解读）
  'chenggu',       // 称骨论命
  'fengshui',      // 风水排盘
  'horoscope',     // 星座运势（基础）
  'name',          // 姓名音韵
  'huangli.daily', // 每日黄历查看
])

/* ---- 消耗积分的功能（key → 积分） ----
 * 客户端展示"消耗 X 积分"；扣减失败抛 { ok:false, reason }
 */
export const FEATURE_COSTS = {
  'bazi.full': 8,        // 八字完整命书（子平/盲派）
  'ziwei.full': 8,       // 紫微完整报告
  'tarot.reading': 5,    // 塔罗牌阵 AI 解读
  'qimen.reading': 5,    // 奇门 AI 解读
  'tarot.single': 2,     // 塔罗单牌 AI 解读（轻量）
  'fengshui.ai': 5,      // 风水 AI 优化建议
  'chenggu.ai': 3,       // 称骨 AI 解读
  'name.ai': 3,          // 姓名 AI 详批
  'horoscope.ai': 3,     // 星座 AI 深度解读
  'huangli.ai': 2,       // 黄历 AI 场景化建议
  'agent.chat': 1,       // 元氣 AI 单轮对话（按轮计费）
}

/* ---- 工具 ---- */
export function planByKey(key) {
  if (key === FREE_PLAN.key) return FREE_PLAN
  return PLANS.find(p => p.key === key) || PLANS[0]
}

/** 用户的「本月积分余额」—— 若周期已过期，先做月度重置 */
export function getMonthlyCredits(user) {
  if (!user) return 0
  // 过期后额度按 free 档算。否则「到期不降级」在余额上完全看不出来：
  // 一个三个月前就过期的天机境账号，顶栏照样显示 1000 积分可用。
  const plan = isPlanExpired(user) ? FREE_PLAN : planByKey(user.plan)
  const resetAt = user.planCreditsResetAt || 0
  const now = Date.now()
  let used = user.creditsUsed || 0
  if (now >= resetAt) {
    // 月度重置（被动触发，不直接写盘，由 ensureMonthlyReset 负责）
    used = 0
  }
  return Math.max(0, plan.credits - used)
}

/** 月度进度：已用 / 总额，0~1 */
export function getMonthlyProgress(user) {
  if (!user) return 0
  const plan = isPlanExpired(user) ? FREE_PLAN : planByKey(user.plan)
  const total = Math.max(1, plan.credits)
  const used = Math.min(plan.credits, user.creditsUsed || 0)
  return used / total
}

/** 是否还够积分扣减指定功能 */
export function canAfford(user, featureKey) {
  const cost = FEATURE_COSTS[featureKey]
  if (cost == null) return true // 未列入积分表 = 视为免费/已放行
  return getMonthlyCredits(user) >= cost
}

/** 本月重置时间是否已到（被动状态判断） */
export function isMonthlyResetDue(user) {
  if (!user) return false
  const resetAt = user.planCreditsResetAt || 0
  return Date.now() >= resetAt
}

/** 生成 30 天后的到期时间戳 */
export function nextResetAt(now = Date.now()) {
  return now + MONTH_MS
}

/* ---- 文案 ---- */
export const PLAN_LABEL = {
  free: '凡人',
  earth: '凡境',
  heaven: '玄境',
  oracle: '天机境',
}

/** 是否属于游客完全免费项 */
export function isFree(featureKey) {
  return FREE_FEATURES.has(featureKey)
}