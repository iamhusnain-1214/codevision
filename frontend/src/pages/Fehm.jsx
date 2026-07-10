import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar.jsx'
import CodePanel from '../components/CodePanel.jsx'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

// Fehm's free-tier Gemini calls can hit a 429 under real load — gemini_service.py
// surfaces that as an error string containing "rate limit". Detect it here so
// we can show a calmer, more specific message + retry instead of a raw red error.
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

const SAMPLE_PROBLEM = `Given an array of integers and a target sum, find two numbers in \
the array that add up to the target and return their indices. Assume exactly \
one solution exists, and you may not use the same element twice.`

const SAMPLE_BUG = {
  code: `def count_positives(nums):
    count = 0
    for i in range(len(nums)):
        if nums[i] > 0:
            count += 1
        return count`,
  expected: '3 for nums=[1, -2, 4, -5, 6]',
  actual: '1',
}

function ModeTabs({ mode, setMode }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[
        ['explain', 'Explain a problem'],
        ['debug', 'Debug my logic'],
      ].map(([m, label]) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
          style={{
            borderColor: mode === m ? 'var(--accent)' : 'var(--line)',
            background: mode === m ? 'var(--accent-dim)' : 'transparent',
            color: mode === m ? 'var(--accent)' : 'var(--ink-muted)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function ExplainMode({ token }) {
  const [problem, setProblem] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Hint Mode: progressive reveal instead of dumping everything at once.
  // 0 = nothing yet, 1 = pattern only, 2 = + why, 3 = + steps, 4 = everything.
  const [revealLevel, setRevealLevel] = useState(0)

  const run = async () => {
    setError(''); setBusy(true); setResult(null); setRevealLevel(0)
    try {
      const data = await api.explainProblem(token, problem)
      setResult(data)
      setRevealLevel(1)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  const loadSample = () => {
    setProblem(SAMPLE_PROBLEM)
    setResult(null)
    setError('')
    setRevealLevel(0)
  }

  const nextHintLabel = { 1: 'Reveal why this pattern', 2: 'Reveal the step-by-step logic', 3: 'Reveal pseudocode & complexity' }[revealLevel]

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-xl2 border p-5 flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
            Problem statement
          </label>
          <button onClick={loadSample} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
            Load sample
          </button>
        </div>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Paste a DSA / LeetCode-style problem here…"
          spellCheck={false}
          className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none text-sm leading-relaxed resize-none focus:border-[var(--accent)]"
          style={{ borderColor: 'var(--line)', minHeight: 280 }}
        />
        {error && (
          isRateLimitError(error)
            ? <RateLimitNotice onRetry={run} busy={busy} />
            : <p className="text-sm mb-3" style={{ color: '#E0574F' }}>{error}</p>
        )}
        <button
          onClick={run} disabled={busy || !problem.trim()}
          className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          {busy ? 'Fehm is thinking…' : 'Get a hint'}
        </button>
      </div>

      <div className="rounded-xl2 border p-5 flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        {!result ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-center" style={{ color: 'var(--ink-faint)' }}>
              Fehm reveals hints one step at a time — pattern first, full logic last.
              You stay in the driver's seat.
            </p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 overflow-y-auto max-h-[75vh]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-faint)' }}>
                What's actually being asked
              </div>
              <p className="text-sm leading-relaxed">{result.restated_problem}</p>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
                Pattern (Hint 1)
              </div>
              <p className="font-display font-semibold text-lg">{result.pattern}</p>
            </div>

            <AnimatePresence>
              {revealLevel >= 2 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-faint)' }}>Why this pattern (Hint 2)</div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{result.why_this_pattern}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {revealLevel >= 3 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--ink-faint)' }}>Step-by-step logic (Hint 3)</div>
                  <div className="flex flex-col gap-3">
                    {(result.steps || []).map((s, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                          {i + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold mb-0.5">{s.title}</div>
                          <div className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{s.explanation}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {revealLevel >= 4 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-5">
                  <div className="flex items-center gap-8">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>Time</div>
                      <div className="font-display font-bold text-xl">{result.time_complexity}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--amber)' }}>Space</div>
                      <div className="font-display font-bold text-xl">{result.space_complexity}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--ink-faint)' }}>Pseudocode</div>
                    <pre className="text-sm font-mono whitespace-pre-wrap px-4 py-3 rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--line)', background: 'var(--raised)' }}>
                      {result.pseudocode}
                    </pre>
                  </div>
                  {result.common_mistakes?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--ink-faint)' }}>Common mistakes</div>
                      <ul className="text-sm leading-relaxed list-disc pl-5" style={{ color: 'var(--ink-muted)' }}>
                        {result.common_mistakes.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {revealLevel < 4 && (
              <button
                onClick={() => setRevealLevel((r) => r + 1)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold border transition-colors"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                {nextHintLabel}
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function DebugMode({ token, prefill }) {
  const [language, setLanguage] = useState(prefill?.language || 'python')
  const [code, setCode] = useState(prefill?.code || '')
  const [expected, setExpected] = useState(prefill?.expected || '')
  const [actual, setActual] = useState(prefill?.actual || '')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fromHookIn, setFromHookIn] = useState(!!prefill)

  const loadSample = () => {
    setCode(SAMPLE_BUG.code)
    setExpected(SAMPLE_BUG.expected)
    setActual(SAMPLE_BUG.actual)
    setResult(null)
    setError('')
  }

  const run = async () => {
    setError(''); setBusy(true); setResult(null)
    try {
      const data = await api.debugLogic(token, code, language, expected, actual)
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  const highlightLines = (result?.key_lines || []).map((k) => k.line)

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-xl2 border p-5 flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>Your code</label>
          <button onClick={loadSample} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Load sample bug</button>
        </div>
        {fromHookIn && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--raised)', color: 'var(--ink-faint)' }}>
            Pulled in from the Custom Code Visualizer's error — edit anything below before diagnosing.
          </div>
        )}
        <textarea
          value={code}
          onChange={(e) => { setCode(e.target.value); setFromHookIn(false) }}
          placeholder="Paste the code that's giving you the wrong answer…"
          spellCheck={false}
          className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm leading-relaxed resize-none focus:border-[var(--accent)]"
          style={{ borderColor: 'var(--line)', minHeight: 200 }}
        />
        <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Expected output</label>
        <input value={expected} onChange={(e) => setExpected(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />
        <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Actual output you're getting</label>
        <input value={actual} onChange={(e) => setActual(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />
        {error && (
          isRateLimitError(error)
            ? <RateLimitNotice onRetry={run} busy={busy} />
            : <p className="text-sm mb-3" style={{ color: '#E0574F' }}>{error}</p>
        )}
        <button
          onClick={run} disabled={busy || !code.trim()}
          className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          {busy ? 'Fehm is diagnosing…' : 'Diagnose the bug'}
        </button>
      </div>

      <div className="rounded-xl2 border p-5 flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        {!result ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-center" style={{ color: 'var(--ink-faint)' }}>
              Fehm won't rewrite your code — it points at the conceptual mistake, like a TA would.
            </p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>Diagnosis</div>
              <p className="text-sm leading-relaxed">{result.diagnosis}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-faint)' }}>Why it breaks</div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{result.why_it_breaks}</p>
            </div>
            {result.guiding_questions?.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-faint)' }}>Think about this</div>
                <ul className="text-sm leading-relaxed list-disc pl-5" style={{ color: 'var(--ink-muted)' }}>
                  {result.guiding_questions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            )}
            {result.fix_hint && (
              <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>💡 {result.fix_hint}</p>
            )}
            {code && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-faint)' }}>Where the bug likely lives</div>
                <CodePanel code={code} activeLine={null} highlightLines={highlightLines} language={language} title="your code" />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function Fehm() {
  const { token } = useAuth()
  const location = useLocation()
  const navState = location.state
  const [mode, setMode] = useState(navState?.mode === 'debug' ? 'debug' : 'explain')

  // If we arrived here from another module's "Debug with Fehm" / "Analyze
  // complexity" hook-in, clear the nav state's history entry so a refresh
  // or back-navigation doesn't keep re-prefilling stale data.
  useEffect(() => {
    if (navState) window.history.replaceState({}, document.title)
  }, [])

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-base" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>ف</span>
          <h1 className="font-display font-bold text-3xl tracking-tight">Fehm</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>AI Logic Coach</span>
        </div>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
          Fehm won't just hand you code — it builds your logic, one hint at a time,
          and helps you debug your own thinking when something's not working.
        </p>

        <ModeTabs mode={mode} setMode={setMode} />

        {mode === 'explain' ? <ExplainMode token={token} /> : <DebugMode token={token} prefill={navState?.mode === 'debug' ? navState : null} />}
      </div>
    </div>
  )
}