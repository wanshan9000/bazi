import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { campaignUrl, trackEvent } from '../utils/analytics.js'
import { claimShareReward } from '../utils/growth.js'
import { localize, useLocale } from '../i18n.jsx'

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'))
}

// 八字报告只分享知识页入口：不携带用户勾选项、出生资料、地点或完整命盘。
export default function ChartSummaryShare({ compact = false }) {
  const { locale } = useLocale()
  const l = (zh, en, tw) => localize(locale, zh, en, tw)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState('idle')
  const [qr, setQr] = useState('')
  const link = campaignUrl('/learn/bazi-basics', { source: 'chart_share', campaign: 'bazi_summary', content: locale === 'en' ? 'en' : 'zh' })
  const linkLabel = link.replace(/([?#]).*$/, '…')

  useEffect(() => {
    let active = true
    if (!open) return () => { active = false }
    QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: '#3d2b47', light: '#ffffff' } })
      .then(code => { if (active) setQr(code) })
      .catch(() => { if (active) setQr('') })
    return () => { active = false }
  }, [link, open])

  const reveal = () => {
    setOpen(true)
    trackEvent('chart_summary_share_opened', { page: 'bazi', locale })
  }
  const copyShareLink = async () => {
    try {
      await copyText(link)
      await claimShareReward('chart_summary')
      trackEvent('chart_summary_link_copied', { page: 'bazi', locale })
      setState('copied')
    } catch {
      setState('failed')
      window.setTimeout(() => setState('idle'), 1800)
    }
  }

  const modal = open ? <div className="report-share-modal" role="presentation">
    <button type="button" className="report-share-backdrop" onClick={() => setOpen(false)} aria-label={l('关闭分享弹窗', 'Close share dialog')} />
    <section className="report-share-dialog" role="dialog" aria-modal="true" aria-label={l('分享八字入门', 'Share BaZi basics')}>
      <button type="button" className="report-share-close" onClick={() => setOpen(false)} aria-label={l('关闭分享弹窗', 'Close share dialog')}>×</button>
      <h2>{l('扫码分享八字入门', 'Scan to share BaZi basics')}</h2>
      <p className="report-share-subtitle">{l('分享给朋友，一起了解八字基础', 'Share a BaZi introduction with a friend')}</p>
      <div className="report-share-qr" aria-label={l('分享二维码', 'Share QR code')}>
        {qr ? <img src={qr} alt={l('八字入门分享二维码', 'BaZi basics share QR code')} /> : <span>{l('正在生成二维码…', 'Generating QR code…')}</span>}
      </div>
      <p className="report-share-hint">{l('手机扫码，即可打开八字入门', 'Scan with your phone to open BaZi basics')}</p>
      <p className="report-share-privacy">{l('此分享不会包含你的出生资料、命盘或报告内容。', 'This share never includes your birth details, chart, or report content.')}</p>
      <div className="report-share-link">
        <span title={link}>{linkLabel}</span>
        <button type="button" onClick={copyShareLink}>{state === 'copied' ? l('已复制', 'Copied') : state === 'failed' ? l('重试', 'Retry') : l('复制链接', 'Copy link')}</button>
      </div>
    </section>
  </div> : null

  const trigger = <section className={`chart-summary-share ${compact ? 'chart-summary-share-compact' : ''}`} aria-label={l('分享八字入门', 'Share BaZi basics')}>
    <button type="button" className="report-agent-share" onClick={reveal}><span aria-hidden="true">↗</span> {l('分享', 'Share')}</button>
  </section>
  return <>{trigger}{modal && (typeof document === 'undefined' ? modal : createPortal(modal, document.body))}</>
}
