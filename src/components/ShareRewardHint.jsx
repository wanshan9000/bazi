import { localize, useLocale } from '../i18n.jsx'

// 全站统一口径：奖励只在服务端确认有效分享后发放，且进入永久积分钱包。
export default function ShareRewardHint({ compact = false, className = '' }) {
  const { locale } = useLocale()
  const l = (zh, en, tw) => localize(locale, zh, en, tw)
  return (
    <p className={`share-reward-hint${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}>
      <span aria-hidden="true">✦</span>
      {l('完成有效分享，获 24 永久积分，可抵扣元氣 AI 与积分功能。', 'Complete a valid share to earn 24 permanent credits for Genki AI and credit features.', '完成有效分享，獲 24 永久積分，可抵扣元氣 AI 與積分功能。')}
    </p>
  )
}
