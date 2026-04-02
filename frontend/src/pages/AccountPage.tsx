import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Document, User } from '../types'
import { updateProfile } from '../api/auth'
import { listDocuments } from '../api/documents'
import { loadWorkspaceSettings, saveWorkspaceSettings, type WorkspaceSettings } from '../workspaceSettings'

type AccountPageProps = {
  user: User | null
  onUserUpdate: (user: User) => void
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AccountPage({ user, onUserUpdate }: AccountPageProps) {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(!!user)
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [settings, setSettings] = useState<WorkspaceSettings>(() => loadWorkspaceSettings())

  useEffect(() => {
    if (!user) return
    setUsername(user.username)
    setEmail(user.email)
  }, [user])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    listDocuments()
      .then(setDocs)
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    saveWorkspaceSettings(settings)
  }, [settings])

  const summary = useMemo(() => {
    const withOcr = docs.filter((doc) => !!doc.ocr_text).length
    const categorized = docs.filter((doc) => !!doc.category).length
    return [
      { label: 'Documents', value: docs.length },
      { label: 'With OCR', value: withOcr },
      { label: 'Categorized', value: categorized },
    ]
  }, [docs])

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    setSavingProfile(true)
    setProfileMessage(null)
    setProfileError(null)
    try {
      const updated = await updateProfile(username.trim(), email.trim())
      onUserUpdate(updated)
      setProfileMessage('Profile updated successfully.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const toggleSetting = (key: keyof Omit<WorkspaceSettings, 'accent'>) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (!user) {
    return (
      <div className="page page--center">
        <div className="card card--narrow card--auth">
          <h1 className="card-title">Account</h1>
          <p className="card-text">Sign in to view your documents and settings.</p>
          <div className="card-actions">
            <Link to="/login" className="btn btn--primary">Log in</Link>
            <Link to="/register" className="btn btn--secondary">Sign up</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`page page--wide account-page account-page--${settings.accent}`}>
      <div className="account-hero account-hero--enhanced">
        <div className="account-avatar">{user.username.charAt(0).toUpperCase()}</div>
        <div className="account-info">
          <p className="account-eyebrow">Profile</p>
          <h1 className="account-name">{user.username}</h1>
          <p className="account-email">{user.email}</p>
          {user.created_at && (
            <p className="account-meta">Joined {formatDate(user.created_at)}</p>
          )}
        </div>
        <div className="account-summary-grid">
          {summary.map((item) => (
            <div key={item.label} className="account-summary-card">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="account-layout">
        <section className="card account-panel">
          <div className="account-panel-head">
            <div>
              <p className="doc-preview-label">Profile editor</p>
              <h2 className="section-title">Personal details</h2>
            </div>
          </div>
          <div className="account-profile-intro">
            <div className="account-profile-chip">
              <span className="account-profile-chip-label">Display name</span>
              <strong>{user.username}</strong>
            </div>
            <div className="account-profile-chip">
              <span className="account-profile-chip-label">Primary email</span>
              <strong>{user.email}</strong>
            </div>
            <div className="account-profile-chip">
              <span className="account-profile-chip-label">Role</span>
              <strong>{user.is_admin ? 'Administrator' : 'User'}</strong>
            </div>
          </div>
          <form className="account-form" onSubmit={handleProfileSave}>
            <label className="account-form-field">
              <span>Username</span>
              <small>This name is shown in the header and profile area.</small>
              <input
                className="auth-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="account-form-field">
              <span>Email</span>
              <small>We use this as your main contact identity in the workspace.</small>
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <div className="account-form-actions">
              <button type="submit" className="btn btn--primary" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save changes'}
              </button>
              {profileMessage && <span className="account-success">{profileMessage}</span>}
              {profileError && <span className="auth-error">{profileError}</span>}
            </div>
          </form>
        </section>

        {user.is_admin && (
          <section className="card account-panel">
            <div className="account-panel-head">
              <div>
                <p className="doc-preview-label">Administration</p>
                <h2 className="section-title">Service access</h2>
              </div>
            </div>
            <p className="page-muted account-settings-note">
              The default admin account can inspect the centralized service log stream.
            </p>
            <div className="card-actions">
              <Link to="/admin/logs" className="btn btn--primary">Open service logs</Link>
            </div>
          </section>
        )}

        <section className="card account-panel">
          <div className="account-panel-head">
            <div>
              <p className="doc-preview-label">Preferences</p>
              <h2 className="section-title">Workspace settings</h2>
            </div>
          </div>
          <p className="page-muted account-settings-note">
            These settings now directly affect the document grid and preview behavior across the app.
          </p>
          <div className="settings-list">
            <label className="settings-item">
              <div>
                <strong>Compact document cards</strong>
                <p className="page-muted">Makes the document grid denser on the home page.</p>
              </div>
              <input type="checkbox" checked={settings.compactCards} onChange={() => toggleSetting('compactCards')} />
            </label>
            <label className="settings-item">
              <div>
                <strong>Show confidence by default</strong>
                <p className="page-muted">Shows ML confidence in the document list and detail page.</p>
              </div>
              <input type="checkbox" checked={settings.showConfidence} onChange={() => toggleSetting('showConfidence')} />
            </label>
            <label className="settings-item">
              <div>
                <strong>Auto-load previews</strong>
                <p className="page-muted">Loads thumbnails and full document preview automatically.</p>
              </div>
              <input type="checkbox" checked={settings.autoOpenPreview} onChange={() => toggleSetting('autoOpenPreview')} />
            </label>
          </div>
          <div className="account-theme-picker">
            <p className="doc-preview-label">Accent</p>
            <div className="theme-options">
              {(['red', 'rose', 'sand'] as const).map((accent) => (
                <button
                  key={accent}
                  type="button"
                  className={settings.accent === accent ? 'theme-swatch active' : 'theme-swatch'}
                  onClick={() => setSettings((prev) => ({ ...prev, accent }))}
                >
                  {accent}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="account-section">
        <div className="account-panel-head">
          <div>
            <p className="doc-preview-label">Library</p>
            <h2 className="section-title">Recent documents</h2>
          </div>
          {docs.length > 0 && (
            <Link to="/" className="btn btn--secondary">All documents</Link>
          )}
        </div>
        {loading && <p className="page-muted">Loading...</p>}
        {!loading && docs.length === 0 && (
          <div className="card account-panel">
            <p className="page-muted">No documents yet. <Link to="/upload">Upload your first file</Link>.</p>
          </div>
        )}
        {!loading && docs.length > 0 && (
          <ul className="account-doc-list account-doc-list--enhanced">
            {docs.slice(0, 8).map((doc) => (
              <li key={doc.id} className="account-doc-item">
                <Link to={`/doc/${doc.id}`} className="account-doc-link">
                  <span className="account-doc-name">{doc.original_filename}</span>
                  <span className="account-doc-date">{formatDate(doc.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
