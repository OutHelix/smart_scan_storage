import { useEffect, useState } from 'react'
import { getHealthcheck } from '../api/documents'

export function HealthPage() {
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getHealthcheck()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load healthcheck'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Healthcheck</h1>
      </div>
      <div className="card">
        {loading && <p className="page-muted">Loading...</p>}
        {error && <p className="page-error">{error}</p>}
        {!loading && !error && (
          <pre className="healthcheck-json">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
