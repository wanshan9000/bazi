/* ============ 元氣滿滿 · 会员与积分引擎 ============
 *
 * 设计原则：
 *   · 不消耗 token 的纯本地排盘/展示 → 游客免费（详见 FREE_FEATURES）
 *   · 游客获得限量体验积分；注册赠送 20 积分
 *   · 凡者 ¥19.9 / 月 = 60 积分；玄者 ¥59.9 / 月 = 200；天者 ¥129.9 / 月 = 520
 *   · 1 积分 = 19,000 Token。积分是唯一面向用户的计量单位，Token 仅用于服务端审计与计费换算。
 *   · 会员积分随月度周期清零，注册赠点和购买点数永久有效
 *   · 元气 Agent 依据模型返回的实际 Token 用量扣积分，不再按对话轮次、主题或时限计费
 *   · 每月（30 天）额度自动重置，积分以月度配额内扣减
 *
 * 注意：余额由 server/accounts.js 持有和扣减；本模块只定义产品策略与前端展示计算。
 */

const MONTH_MS = 30 * 86400000 // 30 天视为「一个月度周期」

/*
 * DeepSeek Flash 的峰时公开价：未缓存输入 $0.30 / M、输出 $1.20 / M Token。
 * 积分一律按最高的输出单价核算，不以平均输入输出比例赌成本。以天者年付的
 * 最低售价 ¥0.208 / 积分、¥7.20 / $ 为基准，保留 20% 目标毛利时上限约为
 * 19,275 个纯输出 Token；取 19,000 留出汇率波动余量。
 */
export const DEEPSEEK_FLASH_PRICING = Object.freeze({
  peakInputCacheMissUsdPerMillion: 0.30,
  peakOutputUsdPerMillion: 1.20,
  targetGrossMargin: 0.20,
})

/** 市场价格换算的最小用户计费单位。实际模型用量向上取整为积分。 */
export const TOKENS_PER_POINT = 19000

export function tokensToPoints(tokens) {
  return Math.ceil(Math.max(0, Number(tokens) || 0) / TOKENS_PER_POINT)
}

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
    name: '凡者',
    tag: '入门',
    price: 19.9,
    pricing: { monthly: 19.9, quarterly: 56.9, annual: 199 },
    credits: 60,
    desc: '从每天的个人黄历与轻量解读开始，慢慢建立自己的生活参考。',
    unit: '/月',
    cta: '从凡者开始',
    perks: [
      '个人黄历订阅推送（结合八字 · 晨起 / 午间 / 晚归）',
      '八字命书、称骨 / 星座 / 黄历深读',
      '塔罗单牌 · 每月含 10 次解读',
      '月度积分当月有效，购买积分永久有效',
    ],
    featured: false,
    benefits: [
      '个人黄历订阅推送',
      '基础深读与塔罗 10 次解读',
      '60 月度积分',
    ],
  },
  {
    key: 'heaven',
    icon: '✦',
    en: 'Heaven Realm',
    name: '玄者',
    tag: '进阶',
    price: 59.9,
    pricing: { monthly: 59.9, quarterly: 169, annual: 599 },
    credits: 200,
    desc: '适合持续探索与反复咨询的月度点数方案。',
    unit: '/月',
    cta: '跃升玄者',
    perks: [
      '凡者全部权益',
      '紫微、奇门、多牌阵塔罗、风水与姓名详批',
      '每月 200 积分',
      '历史记录与新功能优先体验',
    ],
    featured: true,
    hot: true,
    benefits: [
      '全部高阶术数模块',
      '200 月度积分',
      '历史记录与优先体验',
    ],
  },
  {
    key: 'oracle',
    icon: '☼',
    en: 'Oracle Realm',
    name: '天者',
    tag: '至臻',
    price: 129.9,
    pricing: { monthly: 129.9, quarterly: 369, annual: 1299 },
    credits: 520,
    desc: '为高频咨询与多份报告准备的充足点数方案。',
    unit: '/月',
    cta: '登临天者',
    perks: [
      '玄者全部权益',
      '全模块高频使用 · 每月 520 积分',
      '完整报告与个人黄历持续留存',
      '高频使用与新功能优先体验',
    ],
    featured: false,
    benefits: [
      '全模块高频使用',
      '520 月度积分',
      '优先体验新功能',
    ],
  },
]

