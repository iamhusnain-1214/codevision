import React, { useRef, useState } from 'react'
import ModuleLayout from '../../components/ModuleLayout.jsx'
import PlaybackControls from '../../components/PlaybackControls.jsx'
import CodePanel from '../../components/CodePanel.jsx'
import VariablesPanel from '../../components/VariablesPanel.jsx'
import AlgorithmInfo from '../../components/AlgorithmInfo.jsx'
import RecursionTree from '../../components/RecursionTree.jsx'
import LanguageToggle from '../../components/LanguageToggle.jsx'
import { CPP_REFERENCE } from '../../data/cppReference.js'
import { api, ALGORITHMS } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { unwrapSnapshot } from '../../utils/unwrapSnapshot.js'

const CUSTOM_SAMPLE = `def sum_digits(n):
    if n < 10:
        return n
    return n % 10 + sum_digits(n // 10)

result = sum_digits(4827)
print(result)
`

export default function RecursionModule() {
  const { token } = useAuth()
  const visRef = useRef(null)
  const [language, setLanguage] = useState('python')
  const [algorithm, setAlgorithm] = useState('factorial')
  const [n, setN] = useState('5')
  const [customCode, setCustomCode] = useState(CUSTOM_SAMPLE)
  const [trace, setTrace] = useState([])
  const [source, setSource] = useState(null)
  const [result, setResult] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isCustom = algorithm === 'custom'

  const handleAlgorithmChange = (newAlgo) => {
    setAlgorithm(newAlgo)
    setError('')
    if (newAlgo === 'sum_digits' && Number(n) < 10) {
      setN('4827')
    } else if (newAlgo !== 'sum_digits' && n === '4827') {
      setN('5')
    }
  }

  const run = async () => {
    setError(''); setBusy(true); setPlaying(false)
    try {
      const data = isCustom
        ? await api.runCustomTrace(token, customCode, 'python')
        : await api.runTrace(token, 'recursion', algorithm, { n: Number(n) })
      setTrace(data.trace || [])
      setResult(data.result)
      setSource(data.source || customCode)
      setStep(0)
      if (isCustom && data.error) setError(data.error) // partial trace + error, same as Custom Code module
    } catch (err) {
      setError(err.message); setTrace([])
    } finally { setBusy(false) }
  }

  const frame = trace[step] || {}
  const activeLine = isCustom
    ? (frame.line != null ? frame.line - 1 : null)
    : (frame.rel_line != null ? frame.rel_line - 1 : null)

  return (
    <ModuleLayout
      eyebrow="Module 02"
      title="Recursion"
      subtitle="Factorial and fibonacci, with the live call stack made visible."
      left={
        <div className="flex flex-col h-full">
          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Algorithm</label>
          <select
            value={algorithm} onChange={(e) => handleAlgorithmChange(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--line)' }}
          >
            {ALGORITHMS.recursion.map((a) => <option key={a} value={a}>{a === 'custom' ? 'Custom code' : a.replace(/_/g, ' ')}</option>)}
          </select>

          {!isCustom && <AlgorithmInfo algorithm={algorithm} />}

          {isCustom ? (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Your recursive Python code</label>
              <textarea
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                spellCheck={false}
                className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm leading-relaxed resize-none focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--line)', minHeight: 180 }}
              />
            </>
          ) : (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>n</label>
              <input
                value={n} onChange={(e) => setN(e.target.value)}
                className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--line)' }}
              />
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

          {/* Playback controls live here, not under the (potentially very tall) tree
              diagram on the right — so they're never pushed off-screen by big traces. */}
          {trace.length > 0 && (
            <div className="mt-4">
              <PlaybackControls
                step={step} setStep={setStep} total={trace.length}
                playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
                captureRef={visRef} gifFilename={`codevision-recursion-${algorithm}.gif`}
              />
            </div>
          )}

          {source && (
            <div className="mt-5 flex-1 min-h-0 flex flex-col">
              {!isCustom && <LanguageToggle language={language} onChange={setLanguage} className="mb-2" />}
              {isCustom || language === 'python' ? (
                <CodePanel code={source} activeLine={activeLine} language="python" title={isCustom ? 'your code' : 'tracer_array.py — recursion'} />
              ) : (
                <CodePanel code={CPP_REFERENCE.recursion[algorithm]} activeLine={null} language="cpp" title={`${algorithm}.cpp`} />
              )}
            </div>
          )}

          {/* Result + Variables live in the left column, not under the tree diagram
              on the right — a deep/wide tree can grow very tall and would push
              these panels down and off-screen if they lived on the right. */}
          {result !== null && result !== undefined && (
            <div className="mt-4 px-4 py-3 rounded-lg text-sm font-mono" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              result: {JSON.stringify(result)}
            </div>
          )}

          {trace.length > 0 && (
            <div className="mt-4">
              <VariablesPanel variables={isCustom ? unwrapSnapshot(frame.variables || {}) : (frame.variables || {})} />
            </div>
          )}
        </div>
      }
      right={
        <div className="flex flex-col h-full" ref={visRef}>
          <RecursionTree trace={trace} currentStep={step} />
        </div>
      }
    />
  )
}
