import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { render, flush } from '../../test/render.mjs'
import { clearAuth, setAuth } from '../../api/auth.js'
import MyReportsPage, { ReportArchiveDetail } from '../MyReportsPage.jsx'

let originalFetch

beforeEach(() => {
  clearAuth()
  localStorage.clear()
  setAuth('jwt-reports', { id: 'u-1' })
  originalFetch = globalThis.fetch
})

afterEach(() => { globalThis.fetch = originalFetch })

function stubReports() {
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url)
    if (path.includes('/api/reports') && (options.method || 'GET') === 'GET') {
      return {
        status: 200,
        json: async () => ({ ok: true, counts: { bazi: 1, tarot: 1, huangli: 0 }, reports: [
          { id: 'r-bazi', type: 'bazi', title: '八字命盘 · 甲木日主', summary: '甲木日主，宜稳步建立节奏。', facts: ['日主：甲木'], sessionCount: 1, createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000 },
          { id: 'r-tarot', type: 'tarot', title: '塔罗 · 单卡直答', summary: '适合真诚表达。', facts: ['牌阵：单卡直答'], sessionCount: 0, createdAt: 1_700_000_001_000, updatedAt: 1_700_000_001_000 },
        ] }),
      }
    }
    return { status: 200, json: async () => ({ ok: true }) }
  }
}

test('我的报告汇总完整报告，按分类筛选并将完整记录交给原生路由', async () => {
  stubReports()
  let opened = null
  const r = render(MyReportsPage, { user: { id: 'u-1' }, onBack() {}, onOpenReport: report => { opened = report } })
  await flush(4)
  assert.ok(r.text().includes('我的报告'), `没有标题：${r.text().slice(0, 300)}`)
  assert.ok(r.text().includes('八字命盘 · 甲木日主'))
  assert.ok(r.text().includes('塔罗 · 单卡直答'))
  r.click(r.findByText('塔罗'))
  assert.equal(r.text().includes('八字命盘 · 甲木日主'), false)
  const card = r.findByText('塔罗 · 单卡直答')
  r.click(card)
  assert.deepEqual(opened, { id: 'r-tarot', type: 'tarot' })
  r.unmount()
})

test('报告列表可从单条记录删除，且删除操作不会打开报告', async () => {
  const requests = []
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' })
    if ((options.method || 'GET') === 'GET') {
      return {
        status: 200,
        json: async () => ({ ok: true, counts: { bazi: 1 }, reports: [
          { id: 'r-bazi', type: 'bazi', title: '八字命盘 · 甲木日主', summary: '甲木日主，宜稳步建立节奏。', createdAt: 1_700_000_000_000 },
        ] }),
      }
    }
    return { status: 200, json: async () => ({ ok: true }) }
  }
  let opened = null
  const r = render(MyReportsPage, { user: { id: 'u-1' }, onBack() {}, onOpenReport: report => { opened = report } })
  await flush(4)
  const remove = r.$('.my-report-delete')
  assert.ok(remove, '每条报告应提供删除按钮')
  r.click(remove)
  assert.ok(r.text().includes('删除这份报告？'), '删除前应二次确认')
  const dialog = r.$('[role="dialog"]')
  const actions = dialog?.querySelector('.saved-report-confirm-actions')
  const confirm = actions?.querySelector('.saved-report-confirm-danger')
  assert.ok(actions, '删除弹窗应将取消与确认操作放在独立操作区')
  assert.equal(confirm?.type, 'button', '确认删除必须是可提交的按钮')
  assert.equal(confirm?.textContent, '确认删除', '确认删除操作必须始终有明确文案')
  assert.equal(opened, null, '点击删除不应打开报告')
  r.click(confirm)
  await flush(3)
  assert.ok(requests.some(item => item.method === 'DELETE' && item.url.includes('/api/reports/r-bazi')), '确认后应调用该报告的删除接口')
  assert.equal(r.text().includes('八字命盘 · 甲木日主'), false, '删除成功后应立刻从列表移除')
  r.unmount()
})

test('不完整旧档案不出现在我的报告列表中', async () => {
  globalThis.fetch = async () => ({
    status: 200,
    json: async () => ({ ok: true, counts: { bazi: 1, chart: 1 }, reports: [
      { id: 'r-bazi', type: 'bazi', title: '八字命盘 · 甲木日主', summary: '完整命书。', isComplete: true, createdAt: 1_700_000_000_000 },
      { id: 'r-chart', type: 'chart', title: '基础命盘记录 · 1990-06-30', summary: '不应显示。', isComplete: false, createdAt: 1_700_000_001_000 },
    ] }),
  })
  const r = render(MyReportsPage, { user: { id: 'u-1' }, onBack() {}, onOpenReport() {} })
  await flush(4)
  assert.ok(r.text().includes('八字命盘 · 甲木日主'))
  assert.equal(r.text().includes('基础命盘记录'), false)
  r.unmount()
})

