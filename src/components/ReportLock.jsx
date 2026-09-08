// 完整报告 / 会员权益解锁引导卡
// 未登录时展示：告知游客「已生成的完整内容需要注册/登录解锁」，点击跳注册（扫码注册优先，成功即自动登录并返回原页）
import React from 'react'

export default function ReportLock({
  user,
  onRequireLogin,
  backView = 'bazi',
  icon = '🔐',
  eyebrow = '',
  title = '完整报告已就绪 · 登录后解锁全文',
  desc = '基础盘面已为你免费排定，逐项详解与深度精批见登录后全文。',
  note = '注册/登录后即可继续使用 · 扫码识别一步注册，成功即自动登录',
  lockedCount = 0,
}) {
  if (user) return null

  return (
    <div className="report-lock rise" role="note">
      <div className="rl-glow" aria-hidden="true" />
      <div className="rl-body">
        <div className="rl-icon" aria-hidden="true">{icon}</div>
        <div className="rl-text">
          {eyebrow && <p className="rl-eyebrow">{eyebrow}</p>}
          <h4 className="rl-title">
            {title}
            {lockedCount > 0 && <span className="rl-count">另有 {lockedCount} 章详解待解锁</span>}
          </h4>
          <p className="rl-desc">{desc}</p>
        </div>
        <div className="rl-actions">
          <button className="rl-btn" onClick={() => onRequireLogin && onRequireLogin(backView)}>
            注册 / 登录解锁
          </button>
          <p className="rl-note">{note}</p>
        </div>
      </div>
    </div>
  )
}
