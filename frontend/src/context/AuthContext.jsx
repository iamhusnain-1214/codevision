import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('cv-token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    api.me(token)
      .then(setUser)
      .catch(() => { setToken(null); localStorage.removeItem('cv-token') })
      .finally(() => setLoading(false))
  }, [token])

  const login = async (email, password) => {
    const data = await api.login(email, password)
    // Supabase session returns access_token / refresh_token, not "token".
    localStorage.setItem('cv-token', data.access_token)
    localStorage.setItem('cv-refresh-token', data.refresh_token)
    setToken(data.access_token)
    return data
  }

  // Used by AuthCallback.jsx: after clicking the email confirmation link,
  // Supabase redirects back with a valid session already attached to the
  // URL — no need to call our own /login again, just store what we got.
  const setSession = (accessToken, refreshToken) => {
    localStorage.setItem('cv-token', accessToken)
    if (refreshToken) localStorage.setItem('cv-refresh-token', refreshToken)
    setToken(accessToken)
  }

  const register = async (username, email, password) => {
    // Note: registering no longer logs the user in immediately — Supabase
    // requires email verification first. No token comes back here.
    return api.register(username, email, password)
  }

  const logout = () => {
    localStorage.removeItem('cv-token')
    localStorage.removeItem('cv-refresh-token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