test('没有档案时显示完成测算后会自动保存的空状态', async () => {
  globalThis.fetch = async () => ({ status: 200, json: async () => ({ ok: true, counts: {}, reports: [] }) })
  const r = render(MyReportsPage, { user: { id: 'u-1' }, onBack() {}, onOpenReport() {} })
  await flush(4)
  assert.ok(r.text().includes('完成一次测算后，报告会自动保存在这里'))
  r.unmount()
})

function stubReportDetail(report) {
  globalThis.fetch = async () => ({ status: 200, json: async () => ({ ok: true, report }) })
}

test('完整黄历档案用保存的黄历阅读面展示，不回落为原始 Markdown', async () => {
  stubReportDetail({
    id: 'r-huangli', type: 'huangli', title: '2026-09-10 · 个性化黄历', summary: '顺势安排即可。',
    report: {
      date: '2026年9月10日', lunar: '七月廿九', ganzhi: '丙午年乙酉月甲子日', shengxiao: '马',
      real: { yi: '祭祀、祈福', ji: '动土、安葬', xishen: '东北', caishen: '东北', fushen: '正北' },
      calendar: { jianchu: '满', monthGanzhi: '乙酉' },
      scene: { personaTitle: '今日场景：先收边界，再推进', context: { yiHeading: '今日宜', jiHeading: '今日忌' }, traditionalItems: { yi: [{ item: '祭祀', note: '先定心意' }], ji: [{ item: '动土', note: '不宜仓促开工' }] }, guidance: [{ title: '今天怎么安排', body: '先完成一件最重要的沟通。' }] },
      daily: { relation: '顺', theme: '稳住节奏', action: { head: '先沟通', primary: '再推进' } },
      archive: { mode: 'native', sourceType: 'huangli' }, markdown: '# 不应作为页面正文显示',
    },
    facts: ['日期：2026年9月10日'], agentSessionIds: [],
  })
  const r = render(ReportArchiveDetail, { reportId: 'r-huangli', onBack() {} })
  await flush(4)
  const archivedHuangli = r.$('.archived-huangli-view')
  assert.ok(archivedHuangli, '完整黄历应进入历史黄历阅读面')
  assert.ok(archivedHuangli.classList.contains('card'), '历史黄历应复用黄历结果页的白瓷卡片')
  assert.ok(archivedHuangli.classList.contains('hl-report-card'), '历史黄历应复用黄历结果页的内边距与版式')
  assert.equal(r.text().includes('历史黄历'), false, '只读历史不应替换黄历页原本的日期徽章')
  assert.ok(r.text().includes('今日宜'))
  assert.equal(r.text().includes('# 不应作为页面正文显示'), false)
  r.unmount()
})

test('完整塔罗档案恢复牌阵、牌面与保存的逐位解读', async () => {
  stubReportDetail({
    id: 'r-tarot', type: 'tarot', title: '塔罗 · 单卡直答', summary: '适合坦诚表达。',
    report: {
      spread: { id: 'single', name: '单卡直答', nameEn: 'One Card', count: 1, layout: 'center', positions: [{ name: '当下指引', desc: '唯一的答案' }] },
      cards: [{ id: 'm19', name: '太阳', en: 'The Sun', glyph: '☀', kw: ['成功'], reversed: false }],
      question: '我该主动沟通吗？',
      interpretation: { summary: '适合坦诚表达。', narrative: '光明正在显现。', suggestion: '直接而温和地说出重点。', actions: ['写下要说的三句话'], perCard: [{ position: '当下指引', positionDesc: '唯一的答案', card: { name: '太阳', en: 'The Sun', kw: ['成功'] }, text: '主动会带来更清晰的回应。', isReversed: false }] },
      archive: { mode: 'native', sourceType: 'tarot' }, markdown: '# 不应作为页面正文显示',
    },
    facts: ['牌阵：单卡直答'], agentSessionIds: [],
  })
  const r = render(ReportArchiveDetail, { reportId: 'r-tarot', onBack() {} })
  await flush(4)
  assert.ok(r.$('.archived-tarot-view'), '完整塔罗应恢复牌阵阅读面')
  assert.ok(r.text().includes('太阳'))
  assert.ok(r.text().includes('主动会带来更清晰的回应'))
  assert.equal(r.text().includes('# 不应作为页面正文显示'), false)
  r.unmount()
})

