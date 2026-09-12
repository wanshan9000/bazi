import { test } from 'node:test'
import assert from 'node:assert/strict'

const { quickQuestionsForConversation, QUICK_DEFAULT, QUICK_BAZI, QUICK_DATE_SELECTION } = await import('../agent/ChatParts.jsx')

test('新会话使用全站快捷测算入口', () => {
  const quick = quickQuestionsForConversation()
  assert.equal(quick.topic, 'general')
  assert.deepEqual(quick.questions, QUICK_DEFAULT)
  assert.ok(quick.questions.includes('八字排盘'))
  assert.ok(quick.questions.includes('紫微斗数'))
})

test('八字会话使用命盘追问，且不由模型回复决定主题', () => {
  const quick = quickQuestionsForConversation([
    { role: 'user', text: '请看我的大运和事业。' },
    { role: 'ai', text: '改去择日吧。' },
    { role: 'user', text: '继续。' },
  ], { hasChart: true })
  assert.equal(quick.topic, 'bazi')
  assert.deepEqual(quick.questions, QUICK_BAZI)
  assert.ok(quick.questions.includes('盲派报告'))
})

test('择吉会话将快捷问题切换到生活场景', () => {
  const quick = quickQuestionsForConversation([{ role: 'user', text: '下周搬家，帮我择日。' }], { hasChart: true })
  assert.equal(quick.topic, 'date-selection')
  assert.deepEqual(quick.questions, QUICK_DATE_SELECTION)
  assert.ok(quick.questions.includes('相亲择日'))
})

test('用户切换至其它术数时不再沿用八字快捷问题', () => {
  const quick = quickQuestionsForConversation([
    { role: 'user', text: '看看我的八字大运。' },
    { role: 'user', text: '抽张塔罗。' },
  ], { hasChart: true })
  assert.equal(quick.topic, 'general')
  assert.deepEqual(quick.questions, QUICK_DEFAULT)
})
