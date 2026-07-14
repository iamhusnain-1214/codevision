import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const MODULES = ['array', 'recursion', 'dp', 'graph', 'tree', 'custom']

const STATUS_LABEL = {
  pending: 'Pending',
  in_progress: 'In progress',
  added: 'Added',
  rejected: 'Rejected',
}

const STATUS_COLOR = {
  pending: 'var(--ink-muted)',
  in_progress: 'var(--accent)',
  added: '#3FA36B',
  rejected: '#E0574F',
}

export default function AlgorithmRequests() {
  const { token } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [upvotingId, setUpvotingId] = useState(null)

  const [name, setName] = useState('')
  const [module, setModule] = useState('array')
  const [notes, setNotes] = useState('')

  const load = () => {
    setLoading(true)
    api.listAlgorithmRequests(token)
      .then(setRequests)
      .catch((err) => setError(err.message || 'Could not load requests'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await api.submitAlgorithmRequest(token, name.trim(), module, notes.trim() || undefined)
      setName('')
      setNotes('')
      load()
    } catch (err) {
      setError(err.message || 'Could not submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const upvote = async (id) => {
    setUpvotingId(id)
    setError('')
    try {
      await api.upvoteAlgorithmRequest(token, id)
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, upvote_count: r.upvote_count + 1 } : r)))
    } catch (err) {
      setError(err.message || 'Could not upvote')
    } finally {
      setUpvotingId(null)
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-1">Request an algorithm</h1>
        <p className="mb-8" style={{ color: 'var(--ink-muted)' }}>
          Don't see an algorithm you want in a module? Ask for it here — upvote existing requests instead of filing duplicates.
        </p>

        <form
          onSubmit={submit}
          className="rounded-xl2 border p-6 mb-8 grid gap-4"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <div className="grid sm:grid-cols-[1fr_180px] gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Algorithm name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Radix Sort"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Module</label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm capitalize"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              >
                {MODULES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this algorithm, or anything specific you'd like shown"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-lg border text-sm resize-none"
              style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
            />
          </div>

          {error && <p className="text-sm" style={{ color: '#E0574F' }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="justify-self-start text-sm font-semibold px-5 py-2.5 rounded-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <h2 className="font-display font-semibold text-xl mb-4">All requests</h2>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No requests yet — be the first!</p>
        ) : (
          <div className="grid gap-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="rounded-xl2 border p-4 flex items-start justify-between gap-4"
                style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.algorithm_name}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: 'var(--raised)', color: 'var(--ink-muted)' }}
                    >
                      {r.target_module}
                    </span>
                    <span className="text-xs font-medium" style={{ color: STATUS_COLOR[r.status] }}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                  {r.notes && <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{r.notes}</p>}
                  {r.admin_response && (
                    <p className="text-sm mt-2 px-3 py-2 rounded-lg" style={{ background: 'var(--raised)' }}>
                      <span className="font-medium">Admin: </span>{r.admin_response}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => upvote(r.id)}
                  disabled={upvotingId === r.id}
                  className="shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border transition-colors hover:border-[var(--accent)] disabled:opacity-60"
                  style={{ borderColor: 'var(--line)' }}
                  title="Upvote this request"
                >
                  <span className="text-sm font-semibold">▲</span>
                  <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{r.upvote_count}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
