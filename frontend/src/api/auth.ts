const API_BASE = '/api/v1'

/** Преобразует detail из ответа API (строка или массив ошибок валидации) в одну строку для UI */
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

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Ошибка входа'))
  return data as { message: string; user: { id: number; username: string; email: string; created_at?: string } }
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
