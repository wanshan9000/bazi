// 用户级存储隔离（userScope）
// 目标：不同账号的数据（会话 / 记忆 / 收藏 / 画像）互不串台。
// 实现：存储 key 追加用户命名空间  base::<userId>；未登录（游客）直接使用 base。
// 迁移：登录用户首次访问某 key 时，若存在旧的全局数据且命名空间为空，
//       自动把旧数据搬入当前账号（避免登录后丢失历史）。
import { getSession } from '../data/users.js'

/** 当前登录用户 id；未登录返回 'anon'（游客作用域） */
export function currentUid() {
  const u = getSession()
  return u && u.id ? u.id : 'anon'
}

/** 按当前用户解析 localStorage key（带旧数据一次性迁移） */
export function localKey(base) {
  const uid = currentUid()
  if (uid === 'anon') return base
  const ns = `${base}::${uid}`
  const old = localStorage.getItem(base)
  if (old != null && localStorage.getItem(ns) == null) {
    try { localStorage.setItem(ns, old) } catch { /* ignore */ }
  }
  return ns
}

/** 按当前用户解析 sessionStorage key（无迁移，直接命名空间） */
export function sessionKey(base) {
  const uid = currentUid()
  return uid === 'anon' ? base : `${base}::${uid}`
}
