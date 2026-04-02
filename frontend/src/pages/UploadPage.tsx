import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Category, User, UploadStatus } from '../types'
import { getUploadStatus, listCategories, uploadDocument } from '../api/documents'

const ALLOWED = '.pdf,.jpg,.jpeg,.png,.gif,.webp'

type UploadPageProps = {
  user: User | null
}

type UploadItemProgress = {
  name: string
  done: boolean
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error'
  percent?: number
  stage?: string
  details?: Record<string, unknown>
  error?: string
}

function createUploadId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function humanizeStage(stage?: string) {
  switch (stage) {
    case 'request_received': return 'Request received'
    case 'file_saved': return 'File saved'
    case 'ml_start': return 'Starting ML pipeline'
    case 'image_loaded': return 'Image loaded'
    case 'classification': return 'Running classification'
    case 'classification_complete': return 'Classification complete'
    case 'ocr_start': return 'Starting OCR'
    case 'ocr_detecting': return 'Detecting text boxes'
    case 'ocr_generating': return 'Recognizing text'
    case 'ocr_fallback': return 'Using OCR fallback'
    case 'ocr_complete': return 'OCR complete'
    case 'ml_complete': return 'ML complete'
    case 'pdf_fallback': return 'PDF fallback'
    case 'saving_document': return 'Saving document'
    case 'completed': return 'Completed'
    case 'error': return 'Error'
    default: return stage ?? 'Waiting'
  }
}

function formatUploadDetails(status?: UploadStatus | null) {
  if (!status) return 'Waiting for server status...'
  const details = status.details ?? {}
  if (status.stage === 'classification_complete') {
    const predicted = details.predicted_class
    const confidence = typeof details.confidence === 'number'
      ? `${(details.confidence * 100).toFixed(1)}%`
      : null
    return predicted && confidence
      ? `Predicted class: ${predicted} (${confidence})`
      : 'Classification complete'
  }
  if (status.stage === 'ocr_detecting' && typeof details.detected_boxes === 'number') {
    return `Detected text boxes: ${details.detected_boxes}`
  }
  if (status.stage === 'ocr_generating') {
    const completed = details.completed_crops
    const total = details.total_crops
    if (typeof completed === 'number' && typeof total === 'number') {
      return `OCR crops processed: ${completed} / ${total}`
    }
  }
  if (status.stage === 'ocr_fallback' && typeof details.reason === 'string') {
    return `Fallback reason: ${details.reason}`
  }
  if (status.stage === 'completed' && typeof details.document_id === 'number') {
    return `Document ID: ${details.document_id}`
  }
  if (status.stage === 'error' && typeof details.message === 'string') {
    return details.message
  }
  if (typeof details.message === 'string') {
    return details.message
  }
  return humanizeStage(status.stage)
}

