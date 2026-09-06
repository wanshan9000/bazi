/* ============ 订阅 / 升级 Modal ============
 *
 * 由 App.jsx 在全局维护 subscribeModal 状态。
 * 触发方式：
 *   - Landing 定价卡「从凡境开始 / 跃升玄境 / 问鼎天机」按钮
 *   - Profile 升级按钮
 *   - ReportLock 等扣减积分不足时的「升级」入口
 *
 * 行为：
 *   - 未登录 → 提示先注册/登录（由 onRequireLogin 接管，回到原来逻辑）
 *   - 已登录 → 展示档位详情 + 模拟支付确认 → changePlan
 *
 * 这是演示项目：点击「确认支付」直接调用 users.js#changePlan 切换档位并重置积分。
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PLANS, planByKey } from '../engine/membership.js'
import { changePlan } from '../data/users.js'

export default function MembershipModal({
  open,
  planKey,
  user,
  onClose,
  onSuccess,
  onRequireLogin,
}) {
  const plan = planKey ? planByKey(planKey) : null
  const currentPlan = user ? planByKey(user.plan) : null
  const isCurrent = !!(plan && user && user.plan === plan.key)
  const isDowngrade = !!(user && plan && currentPlan && (
    (currentPlan.key === 'oracle' && plan.key !== 'oracle') ||
    (currentPlan.key === 'heaven' && plan.key === 'earth')
  ))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setBusy(false)
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  if (!plan) return null

  const handleConfirm = async () => {
    if (!user) {
      onRequireLogin && onRequireLogin('subscribe')
      return
    }
    // 同档位 = 续费，不是「什么都不做」。此前这里直接关窗，导致 planExpiresAt
    // 永远无法延长，个人中心写着「到期前可手动续费」却根本没有能续上的入口。
    setBusy(true)
    setErr('')
    // 模拟支付：直接调用 changePlan（演示项目）
    const res = await changePlan(user.id, plan.key)
    setBusy(false)
    if (!res.ok) {
      setErr(res.msg || '订阅失败，请稍后再试')
      return
    }
    onSuccess && onSuccess(res.user, res.plan)
    onClose && onClose()
  }

  return createPortal(
    <div className="mm-mask" onClick={onClose}>
      <div className="mm-card rise" onClick={e => e.stopPropagation()} role="dialog" aria-label="订阅会员">
        <button className="mm-close" onClick={onClose} aria-label="关闭">×</button>

        <div className="mm-head">
          <span className="mm-icon" aria-hidden="true">{plan.icon}</span>
          <div>
            <h3 className="mm-title">{plan.name} · 会员</h3>
            <p className="mm-sub">{plan.en} · {plan.tag}</p>
          </div>
        </div>

        <div className="mm-price">
          <span className="num">¥{plan.price}</span>
          <span className="unit">{plan.unit || '/月'}</span>
        </div>

        <p className="mm-desc">{plan.desc}</p>

        <div className="mm-credits">
          <span className="mm-credits-num">{plan.credits}</span>
          <span className="mm-credits-lbl">积分 / 月 · 完整命书 · AI 对话按需消耗</span>
        </div>

        <ul className="mm-perks">
          {plan.perks.map(p => <li key={p}>✓ {p}</li>)}
        </ul>

        {!user && (
          <p className="mm-tip">订阅属于会员权益 · 请先注册/登录（注册即默认开通凡境 200 积分体验）</p>
        )}
        {user && isCurrent && (
          <p className="mm-tip">续费「{plan.name}」：有效期在当前到期时间之上顺延 30 天，积分用量即刻清零。</p>
        )}
        {user && !isCurrent && (
          <p className="mm-tip">
            {isDowngrade
              // 文案要与 changePlan 的实际行为一致：它是立即切档并清零积分用量，
              // 并没有「下一个周期才生效」这回事。
              ? `降级至「${plan.name}」立即生效：额度调整为 ${plan.credits} 积分，本周期已用量清零。`
              : `升级至「${plan.name}」立即生效：积分用量清零并续期 30 天。`}
          </p>
        )}

        {err && <p className="mm-err">{err}</p>}

        <div className="mm-actions">
          <button className="mm-btn ghost" onClick={onClose}>稍后再说</button>
          <button
            className={`mm-btn ${plan.featured ? 'primary' : ''}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? '处理中…'
              : !user ? '注册 / 登录'
              : isCurrent ? '续费 30 天（模拟支付）'
              : '确认订阅（模拟支付）'}
          </button>
        </div>

        <p className="mm-foot">本页面为演示实现 · 点击确认即代表同意《会员服务协议》（占位）</p>
      </div>
    </div>,
    document.body
  )
}