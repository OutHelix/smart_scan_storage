import { Outlet, Link, useLocation } from 'react-router-dom'
import type { User } from '../types'

type LayoutProps = {
  user: User | null
  onLogout: () => void
}

const nav = [
  { to: '/', label: 'Home' },
  { to: '/upload', label: 'Upload' },
  { to: '/account', label: 'Account' },
  { to: '/stitch', label: 'Stitch' },
]

export function Layout({ user, onLogout }: LayoutProps) {
  const location = useLocation()

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
    </div>
  )
}
