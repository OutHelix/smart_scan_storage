import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Document } from '../types'
import { getDocumentPreviewUrl } from '../api/documents'

type DocumentCardProps = {
  doc: Document
  formatDate: (s: string) => string
  formatSize: (bytes: number | null) => string
  compact?: boolean
  showConfidence?: boolean
  autoOpenPreview?: boolean
}

function isImageMime(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

function isPdfMime(mime: string | null): boolean {
  return !!mime && mime.includes('pdf')
}

export function DocumentCard({
  doc,
  formatDate,
  formatSize,
  compact = false,
  showConfidence = true,
  autoOpenPreview = true,
}: DocumentCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const urlRef = useRef<string | null>(null)
  const showImagePreview = isImageMime(doc.mime_type)
  const showPdfPlaceholder = isPdfMime(doc.mime_type)

  useEffect(() => {
    if (!showImagePreview || !autoOpenPreview) return
    let cancelled = false
    getDocumentPreviewUrl(doc.id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPreviewError(true)
      })
    return () => {
      cancelled = true
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
      setPreviewUrl(null)
    }
  }, [doc.id, showImagePreview])

  return (
    <Link to={`/doc/${doc.id}`} className={compact ? 'doc-card doc-card--compact' : 'doc-card'}>
      <div className="doc-card-preview">
        {showImagePreview && previewUrl && !previewError && (
          <img
            src={previewUrl}
            alt=""
            className="doc-card-preview-img"
          />
        )}
        {showImagePreview && autoOpenPreview && (previewError || !previewUrl) && (
          <span className="doc-card-preview-fallback">Image</span>
        )}
        {showImagePreview && !autoOpenPreview && (
          <span className="doc-card-preview-fallback">Preview on open</span>
        )}
        {showPdfPlaceholder && (
          <div className="doc-card-preview-pdf">
            <span className="doc-card-preview-pdf-icon">PDF</span>
          </div>
        )}
        {!showImagePreview && !showPdfPlaceholder && (
          <span className="doc-card-preview-fallback">File</span>
        )}
      </div>
      <div className="doc-card-name">{doc.original_filename}</div>
      {doc.category && <div className="doc-card-category">{doc.category.name}</div>}
      {showConfidence && doc.predicted_confidence != null && (
        <div className="doc-card-confidence">
          ML confidence {`${(doc.predicted_confidence * 100).toFixed(1)}%`}
        </div>
      )}
      <div className="doc-card-meta">
        {formatDate(doc.created_at)}
        {doc.file_size != null && ` | ${formatSize(doc.file_size)}`}
      </div>
    </Link>
  )
}
