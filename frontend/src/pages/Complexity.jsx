import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar.jsx'
import CodePanel from '../components/CodePanel.jsx'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

function isRateLimitError(message) {
  return !!message && /rate limit/i.test(message)
}

function RateLimitNotice({ onRetry, busy }) {
  return (
    <div className="mb-3 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
      <span>Fehm's a bit busy right now (free-tier limit) — give it a moment.</span>
      <button
        onClick={onRetry}
        disabled={busy}
        className="text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors disabled:opacity-60 shrink-0"
        style={{ borderColor: 'var(--accent)' }}
      >
        {busy ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  )
}

const SAMPLES = {
  python: `def bubble_sort(arr):
    for i in range(len(arr)):
        for j in range(len(arr) - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
`,
  cpp: `void bubbleSort(vector<int>& arr) {
    for (int i = 0; i < arr.size(); i++) {
        for (int j = 0; j < arr.size() - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                swap(arr[j], arr[j + 1]);
            }
        }
    }
}
`,
}

export default function Complexity() {
  const { token } = useAuth()
  const location = useLocation()
  const navState = location.state
  const [language, setLanguage] = useState(navState?.prefillLanguage || 'python')
  const [code, setCode] = useState(navState?.prefillCode || SAMPLES.python)
  const [verdict, setVerdict] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fromHookIn, setFromHookIn] = useState(!!navState?.prefillCode)

  useEffect(() => {
    if (navState) window.history.replaceState({}, document.title)
  }, [])

  const switchLanguage = (l) => {
    setLanguage(l)
    setCode(SAMPLES[l])
    setVerdict(null)
    setError('')
  }

  const analyze = async () => {
    setError(''); setBusy(true); setVerdict(null)
    try {
      const data = await api.analyzeComplexityFehm(token, code, language)
      if (data.error) setError(data.error)
      else setVerdict(data)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  const highlightLines = (verdict?.key_lines || []).map((k) => k.line)

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display font-bold text-3xl tracking-tight">Complexity Analyzer</h1>
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            Powered by Fehm
          </span>
        </div>
        <p className="mb-8" style={{ color: 'var(--ink-muted)' }}>
          Paste code — Fehm reasons through the real time/space complexity, including
          hidden costs inside library calls like <code>.sort()</code>, not just loops you wrote yourself.
        </p>

        <div className="flex items-center gap-2 mb-5">
          {['python', 'cpp'].map((l) => (
            <button
              key={l}
              onClick={() => switchLanguage(l)}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: 'var(--line)',
                background: language === l ? 'var(--accent-dim)' : 'transparent',
                color: language === l ? 'var(--accent)' : 'var(--ink-muted)',
              }}
            >
              {l === 'python' ? 'Python' : 'C++'}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl2 border p-5 flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            {fromHookIn && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--raised)', color: 'var(--ink-faint)' }}>
                Pulled in from the module you were just in — edit if needed, then analyze.
              </div>
            )}
            <textarea
              value={code}
              onChange={(e) => { setCode(e.target.value); setFromHookIn(false) }}
              spellCheck={false}
              className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm leading-relaxed resize-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--line)', minHeight: 280 }}
            />
            {error && (
              isRateLimitError(error)
                ? <RateLimitNotice onRetry={analyze} busy={busy} />
                : <p className="text-sm mb-3" style={{ color: '#E0574F' }}>{error}</p>
            )}
            <button
              onClick={analyze} disabled={busy}
              className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {busy ? 'Fehm is analyzing…' : 'Analyze complexity'}
            </button>
          </div>

          <div className="rounded-xl2 border p-5 flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            {!verdict ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-center" style={{ color: 'var(--ink-faint)' }}>The verdict — and the exact lines that caused it — appears here.</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full">
                {verdict.source === 'static_fallback' && (
                  <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--raised)', color: 'var(--ink-faint)' }}>
                    Fehm was unreachable ({verdict.fehm_error}) — showing a basic static estimate instead,
                    which may miss complexity hidden in library calls.
                  </div>
                )}

                <div className="flex items-center gap-8 mb-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>Time</div>
                    <div className="font-display font-bold text-3xl">{verdict.time_complexity}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--amber)' }}>Space</div>
                    <div className="font-display font-bold text-3xl">{verdict.space_complexity}</div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ink-muted)' }}>{verdict.reason}</p>

                {verdict.walkthrough?.length > 0 && (
                  <ul className="text-sm leading-relaxed list-disc pl-5 mb-3" style={{ color: 'var(--ink-muted)' }}>
                    {verdict.walkthrough.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}

                {verdict.tip && (
                  <p className="text-xs font-medium mb-4" style={{ color: 'var(--accent)' }}>💡 {verdict.tip}</p>
                )}
                {verdict.note && (
                  <p className="text-xs mb-4 italic" style={{ color: 'var(--ink-faint)' }}>{verdict.note}</p>
                )}

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-faint)' }}>
                    Key lines driving the verdict
                  </div>
                  <CodePanel code={code} activeLine={null} highlightLines={highlightLines} language={language} title="your code" />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
