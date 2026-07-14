import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

const STATUSES = ['pending', 'in_progress', 'added', 'rejected']

const STATUS_COLOR = {
  pending: 'var(--ink-muted)',
  in_progress: 'var(--accent)',
  added: '#3FA36B',
  rejected: '#E0574F',
}

export default function AdminRequests() {
  const { token } = useAuth()
  const [requests, setRequests] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [drafts, setDrafts] = useState({}) // { [id]: responseText }

  const load = () => {
    setLoading(true)
    api.listAlgorithmRequests(token, filter || undefined)
      .then(setRequests)
      .catch((err) => setError(err.message || 'Could not load requests'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token, filter])

  const setDraft = (id, value) => setDrafts((prev) => ({ ...prev, [id]: value }))

  const updateStatus = async (r, status) => {
    setSavingId(r.id)
    setError('')
    try {
      const updated = await api.updateAlgorithmRequest(token, r.id, {
        status,
        admin_response: drafts[r.id] ?? r.admin_response ?? undefined,
      })
      setRequests((prev) => prev.map((x) => (x.id === r.id ? updated : x)))
    } catch (err) {
      setError(err.message || 'Could not update this request (are you sure you\'re an admin?)')
    } finally {
      setSavingId(null)
    }
  }

  const saveResponseOnly = async (r) => {
    setSavingId(r.id)
    setError('')
    try {
      const updated = await api.updateAlgorithmRequest(token, r.id, {
        status: r.status,
        admin_response: drafts[r.id] ?? '',
      })
      setRequests((prev) => prev.map((x) => (x.id === r.id ? updated : x)))
    } catch (err) {
      setError(err.message || 'Could not save response')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-1">Algorithm requests — Admin</h1>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
          Review, respond to, and update the status of algorithm requests from users.
        </p>

        <div className="flex gap-2 flex-wrap mb-6">
          {['', ...STATUSES].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setFilter(s)}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize"
              style={{
                borderColor: 'var(--line)',
                background: filter === s ? 'var(--accent-dim)' : 'transparent',
                color: filter === s ? 'var(--accent)' : 'var(--ink-muted)',
              }}
            >
              {s ? s.replace('_', ' ') : 'All'}
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
        ) : requests.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No requests{filter ? ` with status "${filter}"` : ''}.</p>
        ) : (
          <div className="grid gap-4">
            {requests.map((r) => (
              <div
                key={r.id}
                className="rounded-xl2 border p-5"
                style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-lg">{r.algorithm_name}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: 'var(--raised)', color: 'var(--ink-muted)' }}
                      >
                        {r.target_module}
                      </span>
                      <span className="text-xs font-medium" style={{ color: STATUS_COLOR[r.status] }}>
                        ▲ {r.upvote_count}
                      </span>
                    </div>
                    {r.notes && <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{r.notes}</p>}
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
                      Requested {new Date(r.created_at).toLocaleDateString()} · user {r.user_id.slice(0, 8)}…
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap mb-3">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(r, s)}
                      disabled={savingId === r.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                      style={{
                        borderColor: r.status === s ? STATUS_COLOR[s] : 'var(--line)',
                        background: r.status === s ? 'var(--raised)' : 'transparent',
                        color: r.status === s ? STATUS_COLOR[s] : 'var(--ink-muted)',
                      }}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 items-start">
                  <textarea
                    value={drafts[r.id] ?? r.admin_response ?? ''}
                    onChange={(e) => setDraft(r.id, e.target.value)}
                    placeholder="Response visible to the requester (optional)"
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm resize-none"
                    style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                  />
                  <button
                    onClick={() => saveResponseOnly(r)}
                    disabled={savingId === r.id}
                    className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:border-[var(--accent)] disabled:opacity-50"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {savingId === r.id ? 'Saving…' : 'Save reply'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
