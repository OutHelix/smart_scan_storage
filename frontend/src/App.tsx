import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { UploadPage } from './pages/UploadPage'
import { DocumentPage } from './pages/DocumentPage'
import { StitchPage } from './pages/StitchPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AccountPage } from './pages/AccountPage'
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
      } catch {
        // ignore
      }
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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
          <Route index element={<HomePage user={user} />} />
          <Route path="upload" element={<UploadPage user={user} />} />
          <Route path="doc/:id" element={<DocumentPage user={user} />} />
          <Route path="stitch" element={<StitchPage />} />
          <Route path="login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="register" element={<RegisterPage onLogin={handleLogin} />} />
          <Route path="account" element={<AccountPage user={user} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
