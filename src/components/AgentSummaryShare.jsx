import { useState } from 'react'
import { campaignUrl, trackEvent } from '../utils/analytics.js'
import { claimShareReward } from '../utils/growth.js'
import ShareRewardHint from './ShareRewardHint.jsx'

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

// 对话原文可能包含私密资料，因此 AI 分享始终只发送用户主动选择的通用文案。
export default function AgentSummaryShare({ locale = 'zh-CN' }) {
  const english = locale === 'en'
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState('')
  const [state, setState] = useState('idle')
  const choices = english
    ? [
        ['culture', 'I explored a traditional Chinese culture question with Genki AI.'],
        ['reflection', 'I used Genki AI to organize a question for reflection.'],
      ]
    : [
        ['culture', '我用元氣 AI 了解了一个传统文化问题。'],
        ['reflection', '我用元氣 AI 梳理了一个值得思考的问题。'],
      ]
  const selectedText = choices.find(([id]) => id === choice)?.[1] || ''
  const link = campaignUrl('/ai-bazi', { source: 'agent_share', campaign: 'agent_summary', content: english ? 'en' : 'zh' })
  const title = english ? 'A Genki AI reflection' : '我的元氣 AI 小结'

  const complete = (event, nextState) => {
    trackEvent(event, { page: 'ai-bazi', locale })
    setState(nextState)
    window.setTimeout(() => setState('idle'), 1800)
  }
  const reveal = () => {
    setOpen(true)
    trackEvent('agent_summary_share_opened', { page: 'ai-bazi', locale })
  }
  const share = async () => {
    if (!selectedText) return
    if (navigator.share) {
      try {
        await navigator.share({ title, text: selectedText, url: link })
        await claimShareReward('agent_summary')
        complete('agent_summary_share_completed', 'shared')
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }
    try {
      await copyText(`${selectedText}\n${link}`)
      await claimShareReward('agent_summary')
      complete('agent_summary_link_copied', 'copied')
    } catch {
      setState('failed')
      window.setTimeout(() => setState('idle'), 1800)
    }
  }

  return (
    <section className={`agent-summary-share${open ? ' is-open' : ''}`} aria-label={english ? 'Create a private-safe share summary' : '创建私密分享摘要'}>
      <div className="agent-summary-share-intro">
        <div><span>GENKI AI</span><b>{english ? 'Share a private-safe takeaway' : '分享一条不含隐私的小结'}</b></div>
        {!open && <button type="button" onClick={reveal}>{english ? 'Choose and share' : '选择后分享'} <span aria-hidden="true">↗</span></button>}
      </div>
      {!open ? <><p>{english ? 'Your chat, birth details and chart are never included.' : '不会包含对话原文、出生资料、地点或完整命盘。'}</p><ShareRewardHint compact /></> : (
        <>
          <fieldset>
            <legend>{english ? 'Choose one shareable sentence' : '选择一条可公开的小结'}</legend>
            {choices.map(([id, text]) => <label key={id}><input type="radio" name="agent-share-summary" value={id} checked={choice === id} onChange={() => setChoice(id)} /><span>{text}</span></label>)}
          </fieldset>
          <button type="button" onClick={share} disabled={!choice}>{state === 'shared' ? (english ? 'Shared' : '已唤起分享') : state === 'copied' ? (english ? 'Copied' : '文案已复制') : state === 'failed' ? (english ? 'Try again' : '复制失败，请重试') : (english ? 'Share selected summary' : '分享已选小结')}</button>
        </>
      )}
    </section>
  )
}