/* ---- 免费档（不可购买，仅作为「未订阅 / 已过期」的落点） ----
 *
 * 免费档是未订阅/到期后的落点。它不发月度积分，注册赠送额度进入永久钱包。
 * 它不出现在 PLANS 里，所以不会进购买列表、不影响定价页。
 */
export const FREE_PLAN = {
  key: 'free',
  icon: '○',
  en: 'Guest',
  name: '游客',
  tag: '未订阅',
  price: 0,
  credits: 0,
  unit: '',
  desc: '基础测算免费；注册赠 20 积分可体验轻量深读，高阶术数需开通玄者。',
  perks: [
    '称骨、星座、八字基础盘与通用黄历免费',
    '塔罗可体验 8 次单牌',
    '八字、称骨、星座、黄历轻量深读',
    '元气 Agent 获赠限量体验积分',
    '注册赠 20 积分',
  ],
  benefits: ['基础测算免费', '轻量深读体验', '注册赠 20 积分'],
}

/** 永久积分包。支付回调接入前仅用于展示预览，不能由前端直接加点。 */
export const POINT_PACKS = [
  { key: 'trial', name: '体验包', price: 9.9, credits: 30, hint: '临时补充', featured: false },
  { key: 'regular', name: '常用包', price: 24.9, credits: 80, hint: '日常咨询补充', featured: false },
  { key: 'value', name: '超值包', price: 49.9, credits: 180, hint: '经常咨询', featured: true },
  { key: 'stock', name: '囤点包', price: 89.9, credits: 360, hint: '高频使用', featured: false },
]

/** 订阅周期仅影响支付预览；月度积分依然按月发放并在当月周期结束时清零。 */
export const SUBSCRIPTION_CYCLES = [
  { key: 'monthly', label: '月付', months: 1, badge: '随时续费' },
  { key: 'quarterly', label: '季付', months: 3, badge: '95 折' },
  { key: 'annual', label: '年付', months: 12, badge: '83 折' },
]

export function subscriptionOffer(planOrKey, cycleKey = 'monthly') {
  const plan = typeof planOrKey === 'string' ? planByKey(planOrKey) : planOrKey
  const cycle = SUBSCRIPTION_CYCLES.find(item => item.key === cycleKey) || SUBSCRIPTION_CYCLES[0]
  return {
    ...cycle,
    price: plan?.pricing?.[cycle.key] ?? plan?.price ?? 0,
  }
}

// 尊者不是商品档位，不能由订阅接口购买。它只配合服务端 super_admin
// 角色使用，供受信任的开发与运营账号进行全量联调。
export const SUPER_PLAN = {
  key: 'supreme',
  icon: '◆',
  en: 'Supreme',
  name: '尊者',
  tag: '超级管理员',
  price: 0,
  credits: Infinity,
  unit: '',
  desc: '开发与运营专用的全量权限档位。',
  perks: ['全站功能无限使用', '管理控制台完整权限', '开发与测试专用'],
  benefits: ['全站功能无限使用', '管理控制台完整权限'],
}

/** 角色由服务端账号库保存，前端字段只用于展示，绝不能作为授权依据。 */
export function isSuperAdmin(user) {
  return Boolean(user && user.role === 'super_admin')
}

/** 会员是否已过期（free 档不会过期） */
export function isPlanExpired(user, now = Date.now()) {
  if (!user) return false
  if (isSuperAdmin(user)) return false
  if (!user.plan || user.plan === FREE_PLAN.key) return false
  const exp = user.planExpiresAt || 0
  return exp > 0 && exp <= now
}

