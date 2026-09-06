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

// 「旧的全局数据已被哪个账号认领」的标记。
// 迁移的本意是：游客用了一阵子再注册，别让他刚才产生的会话/收藏凭空消失。
// 但原来的实现没有任何「只搬一次」的约束 —— 全局 key 会一直留在原地，
// 于是同一台设备上每一个新登录的账号都会把它复制一份进自己的命名空间：
// B 登录后看到的是 A（或上一位游客）的对话记忆和收藏，属于跨账号数据泄漏。
// 认领之后，其余账号一律从空白开始。
const CLAIM_SUFFIX = '::__claimed_by__'

/** 按当前用户解析 localStorage key（旧的游客数据只迁移给第一个认领它的账号） */
export function localKey(base) {
  const uid = currentUid()
  if (uid === 'anon') return base
  const ns = `${base}::${uid}`
  try {
    const old = localStorage.getItem(base)
    if (old != null && localStorage.getItem(ns) == null) {
      const claimKey = base + CLAIM_SUFFIX
      const claimedBy = localStorage.getItem(claimKey)
      if (claimedBy == null) {
        localStorage.setItem(ns, old)
        localStorage.setItem(claimKey, uid)
      }
    }
  } catch { /* 隐私模式等：读写失败就当作没有旧数据 */ }
  return ns
}

/** 按当前用户解析 sessionStorage key（无迁移，直接命名空间） */
export function sessionKey(base) {
  const uid = currentUid()
  return uid === 'anon' ? base : `${base}::${uid}`
}
