/* ============ 积分不足 · 升级提示卡 ============
 *
 * 适用于：八字/紫微完整命书、塔罗/奇门 AI 解读、元氣 AI 等扣减积分场景
 * 触发条件：登录用户，但本月积分不足
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
  onUpgrade,
  onClose,
}) {
  return (
    <div className="report-lock rise" role="note">
      <div className="rl-glow" aria-hidden="true" />
      <div className="rl-body">
        <div className="rl-icon" aria-hidden="true">✦</div>
        <div className="rl-text">
          <p className="rl-eyebrow">{planLabel}积分不足</p>
          <h4 className="rl-title">
            {featureName} · 本月需消耗 {cost} 积分
            <span className="rl-count">当前余额 {remaining}</span>
          </h4>
          <p className="rl-desc">
            完整命书与 AI 解读会按消耗扣减本月积分；升级到「玄者」或「天者」可获得更多额度，解锁全部功能。
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
