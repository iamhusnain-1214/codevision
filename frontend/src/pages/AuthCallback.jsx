import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Supabase redirects here after the user clicks the email confirmation
 * link, with the session already attached to the URL as a hash fragment:
 *   /auth/callback#access_token=...&refresh_token=...&type=signup
 *
 * We parse that, log the user in immediately via setSession, and bounce
 * to the dashboard — no separate login step required after verifying.
 *
 * IMPORTANT: this route must be added to Supabase's allowed Redirect URLs
 * (Authentication -> URL Configuration), e.g. http://localhost:5173/**
 */
export default function AuthCallback() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken) {
      setError('Verification link is missing or expired — please try logging in directly.')
      return
    }

    setSession(accessToken, refreshToken)
    navigate('/dashboard', { replace: true })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-sm mb-4" style={{ color: '#E0574F' }}>{error}</p>
            <a href="/login" className="font-semibold" style={{ color: 'var(--accent)' }}>Go to login</a>
          </>
        ) : (
          <p style={{ color: 'var(--ink-muted)' }}>Confirming your account…</p>
        )}
      </div>
    </div>
  )
}
