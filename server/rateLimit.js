/**
 * 轻量的进程内来源限流器。它不是 DDoS 防护的替代品（生产仍应由 Caddy/CDN
 * 吸收大流量），但能在请求进入业务逻辑前拦住脚本滥用和低成本爆破。
 */
export function createWindowLimiter({ windowMs, max }) {
  const hits = new Map()

  function sweep(now) {
    for (const [key, item] of hits) if (item.resetAt <= now) hits.delete(key)
  }

  return {
    take(key, now = Date.now()) {
      sweep(now)
      const item = hits.get(key)
      if (!item || item.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return { ok: true, remaining: max - 1, resetAt: now + windowMs }
      }
      if (item.count >= max) return { ok: false, remaining: 0, resetAt: item.resetAt }
      item.count++
      return { ok: true, remaining: max - item.count, resetAt: item.resetAt }
    },
  }
}

export function ipRateLimit({ windowMs, max, message = '请求过于频繁，请稍后再试' }) {
  const limiter = createWindowLimiter({ windowMs, max })
  return (req, res, next) => {
    const result = limiter.take(req.ip || 'unknown')
    if (result.ok) return next()
    res.setHeader('Retry-After', Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)))
    return res.status(429).json({ ok: false, msg: message })
  }
}
