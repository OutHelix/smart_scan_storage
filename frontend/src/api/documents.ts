import type { Document } from '../types'
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

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  const token = getToken()
  if (!token) throw new Error('Войдите в аккаунт для загрузки файлов')
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Upload failed'))
  return data as Document
}

export async function getDocument(id: number): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/${id}`, { headers: authHeaders() })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Document not found'))
  return data as Document
}

/** Fetches file and returns an object URL for preview (e.g. in <img>). Caller must revoke the URL when done. */
export async function getDocumentPreviewUrl(id: number): Promise<string> {
  const token = getToken()
  if (!token) throw new Error('Sign in to view')
  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to load preview')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function downloadDocument(id: number, filename: string): Promise<void> {
  const token = getToken()
  if (!token) throw new Error('Sign in to download')
  const res = await fetch(`${API_BASE}/documents/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
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
