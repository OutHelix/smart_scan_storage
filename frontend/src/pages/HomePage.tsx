import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { User, Category, Document } from '../types'
import { listCategories, listDocuments } from '../api/documents'
import { DocumentCard } from '../components/DocumentCard'
import { loadWorkspaceSettings } from '../workspaceSettings'

type HomePageProps = {
  user: User | null
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatSize(bytes: number | null) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function HomePage({ user }: HomePageProps) {
  const [docs, setDocs] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [loading, setLoading] = useState(!!user)
  const [error, setError] = useState<string | null>(null)
  const [settingsVersion, setSettingsVersion] = useState(0)

  const loadDocuments = useCallback(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    listDocuments()
      .then(setDocs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!user) {
      setDocs([])
      setCategories([])
      setLoading(false)
      return
    }
    loadDocuments()
    listCategories()
      .then(setCategories)
      .catch((e) => console.error('Failed to load categories:', e))
  }, [user, loadDocuments])

  useEffect(() => {
    const onFocus = () => setSettingsVersion((value) => value + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const settings = loadWorkspaceSettings()
  void settingsVersion

  const filteredDocs =
    selectedCategoryId === null
      ? docs
      : docs.filter((d) => d.category?.id === selectedCategoryId)

  if (!user) {
    return (
      <div className="page page--center">
        <div className="card card--narrow">
          <h1 className="card-title">Documents</h1>
          <p className="card-text">Sign in to upload and view your documents.</p>
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
      <div className="page-head">
        <h1 className="page-title">My documents</h1>
        <div className="page-head-actions">
          {categories.length > 0 && (
            <select
              className="page-category-select"
              value={selectedCategoryId ?? ''}
              onChange={(e) =>
                setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">All categories ({docs.length})</option>
              {categories.map((cat) => {
                const count = docs.filter((d) => d.category?.id === cat.id).length
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({count})
                  </option>
                )
              })}
            </select>
          )}
          <Link to="/upload" className="btn btn--primary">Upload</Link>
        </div>
      </div>
      {loading && <p className="page-muted">Loading...</p>}
      {error && (
        <div className="card card--empty">
          <p className="page-error">{error}</p>
          <button type="button" className="btn btn--secondary" onClick={loadDocuments}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && docs.length === 0 && (
        <div className="card card--empty">
          <p>No documents yet. Upload your first file.</p>
          <Link to="/upload" className="btn btn--primary">Upload document</Link>
        </div>
      )}
      {!loading && !error && docs.length > 0 && filteredDocs.length === 0 && (
        <div className="card card--empty">
          <p>No documents in this category.</p>
        </div>
      )}
      {!loading && !error && filteredDocs.length > 0 && (
        <div className={settings.compactCards ? 'doc-grid doc-grid--compact' : 'doc-grid'}>
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              formatDate={formatDate}
              formatSize={formatSize}
              compact={settings.compactCards}
              showConfidence={settings.showConfidence}
              autoOpenPreview={settings.autoOpenPreview}
            />
          ))}
        </div>
      )}
    </div>
  )
}
