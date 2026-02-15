import { Outlet, Link, useLocation } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Home' },
  { to: '/upload', label: 'Upload' },
  { to: '/stitch', label: 'Stitch' },
]

export function Layout() {
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
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
