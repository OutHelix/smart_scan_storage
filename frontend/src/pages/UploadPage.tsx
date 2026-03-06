import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '../types'
import { uploadDocument } from '../api/documents'

const ALLOWED = '.pdf,.jpg,.jpeg,.png,.gif,.webp'

type UploadPageProps = {
  user: User | null
}

export function UploadPage({ user }: UploadPageProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ name: string; done: boolean; error?: string }[]>([])
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

  const startUpload = async () => {
    if (!user || files.length === 0) return
    setUploading(true)
    const next: { name: string; done: boolean; error?: string }[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        await uploadDocument(file)
        next.push({ name: file.name, done: true })
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
    }
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
