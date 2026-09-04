// 康熙字典字库（20794 字，含简繁）
// 数据源：shunshi-kangxi-core 0.1.1 的 chars.json（MIT），裁剪为取名所需字段。
// 使用标准 ESM JSON import attributes（Node ≥22.10 与 Vite 均原生支持，替代 vite 专用 ?json 后缀）
import data from './kangxi.json' with { type: 'json' }

const CHARS = data.chars || data
const ALIAS = data._alias || {}

// 查询单字信息（自动处理繁体→简体映射）
export function lookupChar(ch) {
  if (!ch) return null
  const direct = CHARS[ch]
  if (direct) return direct
  // 繁体 → 查简体（如 華→华）
  const mapped = ALIAS[ch]
  if (mapped && CHARS[mapped]) return { ...CHARS[mapped], trad: ch, simplified: mapped }
  // 简体 → 反向查繁体（如 华→華）
  for (const [t, s] of Object.entries(ALIAS)) {
    if (s === ch && CHARS[t]) return { ...CHARS[t], trad: t, simplified: ch }
  }
  return null
}

// 康熙笔画（取名用：单姓取康熙笔画，繁体字按繁体）
export function kangxiStrokes(ch) {
  const info = lookupChar(ch)
  if (!info) return null
  return info.kx || info.ts || null
}

// 简体笔画
export function simpleStrokes(ch) {
  const info = lookupChar(ch)
  if (!info) return null
  return info.ts || info.kx || null
}

// 汉字五行
export function charWuxing(ch) {
  const info = lookupChar(ch)
  if (!info) return null
  return info.wx || null
}

export const KANGXI_SIZE = Object.keys(CHARS).length
