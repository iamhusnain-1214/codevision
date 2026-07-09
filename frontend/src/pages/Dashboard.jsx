import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar.jsx'
import OnboardingTour, { hasSeenOnboarding } from '../components/OnboardingTour.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'

const MODULES = [
  { key: 'array', n: '01', name: 'Array & Sorting', desc: '13 algorithms — Kadane, sorts, sliding window, two pointers.', path: '/module/array' },
  { key: 'recursion', n: '02', name: 'Recursion', desc: 'Watch the call stack build and unwind.', path: '/module/recursion' },
  { key: 'dp', n: '03', name: 'Dynamic Programming', desc: 'LCS and knapsack, table filled live.', path: '/module/dp' },
  { key: 'custom', n: '04', name: 'Custom Code Visualizer', desc: 'Paste Python or C++ — memory animates automatically.', path: '/module/custom', badge: 'Beta' },
  { key: 'graph', n: '05', name: 'Graphs', desc: 'BFS, Dijkstra, Kruskal, Floyd–Warshall and more.', path: '/module/graph' },
  { key: 'tree', n: '06', name: 'Trees', desc: 'BST, AVL rotations, heaps, tries.', path: '/module/tree' },
  { key: 'race', n: '07', name: 'Algorithm Race', desc: 'Two sorting algorithms, same array, side by side.', path: '/race', badge: 'New' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const { token } = useAuth()
  const [recent, setRecent] = useState([])
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    if (!token) return
    api.history(token).then((d) => setRecent(d.runs?.slice(0, 5) || [])).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!hasSeenOnboarding()) setShowTour(true)
  }, [])

  return (
    <div className="min-h-screen">
      <Navbar />
      {showTour && <OnboardingTour onClose={() => setShowTour(false)} />}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
          <h1 className="font-display font-bold text-3xl tracking-tight">
            Welcome back{user?.username ? `, ${user.username}` : ''}.
          </h1>
          <button
            onClick={() => setShowTour(true)}
            className="text-sm font-medium shrink-0"
            style={{ color: 'var(--accent)' }}
          >
            Take the tour
          </button>
        </div>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>Pick a module to start tracing.</p>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <Link
            to="/fehm"
            className="block rounded-xl2 border p-6 transition-all hover:border-[var(--accent)] hover:-translate-y-0.5"
            style={{ borderColor: 'var(--accent)', background: 'var(--accent-dim)' }}
          >
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-4">
                <span
                  className="w-11 h-11 rounded-lg flex items-center justify-center font-display font-bold text-lg shrink-0"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  ف
                </span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-semibold text-lg">Fehm</h3>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                    >
                      New
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                    Stuck on a problem? Paste it and Fehm breaks down the pattern, walks
                    through the logic step by step, and gives you pseudocode — not just an answer.
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--accent)' }}>Ask Fehm →</span>
            </div>
          </Link>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {MODULES.map((m, i) => (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Link
                to={m.path}
                className="block h-full rounded-xl2 border p-6 transition-all hover:border-[var(--accent)] hover:-translate-y-0.5"
                style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{m.n}</span>
                  {m.badge && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{m.name}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{m.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="rounded-xl2 border p-6" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Recent runs</h2>
            <Link to="/history" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--ink-faint)' }}>
              No runs yet — open a module and run your first trace.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <span className="font-medium capitalize">{r.module}</span>
                    <span style={{ color: 'var(--ink-faint)' }}> · {r.algorithm}</span>
                  </div>
                  <span style={{ color: 'var(--ink-faint)' }}>{r.created_at}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
