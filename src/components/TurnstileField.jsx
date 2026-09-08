import { useEffect, useRef, useState } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const SCRIPT_ID = 'cf-turnstile-script'

/** Cloudflare Turnstile 的极薄适配层。未配置 site key 时不渲染，便于本地开发。 */
export default function TurnstileField({ onToken, onError }) {
  const nodeRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!SITE_KEY || !nodeRef.current) return undefined
    let widgetId = null
    let stopped = false
    const render = () => {
      if (stopped || !window.turnstile || !nodeRef.current) return
      widgetId = window.turnstile.render(nodeRef.current, {
        sitekey: SITE_KEY,
        theme: 'light',
        callback: token => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => { onToken(''); onError?.('人机验证加载失败，请刷新后重试') },
      })
      setReady(true)
    }
    const existing = document.getElementById(SCRIPT_ID)
    if (window.turnstile) render()
    else if (existing) existing.addEventListener('load', render, { once: true })
    else {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.addEventListener('load', render, { once: true })
      script.addEventListener('error', () => onError?.('人机验证加载失败，请检查网络'), { once: true })
      document.head.appendChild(script)
    }
    return () => {
      stopped = true
      if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onError, onToken])

  if (!SITE_KEY) return null
  return <div className={`turnstile-field ${ready ? 'ready' : ''}`} ref={nodeRef} aria-label="人机验证" />
}
