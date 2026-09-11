import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BUILTIN_SKILLS,
  normalizeEnabledSkillKeys,
  shouldRunSkillTool,
  skillByKey,
} from '../skills.js'

test('健康养生只保留五运六气一个用户可见技能入口', () => {
  const healthEntries = BUILTIN_SKILLS.filter(s =>
    s.key === 'health' || s.key === 'wuyunliuqi'
  )

  assert.deepEqual(healthEntries.map(s => s.key), ['wuyunliuqi'])
  assert.match(healthEntries[0].name, /健康养生/)
  assert.ok(healthEntries[0].keywords.includes('失眠'), '合并后仍应覆盖日常养生咨询')
})

test('旧 health 设置映射到五运六气，且不产生重复技能', () => {
  assert.equal(skillByKey('health')?.key, 'wuyunliuqi')
  assert.deepEqual(
    normalizeEnabledSkillKeys(['health', 'wuyunliuqi', 'tarot', 'health']),
    ['wuyunliuqi', 'tarot']
  )
})

test('日常养护咨询没有生辰时不强行调用五运六气排盘工具', () => {
  const healthSkill = skillByKey('health')
  assert.equal(shouldRunSkillTool(healthSkill, null), false)
  assert.equal(shouldRunSkillTool(healthSkill, { pillars: ['甲子', '乙丑', '丙寅', '丁卯'] }), true)
})
