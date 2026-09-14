import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStructuredAgentAnswer, structuredAnswerText, structuredAnswerProtocol } from '../agentAnswer.js'

const valid = {
  version: 1,
  summary: '先稳住当前节奏，再根据已核验的信息安排下一步。',
  sections: [{
    title: '当前重点',
    body: '先完成最重要的一件事。',
    items: [{ label: '行动', text: '把安排写成明确的时间表。' }],
  }],
  closing: '有新的出生资料或时间条件时，可以继续补充。',
}

test('结构化 Agent 答案只接受带版本和必填摘要的 JSON', () => {
  assert.deepEqual(parseStructuredAgentAnswer(JSON.stringify(valid)), valid)
  assert.deepEqual(parseStructuredAgentAnswer(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``), valid)
  assert.equal(parseStructuredAgentAnswer(JSON.stringify({ ...valid, version: 2 })), null)
  assert.equal(parseStructuredAgentAnswer(JSON.stringify({ ...valid, summary: '' })), null)
  assert.equal(parseStructuredAgentAnswer('这是一段普通文本'), null)
})

test('结构化答案会丢弃空字段、过量条目，并保留可读历史文本', () => {
  const parsed = parseStructuredAgentAnswer(JSON.stringify({
    ...valid,
    sections: [
      { title: '空组' },
      { title: '有效组', items: [{ label: '', text: '无标签' }, { label: '依据', text: '已核验的事实。' }] },
      ...Array.from({ length: 8 }, (_, i) => ({ title: `第${i}组`, body: '保留内容' })),
    ],
  }))
  assert.equal(parsed.sections.length, 6)
  assert.equal(parsed.sections[0].title, '有效组')
  assert.deepEqual(parsed.sections[0].items, [{ label: '依据', text: '已核验的事实。' }])
  assert.ok(structuredAnswerText(parsed).includes('依据：已核验的事实。'))
  assert.ok(structuredAnswerProtocol().includes('最终答复必须且只能输出一个合法 JSON 对象'))
})