/** 每日黄历提醒是凡者起的付费权益；过期用户即时失去推送资格。 */
export function canUseHuangliReminder(user, now = Date.now()) {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (isPlanExpired(user, now)) return false
  return ['earth', 'heaven', 'oracle'].includes(user.plan)
}

/* ---- 游客完全免费的功能（不消耗模型用量的本地计算/展示） ----
 * 路径与 App 路由对齐；下方所有未列出的「消耗积分」功能 → 登录 + 积分
 */
export const FREE_FEATURES = new Set([
  'bazi.chart',    // 八字盘面 + 五行 + 喜忌神
  'chenggu',       // 称骨论命
  'horoscope',     // 星座运势（基础）
  'huangli.daily', // 每日黄历查看
])

/* ---- 消耗积分的功能（key → 积分） ----
 * 客户端展示"消耗 X 积分"；扣减失败抛 { ok:false, reason }
 */
export const FEATURE_COSTS = {
  'bazi.full': 5,        // 八字完整命书（子平/盲派）
  'ziwei.full': 5,       // 紫微完整报告
  'tarot.reading': 5,    // 塔罗牌阵 AI 解读
  'qimen.reading': 5,    // 奇门 AI 解读
  'tarot.single': 2,     // 塔罗单牌 AI 解读（轻量）
  'fengshui.ai': 5,      // 风水 AI 优化建议
  'chenggu.ai': 2,       // 称骨补充解读
  'name.ai': 5,          // 姓名 AI 详批
  'horoscope.ai': 2,     // 星座深读
  'huangli.ai': 2,       // 黄历 AI 场景化建议
  // Agent 不使用这个固定值扣费；仅作“余额是否为零”的启动阈值。
  'agent.chat': 1,
}

/* ---- 非 Agent 模块的会员开放范围 ----
 *
 * 积分决定“还可用多少”，档位决定“哪些模块可用”。轻量深读保留给已登录游客，
 * 让注册赠送积分能真正用于体验；需要更完整方法论与盘面能力的模块从玄者开放。
 */
export const FEATURE_MIN_PLAN = Object.freeze({
  'bazi.full': 'free',
  'chenggu.ai': 'free',
  'horoscope.ai': 'free',
  'huangli.ai': 'free',
  'tarot.single': 'earth',
  'tarot.reading': 'heaven',
  'ziwei.full': 'heaven',
  'qimen.reading': 'heaven',
  'fengshui.ai': 'heaven',
  'name.ai': 'heaven',
  'agent.chat': 'free',
})

const PLAN_ACCESS_RANK = Object.freeze({ free: 0, earth: 1, heaven: 2, oracle: 3, supreme: 4 })

/** 随订阅周期重置的非 Agent 附赠次数；高档会员继承凡者的单牌体验额度。 */
export const PLAN_FEATURE_ALLOWANCES = Object.freeze({
  earth: Object.freeze({ 'tarot.single': 10 }),
  heaven: Object.freeze({ 'tarot.single': 10 }),
  oracle: Object.freeze({ 'tarot.single': 10 }),
  supreme: Object.freeze({ 'tarot.single': Infinity }),
})

export function requiredPlanForFeature(featureKey) {
  return FEATURE_MIN_PLAN[featureKey] || 'free'
}

/** 功能是否已由当前有效会员档位开放；尊者始终不受限制。 */
export function canUseFeature(user, featureKey, now = Date.now()) {
  if (isSuperAdmin(user)) return true
  if (!user) return false
  const currentPlan = isPlanExpired(user, now) ? FREE_PLAN.key : (user.plan || FREE_PLAN.key)
  return (PLAN_ACCESS_RANK[currentPlan] ?? 0) >= (PLAN_ACCESS_RANK[requiredPlanForFeature(featureKey)] ?? 0)
}

