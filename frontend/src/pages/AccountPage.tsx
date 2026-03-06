import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '../types'
import type { Document } from '../types'
import { listDocuments } from '../api/documents'

type AccountPageProps = {
  user: User | null
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AccountPage({ user }: AccountPageProps) {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(!!user)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    listDocuments()
      .then(setDocs)
      .finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className="page page--center">
        <div className="card card--narrow card--auth">
          <h1 className="card-title">Account</h1>
          <p className="card-text">Sign in to view your documents and settings.</p>
          <div className="card-actions">
            <Link to="/login" className="btn btn--primary">Log in</Link>
            <Link to="/register" className="btn btn--secondary">Sign up</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="account-hero">
        <div className="account-avatar">{user.username.charAt(0).toUpperCase()}</div>
        <div className="account-info">
          <h1 className="account-name">{user.username}</h1>
          <p className="account-email">{user.email}</p>
          {user.created_at && (
            <p className="account-meta">Joined {formatDate(user.created_at)}</p>
          )}
        </div>
      </div>
      <section className="account-section">
        <h2 className="section-title">Recent documents</h2>
        {loading && <p className="page-muted">Loading…</p>}
        {!loading && docs.length === 0 && (
          <p className="page-muted">No documents yet. <Link to="/upload">Upload your first file</Link>.</p>
        )}
        {!loading && docs.length > 0 && (
          <ul className="account-doc-list">
            {docs.slice(0, 10).map((doc) => (
              <li key={doc.id} className="account-doc-item">
                <Link to={`/doc/${doc.id}`} className="account-doc-link">
                  <span className="account-doc-name">{doc.original_filename}</span>
                  <span className="account-doc-date">{formatDate(doc.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {docs.length > 0 && (
          <Link to="/" className="btn btn--secondary">All documents →</Link>
        )}
      </section>
    </div>
  )
}
