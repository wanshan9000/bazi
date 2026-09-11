import { useEffect } from 'react'

export default function ReportDeleteConfirm({ open, deleting = false, error = '', onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => {
      if (event.key === 'Escape' && !deleting) onCancel?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleting, onCancel, open])

  if (!open) return null

  const close = () => {
    if (!deleting) onCancel?.()
  }

  return (
    <div className="saved-report-confirm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
      <section className="saved-report-confirm-card" role="dialog" aria-modal="true" aria-labelledby="report-delete-confirm-title" aria-describedby="report-delete-confirm-copy">
        <div className="saved-report-confirm-heading">
          <span className="saved-report-confirm-mark" aria-hidden="true">!</span>
          <div>
            <p className="saved-report-confirm-kicker">报告档案</p>
            <h2 id="report-delete-confirm-title">删除这份报告？</h2>
          </div>
        </div>
        <p id="report-delete-confirm-copy" className="saved-report-confirm-copy">报告会从“我的报告”移除；关联的元气 AI 会话仍会保留在会话历史中。</p>
        {error ? <p className="my-reports-delete-error" role="alert">{error}</p> : null}
        <div className="saved-report-confirm-actions">
          <button type="button" className="saved-report-confirm-cancel" onClick={close} disabled={deleting}>取消</button>
          <button type="button" className="saved-report-confirm-danger" onClick={onConfirm} disabled={deleting}>{deleting ? '删除中…' : '确认删除'}</button>
        </div>
      </section>
    </div>
  )
}
