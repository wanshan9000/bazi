import { config, emailConfigured } from './config.js'

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char])
}

export async function sendPasswordResetEmail(email, code) {
  if (!emailConfigured()) throw new Error('邮箱服务尚未配置')
  const safeCode = escapeHtml(code)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.email.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.email.from,
      to: [email],
      subject: '元氣满满 - 重设密码验证码',
      text: `你的重设密码验证码是 ${code}，${config.email.resetCodeTtlMin} 分钟内有效。若非本人操作，请忽略此邮件。`,
      html: `<div style="max-width:480px;margin:0 auto;padding:28px 24px;font-family:serif;color:#382c29"><h2 style="margin:0 0 16px">重设元氣满满密码</h2><p>你的验证码是：</p><p style="margin:18px 0;padding:15px;background:#fbf5ed;border-radius:6px;font-size:28px;letter-spacing:6px;font-weight:700;text-align:center">${safeCode}</p><p style="font-size:14px;color:#76655f">验证码 ${config.email.resetCodeTtlMin} 分钟内有效。若非本人操作，请忽略此邮件。</p></div>`,
    }),
  })
  if (!response.ok) throw new Error(`邮件服务请求失败 (${response.status})`)
}
