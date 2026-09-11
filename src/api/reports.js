import { api } from './auth.js'

function pathWithType(type) {
  const clean = String(type || '').trim()
  return clean ? `/api/reports?type=${encodeURIComponent(clean)}` : '/api/reports'
}

export function createReportApi() {
  return {
    list(type = '') { return api(pathWithType(type)) },
    get(id) { return api(`/api/reports/${encodeURIComponent(id)}`) },
    save(draft) { return api('/api/reports', { method: 'POST', body: draft }) },
    migrate(reports) { return api('/api/reports/migrate', { method: 'POST', body: { reports } }) },
    linkSession(reportId, sessionId) {
      return api(`/api/reports/${encodeURIComponent(reportId)}/sessions`, { method: 'POST', body: { sessionId } })
    },
    remove(id) { return api(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
  }
}

export const reportApi = createReportApi()
