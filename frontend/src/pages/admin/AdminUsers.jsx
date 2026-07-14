import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminUsers() {
  const { token, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    api.listUsers(token)
      .then(setUsers)
      .catch((err) => setError(err.message || 'Could not load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token])

  const toggleBan = async (u) => {
    setBusyId(u.id)
    setError('')
    setNotice('')
    try {
      const updated = u.is_banned ? await api.unbanUser(token, u.id) : await api.banUser(token, u.id)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
    } catch (err) {
      setError(err.message || 'Could not update ban status')
    } finally {
      setBusyId(null)
    }
  }

  const sendReset = async (u) => {
    setBusyId(u.id)
    setError('')
    setNotice('')
    try {
      const res = await api.resetUserPassword(token, u.id)
      setNotice(res.message || 'Reset email sent')
    } catch (err) {
      setError(err.message || 'Could not send reset email')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = users.filter((u) =>
    !search.trim() ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-1">Users — Admin</h1>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
          View registered users, trigger a password reset email, or suspend an account.
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email…"
          className="w-full max-w-sm px-3.5 py-2.5 rounded-lg border text-sm mb-6"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        />

        {error && (
          <p className="text-sm mb-4 px-3.5 py-2.5 rounded-lg" style={{ background: 'var(--raised)', color: '#E0574F' }}>
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm mb-4 px-3.5 py-2.5 rounded-lg" style={{ background: 'var(--raised)', color: '#3FA36B' }}>
            {notice}
          </p>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No users match.</p>
        ) : (
          <div className="rounded-xl2 border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--raised)' }}>
                  <th className="text-left px-4 py-2.5 font-medium">Username</th>
                  <th className="text-left px-4 py-2.5 font-medium">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium">Joined</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
                    <td className="px-4 py-3">
                      {u.username}
                      {u.id === currentUser?.id && (
                        <span className="ml-1.5 text-xs" style={{ color: 'var(--ink-faint)' }}>(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-muted)' }}>
                      {u.email || <span style={{ color: 'var(--ink-faint)' }}>no email on file</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-muted)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: u.is_banned ? '#E0574F' : '#3FA36B' }}>
                        {u.is_banned ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => sendReset(u)}
                        disabled={busyId === u.id || !u.email}
                        title={!u.email ? 'No email on file' : 'Send password reset email'}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:border-[var(--accent)] disabled:opacity-40 mr-2"
                        style={{ borderColor: 'var(--line)' }}
                      >
                        Reset password
                      </button>
                      <button
                        onClick={() => toggleBan(u)}
                        disabled={busyId === u.id || u.id === currentUser?.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
                        style={{ borderColor: 'var(--line)', color: u.is_banned ? '#3FA36B' : '#E0574F' }}
                      >
                        {u.is_banned ? 'Unsuspend' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
