import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '../types'
import { register as registerApi, login, setToken } from '../api/auth'

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
      await registerApi(username, email, password)
      const { user, access_token } = await login(username, password)
      setToken(access_token)
      onLogin(user)
      navigate('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--center">
      <div className="card card--narrow card--auth">
        <h1 className="card-title">Sign up</h1>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-username">Username</label>
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
            <label className="auth-label" htmlFor="register-password">Password</label>
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
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Creating account…' : 'Sign up'}
            </button>
            <span className="auth-meta">
              Already have an account? <Link to="/login">Log in</Link>
            </span>
          </div>
          {error && <div className="auth-error">{error}</div>}
        </form>
      </div>
    </div>
  )
}
