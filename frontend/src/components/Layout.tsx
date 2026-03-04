import { Outlet, Link, useLocation } from 'react-router-dom'
import type { User } from '../types'

type LayoutProps = {
  user: User | null
  onLogout: () => void
}

const nav = [
  { to: '/', label: 'Главная' },
  { to: '/upload', label: 'Загрузка' },
  { to: '/stitch', label: 'Склейка' },
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
                <div className="layout-user-name">{user.username}</div>
                <button
                  type="button"
                  className="wf-btn wf-btn--ghost"
                  onClick={onLogout}
                >
                  Выйти
                </button>
              </div>
            </>
          ) : (
            <div className="layout-auth-links">
              <Link
                to="/login"
                className={location.pathname === '/login' ? 'layout-nav-link active' : 'layout-nav-link'}
              >
                Вход
              </Link>
              <Link
                to="/register"
                className={location.pathname === '/register' ? 'layout-nav-link active' : 'layout-nav-link'}
              >
                Регистрация
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