/** 当前月度内含次数及已用次数。服务端负责实际递增，这里仅供展示和校验。 */
export function featureAllowanceStatus(user, featureKey, now = Date.now()) {
  if (!user) return { limit: 0, used: 0, remaining: 0 }
  if (isSuperAdmin(user)) return { limit: Infinity, used: 0, remaining: Infinity }
  const currentPlan = isPlanExpired(user, now) ? FREE_PLAN.key : (user.plan || FREE_PLAN.key)
  const limit = PLAN_FEATURE_ALLOWANCES[currentPlan]?.[featureKey] || 0
  const used = Math.max(0, Number(user.monthlyFeatureUsage?.[featureKey]) || 0)
  return { limit, used, remaining: Math.max(0, limit - used) }
}

/** Agent 的积分结算策略：每次成功调用按模型 usage 换算积分后扣除。 */
export const AGENT_TOKEN_BILLING = Object.freeze({
  minimumBalance: 1,
  unit: '积分',
  tokensPerPoint: TOKENS_PER_POINT,
})

/* ---- 工具 ---- */
export function planByKey(key) {
  if (key === SUPER_PLAN.key) return SUPER_PLAN
  if (key === FREE_PLAN.key) return FREE_PLAN
  return PLANS.find(p => p.key === key) || PLANS[0]
}

/** 月度、永久与总可用积分。纯函数只用于展示；实际扣减由服务端完成。 */
export function getCreditBalance(user, now = Date.now()) {
  if (!user) return { monthly: 0, permanent: 0, total: 0 }
  if (isSuperAdmin(user)) return { monthly: Infinity, permanent: Infinity, total: Infinity }
  const plan = isPlanExpired(user, now) ? FREE_PLAN : planByKey(user.plan)
  const resetAt = user.planCreditsResetAt || 0
  const used = now >= resetAt && resetAt > 0
    ? 0
    : Math.max(0, Number(user.monthlyCreditsUsed ?? user.creditsUsed ?? 0))
  const monthly = Math.max(0, plan.credits - used)
  const permanent = Math.max(0, Number(user.permanentCredits ?? 0))
  return { monthly, permanent, total: monthly + permanent }
}

/** 用户的「本月积分余额」—— 若周期已过期，先做月度重置 */
export function getMonthlyCredits(user) {
  return getCreditBalance(user).monthly
}

/** 月度进度：已用 / 总额，0~1 */
export function getMonthlyProgress(user) {
  if (!user) return 0
  if (isSuperAdmin(user)) return 0
  const plan = isPlanExpired(user) ? FREE_PLAN : planByKey(user.plan)
  if (plan.credits <= 0) return 0
  const total = Math.max(1, plan.credits)
  const used = Math.min(plan.credits, user.monthlyCreditsUsed ?? user.creditsUsed ?? 0)
  return used / total
}

/** 是否还够积分扣减指定功能 */
export function canAfford(user, featureKey) {
  if (isSuperAdmin(user)) return true
  if (!canUseFeature(user, featureKey)) return false
  const cost = FEATURE_COSTS[featureKey]
  if (cost == null) return true // 未列入积分表 = 视为免费/已放行
  return getCreditBalance(user).total >= cost
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
  free: '游客',
  earth: '凡者',
  heaven: '玄者',
  oracle: '天者',
  supreme: '尊者',
}

/**
 * 当前档位的「下一档」——用于「积分不足，去升级」的引导。
 *
 * 此前各页面各写一遍 `plan === 'earth' ? 'heaven' : 'oracle'`：free 档不等于
 * earth，于是一个刚过期的账号会被直接推到最贵的天机境，而他本该先看到玄境。
 * 已是最高档时返回 null，调用方据此显示「已是最高档位」。
 */
export function nextPlanKey(planKey) {
  if (planKey === 'oracle' || planKey === SUPER_PLAN.key) return null
  if (planKey === 'heaven') return 'oracle'
  return planKey === 'earth' ? 'heaven' : 'earth'
}

/** 是否属于游客完全免费项 */
export function isFree(featureKey) {
  return FREE_FEATURES.has(featureKey)
}
