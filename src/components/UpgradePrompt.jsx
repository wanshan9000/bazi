/* ============ 积分不足 · 升级提示卡 ============
 *
 * 适用于：八字/紫微完整命书、塔罗/奇门 AI 解读、元氣 AI 等扣减积分场景
 * 触发条件：登录用户，但可用积分余额不足
 *
 * 行为：给用户清晰展示当前消耗 / 余额，并提供两条路径
 *   - 「升级方案」 → 打开订阅 Modal（更高额度）
 *   - 「稍后再说」 → 关闭弹窗回到原页面
 */
import React from 'react'
import { planByKey } from '../engine/membership.js'

export default function UpgradePrompt({
  featureName = '此项内容',
  cost = 0,
  remaining = 0,
  planLabel = '',
  lockedByPlan = false,
  requiredPlanLabel = '',
  onUpgrade,
  onClose,
}) {
  return (
    <div className="report-lock rise" role="note">
      <div className="rl-glow" aria-hidden="true" />
      <div className="rl-body">
        <div className="rl-icon" aria-hidden="true">✦</div>
        <div className="rl-text">
          <p className="rl-eyebrow">{lockedByPlan ? `${planLabel}暂未开放` : `${planLabel}积分不足`}</p>
          <h4 className="rl-title">
            {lockedByPlan ? `${featureName} · ${requiredPlanLabel}及以上可用` : `${featureName} · 需消耗 ${Number(cost).toLocaleString('zh-CN')} 积分`}
            {!lockedByPlan && <span className="rl-count">当前余额 {Number(remaining).toLocaleString('zh-CN')}</span>}
          </h4>
          <p className="rl-desc">
            {lockedByPlan
              ? `开通${requiredPlanLabel}后，即可使用积分解锁这项完整解读。`
              : '元气 Agent 按实际用量结算，其他 AI 解读按对应积分扣除；优先使用当月额度。'}
          </p>
        </div>
        <div className="rl-actions">
          {onClose && (
            <button className="rl-btn ghost" onClick={onClose}>稍后再说</button>
          )}
          {onUpgrade && (
            <button className="rl-btn" onClick={onUpgrade}>查看升级方案</button>
          )}
        </div>
      </div>
    </div>
  )
}