test('不完整旧基础命盘不会生成兜底详情', async () => {
  stubReportDetail({
    id: 'r-chart', type: 'chart', title: '基础命盘记录 · 1990-06-30', summary: '丙日主',
    facts: ['日主：丙火', '四柱：[object Object]'],
    report: null,
    chart: { year: 1990, month: 6, day: 30, hour: 12, gender: '女', pillars: [{ gan: '庚', zhi: '午' }, { gan: '壬', zhi: '午' }, { gan: '丙', zhi: '子' }, { gan: '甲', zhi: '午' }] },
    agentSessionIds: [],
  })
  const r = render(ReportArchiveDetail, { reportId: 'r-chart', onBack() {} })
  await flush(4)
  assert.ok(r.text().includes('没有完整报告结果'))
  assert.equal(r.text().includes('基础档案'), false)
  assert.equal(r.text().includes('[object Object]'), false)
  r.unmount()
})

test('完整称骨档案恢复骨重、传统歌诀与日常建议', async () => {
  stubReportDetail({
    id: 'r-chenggu', type: 'chenggu', title: '称骨论命 · 3.8两', summary: '稳步积累更有利。',
    report: {
      summary: { total: 3.8, tone: '稳进', lunarYear: '庚午', lunarMonth: '五月', lunarDay: '初八', shiChen: '午', gender: '女' },
      verdict: { plain: '先稳住节奏，再扩大成果。' }, uncertainty: { isEstimate: false },
      breakdown: [{ name: '年骨', value: 0.9, detail: '庚午年' }], classic: { title: '三两八钱', sourceVerse: '一身骨肉最清高。早入簧门姓氏标。' },
      bazi: { pillars: ['庚午', '壬午', '丙子', '甲午'], dayMaster: '丙火', strength: '偏旺', favorable: ['水', '金'] },
      lines: [{ key: 'work', label: '工作与学业', text: '先完成核心任务，再扩展协作。' }], archive: { mode: 'native', sourceType: 'chenggu' },
    }, facts: [], agentSessionIds: [],
  })
  const r = render(ReportArchiveDetail, { reportId: 'r-chenggu', onBack() {} })
  await flush(4)
  assert.ok(r.$('.archived-chenggu-view'))
  assert.ok(r.text().includes('一身骨肉最清高。'))
  assert.ok(r.text().includes('工作与学业'))
  r.unmount()
})

test('完整姓名、风水与星座档案进入各自的只读阅读面', async () => {
  const cases = [
    {
      className: '.archived-name-view', report: {
        id: 'r-name', type: 'name', title: '姓名测算 · 王梓萱', summary: '格局协调。', facts: [], agentSessionIds: [],
        report: { analysis: { input: { surname: '王', given: '梓萱' }, score: 86, grade: '吉', summaryText: '格局协调。', grid: [{ name: '人格', value: 15, wuxing: '土', luck: { 吉: true, category: '吉' }, desc: '稳健' }], sancai: { tian: '土', ren: '火', di: '木', verdict: '吉' } }, recommendations: [] },
      }, expected: '王梓萱',
    },
    {
      className: '.archived-fengshui-view', report: {
        id: 'r-fengshui', type: 'fengshui', title: '家居风水 · 布局分析', summary: '采光优先。', facts: [], agentSessionIds: [],
        report: { overallScore: 82, door: { dir: '南', wuxing: '火', match: '门向通达。' }, favorable: ['木'], avoid: ['金'], lucky: { 生方: '东', 天医: '东南', 延年: '南' }, summary: ['客厅保持明亮。'], rooms: [{ key: 'living', name: '客厅', dir: '东', wuxing: '木', score: 82, role: '聚气', ideal: '明亮整洁', tips: ['留出动线'], colorList: ['青绿'] }], bed: { dir: '东南', verdict: '吉', desc: '利于安稳休息。' } },
      }, expected: '客厅',
    },
    {
      className: '.archived-horoscope-view', report: {
        id: 'r-horoscope', type: 'horoscope', title: '白羊座 · 每日星座运势', summary: '行动力上扬。', facts: [], agentSessionIds: [],
        report: { sign: { name: '白羊座', en: 'Aries', icon: '♈', ruler: '火星', wx: '火', color: '红', dateRange: '3.21-4.19' }, today: { overall: 4, tone: '上扬', toneDesc: '行动力上扬。', scores: [{ key: 'career', label: '事业', en: 'Career', score: 4 }], luckyColor: '红色', luckyNum: 8, luckyDir: '东方', yi: ['推进'], ji: ['拖延'] }, tomorrow: { overall: 3, tone: '平稳', text: '留出空间复盘。' }, week: [] },
      }, expected: '白羊座',
    },
  ]
  for (const item of cases) {
    stubReportDetail(item.report)
    const r = render(ReportArchiveDetail, { reportId: item.report.id, onBack() {} })
    await flush(4)
    assert.ok(r.$(item.className), `${item.report.type} 应进入专属历史阅读面`)
    assert.ok(r.text().includes(item.expected))
    r.unmount()
  }
})
