import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

const STATUS_COLOR = {
  success: '#3FA36B',
  error: '#E0574F',
  timeout: '#D98C2B',
}

export default function AdminModeration() {
  const { token } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [filter, setFilter] = useState('') // '' | error | timeout | success
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const load = () => {
    setLoading(true)
    api.listCustomSubmissions(token, filter || undefined, 100)
      .then(setSubmissions)
      .catch((err) => setError(err.message || 'Could not load submissions'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token, filter])

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-1">Custom Code Moderation — Admin</h1>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
          Recent Custom Code Visualizer submissions, including failures and timeouts —
          read-only; use the Users tab to suspend an account if a pattern of abuse shows up.
        </p>

        <div className="flex gap-2 flex-wrap mb-6">
          {[
            ['', 'All'],
            ['error', 'Errors'],
            ['timeout', 'Timeouts'],
            ['success', 'Successes'],
          ].map(([val, label]) => (
            <button
              key={val || 'all'}
              onClick={() => setFilter(val)}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors"
              style={{
                borderColor: 'var(--line)',
                background: filter === val ? 'var(--accent-dim)' : 'transparent',
                color: filter === val ? 'var(--accent)' : 'var(--ink-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm mb-4 px-3.5 py-2.5 rounded-lg" style={{ background: 'var(--raised)', color: '#E0574F' }}>
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
            No submissions{filter ? ` with status "${filter}"` : ''} yet.
          </p>
        ) : (
          <div className="grid gap-3">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl2 border p-4"
                style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full uppercase" style={{ background: 'var(--raised)', color: 'var(--ink-muted)' }}>
                      {s.language}
                    </span>
                    <span className="text-xs font-semibold capitalize" style={{ color: STATUS_COLOR[s.status] || 'var(--ink-muted)' }}>
                      {s.status}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                      {new Date(s.created_at).toLocaleString()} · user {s.user_id.slice(0, 8)}…
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:border-[var(--accent)]"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {expandedId === s.id ? 'Hide code' : 'View code'}
                  </button>
                </div>

                {s.error_message && (
                  <p className="text-sm mt-2 px-3 py-2 rounded-lg font-mono" style={{ background: 'var(--raised)', color: STATUS_COLOR[s.status] }}>
                    {s.error_message}
                  </p>
                )}

                {expandedId === s.id && (
                  <pre
                    className="text-xs mt-3 p-3 rounded-lg overflow-x-auto font-mono"
                    style={{ background: 'var(--raised)', color: 'var(--ink)' }}
                  >
                    {s.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
