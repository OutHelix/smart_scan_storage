import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Document, User } from '../types'
import { deleteDocument, downloadDocument, getDocument, getDocumentPreviewUrl } from '../api/documents'
import { loadWorkspaceSettings } from '../workspaceSettings'

type DocumentPageProps = {
  user: User | null
}

function formatDate(s: string) {
  return new Date(s).toLocaleString('en-GB')
}

function formatSize(bytes: number | null) {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatConfidence(confidence: number | null) {
  if (confidence == null) return '-'
  return `${(confidence * 100).toFixed(1)}%`
}

function isImageMime(mime: string | null) {
  return !!mime && mime.startsWith('image/')
}

function isPdfMime(mime: string | null) {
  return !!mime && mime.includes('pdf')
}

export function DocumentPage({ user }: DocumentPageProps) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showFullOcr, setShowFullOcr] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewEnabled, setPreviewEnabled] = useState(loadWorkspaceSettings().autoOpenPreview)
  const urlRef = useRef<string | null>(null)

  const loadDocument = () => {
    if (!user || !id) return
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
  }

  useEffect(() => {
    if (!user || !id) {
      setLoading(false)
      return
    }
    loadDocument()
  }, [user, id])

  useEffect(() => {
    if (!doc || !previewEnabled) return
    setPreviewLoading(true)
    setPreviewError(null)
    getDocumentPreviewUrl(doc.id)
      .then((url) => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setPreviewUrl(url)
      })
      .catch((e) => {
        setPreviewError(e instanceof Error ? e.message : 'Failed to load preview')
      })
      .finally(() => setPreviewLoading(false))

    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
      setPreviewUrl(null)
    }
  }, [doc, previewEnabled])

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
      .then(() => navigate('/'))
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

  if (loading) return <div className="page"><p className="page-muted">Loading...</p></div>
  if (error || !doc) {
    return (
      <div className="page">
        <p className="page-error">{error ?? 'Document not found'}</p>
        <div className="card-actions">
          <button type="button" className="btn btn--secondary" onClick={loadDocument}>
            Try again
          </button>
          <Link to="/" className="btn btn--secondary">Back to list</Link>
        </div>
      </div>
    )
  }

  const truncatedOcr = doc.ocr_text && doc.ocr_text.length > 600
    ? `${doc.ocr_text.substring(0, 600)}...`
    : doc.ocr_text

  return (
    <div className="page page--wide">
      <div className="page-head">
        <Link to="/" className="btn btn--secondary">Back to list</Link>
      </div>

      <div className="doc-view">
        <section className="card doc-preview-card">
          <div className="doc-preview-head">
            <div>
              <p className="doc-preview-label">Preview</p>
              <h1 className="doc-detail-title">{doc.original_filename}</h1>
            </div>
            {doc.category && <span className="doc-badge">{doc.category.name}</span>}
          </div>

          <div className="doc-preview-stage">
            {!previewEnabled && (
              <div className="doc-preview-fallback">
                <strong>Preview is paused by workspace settings.</strong>
                <p className="page-muted">Load it manually when you need it.</p>
                <button type="button" className="btn btn--primary" onClick={() => setPreviewEnabled(true)}>
                  Load preview
                </button>
              </div>
            )}
            {previewEnabled && previewLoading && <p className="page-muted">Loading preview...</p>}
            {previewEnabled && !previewLoading && previewError && <p className="page-error">{previewError}</p>}
            {previewEnabled && !previewLoading && !previewError && previewUrl && isImageMime(doc.mime_type) && (
              <img src={previewUrl} alt={doc.original_filename} className="doc-preview-image" />
            )}
            {previewEnabled && !previewLoading && !previewError && previewUrl && isPdfMime(doc.mime_type) && (
              <iframe
                src={previewUrl}
                title={doc.original_filename}
                className="doc-preview-frame"
              />
            )}
            {previewEnabled && !previewLoading && !previewError && previewUrl && !isImageMime(doc.mime_type) && !isPdfMime(doc.mime_type) && (
              <div className="doc-preview-fallback">
                <strong>Preview is not available for this file type.</strong>
                <p className="page-muted">Use download to open the original file locally.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="card doc-sidebar">
          <div className="doc-sidebar-block">
            <p className="doc-preview-label">Document details</p>
            <dl className="doc-detail-meta">
              <dt>Uploaded</dt>
              <dd>{formatDate(doc.created_at)}</dd>
              <dt>Size</dt>
              <dd>{formatSize(doc.file_size)}</dd>
              <dt>Type</dt>
              <dd>{doc.mime_type ?? 'Unknown'}</dd>
              <dt>Category</dt>
              <dd>{doc.category?.name ?? 'Uncategorized'}</dd>
              {doc.predicted_category_name && (
                <>
                  <dt>ML Predicted</dt>
                  <dd>{doc.predicted_category_name}</dd>
                </>
              )}
              {doc.predicted_confidence != null && (
                <>
                  <dt>Confidence</dt>
                  <dd>{formatConfidence(doc.predicted_confidence)}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="doc-detail-actions">
            <button type="button" className="btn btn--primary btn--full" onClick={handleDownload}>
              Download
            </button>
            <button
              type="button"
              className="btn btn--danger btn--full"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </aside>
      </div>

      {doc.ocr_text && (
        <div className="card doc-ocr-card">
          <div className="doc-preview-head">
            <div>
              <p className="doc-preview-label">OCR</p>
              <h2 className="doc-section-title">Recognized text</h2>
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() => setShowFullOcr(!showFullOcr)}
            >
              {showFullOcr ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <div className="doc-ocr-content">
            {showFullOcr ? doc.ocr_text : truncatedOcr}
          </div>
        </div>
      )}

      {!doc.ocr_text && doc.mime_type && doc.mime_type.startsWith('image/') && (
        <div className="card doc-ocr-card">
          <p className="page-muted">No text recognized from this document.</p>
        </div>
      )}
    </div>
  )
}
