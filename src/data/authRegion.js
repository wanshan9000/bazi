// 登录方式由设备时区自动分流。浏览器语言不可靠：海外华人也常用简体中文。
export function isMainlandChina() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Shanghai'
  } catch {
    return false
  }
}
