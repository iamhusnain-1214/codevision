import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const expired = searchParams.get('expired') === '1'
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setResent(false)
    setBusy(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    try {
      await api.resendVerification(form.email)
      setResent(true)
    } catch {
      // stay quiet — the error banner above is enough context
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar minimal />
      <div className="flex-1 flex items-center justify-center px-6">
        <motion.form
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          onSubmit={submit}
          className="w-full max-w-sm rounded-xl2 border p-8"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <h1 className="font-display font-bold text-2xl mb-1">Welcome back</h1>
          <p className="text-sm mb-7" style={{ color: 'var(--ink-muted)' }}>Log in to continue tracing.</p>

          {expired && (
            <div className="mb-5 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              Your session expired — log in again to continue.
            </div>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)] transition-colors"
            style={{ borderColor: 'var(--line)' }}
            placeholder="ada@lovelace.dev"
          />

          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Password</label>
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full mb-6 px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)] transition-colors"
            style={{ borderColor: 'var(--line)' }}
            placeholder="••••••••"
          />

          {error && (
            <div className="mb-4">
              <p className="text-sm" style={{ color: '#E0574F' }}>{error}</p>
              {error.toLowerCase().includes('verify') && !resent && (
                <button type="button" onClick={resend} className="text-sm font-semibold mt-1" style={{ color: 'var(--accent)' }}>
                  Resend verification email
                </button>
              )}
              {resent && <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Verification email resent — check your inbox.</p>}
            </div>
          )}

          <button
            disabled={busy}
            className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {busy ? 'Logging in…' : 'Log in'}
          </button>

          <p className="text-sm text-center mt-6" style={{ color: 'var(--ink-muted)' }}>
            New here?{' '}
            <Link to="/register" className="font-semibold" style={{ color: 'var(--accent)' }}>Create an account</Link>
          </p>
        </motion.form>
      </div>
    </div>
  )
}
