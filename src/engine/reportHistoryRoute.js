const HISTORY_ROUTE_BY_TYPE = Object.freeze({
  bazi: 'bazi',
  ziwei: 'ziwei',
  qimen: 'qimen',
  huangli: 'huangli',
  tarot: 'tarot-reading',
  chenggu: 'chenggu',
  name: 'name',
  fengshui: 'fengshui',
  horoscope: 'astro',
})

const HISTORY_TYPE_BY_VIEW = Object.freeze(Object.fromEntries(
  Object.entries(HISTORY_ROUTE_BY_TYPE).map(([type, view]) => [view, type]),
))

export function historyRouteForReport(report) {
  return HISTORY_ROUTE_BY_TYPE[String(report?.type || '')] || null
}

export function historyTypeForView(view) {
  return HISTORY_TYPE_BY_VIEW[String(view || '')] || null
}

export function isHistoryReportView(view) {
  return Boolean(historyTypeForView(view))
}
