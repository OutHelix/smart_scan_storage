const API_BASE = '/api/v1'

export function getErrorMessage(data: unknown, fallback: string): string {
  if (data == null || typeof data !== 'object') return fallback
  const d = data as { detail?: unknown }
  if (d.detail == null) return fallback
  if (typeof d.detail === 'string') return d.detail
  if (Array.isArray(d.detail) && d.detail.length > 0) {
    const first = d.detail[0] as { msg?: string }
    return first.msg ?? fallback
  }
  return fallback
}

const TOKEN_KEY = 'sss_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export interface LoginResult {
  message: string
  user: { id: number; username: string; email: string; is_admin: boolean; created_at?: string }
  access_token: string
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Login failed'))
  return data as LoginResult
}

export async function register(username: string, email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Registration failed'))
  return data as { id: number; username: string; email: string; is_admin: boolean; created_at?: string }
}

export async function updateProfile(username: string, email: string) {
  const token = getToken()
  if (!token) throw new Error('Sign in to update profile')
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, email }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Failed to update profile'))
  return data as { id: number; username: string; email: string; is_admin: boolean; created_at?: string }
}
