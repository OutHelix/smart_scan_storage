import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '../types'
import { login, setToken } from '../api/auth'

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
      const { user, access_token } = await login(username, password)
      setToken(access_token)
      onLogin(user)
      navigate('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Log in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--center">
      <div className="card card--narrow card--auth">
        <h1 className="card-title">Log in</h1>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-username">Username</label>
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
            <label className="auth-label" htmlFor="login-password">Password</label>
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
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Signing in…' : 'Log in'}
            </button>
            <span className="auth-meta">
              No account? <Link to="/register">Sign up</Link>
            </span>
          </div>
          {error && <div className="auth-error">{error}</div>}
        </form>
      </div>
    </div>
  )
}
