import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { PLANS, planByKey } from '../engine/membership.js'

function previewPaymentPayload(user, plan) {
  return `GENKI-PAYMENT-PREVIEW|user=${user.id}|plan=${plan.key}|amount=${plan.price}|period=month`
}

export default function MembershipModal({
  open,
  planKey,
  user,
  onClose,
  onRequireLogin,
  showPlanPicker = false,
}) {
  const [selectedKey, setSelectedKey] = useState(planKey || 'earth')
  const [step, setStep] = useState(showPlanPicker ? 'plans' : 'checkout')
  const [qr, setQr] = useState('')
  const plan = planByKey(selectedKey)

  useEffect(() => {
    if (!open) return
    setSelectedKey(planKey || 'earth')
    setStep(showPlanPicker ? 'plans' : 'checkout')
    const onKey = event => { if (event.key === 'Escape') onClose && onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, planKey, showPlanPicker, onClose])

  useEffect(() => {
    let active = true
    if (!open || step !== 'checkout' || !user || !plan) {
      setQr('')
      return undefined
    }
    QRCode.toDataURL(previewPaymentPayload(user, plan), {
      width: 220,
      margin: 1,
      color: { dark: '#442c35', light: '#fffdfb' },
    }).then(value => {
      if (active) setQr(value)
    }).catch(() => {
      if (active) setQr('')
    })
    return () => { active = false }
  }, [open, step, user, plan])

  if (!open || !plan) return null

  const choosePlan = key => {
    if (!user) {
      onRequireLogin && onRequireLogin('subscribe')
      return
    }
    setSelectedKey(key)
    setStep('checkout')
  }

  const picker = (
    <>
      <div className="mm-head mm-picker-head">
        <div>
          <p className="mm-kicker">MEMBERSHIP RENEWAL</p>
          <h3 className="mm-title">选择续费会员</h3>
          <p className="mm-sub">选择后进入扫码支付页</p>
        </div>
      </div>
      <div className="mm-plan-grid">
        {PLANS.map(item => {
          const active = item.key === user?.plan
          return (
            <button key={item.key} className={`mm-plan-option ${item.featured ? 'featured' : ''}`} onClick={() => choosePlan(item.key)}>
              {item.hot && <span className="mm-plan-hot">推荐</span>}
              <span className="mm-plan-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.name}</strong>
              <span>{item.tag}</span>
              <b>¥{item.price}<small>/月</small></b>
              <em>{active ? '当前会员 · 续费' : `选择${item.name}`}</em>
            </button>
          )
        })}
      </div>
      <button className="mm-text-btn" onClick={onClose}>稍后再说</button>
    </>
  )

  const checkout = (
    <>
      <div className="mm-head">
        {showPlanPicker && <button className="mm-back" onClick={() => setStep('plans')} aria-label="返回会员选择">‹</button>}
        <span className="mm-icon" aria-hidden="true">{plan.icon}</span>
        <div>
          <p className="mm-kicker">SCAN TO PAY</p>
          <h3 className="mm-title">续费 {plan.name}</h3>
          <p className="mm-sub">{plan.en} · {plan.tag}</p>
        </div>
      </div>
      {!user ? (
        <div className="mm-login-state">
          <b>登录后创建支付订单</b>
          <p>支付结果将由服务端确认，会员权益不会在付款前提前开通。</p>
          <button className="mm-btn primary" onClick={() => onRequireLogin && onRequireLogin('subscribe')}>注册 / 登录</button>
        </div>
      ) : (
        <>
          <div className="mm-payment-summary">
            <span>{plan.name}会员 · 30 天</span>
            <b>¥{plan.price}</b>
          </div>
          <div className="mm-qr-wrap">
            {qr ? <img src={qr} alt="支付二维码预览" /> : <span>二维码生成中</span>}
          </div>
          <p className="mm-payment-status"><span aria-hidden="true">●</span> 支付服务准备中</p>
          <p className="mm-payment-note">当前为支付页面预览。支付通道接入后，此处将显示服务端创建的真实支付订单二维码，并在回调确认后自动续费。</p>
        </>
      )}
      <div className="mm-actions">
        <button className="mm-btn ghost" onClick={showPlanPicker ? () => setStep('plans') : onClose}>{showPlanPicker ? '返回选择' : '关闭'}</button>
        {user && <button className="mm-btn primary" disabled>等待支付通道接入</button>}
      </div>
    </>
  )

  return createPortal(
    <div className="mm-mask" onClick={onClose}>
      <section className={`mm-card ${step === 'plans' ? 'mm-card-picker' : ''}`} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="会员续费">
        <button className="mm-close" onClick={onClose} aria-label="关闭">×</button>
        {step === 'plans' ? picker : checkout}
      </section>
    </div>,
    document.body,
  )
}
