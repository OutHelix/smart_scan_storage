import type { Category, Document, UploadStatus } from '../types'
import { getToken } from './auth'
import { getErrorMessage } from './auth'

const API_BASE = '/api/v1'

function authHeaders(): HeadersInit {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/documents`, { headers: authHeaders() })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Failed to load documents'))
  return data as Document[]
}

export async function listCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories`, { headers: authHeaders() })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Failed to load categories'))
  return data as Category[]
}

export async function getHealthcheck(): Promise<unknown> {
  const res = await fetch('/health')
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Failed to load healthcheck'))
  return data
}

export type UploadOptions = {
  categoryId?: number
  useMl?: boolean
  uploadId?: string
}

export async function uploadDocument(
  file: File,
  options?: UploadOptions | number
): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  const categoryId =
    typeof options === 'number' ? options : options?.categoryId
  const useMl = typeof options === 'object' && options?.useMl
  const uploadId = typeof options === 'object' ? options?.uploadId : undefined
  if (categoryId != null) form.append('category_id', String(categoryId))
  if (useMl) form.append('use_ml', 'true')
  if (uploadId) form.append('upload_id', uploadId)
  const token = getToken()
  if (!token) throw new Error('Sign in to upload files')
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Upload failed'))
  return data as Document
}

export async function getUploadStatus(uploadId: string): Promise<UploadStatus> {
  const res = await fetch(`${API_BASE}/documents/upload-status/${uploadId}`, { headers: authHeaders() })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Failed to load upload status'))
  return data as UploadStatus
}

export async function getDocument(id: number): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/${id}`, { headers: authHeaders() })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Document not found'))
  return data as Document
}

export async function getDocumentOcr(id: number): Promise<{ ocr_text: string | null; predicted_confidence: number | null; predicted_category_name: string | null }> {
  const res = await fetch(`${API_BASE}/documents/${id}/ocr`, { headers: authHeaders() })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Failed to load OCR data'))
  return data
}

export async function getDocumentPreviewUrl(id: number): Promise<string> {
  const token = getToken()
  if (!token) throw new Error('Sign in to view')
  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(getErrorMessage(data, 'Failed to load preview'))
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function downloadDocument(id: number, filename: string): Promise<void> {
  const token = getToken()
  if (!token) throw new Error('Sign in to download')
  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(getErrorMessage(data, 'Download failed'))
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(getErrorMessage(data, 'Failed to delete'))
  }
}
