// server/data/ 的定期快照。
//
// 之前这里什么都没有。原子写只保证「不会写出半截文件」，它防不了误删、防不了
// 磁盘故障、更防不了一次手滑的 rm。订阅者手机号、账号口令散列、AI 会话全在
// 那几个 JSON 里，丢了就是丢了。
//
// 做法刻意简单：定期把每个数据文件复制一份带时间戳的副本，只保留最近 N 份。
// 不做增量、不做压缩 —— 这些文件是 KB~MB 量级，简单到不会自己出故障更重要。
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

/** 需要快照的数据文件（不存在的会被跳过） */
export function backupTargets() {
  return [
    config.storeFile,                    // 订阅、验证码、分享、管理技能
    config.auth.accountsFile,            // 账号（含口令散列）
    process.env.AGENT_STORE_FILE || path.join(path.dirname(config.storeFile), 'agent_sessions.json'),
  ]
}

function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/**
 * 做一次快照。返回 { copied, skipped, errors }。
 *
 * 只快照能解析成 JSON 的文件：源文件已经损坏时再存一份没有意义，
 * 反而会把仅存的几个好副本挤出保留窗口。
 */
export function runBackup({ dir = config.backup.dir, keep = config.backup.keep, targets = backupTargets(), now = new Date() } = {}) {
  const out = { copied: [], skipped: [], errors: [] }
  try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }) }
  catch (e) { out.errors.push(`创建备份目录失败：${e.message}`); return out }

  const tag = stamp(now)
  for (const file of targets) {
    const base = path.basename(file, '.json')
    let raw
    try {
      if (!fs.existsSync(file)) { out.skipped.push(`${base}（文件不存在）`); continue }
      raw = fs.readFileSync(file, 'utf-8')
      JSON.parse(raw)
    } catch (e) {
      out.skipped.push(`${base}（源文件不可读或已损坏：${e.message}）`)
      continue
    }
    const dest = path.join(dir, `${base}.${tag}.json`)
    try {
      // 账号库含口令散列，副本同样限制权限
      fs.writeFileSync(dest, raw, { mode: 0o600 })
      out.copied.push(path.basename(dest))
    } catch (e) {
      out.errors.push(`${base}：${e.message}`)
      continue
    }
    // 轮转：同一个源文件只留最近 keep 份
    try {
      const olds = fs.readdirSync(dir)
        .filter(f => f.startsWith(`${base}.`) && f.endsWith('.json'))
        .sort() // 文件名里的时间戳是定长且字典序即时间序
      for (const f of olds.slice(0, Math.max(0, olds.length - keep))) {
        fs.rmSync(path.join(dir, f), { force: true })
      }
    } catch (e) {
      out.errors.push(`轮转 ${base} 失败：${e.message}`)
    }
  }
  return out
}

let timer = null

/** 启动定期快照。intervalHours=0 表示关闭。 */
export function startBackups() {
  const hours = config.backup.intervalHours
  if (!hours || hours <= 0) {
    console.log('  数据备份: 已关闭（BACKUP_INTERVAL_HOURS=0）')
    return null
  }
  const tick = () => {
    try {
      const r = runBackup()
      if (r.copied.length) console.log(`[backup] 已快照 ${r.copied.length} 个数据文件`)
      for (const e of r.errors) console.error(`[backup] ${e}`)
    } catch (e) {
      console.error('[backup] 快照失败', e)
    }
  }
  tick() // 启动即备一份：等 24 小时才有第一份副本，等于头一天完全裸奔
  timer = setInterval(tick, hours * 3600 * 1000)
  // 不要因为这个定时器把进程钉住（测试、一次性脚本会因此挂着不退出）
  if (typeof timer.unref === 'function') timer.unref()
  console.log(`  数据备份: 每 ${hours} 小时一次 · 保留 ${config.backup.keep} 份 · ${config.backup.dir}`)
  return timer
}

export function stopBackups() {
  if (timer) { clearInterval(timer); timer = null }
}
