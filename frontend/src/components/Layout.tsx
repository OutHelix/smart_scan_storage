import { Outlet, Link, useLocation } from 'react-router-dom'
import type { User } from '../types'

type LayoutProps = {
  user: User | null
  onLogout: () => void
}

export function Layout({ user, onLogout }: LayoutProps) {
  const location = useLocation()
  const nav = [
    { to: '/', label: 'Home' },
    { to: '/upload', label: 'Upload' },
    { to: '/account', label: 'Account' },
    ...(user?.is_admin ? [{ to: '/admin/logs', label: 'Logs' }] : []),
  ]

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-title">Smart Scan Storage</Link>
        <nav className="layout-nav">
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={location.pathname === to ? 'layout-nav-link active' : 'layout-nav-link'}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="layout-user">
          {user ? (
            <>
              <div className="layout-user-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="layout-user-info">
                <Link to="/account" className="layout-user-name">{user.username}</Link>
                <button
                  type="button"
                  className="btn btn--header"
                  onClick={onLogout}
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            <div className="layout-auth-links">
              <Link
                to="/login"
                className={location.pathname === '/login' ? 'layout-nav-link active' : 'layout-nav-link'}
              >
                Log in
              </Link>
              <Link
                to="/register"
                className={location.pathname === '/register' ? 'layout-nav-link active' : 'layout-nav-link'}
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
      <footer className="layout-footer">
        <div className="layout-footer-links">
          <Link to="/health" target="_blank" rel="noreferrer" className="layout-footer-link">
            Healthcheck
          </Link>
          <a href="/docs" target="_blank" rel="noreferrer" className="layout-footer-link">
            API docs
          </a>
        </div>
      </footer>
    </div>
  )
}
