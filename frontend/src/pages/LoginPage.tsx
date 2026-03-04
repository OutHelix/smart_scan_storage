import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '../types'
import { login } from '../api/auth'

type LoginPageProps = {
  onLogin: (user: User) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { user } = await login(username, password)
      onLogin(user)
      navigate('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wf">
      <div className="auth-card">
        <div className="auth-title">Вход</div>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-username">Имя пользователя</label>
            <input
              id="login-username"
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="auth-actions">
            <button type="submit" className="wf-btn" disabled={loading}>
              {loading ? 'Входим…' : 'Войти'}
            </button>
            <span className="auth-meta">
              Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
            </span>
          </div>
          {error && <div className="auth-error">{error}</div>}
        </form>
      </div>
    </div>
  )
}

