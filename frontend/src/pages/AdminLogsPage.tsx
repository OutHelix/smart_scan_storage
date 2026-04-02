import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getServiceLogs } from '../api/admin'
import type { ServiceLogsResponse, User } from '../types'

type AdminLogsPageProps = {
  user: User | null
}

export function AdminLogsPage({ user }: AdminLogsPageProps) {
  const [logs, setLogs] = useState<ServiceLogsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(300)

  const loadLogs = () => {
    if (!user?.is_admin) return
    setLoading(true)
    setError(null)
    getServiceLogs(limit)
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load logs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user?.is_admin) return
    loadLogs()
  }, [user, limit])

  if (!user) {
    return (
      <div className="page page--center">
        <div className="card card--narrow">
          <p>Sign in as admin to view service logs.</p>
          <Link to="/login" className="btn btn--primary">Log in</Link>
        </div>
      </div>
    )
  }

  if (!user.is_admin) {
    return (
      <div className="page page--center">
        <div className="card card--narrow">
          <p className="page-error">This page is available only for administrators.</p>
          <Link to="/account" className="btn btn--secondary">Back to account</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Service logs</h1>
          <p className="page-muted">Centralized backend log stream available for the default admin account.</p>
        </div>
        <div className="page-head-actions">
          <select
            className="page-category-select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={100}>100 lines</option>
            <option value={300}>300 lines</option>
            <option value={500}>500 lines</option>
            <option value={1000}>1000 lines</option>
          </select>
          <button type="button" className="btn btn--primary" onClick={loadLogs} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <p className="page-error">{error}</p>}

      <div className="card">
        <p className="doc-preview-label">Source</p>
        <p className="page-muted admin-logs-source">{logs?.source ?? 'No log file loaded yet'}</p>
        <p className="page-muted">Loaded lines: {logs?.line_count ?? 0}</p>
        <pre className="admin-log-viewer">
          {logs?.lines.length ? logs.lines.join('\n') : 'No log entries yet.'}
        </pre>
      </div>
    </div>
  )
}
