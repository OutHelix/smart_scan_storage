import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { UploadPage } from './pages/UploadPage'
import { DocumentPage } from './pages/DocumentPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AccountPage } from './pages/AccountPage'
import { HealthPage } from './pages/HealthPage'
import { AdminLogsPage } from './pages/AdminLogsPage'
import { clearToken } from './api/auth'
import type { User } from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sss_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as User
        setUser(parsed)
      } catch {}
    }
  }, [])

  const handleLogin = (u: User) => {
    setUser(u)
    localStorage.setItem('sss_user', JSON.stringify(u))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('sss_user')
    clearToken()
  }

  const handleUserUpdate = (nextUser: User) => {
    setUser(nextUser)
    localStorage.setItem('sss_user', JSON.stringify(nextUser))
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
          <Route index element={<HomePage user={user} />} />
          <Route path="upload" element={<UploadPage user={user} />} />
          <Route path="doc/:id" element={<DocumentPage user={user} />} />
          <Route path="login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="register" element={<RegisterPage onLogin={handleLogin} />} />
          <Route path="account" element={<AccountPage user={user} onUserUpdate={handleUserUpdate} />} />
          <Route path="admin/logs" element={<AdminLogsPage user={user} />} />
          <Route path="health" element={<HealthPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
