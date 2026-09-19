import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { campaignUrl, trackEvent } from '../utils/analytics.js'
import { claimShareReward } from '../utils/growth.js'
import { localize, useLocale } from '../i18n.jsx'
import ShareRewardHint from './ShareRewardHint.jsx'

// /api/agent/chat 的服务端上限是 2000 字。报告页要带足够的关键信息进入对话，
// 也不能因一份长报告让用户一点击就收到报错；预留 100 字给后续协议字段。
export const REPORT_AGENT_PROMPT_LIMIT = 1900

function normalText(value) {
  return String(value || '').replace(/\n{3,}/g, '\n\n').trim()
}

function compactText(value, limit) {
  const text = normalText(value)
  if (text.length <= limit) return text
  const marker = '\n\n……（报告较长，已保留开头与结论；可继续指定模块追问）……\n\n'
  const available = Math.max(0, limit - marker.length)
  const headLength = Math.ceil(available * 0.68)
  const tailLength = available - headLength
  return `${text.slice(0, headLength).trimEnd()}${marker}${text.slice(-tailLength).trimStart()}`
}

export function buildReportAgentPrompt({ reportName, facts = [], report = null }) {
  const name = compactText(normalText(reportName) || '当前', 32)
  const header = [
    `报告咨询：${name}`,
    `我正在阅读${name}报告。请只围绕以下当前报告资料回答我的后续问题；若资料中没有，请先说明并向我确认，不要把推测当作页面结论。`,
  ].join('\n')
  const factsText = compactText(facts.filter(Boolean).map(item => `- ${normalText(item)}`).join('\n'), 520)
  const factsBlock = factsText ? `已知资料：\n${factsText}` : ''
  const reportHeading = '当前报告摘要：\n'
  const reportBudget = Math.max(260, REPORT_AGENT_PROMPT_LIMIT - header.length - (factsBlock ? factsBlock.length + 2 : 0) - reportHeading.length - 2)
  const reportText = compactText(report?.markdown, reportBudget)
  const reportBlock = reportText ? `${reportHeading}${reportText}` : ''

  return [header, factsBlock, reportBlock].filter(Boolean).join('\n\n').slice(0, REPORT_AGENT_PROMPT_LIMIT)
}

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

export default function ReportAgentFooter({ onAskAgent, share = null }) {
  const { locale } = useLocale()
  const l = (zh, en, tw) => localize(locale, zh, en, tw)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareState, setShareState] = useState('idle')
  const [shareQr, setShareQr] = useState('')
  const shareUrl = campaignUrl('/', { source: 'report_share', campaign: 'report_actions', content: locale === 'en' ? 'en' : 'zh' })
  const shareUrlLabel = shareUrl.replace(/([?#]).*$/, '…')
  const shareText = l('我在元氣满满探索传统文化工具。', 'I am exploring traditional culture tools with Genki.')
  useEffect(() => {
    let active = true
    if (!shareOpen) return () => { active = false }
    QRCode.toDataURL(shareUrl, { width: 320, margin: 1, color: { dark: '#3d2b47', light: '#ffffff' } })
      .then(code => { if (active) setShareQr(code) })
      .catch(() => { if (active) setShareQr('') })
    return () => { active = false }
  }, [shareOpen, shareUrl])

  const copyShareLink = async () => {
    try {
      await copyText(`${shareText}\n${shareUrl}`)
      await claimShareReward('report')
      trackEvent('report_share_link_copied', { locale })
      setShareState('copied')
    } catch (error) {
      setShareState('failed')
    }
  }
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const genericShareModal = shareOpen ? <div className="report-share-modal" role="presentation">
    <button type="button" className="report-share-backdrop" onClick={() => setShareOpen(false)} aria-label={l('关闭分享弹窗', 'Close share dialog')} />
    <section className="report-share-dialog" role="dialog" aria-modal="true" aria-label={l('分享元氣满满', 'Share Genki')}>
      <button type="button" className="report-share-close" onClick={() => setShareOpen(false)} aria-label={l('关闭分享弹窗', 'Close share dialog')}>×</button>
      <h2>{l('扫码分享元氣满满', 'Scan to share Genki')}</h2>
      <p className="report-share-subtitle">{l('分享给朋友，一起探索传统文化工具', 'Share a traditional culture tool with a friend')}</p>
      <div className="report-share-qr" aria-label={l('分享二维码', 'Share QR code')}>
        {shareQr ? <img src={shareQr} alt={l('元氣满满分享二维码', 'Genki share QR code')} /> : <span>{l('正在生成二维码…', 'Generating QR code…')}</span>}
      </div>
      <p className="report-share-hint">{l('手机扫码，即可打开元氣满满', 'Scan with your phone to open Genki')}</p>
      <p className="report-share-privacy">{l('此分享不会包含你的出生资料、命盘或报告内容。', 'This share never includes your birth details, chart, or report content.')}</p>
      <div className="report-share-link">
        <span title={shareUrl}>{shareUrlLabel}</span>
        <button type="button" onClick={copyShareLink}>{shareState === 'copied' ? l('已复制', 'Copied') : shareState === 'failed' ? l('重试', 'Retry') : l('复制链接', 'Copy link')}</button>
      </div>
    </section>
  </div> : null
  return (
    <>
      <div className="report-agent-footer-zone">
      <section className="report-agent-footer has-share" aria-label={l('报告页操作', 'Report actions')}>
        {share || <button type="button" className="report-agent-share" onClick={() => setShareOpen(true)}><span aria-hidden="true">↗</span> {l('分享', 'Share')}</button>}
        <button type="button" className="report-agent-ask" onClick={onAskAgent}>
          ✦ {l('问元气 AI', 'Ask Genki AI')}
        </button>
        <button type="button" className="report-agent-home" onClick={scrollToTop}>
          {l('回到顶部', 'Back to top', '回到頂部')}
        </button>
      </section>
      <ShareRewardHint compact />
      </div>
      {genericShareModal && (typeof document === 'undefined' ? genericShareModal : createPortal(genericShareModal, document.body))}
    </>
  )
}
