import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '../types'
import { register as registerApi } from '../api/auth'

type RegisterPageProps = {
  onLogin: (user: User) => void
}

export function RegisterPage({ onLogin }: RegisterPageProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await registerApi(username, email, password)
      onLogin(user)
      navigate('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wf">
      <div className="auth-card">
        <div className="auth-title">Регистрация</div>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-username">Имя пользователя</label>
            <input
              id="register-username"
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-password">Пароль</label>
            <input
              id="register-password"
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="auth-actions">
            <button type="submit" className="wf-btn" disabled={loading}>
              {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
            </button>
            <span className="auth-meta">
              Уже есть аккаунт? <Link to="/login">Войти</Link>
            </span>
          </div>
          {error && <div className="auth-error">{error}</div>}
        </form>
      </div>
    </div>
  )
}

