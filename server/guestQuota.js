// 游客免费额度的服务端记账。
//
// 为什么必须在服务端：游客额度原本只存在浏览器 localStorage 里，而游客标识
// （`anon:<设备id>`）是客户端自报的 —— 清一次站点数据就同时重置了免费额度和
// 按 uid 的限流桶，剩下唯一的闸门是按 IP 的每分钟限流。实测拿一个全新的 anon
// 标识可以直接调用付费模型，账单照记。等于任何人都能无限白嫖。
//
// 记账维度取**来源 IP**，不取自报的游客标识 —— 后者改一下就是新身份，记了也白记。
// 前提是 server/index.js 设了 trust proxy，否则经 Caddy 之后 req.ip 恒为 127.0.0.1，
// 全站会共用一个 30 天体验桶，反而比没有限制更糟。
//
// 已登录用户不走这里：他们按账号扣积分，额度在 accounts.js。
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

const MONTH_MS = 30 * 86400000

/** 每 IP 每 30 天的免费 Token 上限（约 ¥5 的 DeepSeek Flash 体验额度）。 */
export const GUEST_MONTHLY_TOKENS = config.guest.monthlyTokens

/**
 * 一轮对话在拿到真实 usage 之前先预扣的量。
 *
 * 不预扣的话，额度只在**回复结束后**才增加，几十个并发请求会在同一瞬间全部
 * 通过检查（经典的 check-then-act 竞态）。预扣一个保守估计值，拿到真实用量再校正。
 */
export const PREPAID_TOKENS = 1500

export function createGuestQuota(file, { monthlyLimit = GUEST_MONTHLY_TOKENS, dailyLimit } = {}) {
  // dailyLimit 只为旧测试/内部调用兼容；生产配置统一使用 monthlyLimit。
  const limit = Number.isFinite(dailyLimit) ? dailyLimit : monthlyLimit
  let cache = null
  let dirty = false

  function load() {
    if (cache) return cache
    try {
      if (file && fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
        cache = parsed && typeof parsed === 'object' ? parsed : {}
      } else {
        cache = {}
      }
    } catch {
      // 这份数据丢了最多是游客额度重置一次，不值得为它中断服务
      cache = {}
    }
    return cache
  }

  function save() {
    if (!file || !dirty) return
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = `${file}.tmp-${process.pid}`
      fs.writeFileSync(tmp, JSON.stringify(cache))
      fs.renameSync(tmp, file)
      dirty = false
    } catch (e) {
      console.error('[guestQuota] 写入失败', e.message)
    }
  }

  /** 清掉过期条目。不做的话这张表会随访客 IP 无界增长。 */
  function sweep(now) {
    for (const [k, v] of Object.entries(cache)) {
      if (!v || v.resetAt <= now) delete cache[k]
    }
  }

  function entry(ip, now) {
    const db = load()
    const cur = db[ip]
    if (!cur || cur.resetAt <= now) {
      // 从首次使用起算 30 天，而非自然月，避免所有访客在同一时刻重置。
      db[ip] = { used: 0, resetAt: now + MONTH_MS }
    }
    return db[ip]
  }

  return {
    /** 还剩多少 token */
    remaining(ip, now = Date.now()) {
      return Math.max(0, limit - entry(ip, now).used)
    },

    /**
     * 这一轮能不能开始。可以则预扣 PREPAID_TOKENS 并返回 { ok:true }，
     * 不可以则返回 { ok:false, remaining, resetAt }。
     */
    begin(ip, now = Date.now()) {
      const e = entry(ip, now)
      if (e.used >= limit) {
        return { ok: false, remaining: 0, resetAt: e.resetAt }
      }
      e.used += PREPAID_TOKENS
      dirty = true
      sweep(now)
      save()
      return { ok: true, remaining: Math.max(0, limit - e.used), resetAt: e.resetAt }
    },

    /**
     * 这一轮结束，用真实用量校正预扣。
     * @param actualTokens 模型回报的 totalTokens；拿不到就传 0（预扣照算，宁可多算不少算）
     */
    settle(ip, actualTokens, now = Date.now()) {
      const e = entry(ip, now)
      const actual = Number(actualTokens) > 0 ? Number(actualTokens) : 0
      // 把预扣换成真实值；真实值为 0（没跑起来）时等于把预扣退回去
      e.used = Math.max(0, e.used - PREPAID_TOKENS + actual)
      dirty = true
      save()
      return e.used
    },

    /** 测试用 */
    _dump: () => load(),
    _reset: () => { cache = null; dirty = false },
  }
}

let shared = null
export function sharedGuestQuota(file) {
  if (!shared) shared = createGuestQuota(file || config.guest.quotaFile)
  return shared
}
