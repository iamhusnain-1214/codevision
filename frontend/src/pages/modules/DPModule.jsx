import React, { useRef, useState } from 'react'
import ModuleLayout from '../../components/ModuleLayout.jsx'
import PlaybackControls from '../../components/PlaybackControls.jsx'
import CodePanel from '../../components/CodePanel.jsx'
import VariablesPanel from '../../components/VariablesPanel.jsx'
import AlgorithmInfo from '../../components/AlgorithmInfo.jsx'
import LanguageToggle from '../../components/LanguageToggle.jsx'
import DPTable from '../../components/DPTable.jsx'
import { CPP_REFERENCE } from '../../data/cppReference.js'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function DPModule() {
  const { token } = useAuth()
  const visRef = useRef(null)
  const [language, setLanguage] = useState('python')
  const [algorithm, setAlgorithm] = useState('lcs')
  const [s1, setS1] = useState('ABCBDAB')
  const [s2, setS2] = useState('BDCABA')
  const [weights, setWeights] = useState('2, 3, 4, 5')
  const [values, setValues] = useState('3, 4, 5, 6')
  const [capacity, setCapacity] = useState('5')
  const [trace, setTrace] = useState([])
  const [source, setSource] = useState(null)
  const [result, setResult] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setError(''); setBusy(true); setPlaying(false)
    try {
      const input = algorithm === 'lcs'
        ? { s1, s2 }
        : {
            weights: weights.split(',').map((v) => Number(v.trim())),
            values: values.split(',').map((v) => Number(v.trim())),
            capacity: Number(capacity),
          }
      const data = await api.runTrace(token, 'dp', algorithm, input)
      setTrace(data.trace || [])
      setResult(data.result)
      setSource(data.source || null)
      setStep(0)
    } catch (err) {
      setError(err.message); setTrace([])
    } finally { setBusy(false) }
  }

  const frame = trace[step] || {}
  const activeLine = frame.rel_line != null ? frame.rel_line - 1 : null

  return (
    <ModuleLayout
      eyebrow="Module 03"
      title="Dynamic Programming"
      subtitle="LCS and 0/1 Knapsack — watch the table fill in, cell by cell."
      left={
        <div className="flex flex-col h-full">
          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Algorithm</label>
          <select
            value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--line)' }}
          >
            <option value="lcs">Longest Common Subsequence</option>
            <option value="knapsack">0/1 Knapsack</option>
          </select>

          <AlgorithmInfo algorithm={algorithm} />

          {algorithm === 'lcs' ? (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>String 1</label>
              <input value={s1} onChange={(e) => setS1(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>String 2</label>
              <input value={s2} onChange={(e) => setS2(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />
            </>
          ) : (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Weights</label>
              <input value={weights} onChange={(e) => setWeights(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Values</label>
              <input value={values} onChange={(e) => setValues(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Capacity</label>
              <input value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />
            </>
          )}

          {error && <p className="text-sm mb-3" style={{ color: '#E0574F' }}>{error}</p>}

          <button
            onClick={run} disabled={busy}
            className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {busy ? 'Tracing…' : 'Run trace'}
          </button>

          {source && (
            <div className="mt-5 flex-1 min-h-0 flex flex-col">
              <LanguageToggle language={language} onChange={setLanguage} className="mb-2" />
              {language === 'python' ? (
                <CodePanel code={source} activeLine={activeLine} language="python" title="tracer_array.py — dp" />
              ) : (
                <CodePanel code={CPP_REFERENCE.dp[algorithm]} activeLine={null} language="cpp" title={`${algorithm}.cpp`} />
              )}
            </div>
          )}
        </div>
      }
      right={
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center overflow-auto px-2 pb-6 min-h-[280px]" ref={visRef}>
            <DPTable frame={frame} />
          </div>

          {result !== null && result !== undefined && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm font-mono" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              result: {JSON.stringify(result)}
            </div>
          )}

          {trace.length > 0 && (
            <div className="mb-4">
              <VariablesPanel variables={frame.variables || {}} />
            </div>
          )}

          <PlaybackControls
            step={step} setStep={setStep} total={trace.length}
            playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
            captureRef={visRef} gifFilename={`codevision-dp-${algorithm}.gif`}
          />
        </div>
      }
    />
  )
}
