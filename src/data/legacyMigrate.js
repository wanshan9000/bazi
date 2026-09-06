/* ============ 旧的本地账号 → 服务端账号 一次性迁移 ============
 *
 * 账号迁到服务端之前，用户是存在浏览器 localStorage['sanmen-users'] 里的，
 * 口令是 PBKDF2（更早还有一批 djb2）。这些散列不可逆，服务端不可能凭空知道口令。
 *
 * 如果什么都不做，后果是双重的：
 *   1. 老用户用原来的账号密码登录 → 服务端查无此人 → 被锁在门外；
 *   2. 他们的会话/记忆/收藏都以 `base::<旧uid>` 命名，即便重新注册，
 *      新账号是另一个 uid，那些数据谁也读不到了 —— 看起来就是「全没了」。
 *
 * 做法：登录失败时，用用户**刚输入的明文口令**去校验本地那份旧散列。
 * 校验通过 = 这个人确实知道这个账号的口令，于是替他在服务端建号，
 * 并把 `::<旧uid>` 的存储键改挂到新 uid 上。
 *
 * 安全边界：能读到 localStorage 的人本来就能离线爆破那份散列，这里没有放大风险；
 * 而且迁移必须提供正确口令，拿不到口令就走不通这条路。迁移一次后打标记，不重复。
 */

const USERS_KEY = 'sanmen-users'
const MIGRATED_FLAG = 'genki-legacy-migrated'

function readLegacyUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const arr = raw ? JSON.parse(raw) : null
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

function djb2(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return 'u' + (h >>> 0).toString(36)
}

/** 校验旧散列（支持 `pbkdf2$轮数$盐$摘要` 与更早的 djb2 两种格式） */
async function verifyLegacyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored) return false
  if (!stored.includes('$')) return djb2(password) === stored
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const sub = globalThis.crypto && globalThis.crypto.subtle
  if (!sub) return false
  const salt = Uint8Array.from(parts[2].match(/.{2}/g).map(h => parseInt(h, 16)))
  const key = await sub.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await sub.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return toHex(bits) === parts[3]
}

/**
 * 把 `base::<旧uid>` 形式的存储键改挂到新 uid 上。
 * 已存在同名新键时不覆盖 —— 新账号自己产生的数据优先，迁移不该把它盖掉。
 */
export function remapScopedKeys(oldUid, newUid) {
  if (!oldUid || !newUid || oldUid === newUid) return 0
  let moved = 0
  try {
    const suffix = `::${oldUid}`
    // 先收集再改写：边遍历边 setItem 会让 key(i) 的下标含义漂移。
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.endsWith(suffix)) keys.push(k)
    }
    for (const k of keys) {
      const target = k.slice(0, -suffix.length) + `::${newUid}`
      if (localStorage.getItem(target) != null) continue
      const v = localStorage.getItem(k)
      if (v == null) continue
      localStorage.setItem(target, v)
      moved++
    }
  } catch { /* 隐私模式等：迁不了就算了，不该因此让登录失败 */ }
  return moved
}

/** 这台设备上还有没有没迁过的旧账号 */
export function hasLegacyAccounts() {
  return readLegacyUsers().some(u => !u.__migrated)
}

/**
 * 尝试迁移一个旧账号。
 * @param account  用户输入的账号
 * @param password 用户输入的明文口令
 * @param serverRegister 形如 ({nickname, account, password}) => Promise<{ok, user, msg}>
 * @returns { ok, user? , msg? }；ok=false 且无 msg 表示「这里没有可迁移的账号」，
 *          调用方应沿用原来的登录失败提示。
 */
export async function tryMigrateLegacy(account, password, serverRegister) {
  const acct = String(account || '').trim().toLowerCase()
  if (!acct) return { ok: false }
  const users = readLegacyUsers()
  const idx = users.findIndex(u => String(u.account || '').toLowerCase() === acct && !u.__migrated)
  if (idx < 0) return { ok: false }
  const legacy = users[idx]

  let passed = false
  try { passed = await verifyLegacyPassword(password, legacy.password) } catch { passed = false }
  if (!passed) return { ok: false }

  const res = await serverRegister({
    nickname: legacy.nickname || '缘主',
    account: legacy.account,
    password,
  })
  if (!res.ok) {
    // 账号名在服务端已被别人占用等 —— 如实回报，别让用户对着「密码错误」发懵
    return { ok: false, msg: res.msg || '账号迁移失败，请联系管理员' }
  }

  remapScopedKeys(legacy.id, res.user.id)
  try {
    users[idx] = { ...legacy, __migrated: res.user.id, password: undefined }
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
    localStorage.setItem(MIGRATED_FLAG, String(Date.now()))
  } catch { /* 标记写不进去最多是下次再试一遍，服务端有重名保护 */ }

  return { ok: true, user: res.user, migrated: true }
}