export function UploadPage({ user }: UploadPageProps) {
  const [files, setFiles] = useState<File[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [useMl, setUseMl] = useState(true)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadItemProgress[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [currentFileName, setCurrentFileName] = useState<string | null>(null)
  const [serverStatus, setServerStatus] = useState<UploadStatus | null>(null)
  const pollingRef = useRef<number | null>(null)
  const navigate = useNavigate()

  const allowed = (f: File) => {
    const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
    return ALLOWED.split(',').includes(ext)
  }

  const stopPolling = () => {
    if (pollingRef.current != null) {
      window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }
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
        if (data.length > 0) {
          setCategoryId(data[0].id)
        }
      })
      .catch((err) => setCategoriesError(err instanceof Error ? err.message : 'Failed to load categories'))
      .finally(() => setLoadingCategories(false))
  }, [user])

  useEffect(() => () => stopPolling(), [])

  const startUpload = async () => {
    if (!user || files.length === 0) return

    setUploading(true)
    setUploadError(null)

    const next: UploadItemProgress[] = files.map((file) => ({
      name: file.name,
      done: false,
      status: 'queued',
      percent: 0,
    }))
    const successfulIndexes: number[] = []
    setProgress(next)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const uploadId = createUploadId()
      setCurrentFileName(file.name)
      setServerStatus(null)
      next[i] = { name: file.name, done: false, status: 'uploading', percent: 1, stage: 'queued' }
      setProgress([...next])

      const pollStatus = async () => {
        try {
          const status = await getUploadStatus(uploadId)
          setServerStatus(status)
          next[i] = {
            name: file.name,
            done: status.stage === 'completed',
            status: status.stage === 'completed'
              ? 'done'
              : status.stage === 'error'
                ? 'error'
                : status.percent >= 20
                  ? 'processing'
                  : 'uploading',
            percent: status.percent,
            stage: status.stage,
            details: status.details,
            error: status.stage === 'error' && typeof status.details.message === 'string'
              ? status.details.message
              : undefined,
          }
          setProgress([...next])
        } catch {}
      }

      await pollStatus()
      pollingRef.current = window.setInterval(() => {
        void pollStatus()
      }, 1000)

      try {
        await uploadDocument(
          file,
          useMl
            ? { useMl: true, uploadId }
            : { categoryId: categoryId ?? undefined, uploadId }
        )
        await pollStatus()
        stopPolling()
        next[i] = {
          ...next[i],
          done: true,
          status: 'done',
          percent: 100,
          stage: 'completed',
        }
        successfulIndexes.push(i)
      } catch (err) {
        stopPolling()
        await pollStatus()
        next[i] = {
          ...next[i],
          done: false,
          status: 'error',
          percent: next[i]?.percent ?? 0,
          error: err instanceof Error ? err.message : 'Upload failed',
        }
      }

      setProgress([...next])
    }

    stopPolling()
    setUploading(false)
    setCurrentFileName(null)

    if (next.every((item) => item.done)) {
      setFiles([])
      setProgress([])
      setServerStatus(null)
      setTimeout(() => navigate('/'), 500)
      return
    }

    setUploadError('Some files failed to upload. Fix issues and retry.')
    setFiles((prev) => prev.filter((_, index) => !successfulIndexes.includes(index)))
    setProgress(next.filter((item) => !item.done))
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

  const completedCount = progress.filter((item) => item.done).length
  const activeProgress = progress.find((item) => !item.done && item.status !== 'error') ?? null
  const activePercent = activeProgress?.percent ?? 0

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Upload documents</h1>
        <Link to="/" className="btn btn--secondary">Back</Link>
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
          <span className="upload-option-label">Auto-categorize with AI (recommended)</span>
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
          <p className="upload-ml-hint">AI will analyze the document content and assign the most appropriate category automatically.</p>
        )}
        {categoriesError && <p className="page-error">{categoriesError}</p>}
      </div>
      {uploadError && <p className="page-error">{uploadError}</p>}
      {files.length > 0 && (
        <div className="upload-queue">
          <h3>Queue ({files.length})</h3>
          {uploading && (
            <div className="upload-progress-card">
              <div className="upload-progress-head">
                <strong>Document processing</strong>
                <span>{completedCount} / {files.length}</span>
              </div>
              <div className="upload-progress-bar">
                <div
                  className="upload-progress-bar-fill"
                  style={{ width: `${Math.max(activePercent, 2)}%` }}
                />
              </div>
              <div className="upload-progress-metrics">
                <span>{activePercent.toFixed(0)}%</span>
                <span>{humanizeStage(serverStatus?.stage ?? activeProgress?.stage)}</span>
              </div>
              <p className="page-muted upload-progress-text">
                {currentFileName ? `Current file: ${currentFileName}` : 'Preparing upload...'}
              </p>
              <p className="page-muted upload-progress-text">
                {formatUploadDetails(serverStatus)}
              </p>
            </div>
          )}
          <ul className="upload-list">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="upload-item">
                <span className="upload-name">{f.name}</span>
                {typeof progress[i]?.percent === 'number' && (
                  <span className="upload-status upload-status--percent">{progress[i]?.percent?.toFixed(0)}%</span>
                )}
                {progress[i]?.status === 'uploading' && <span className="upload-status upload-status--run">Uploading</span>}
                {progress[i]?.status === 'processing' && <span className="upload-status upload-status--run">{humanizeStage(progress[i]?.stage)}</span>}
                {progress[i]?.status === 'done' && <span className="upload-status upload-status--ok">Uploaded</span>}
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
            {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
