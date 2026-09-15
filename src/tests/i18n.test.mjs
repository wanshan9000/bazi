import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { render } from '../test/render.mjs'

const { LOCALES, LocaleProvider, LanguageSwitcher, normalizeLocale } = await import('../i18n.jsx')

test('多语言层只接受简体、繁体和英文三种显示语言', () => {
  assert.deepEqual(LOCALES.map(item => item.key), ['zh-CN', 'zh-TW', 'en'])
  assert.equal(normalizeLocale('zh-TW'), 'zh-TW')
  assert.equal(normalizeLocale('en'), 'en')
  assert.equal(normalizeLocale('fr'), 'zh-CN')
})

test('语言选择器切换英文后同步页面语言并记住偏好', () => {
  localStorage.clear()
  document.documentElement.lang = ''
  function Fixture() {
    return createElement(LocaleProvider, null, createElement(LanguageSwitcher))
  }
  const r = render(Fixture)
  try {
    const trigger = r.$('.language-switcher-trigger')
    assert.equal(trigger.textContent, '简体')
    r.click(trigger)
    r.click(r.findByText('English', '.language-switcher-option'))
    assert.equal(localStorage.getItem('genki-locale'), 'en')
    assert.equal(document.documentElement.lang, 'en')
  } finally {
    r.unmount()
    localStorage.clear()
  }
})
