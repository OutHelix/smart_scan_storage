import { Link } from 'react-router-dom'
import type { User } from '../types'

type AccountPageProps = {
  user: User | null
}

export function AccountPage({ user }: AccountPageProps) {
  if (!user) {
    return (
      <div className="wf">
        <div className="auth-card">
          <div className="auth-title">Личный кабинет</div>
          <p>Вы не авторизованы.</p>
          <p className="auth-meta">
            <Link to="/login">Войти</Link> или <Link to="/register">зарегистрироваться</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="wf">
      <div className="auth-card">
        <div className="auth-title">Личный кабинет</div>
        <p><strong>Имя пользователя:</strong> {user.username}</p>
        <p><strong>Email:</strong> {user.email}</p>
        {user.created_at && (
          <p>
            <strong>Регистрация:</strong>{' '}
            {new Date(user.created_at).toLocaleString()}
          </p>
        )}
        <div className="auth-meta">
          Здесь позже появится список ваших документов и настройки.
        </div>
      </div>
    </div>
  )
}

