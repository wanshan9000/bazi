import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFusedHuangliData, buildFusedHuangli, generateHuangli, getSceneData, inferScenario } from '../cantian.js'
import { buildChart } from '../bazi.js'

test('黄历场景：四类身份均可识别，退休年龄按性别自动进入享受族', () => {
  assert.equal(inferScenario(35, 'worker'), 'worker')
  assert.equal(inferScenario(19, 'student'), 'student')
  assert.equal(inferScenario(42, 'free'), 'free')
  assert.equal(inferScenario(22, '', '男'), 'student')
  assert.equal(inferScenario(60, '', '男'), 'enjoy')
  assert.equal(inferScenario(59, '', '男'), 'worker')
  assert.equal(inferScenario(50, '', '女'), 'enjoy')
  assert.equal(inferScenario(49, '', '女'), 'worker')
  assert.equal(inferScenario(66, 'free', '男'), 'free')
  assert.equal(inferScenario(52, '退休人士'), 'enjoy')
  assert.equal(getSceneData('享受族').name, '享受族（退休人士）')
})

test('统一黄历入口：模式控制八字计算，语气只影响生活化表达', () => {
  const chart = buildChart(1988, 6, 15, 12, '男')
  const standard = generateHuangli({ chart, date: '2026-09-09', mode: 'standard', tone: 'practical' })
  assert.equal(standard.presentation.mode, 'standard')
  assert.equal(standard.presentation.tone, 'practical')
  assert.equal(standard.daily, null)
  assert.ok(standard.real?.yi)

  const personalized = generateHuangli({ chart, date: '2026-09-09', mode: 'personalized', tone: 'practical' })
  assert.equal(personalized.presentation.mode, 'personalized')
  assert.ok(personalized.daily)
  assert.ok(personalized.scene.advice)

  const humorous = generateHuangli({ date: '2026-09-09', scenario: 'worker', tone: 'humorous', format: 'markdown' })
  assert.match(humorous, /幽默参考/)
  assert.match(humorous, /传统规则层/)
})

test('黄历场景：生活翻译保留传统字段来源，不覆盖彭祖黄历', () => {
  const daily = {
    monthGanzhi: '丁酉月', jianchu: '除', relation: '顺',
    action: { body: '适合把已准备好的事项往前推进。' },
    tips: { color: '黄棕', dir: '中原', noble: '龙狗牛', num: '5·10' },
    bazi: { dayMaster: '丙', dayMasterWx: '火', favorable: ['土'], avoid: ['水'] },
  }
  const data = buildFusedHuangliData('2026-09-09', 'enjoy', { daily })
  assert.equal(data.scene.name, '享受族（退休人士）')
  assert.ok(data.scene.guidance.length >= 3)
  assert.equal(data.scene.traditionalItems.yi.length, data.real.yi.split(',').length)
  assert.match(data.scene.traditionalItems.yi[0].note, /家人团聚/)
  assert.match(data.scene.traditionalItems.ji[0].note, /操心/)
  assert.ok(data.scene.guidance.every(item => item.source.includes('日历依据：丁酉月除日')))
  assert.match(data.scene.persona, /丁酉月除日/)
  assert.match(data.scene.persona, /丙火日主/)
  assert.match(data.scene.personaTitle, /从容安排日/)
  assert.match(data.scene.personaSummary, /丁酉月除日/)
  assert.equal(data.scene.personaFacts.length, 4)
  assert.match(data.scene.context.anchor, /享受族/)
  assert.match(data.scene.context.baziHint, /偏好土/)
  assert.match(data.scene.context.ruleLead, /传统宜/)
  assert.match(data.scene.context.arrangeLead, /丙火日主/)
  assert.match(data.scene.advice.career, /家人团聚/)
  assert.match(data.scene.advice.career, /伐木/)
  assert.ok(Object.values(data.scene.advice).every(value => !value.includes('丙火日主')))
  assert.match(data.scene.context.notesLead, /传统宜忌/)
  assert.ok(Object.values(data.scene.tips).every(value => !value.includes('丙火日主')))
  assert.ok(Object.values(data.scene.zodiac).every(value => !value.includes('丙火日主')))
  assert.ok(data.scene.mental.every(value => !value.includes('丙火日主')))
  assert.match(data.scene.context.zodiacLead, /丁酉月除日/)
  assert.match(data.scene.rhythm.action.body, /传统宜/)
  assert.match(data.scene.rhythm.action.body, /大动作先缓一缓/)
  assert.match(data.scene.rhythm.action.primary, /适合把已准备好的事项/)
  assert.match(data.scene.rhythm.action.secondary, /传统宜/)
  assert.ok(data.scene.rhythm.priorities.some(item => item.source.startsWith('传统宜·')))
  assert.ok(data.scene.rhythm.tips.some(item => item.label === '传统喜神'))

  const report = buildFusedHuangli('2026-09-09', 'student')
  assert.match(report, /把黄历放进今天/)
  assert.match(report, /不替代传统黄历规则/)
  assert.match(report, /传统规则层/)
})
