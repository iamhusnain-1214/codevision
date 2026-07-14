import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Navbar({ minimal = false }) {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to={token ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            CV
          </span>
          <span className="font-display font-semibold text-lg tracking-tight">CodeVision</span>
        </Link>

        {!minimal && token && (
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {[
              ['Dashboard', '/dashboard'],
              ['History', '/history'],
              ['Complexity', '/complexity'],
              ['Race', '/race'],
              ['Fehm', '/fehm'],
              ['Requests', '/requests'],
              ['Settings', '/settings'],
              ...(user?.is_admin ? [['Admin', '/admin/requests'], ['Algorithms', '/admin/algorithms'], ['Users', '/admin/users'], ['Health', '/admin/health'], ['Moderation', '/admin/moderation'], ['Analytics', '/admin/analytics']] : []),
            ].map(([label, path]) => (
              <Link
                key={path}
                to={path}
                className="px-3.5 py-2 rounded-lg transition-colors hover:bg-[var(--raised)]"
                style={{ color: path === '/fehm' ? 'var(--accent)' : path.startsWith('/admin') ? '#E0574F' : 'var(--ink-muted)' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {token ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm" style={{ color: 'var(--ink-muted)' }}>
                {user?.username || '...'}
              </span>
              <button
                onClick={() => { logout(); navigate('/') }}
                className="text-sm font-medium px-3.5 py-2 rounded-lg border transition-colors hover:border-[var(--accent)]"
                style={{ borderColor: 'var(--line)' }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm font-medium px-3.5 py-2 rounded-lg transition-colors hover:bg-[var(--raised)]">Log in</Link>
              <Link
                to="/register"
                className="text-sm font-semibold px-4 py-2 rounded-lg transition-transform hover:scale-[1.03]"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}