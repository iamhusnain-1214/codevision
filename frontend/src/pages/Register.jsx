import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(form.username, form.email, form.password)
      // No token comes back — Supabase requires email verification before
      // login works, so send them to check their inbox instead of the dashboard.
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar minimal />
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="w-full max-w-sm rounded-xl2 border p-8 text-center"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          >
            <h1 className="font-display font-bold text-2xl mb-3">Check your email</h1>
            <p className="text-sm mb-7" style={{ color: 'var(--ink-muted)' }}>
              We sent a verification link to <strong>{form.email}</strong>. Click it, then log in below.
            </p>
            <Link
              to="/login"
              className="inline-block w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01]"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              Go to login
            </Link>
          </motion.div>
        </div>
      </div>
    )
  }

  const field = (label, key, type = 'text', placeholder = '') => (
    <>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>{label}</label>
      <input
        required
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)] transition-colors"
        style={{ borderColor: 'var(--line)' }}
        placeholder={placeholder}
      />
    </>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar minimal />
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <motion.form
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          onSubmit={submit}
          className="w-full max-w-sm rounded-xl2 border p-8"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <h1 className="font-display font-bold text-2xl mb-1">Create your account</h1>
          <p className="text-sm mb-7" style={{ color: 'var(--ink-muted)' }}>Free to start. No credit card.</p>

          {field('Username', 'username', 'text', 'ada')}
          {field('Email', 'email', 'email', 'ada@lovelace.dev')}
          {field('Password', 'password', 'password', '••••••••')}

          {error && <p className="text-sm mb-4" style={{ color: '#E0574F' }}>{error}</p>}

          <button
            disabled={busy}
            className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>

          <p className="text-sm text-center mt-6" style={{ color: 'var(--ink-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: 'var(--accent)' }}>Log in</Link>
          </p>
        </motion.form>
      </div>
    </div>
  )
}
