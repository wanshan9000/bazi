import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { render, flush } from '../../test/render.mjs'
import { buildChart } from '../../engine/bazi.js'

const { default: FengshuiPage } = await import('../FengshuiPage.jsx')

test('未录入八字时只展示常驻出生信息输入，不给出通用风水评分或保存档案', async () => {
  const saved = []
  const r = render(FengshuiPage, {
    user: { id: 'needs-bazi-user' },
    onBack() {}, onChart() {},
    onReportReady: async payload => { saved.push(payload); return 'should-not-save' },
  })
  try {
    assert.match(r.text(), /风水需结合个人八字|先录入八字/, '应明确告知用户先录入八字')
    assert.ok(r.$('.fs-bazi-entry input[type="number"]'), '出生信息表单应直接常驻显示')
    assert.equal(r.findByText('排八字'), null, '不应再把八字输入藏进“排八字”折叠入口')
    assert.equal(r.$('.fs-overview'), null, '没有八字时不应展示通用综合评分')
    assert.equal(r.$('.fs-desk-result'), null, '没有八字时不应展示通用座位评分')
    await flush()
    assert.equal(saved.length, 0, '没有八字时不得保存通用风水报告')
  } finally {
    r.unmount()
  }
})

test('风水生辰输入使用与八字页一致的独立命盘表单结构', () => {
  const r = render(FengshuiPage, { onBack() {}, onChart() {} })
  try {
    assert.equal(r.$('.fs-page-title')?.textContent?.trim(), '风水分析', '移动端应保留清晰的风水分析页头')
    assert.ok(r.$('.fs-bazi-entry'), '风水页应使用独立的个人命盘输入区，而不是散落字段')
    assert.ok(r.$('.fs-bazi-form-grid'), '出生年月日、时辰与性别应由响应式字段网格承载')
    assert.ok(r.$('.fs-bazi-submit'), '命盘表单应提供醒目的主操作按钮')
    assert.ok(
      r.$('.fs-bazi-form-grid').nextElementSibling?.classList.contains('fs-bazi-submit'),
      '排定命盘按钮应位于日期输入框下方，而非与字段挤在同一行'
    )
    assert.match(r.$('.fs-bazi-entry').textContent, /出生日期/, '历法切换应与出生日期归在同一组')
  } finally {
    r.unmount()
  }
})

test('风水报告标题提供更换生辰入口，并返回八字输入界面', () => {
  const r = render(FengshuiPage, { chart: buildChart(1990, 5, 6, 8, '男'), onBack() {}, onChart() {} })
  try {
    const change = r.findByText('更换生辰')
    assert.ok(change, '已生成风水报告时，标题右侧应提供更换生辰按钮')

    r.click(change)

    assert.ok(r.$('.fs-bazi-entry'), '点击更换生辰后应直接显示出生信息输入')
    assert.equal(r.$('.fs-overview'), null, '重新录入期间不应继续展示旧命盘的综合评分')
  } finally {
    r.unmount()
  }
})

test('户型设置与综合得分、座位设置与座位得分各自收在同一分析组', () => {
  const r = render(FengshuiPage, { chart: buildChart(1990, 5, 6, 8, '男'), onBack() {}, onChart() {} })
  try {
    const home = r.$('.fs-home-analysis')
    const desk = r.$('.fs-desk-analysis')
    assert.ok(home?.querySelector('.fs-form'), '户型设置应与综合得分组成同一块')
    assert.ok(home?.querySelector('.fs-overview'), '综合得分应紧邻户型设置')
    assert.ok(desk?.querySelector('.fs-desk-panel'), '书桌设置应与座位得分组成同一块')
    assert.ok(desk?.querySelector('.fs-desk-result'), '座位得分应紧邻书桌设置')

    const deskScore = desk?.querySelector('.fs-desk-score-card.ov-card')
    assert.ok(deskScore, '座位得分应复用综合评分的居中数字卡')
    assert.ok(deskScore.querySelector('.ov-bar'), '座位得分应与综合评分一样提供整宽进度条')
  } finally {
    r.unmount()
  }
})

test('风水两张分析组在所有尺寸下均以上下顺序呈现设置与得分', async () => {
  const css = await readFile(new URL('../../styles/global.css', import.meta.url), 'utf8')
  assert.match(
    css,
    /^\.fs-analysis-block\s*\{[^}]*grid-template-columns:\s*1fr;/m,
    '户型与书桌分析组应固定为单列，上方设置、下方得分'
  )
})

test('评分数字与说明在宽屏采用左右结构，窄屏才回落为上下排列', async () => {
  const css = await readFile(new URL('../../styles/global.css', import.meta.url), 'utf8')
  const homeScoreRule = css.match(/\.fs-home-analysis \.fs-overview\s*\{([^}]*)\}/)?.[1] || ''
  const deskScoreRule = css.match(/\.fs-desk-result\s*\{([^}]*)\}/)?.[1] || ''
  const homeColumns = homeScoreRule.match(/grid-template-columns:\s*([^;]+)/)?.[1]?.trim()
  const deskColumns = deskScoreRule.match(/grid-template-columns:\s*([^;]+)/)?.[1]?.trim()

  assert.notEqual(homeColumns, '1fr', '综合评分的数字与说明应在宽屏分栏')
  assert.notEqual(deskColumns, '1fr', '座位评分的数字与说明应在宽屏分栏')
})

test('风水页提供书桌座位输入、结果卡，并把结论保存和带入元气 Agent', async () => {
  const saved = []
  let agentRequest = null
  const r = render(FengshuiPage, {
    chart: buildChart(1990, 5, 6, 8, '男'),
    user: { id: 'desk-user' },
    onBack() {}, onChart() {},
    onReportReady: async payload => { saved.push(payload); return 'desk-report' },
    onAskAgent: payload => { agentRequest = payload },
  })
  try {
    const panel = r.$('.fs-desk-panel')
    assert.ok(panel, '页面应单独呈现书桌 / 座位风水分析区')
    assert.match(panel.textContent, /书桌.*座位风水/)
    const direction = panel.querySelector('[data-fengshui-field="deskDir"]')
    assert.ok(direction, '用户应可选择书桌面向')
    r.select(direction, '西')
    await flush()

    assert.ok(r.$('.fs-desk-score-card .ov-score'), '座位分析应以统一评分卡给出独立评分')
    assert.ok(saved.at(-1)?.result?.desk, '保存的风水报告必须包含书桌座位结论')

    r.click(r.findByText('咨询元气 AI'))
    assert.match(agentRequest.prompt, /书桌.*座位|座位.*书桌/, '元气 Agent 上下文必须带入座位结论')
  } finally {
    r.unmount()
  }
})
