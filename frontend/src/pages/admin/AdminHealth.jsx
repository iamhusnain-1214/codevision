import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

function timeAgo(unixSeconds) {
  if (!unixSeconds) return 'never (this process)'
  const diffMs = Date.now() - unixSeconds * 1000
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function StatusDot({ status }) {
  const color = status === 'ok' ? '#3FA36B' : status === 'error' ? '#E0574F' : 'var(--ink-faint)'
  return <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
}

export default function AdminHealth() {
  const { token } = useAuth()
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [waking, setWaking] = useState(false)
  const [wakeResult, setWakeResult] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    api.getSystemHealth(token)
      .then(setHealth)
      .catch((err) => setError(err.message || 'Could not load system health'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token])

  const wakeUp = async () => {
    setWaking(true)
    setWakeResult('')
    try {
      await api.pingHealth()
      setWakeResult('Backend responded — it\'s awake.')
      load()
    } catch (err) {
      setWakeResult('Backend did not respond (may still be cold-starting — try again in ~30s).')
    } finally {
      setWaking(false)
    }
  }

  const rows = health ? [
    { label: 'Backend (Render)', status: health.backend, detail: null },
    { label: 'Supabase', status: health.supabase.status, detail: health.supabase.detail },
    { label: 'Redis (Upstash)', status: health.redis.status, detail: health.redis.detail },
  ] : []

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <h1 className="font-display font-bold text-3xl tracking-tight">System Health — Admin</h1>
          <button
            onClick={wakeUp}
            disabled={waking}
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {waking ? 'Pinging…' : 'Wake up backend'}
          </button>
        </div>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
          Live status, checked on demand — not the same as the automated uptime cron below.
        </p>

        {wakeResult && (
          <p className="text-sm mb-4 px-3.5 py-2.5 rounded-lg" style={{ background: 'var(--raised)' }}>
            {wakeResult}
          </p>
        )}

        {error && (
          <p className="text-sm mb-4 px-3.5 py-2.5 rounded-lg" style={{ background: 'var(--raised)', color: '#E0574F' }}>
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Checking…</p>
        ) : health ? (
          <>
            <div className="rounded-xl2 border overflow-hidden mb-6" style={{ borderColor: 'var(--line)' }}>
              {rows.map((r, i) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between px-5 py-4"
                  style={{
                    background: 'var(--surface)',
                    borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={r.status} />
                    <span className="font-medium">{r.label}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-sm font-medium capitalize"
                      style={{ color: r.status === 'ok' ? '#3FA36B' : '#E0574F' }}
                    >
                      {r.status}
                    </span>
                    {r.detail && (
                      <p className="text-xs mt-0.5 max-w-md truncate" style={{ color: 'var(--ink-faint)' }} title={r.detail}>
                        {r.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="rounded-xl2 border p-5"
              style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
            >
              <h2 className="font-medium mb-1">Uptime cron (cron-job.org)</h2>
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                Last hit: <span className="font-medium">{timeAgo(health.last_cron_ping)}</span>
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--ink-faint)' }}>
                Expected every ~10 minutes. If this is much older than that, the cron job itself
                may have stopped firing (check cron-job.org directly) — this dashboard only sees
                pings that reached this specific backend process.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
