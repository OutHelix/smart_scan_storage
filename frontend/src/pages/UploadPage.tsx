import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Category, User } from '../types'
import { listCategories, uploadDocument } from '../api/documents'

const ALLOWED = '.pdf,.jpg,.jpeg,.png,.gif,.webp'

type UploadPageProps = {
  user: User | null
}

export function UploadPage({ user }: UploadPageProps) {
  const [files, setFiles] = useState<File[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [useMl, setUseMl] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ name: string; done: boolean; error?: string }[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const navigate = useNavigate()

  const allowed = (f: File) => {
    const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
    return ALLOWED.split(',').includes(ext)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const list = Array.from(e.dataTransfer.files).filter(allowed)
    setFiles((prev) => [...prev, ...list])
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(true)
  }, [])

  const onDragLeave = useCallback(() => setDrag(false), [])

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []).filter(allowed)
    setFiles((prev) => [...prev, ...list])
    e.target.value = ''
  }, [])

  useEffect(() => {
    if (!user) return
    setLoadingCategories(true)
    setCategoriesError(null)
    listCategories()
      .then((data) => {
        setCategories(data)
        setCategoryId(data[0]?.id ?? null)
      })
      .catch((err) => setCategoriesError(err instanceof Error ? err.message : 'Failed to load categories'))
      .finally(() => setLoadingCategories(false))
  }, [user])

  const startUpload = async () => {
    if (!user || files.length === 0) return
    setUploading(true)
    setUploadError(null)
    const next: { name: string; done: boolean; error?: string }[] = []
    const successfulIndexes: number[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        await uploadDocument(
          file,
          useMl ? { useMl: true } : { categoryId: categoryId ?? undefined }
        )
        next.push({ name: file.name, done: true })
        successfulIndexes.push(i)
      } catch (err) {
        next.push({ name: file.name, done: false, error: err instanceof Error ? err.message : 'Error' })
      }
      setProgress([...next])
    }
    setUploading(false)
    if (next.every((p) => p.done)) {
      setFiles([])
      setProgress([])
      navigate('/')
      return
    }
    setUploadError('Some files failed to upload. Fix issues and retry.')
    setFiles((prev) => prev.filter((_, index) => !successfulIndexes.includes(index)))
    setProgress(next.filter((p) => !p.done))
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setProgress((prev) => prev.filter((_, i) => i !== index))
  }

  if (!user) {
    return (
      <div className="page page--center">
        <div className="card card--narrow">
          <h1 className="card-title">Upload</h1>
          <p>Sign in to upload files.</p>
          <Link to="/login" className="btn btn--primary">Log in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Upload documents</h1>
        <Link to="/" className="btn btn--secondary">← Back</Link>
      </div>
      <div
        className={`dropzone ${drag ? 'dropzone--active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          multiple
          accept={ALLOWED}
          onChange={onSelect}
          className="dropzone-input"
          id="file-input"
        />
        <label htmlFor="file-input" className="dropzone-label">
          Drag files here or click to select
        </label>
        <p className="dropzone-hint">PDF, JPG, PNG, GIF, WEBP</p>
      </div>
      <div className="upload-options">
        <label className="upload-option-row">
          <input
            type="checkbox"
            checked={useMl}
            onChange={(e) => setUseMl(e.target.checked)}
          />
          <span className="upload-option-label">Auto-categorize with AI</span>
        </label>
        {!useMl && (
          <div className="upload-category">
            <label htmlFor="category-select" className="dropzone-hint">Category</label>
            <select
              id="category-select"
              className="upload-category-select"
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingCategories || categories.length === 0}
            >
              {categories.length === 0 && <option value="">No categories</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {useMl && (
          <p className="upload-ml-hint">AI will analyze filenames and assign the best category.</p>
        )}
        {categoriesError && <p className="page-error">{categoriesError}</p>}
      </div>
      {uploadError && <p className="page-error">{uploadError}</p>}
      {files.length > 0 && (
        <div className="upload-queue">
          <h3>Queue ({files.length})</h3>
          <ul className="upload-list">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="upload-item">
                <span className="upload-name">{f.name}</span>
                {progress[i]?.done && <span className="upload-status upload-status--ok">✓</span>}
                {progress[i]?.error && (
                  <span className="upload-status upload-status--err">{progress[i].error}</span>
                )}
                {!uploading && !progress[i] && (
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => removeFile(i)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn--primary"
            onClick={startUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Upload all'}
          </button>
        </div>
      )}
    </div>
  )
}
