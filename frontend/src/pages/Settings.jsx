import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Settings() {
  const { token, user } = useAuth()
  const [searchParams] = useSearchParams()
  const cameFromReset = searchParams.get('reason') === 'reset'
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)
    try {
      await api.changePassword(token, newPassword)
      setSuccess('Password changed successfully.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message || 'Could not change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-12">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-1">Settings</h1>
        <p className="mb-8" style={{ color: 'var(--ink-muted)' }}>
          {user?.username ? `Signed in as ${user.username}` : 'Manage your account'}
        </p>

        <div
          className="rounded-xl2 border p-6"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          {cameFromReset && (
            <p
              className="text-sm mb-4 px-3.5 py-2.5 rounded-lg"
              style={{ background: 'var(--raised)', color: 'var(--accent)' }}
            >
              You're here from a password reset link — set a new password below to finish.
            </p>
          )}
          <h2 className="font-display font-semibold text-lg mb-4">Change password</h2>

          <form onSubmit={submit} className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                required
              />
            </div>

            {error && <p className="text-sm" style={{ color: '#E0574F' }}>{error}</p>}
            {success && <p className="text-sm" style={{ color: '#3FA36B' }}>{success}</p>}

            <button
              type="submit"
              disabled={saving}
              className="justify-self-start text-sm font-semibold px-5 py-2.5 rounded-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {saving ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}