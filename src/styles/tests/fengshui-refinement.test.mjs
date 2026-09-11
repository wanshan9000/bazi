import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const cssBlock = selector => css.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

test('风水生辰引导以有层次的命盘笺呈现，而非单层粉色大卡', () => {
  const entry = cssBlock('\\.fs-bazi-required')
  const input = cssBlock('\\.fs-bazi-control input, \\.fs-bazi-control select')

  assert.match(entry, /position:\s*relative;/)
  assert.match(entry, /overflow:\s*hidden;/)
  assert.match(css, /\.fs-bazi-required::before\s*\{[^}]*radial-gradient/)
  assert.match(input, /background:\s*linear-gradient/)
})

test('个人八字信息表单不再嵌套第二层有底色的卡片', () => {
  const entry = cssBlock('\\.fs-bazi-entry')

  assert.match(entry, /padding:\s*0;/)
  assert.match(entry, /border:\s*0;/)
  assert.match(entry, /border-radius:\s*0;/)
  assert.match(entry, /background:\s*transparent;/)
  assert.match(entry, /box-shadow:\s*none;/)
})

test('风水报告的设置与评分区保留统一、柔和的阅读层级', () => {
  const analysis = cssBlock('\\.fs-analysis-block')
  const summary = cssBlock('\\.fs-summary, \\.fs-rooms, \\.fs-door')

  assert.match(analysis, /border-radius:\s*22px;/)
  assert.match(analysis, /box-shadow:\s*0 16px 36px/)
  assert.match(summary, /box-shadow:\s*0 12px 28px/)
})

test('手机端命盘笺从舒适的上方留白开始排布，不把表单压在屏幕中央', () => {
  assert.match(css, /@media \(max-width: 639px\)\s*\{\s*\.page-wrap:has\(\.fs-bazi-required\) \.fs-bazi-required\s*\{[^}]*justify-content:\s*flex-start;[^}]*padding-top:\s*clamp\(34px, 9vh, 76px\);/)
})

test('手机端在风水命盘笺上方保留横线与风水分析标题', () => {
  assert.match(css, /@media \(max-width: 639px\)\s*\{[\s\S]*?\.page-wrap:has\(\.fs-bazi-required\) \.fs-page-title\s*\{[^}]*display:\s*block;/)
  assert.match(css, /\.page-wrap:has\(\.fs-bazi-required\) \.fs-page-title::before\s*\{[^}]*height:\s*1px;/)
})

test('iPad 端将年份独占一行，其余出生字段以两列成组排列', () => {
  assert.match(css, /@media \(min-width: 640px\) and \(max-width: 1023px\)\s*\{[\s\S]*?\.fs-bazi-form-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/)
  assert.match(css, /@media \(min-width: 640px\) and \(max-width: 1023px\)\s*\{[\s\S]*?\.fs-bazi-control-year\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/)
})

test('宽屏命盘引导使用精致阅读级字号，而非海报级大字', () => {
  const fengshuiStart = css.indexOf('@media (min-width: 1024px)', css.indexOf('.fs-bazi-calendar-hint'))
  const fengshuiEnd = css.indexOf('\n.fs-tip', fengshuiStart)
  const desktopRules = css.slice(fengshuiStart, fengshuiEnd)

  assert.match(desktopRules, /\.fs-bazi-required \.n-h\s*\{[^}]*font-size:\s*clamp\(30px, 2\.5vw, 44px\);/)
  assert.match(desktopRules, /\.fs-bazi-required > p\s*\{[^}]*font-size:\s*clamp\(14px, 1\.05vw, 18px\);/)
  assert.match(desktopRules, /\.fs-bazi-control input, \.fs-bazi-control select\s*\{[^}]*min-height:\s*58px;[^}]*font-size:\s*clamp\(17px, 1\.2vw, 20px\);/)
})
