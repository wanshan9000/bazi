import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { PLANS, POINT_PACKS, SUBSCRIPTION_CYCLES, TOKENS_PER_POINT, planByKey, subscriptionOffer } from '../engine/membership.js'

function previewPaymentPayload(user, item, kind, cycleKey = 'once') {
  return `GENKI-PAYMENT-PREVIEW|user=${user.id}|kind=${kind}|item=${item.key}|cycle=${cycleKey}|amount=${item.price}`
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
  const [selectedPack, setSelectedPack] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [step, setStep] = useState(showPlanPicker ? 'plans' : 'checkout')
  const [qr, setQr] = useState('')
  const plan = planByKey(selectedKey)
  const item = selectedPack || plan
  const buyingPack = Boolean(selectedPack)
  const offer = subscriptionOffer(plan, billingCycle)

  useEffect(() => {
    if (!open) return
    setSelectedKey(planKey || 'earth')
    setSelectedPack(null)
    setBillingCycle('monthly')
    setStep(showPlanPicker ? 'plans' : 'checkout')
    const onKey = event => { if (event.key === 'Escape') onClose && onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, planKey, showPlanPicker, onClose])

  useEffect(() => {
    let active = true
    if (!open || step !== 'checkout' || !user || !item) {
      setQr('')
      return undefined
    }
    QRCode.toDataURL(previewPaymentPayload(user, buyingPack ? item : offer, buyingPack ? 'points' : 'membership', buyingPack ? 'once' : billingCycle), {
      width: 220,
      margin: 1,
      color: { dark: '#442c35', light: '#fffdfb' },
    }).then(value => {
      if (active) setQr(value)
    }).catch(() => {
      if (active) setQr('')
    })
    return () => { active = false }
  }, [open, step, user, item, buyingPack, billingCycle, offer.price])

  if (!open || !plan) return null

  const choosePlan = key => {
    if (!user) {
      onRequireLogin && onRequireLogin('subscribe')
      return
    }
    setSelectedKey(key)
    setSelectedPack(null)
    setStep('checkout')
  }

  const choosePack = pack => {
    if (!user) {
      onRequireLogin && onRequireLogin('subscribe')
      return
    }
    setSelectedPack(pack)
    setStep('checkout')
  }

  const picker = (
    <>
      <div className="mm-head mm-picker-head">
        <div>
          <p className="mm-kicker">MEMBERSHIP RENEWAL</p>
          <h3 className="mm-title">会员与积分</h3>
          <p className="mm-sub">1 积分 = {TOKENS_PER_POINT.toLocaleString('zh-CN')} Token · 按实际用量结算</p>
        </div>
      </div>
      <div className="mm-plan-grid">
        <div className="mm-cycle-switch" role="group" aria-label="会员订阅周期">
          {SUBSCRIPTION_CYCLES.map(cycle => (
            <button key={cycle.key} type="button" className={billingCycle === cycle.key ? 'active' : ''} onClick={() => setBillingCycle(cycle.key)}>
              <b>{cycle.label}</b><span>{cycle.badge}</span>
            </button>
          ))}
        </div>
        {PLANS.map(item => {
          const active = item.key === user?.plan
          const itemOffer = subscriptionOffer(item, billingCycle)
          return (
            <button key={item.key} className={`mm-plan-option ${item.featured ? 'featured' : ''}`} onClick={() => choosePlan(item.key)}>
              {item.hot && <span className="mm-plan-hot">推荐</span>}
              <span className="mm-plan-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.name}</strong>
              <span>{item.tag}</span>
              <b>¥{itemOffer.price}<small>/{itemOffer.label}</small></b>
              <em>{item.credits.toLocaleString('zh-CN')} 积分/月 · 当月有效</em>
              <i>{active ? '当前会员 · 续费' : `选择${item.name}`}</i>
            </button>
          )
        })}
      </div>
      <div className="mm-points-head">
        <div>
          <b>永久积分包</b>
          <span>不随会员到期清零</span>
        </div>
      </div>
      <div className="mm-points-grid">
        {POINT_PACKS.map(pack => (
          <button key={pack.key} className={`mm-points-option ${pack.featured ? 'featured' : ''}`} onClick={() => choosePack(pack)}>
            {pack.featured && <span className="mm-plan-hot">推荐</span>}
            <strong>{pack.name}</strong>
            <b>{pack.credits.toLocaleString('zh-CN')} 积分</b>
            <span>{pack.hint}</span>
            <em>¥{pack.price} · 永久有效</em>
          </button>
        ))}
      </div>
      <button className="mm-text-btn" onClick={onClose}>稍后再说</button>
    </>
  )

  const checkout = (
    <>
      <div className="mm-head">
        {showPlanPicker && <button className="mm-back" onClick={() => setStep('plans')} aria-label="返回会员选择">‹</button>}
        <span className="mm-icon" aria-hidden="true">{buyingPack ? '✦' : plan.icon}</span>
        <div>
          <p className="mm-kicker">SCAN TO PAY</p>
          <h3 className="mm-title">{buyingPack ? `购买 ${item.name}` : `续费 ${plan.name}`}</h3>
          <p className="mm-sub">{buyingPack ? `${item.credits.toLocaleString('zh-CN')} 永久积分` : `${plan.en} · ${offer.label} · ${offer.badge}`}</p>
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
            <span>{buyingPack ? `${item.credits.toLocaleString('zh-CN')} 永久积分 · 永久有效` : `${plan.name}会员 · ${offer.months} 个月 · 月度积分按月发放`}</span>
            <b>¥{buyingPack ? item.price : offer.price}</b>
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
      <section className={`mm-card ${step === 'plans' ? 'mm-card-picker' : ''}`} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="会员与点数购买">
        <button className="mm-close" onClick={onClose} aria-label="关闭">×</button>
        {step === 'plans' ? picker : checkout}
      </section>
    </div>,
    document.body,
  )
}
