const API_BASE = '/api/v1'

/** Normalise API error detail (string or validation array) into a single message for UI */
export function getErrorMessage(data: unknown, fallback: string): string {
  if (data == null || typeof data !== 'object') return fallback
  const d = data as { detail?: unknown }
  if (d.detail == null) return fallback
  if (typeof d.detail === 'string') return d.detail
  if (Array.isArray(d.detail) && d.detail.length > 0) {
    const first = d.detail[0] as { msg?: string; loc?: unknown[] }
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
  user: { id: number; username: string; email: string; created_at?: string }
  access_token: string
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Ошибка входа'))
  return data as LoginResult
}

export async function register(username: string, email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Ошибка регистрации'))
  return data as { id: number; username: string; email: string; created_at?: string }
}
