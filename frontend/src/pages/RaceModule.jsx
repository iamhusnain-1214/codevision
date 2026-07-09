import React, { useMemo, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import ArrayVisualization from '../components/ArrayVisualization.jsx'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const SORT_ALGOS = ['bubble_sort', 'selection_sort', 'insertion_sort', 'merge_sort', 'quick_sort', 'heap_sort']

const LABELS = {
  bubble_sort: 'Bubble Sort',
  selection_sort: 'Selection Sort',
  insertion_sort: 'Insertion Sort',
  merge_sort: 'Merge Sort',
  quick_sort: 'Quick Sort',
  heap_sort: 'Heap Sort',
}

function Racer({ label, trace, step, busy, error }) {
  const clampedStep = Math.min(step, Math.max(trace.length - 1, 0))
  const frame = trace[clampedStep] || {}
  const vars = frame.variables || {}
  const finished = trace.length > 0 && step >= trace.length - 1

  return (
    <div className="rounded-xl2 border p-5 flex flex-col" style={{ borderColor: finished ? 'var(--accent)' : 'var(--line)', background: 'var(--surface)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold">{label}</h3>
        {trace.length > 0 && (
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: finished ? 'var(--accent)' : 'var(--raised)', color: finished ? 'var(--bg)' : 'var(--ink-muted)' }}
          >
            {finished ? `done in ${trace.length} steps` : `step ${clampedStep + 1} / ${trace.length}`}
          </span>
        )}
      </div>
      {error ? (
        <p className="text-sm" style={{ color: '#E0574F' }}>{error}</p>
      ) : trace.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{busy ? 'Racing…' : 'Waiting to start.'}</p>
      ) : (
        <ArrayVisualization algorithm={label.toLowerCase().replace(/\s+/g, '_')} values={vars.arr || []} variables={vars} />
      )}
    </div>
  )
}

export default function RaceModule() {
  const { token } = useAuth()
  const [arrText, setArrText] = useState('8, 3, 5, 1, 9, 2, 7, 4, 6')
  const [algoA, setAlgoA] = useState('bubble_sort')
  const [algoB, setAlgoB] = useState('quick_sort')
  const [traceA, setTraceA] = useState([])
  const [traceB, setTraceB] = useState([])
  const [errorA, setErrorA] = useState('')
  const [errorB, setErrorB] = useState('')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)

  const arr = useMemo(
    () => arrText.split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v)),
    [arrText]
  )

  const maxLen = Math.max(traceA.length, traceB.length, 1)

  const run = async () => {
    setBusy(true); setPlaying(false); setStep(0)
    setTraceA([]); setTraceB([]); setErrorA(''); setErrorB('')
    const [resA, resB] = await Promise.allSettled([
      api.runTrace(token, 'array', algoA, { arr }),
      api.runTrace(token, 'array', algoB, { arr }),
    ])
    if (resA.status === 'fulfilled') setTraceA(resA.value.trace || [])
    else setErrorA(resA.reason.message)
    if (resB.status === 'fulfilled') setTraceB(resB.value.trace || [])
    else setErrorB(resB.reason.message)
    setBusy(false)
  }

  // Simple play loop — advances the shared step counter; each Racer panel
  // clamps to its own trace length once it finishes, so the faster
  // algorithm visibly "wins" and sits at its final sorted state.
  React.useEffect(() => {
    if (!playing) return
    if (step >= maxLen - 1) { setPlaying(false); return }
    const t = setTimeout(() => setStep((s) => s + 1), 400)
    return () => clearTimeout(t)
  }, [playing, step, maxLen])

  const winner = traceA.length > 0 && traceB.length > 0
    ? (traceA.length === traceB.length ? 'tie' : traceA.length < traceB.length ? 'A' : 'B')
    : null

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-1">Algorithm Race</h1>
        <p className="mb-8" style={{ color: 'var(--ink-muted)' }}>
          Same array, two algorithms, side by side — watch which one gets there first and why.
        </p>

        <div className="rounded-xl2 border p-5 mb-6" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: 'var(--ink-muted)' }}>Array</label>
          <input
            value={arrText} onChange={(e) => setArrText(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--line)' }}
          />
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: 'var(--ink-muted)' }}>Algorithm A</label>
              <select value={algoA} onChange={(e) => setAlgoA(e.target.value)} className="w-full px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }}>
                {SORT_ALGOS.map((a) => <option key={a} value={a}>{LABELS[a]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: 'var(--ink-muted)' }}>Algorithm B</label>
              <select value={algoB} onChange={(e) => setAlgoB(e.target.value)} className="w-full px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }}>
                {SORT_ALGOS.map((a) => <option key={a} value={a}>{LABELS[a]}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={run} disabled={busy}
            className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {busy ? 'Starting the race…' : 'Start race'}
          </button>
        </div>

        {(traceA.length > 0 || traceB.length > 0) && (
          <>
            <div className="flex items-center gap-4 mb-5">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                {playing ? 'Pause' : step >= maxLen - 1 ? 'Replay' : 'Play'}
              </button>
              <input
                type="range" min={0} max={maxLen - 1} value={step}
                onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)) }}
                className="flex-1"
              />
              <span className="text-xs font-mono shrink-0" style={{ color: 'var(--ink-muted)' }}>{step + 1} / {maxLen}</span>
            </div>

            {winner && step >= maxLen - 1 && (
              <div className="mb-5 px-4 py-3 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                {winner === 'tie'
                  ? `Tie! Both finished in ${traceA.length} steps.`
                  : `${LABELS[winner === 'A' ? algoA : algoB]} wins — ${winner === 'A' ? traceA.length : traceB.length} steps vs ${winner === 'A' ? traceB.length : traceA.length}.`}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <Racer label={LABELS[algoA]} trace={traceA} step={step} busy={busy} error={errorA} />
              <Racer label={LABELS[algoB]} trace={traceB} step={step} busy={busy} error={errorB} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
