import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.resolve(here, '../global.css'), 'utf8')
const app = fs.readFileSync(path.resolve(here, '../../App.jsx'), 'utf8')
const agent = fs.readFileSync(path.resolve(here, '../../components/AgentChatDsh.jsx'), 'utf8')
const cssBlock = selector => css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

test('应用壳使用稳定视口高度并裁掉意外横向溢出', () => {
  const html = cssBlock('html')
  const body = cssBlock('body')
  const shell = cssBlock('\\.app-shell')

  assert.match(html, /overflow-x:\s*clip;/)
  assert.match(html, /-webkit-text-size-adjust:\s*100%;/)
  assert.match(body, /min-height:\s*100svh;/)
  assert.match(body, /overflow-x:\s*clip;/)
  assert.match(shell, /min-height:\s*100svh;/)
})

test('英文界面使用正常西文字距，中文全局字距规则保持独立', () => {
  const englishTypography = cssBlock('html:lang\\(en\\) \\.app-shell,\\s*html:lang\\(en\\) \\.app-shell \\*')
  const body = cssBlock('body')

  assert.match(englishTypography, /letter-spacing:\s*normal;/)
  assert.match(englishTypography, /word-spacing:\s*normal;/)
  assert.match(body, /letter-spacing:\s*0\.01em;/)
})

test('奇门报告标题在手机不再使用 100vw 制造横向拖动', () => {
  const title = cssBlock('\\.qimen-report-page-title')
  assert.match(title, /width:\s*calc\(100% \+ 28px\);/)
  assert.match(title, /margin:\s*4px 0 18px -14px;/)
})

test('手机聚焦可编辑控件不会触发 Safari 自动缩放', () => {
  const mobileInputRule = css.match(/\/\* iOS Safari 会在聚焦小于 16px[\s\S]*?@media \(max-width: 720px\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(mobileInputRule, /font-size:\s*16px !important;/)
})

test('窄桌面顶栏让导航收缩，不与品牌和账户入口重叠', () => {
  assert.match(css, /@media \(min-width: 870px\) \{\s*\.topbar-inner\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/)
  assert.match(css, /\.topnav\s*\{\s*min-width:\s*0;\s*justify-self:\s*stretch;\s*justify-content:\s*center;\s*overflow-x:\s*auto;/)
  assert.match(css, /@media \(min-width: 870px\) and \(max-width: 1210px\) \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);[\s\S]*?\.topnav\s*\{\s*justify-self:\s*center;\s*justify-content:\s*center;\s*gap:\s*30px;[\s\S]*?\.user-chip-login\s*\{\s*min-width:\s*auto;\s*padding:\s*6px 16px;/)
})

test('桌面与 iPad 顶栏始终保留 Logo 右侧的品牌名称', () => {
  const compactBar = css.match(/@media \(min-width: 870px\) and \(max-width: 1210px\) \{([\s\S]*?)\n\}/)?.[1] || ''

  assert.doesNotMatch(compactBar, /\.brand-name\s*\{\s*display:\s*none;/)
  assert.doesNotMatch(compactBar, /\.brand\s*\{\s*gap:\s*0;/)
})

test('手机 Agent 在头部切换语言，底部不再出现第二个切换器', () => {
  assert.match(agent, /import \{ LanguageSwitcher \} from '\.\.\/i18n\.jsx'/)
  assert.match(agent, /<div className="agent-head-actions">\s*<LanguageSwitcher mobile \/>/)
  assert.match(app, /\{view !== 'agent' && <LanguageSwitcher mobile onLocaleChange=\{syncGuideLanguage\} \/>\}/)
  assert.match(css, /\.agent-head-actions \.language-switcher-mobile\s*\{[\s\S]*?position:\s*relative;/)
})
