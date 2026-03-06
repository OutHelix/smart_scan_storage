import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { User } from '../types'
import type { Document } from '../types'
import { getDocument, downloadDocument, deleteDocument } from '../api/documents'

type DocumentPageProps = {
  user: User | null
}

function formatDate(s: string) {
  return new Date(s).toLocaleString('en-GB')
}

function formatSize(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentPage({ user }: DocumentPageProps) {
  const { id } = useParams()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user || !id) {
      setLoading(false)
      return
    }
    const numId = parseInt(id, 10)
    if (Number.isNaN(numId)) {
      setError('Invalid ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getDocument(numId)
      .then(setDoc)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [user, id])

  const handleDownload = () => {
    if (!doc) return
    downloadDocument(doc.id, doc.original_filename).catch((e) =>
      setError(e instanceof Error ? e.message : 'Download failed')
    )
  }

  const handleDelete = () => {
    if (!doc || !window.confirm('Delete this document?')) return
    setDeleting(true)
    deleteDocument(doc.id)
      .then(() => (window.location.href = '/'))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Delete failed')
        setDeleting(false)
      })
  }

  if (!user) {
    return (
      <div className="page page--center">
        <div className="card card--narrow">
          <p>Sign in to view documents.</p>
          <Link to="/login" className="btn btn--primary">Log in</Link>
        </div>
      </div>
    )
  }

  if (loading) return <div className="page"><p className="page-muted">Loading…</p></div>
  if (error || !doc) {
    return (
      <div className="page">
        <p className="page-error">{error ?? 'Document not found'}</p>
        <Link to="/" className="btn btn--secondary">Back to list</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <Link to="/" className="btn btn--secondary">← Back to list</Link>
      </div>
      <div className="card doc-detail">
        <div className="doc-detail-icon">📄</div>
        <h1 className="doc-detail-title">{doc.original_filename}</h1>
        <dl className="doc-detail-meta">
          <dt>Uploaded</dt>
          <dd>{formatDate(doc.created_at)}</dd>
          <dt>Size</dt>
          <dd>{formatSize(doc.file_size)}</dd>
        </dl>
        <div className="doc-detail-actions">
          <button type="button" className="btn btn--primary" onClick={handleDownload}>
            Download
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
