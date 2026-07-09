import React, { useMemo, useRef, useState } from 'react'
import ModuleLayout from '../../components/ModuleLayout.jsx'
import PlaybackControls from '../../components/PlaybackControls.jsx'
import CodePanel from '../../components/CodePanel.jsx'
import VariablesPanel from '../../components/VariablesPanel.jsx'
import ArrayVisualization from '../../components/ArrayVisualization.jsx'
import AlgorithmInfo from '../../components/AlgorithmInfo.jsx'
import LanguageToggle from '../../components/LanguageToggle.jsx'
import { CPP_REFERENCE } from '../../data/cppReference.js'
import { api, ALGORITHMS } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

const NEEDS_TARGET = ['binary_search', 'two_pointer_pair_sum']
const NEEDS_K = ['sliding_window_max_sum']

const LABELS = {
  kadane: 'Kadane — Maximum Subarray',
  moore_voting: "Moore's Voting — Majority Element",
  binary_search: 'Binary Search',
  bubble_sort: 'Bubble Sort',
  selection_sort: 'Selection Sort',
  insertion_sort: 'Insertion Sort',
  merge_sort: 'Merge Sort',
  quick_sort: 'Quick Sort',
  heap_sort: 'Heap Sort',
  prefix_sum: 'Prefix Sum',
  sliding_window_max_sum: 'Sliding Window — Max Sum',
  two_pointer_pair_sum: 'Two Pointer — Pair Sum',
  dutch_national_flag: 'Dutch National Flag',
}

export default function ArrayModule() {
  const { token } = useAuth()
  const visRef = useRef(null)
  const [language, setLanguage] = useState('python')
  const [algorithm, setAlgorithm] = useState('kadane')
  const [arrText, setArrText] = useState('4, 2, -5, 6, 1, 3, -2, 5')
  const [target, setTarget] = useState('8')
  const [k, setK] = useState('3')
  const [trace, setTrace] = useState([])
  const [source, setSource] = useState(null)
  const [result, setResult] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const arr = useMemo(
    () => arrText.split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v)),
    [arrText]
  )

  const handleAlgorithmChange = (newAlgo) => {
    setAlgorithm(newAlgo)
    setError('')
    if (newAlgo === 'binary_search') {
      const sorted = [...arr].sort((a, b) => a - b)
      if (JSON.stringify(sorted) !== JSON.stringify(arr)) {
        setArrText(sorted.join(', '))
      }
    }
    if (newAlgo === 'dutch_national_flag') {
      const isValid = arr.length > 0 && arr.every((v) => v === 0 || v === 1 || v === 2)
      if (!isValid) {
        setArrText('2, 0, 1, 2, 1, 0, 0, 2, 1, 0')
      }
    }
  }

  const run = async () => {
    setError('')
    if (algorithm === 'binary_search') {
      const isSorted = arr.every((v, i) => i === 0 || arr[i - 1] <= v)
      if (!isSorted) {
        setError('Binary search only works on a sorted array. Sort your input first (e.g. -5, -2, 1, 2, 3, 4, 5, 6).')
        return
      }
    }
    if (algorithm === 'dutch_national_flag') {
      const isValid = arr.every((v) => v === 0 || v === 1 || v === 2)
      if (!isValid) {
        setError('Dutch National Flag only works on arrays of 0, 1, and 2 (e.g. 2, 0, 1, 2, 1, 0).')
        return
      }
    }
    setBusy(true)
    setPlaying(false)
    try {
      const input = { arr }
      if (NEEDS_TARGET.includes(algorithm)) input.target = Number(target)
      if (NEEDS_K.includes(algorithm)) input.k = Number(k)
      const data = await api.runTrace(token, 'array', algorithm, input)
      setTrace(data.trace || [])
      setResult(data.result)
      setSource(data.source || null)
      setStep(0)
    } catch (err) {
      setError(err.message)
      setTrace([])
    } finally {
      setBusy(false)
    }
  }

  const frame = trace[step] || {}
  // snapshot vars vary per algorithm; the tracer always nests them under `variables`
  const vars = frame.variables || {}
  const activeLine = frame.rel_line != null ? frame.rel_line - 1 : null

  return (
    <ModuleLayout
      eyebrow="Module 01"
      title="Array & Sorting"
      subtitle="Kadane's algorithm, all major sorts, prefix sums, sliding windows and pointer techniques."
      left={
        <div className="flex flex-col h-full">
          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Algorithm</label>
          <select
            value={algorithm}
            onChange={(e) => handleAlgorithmChange(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--line)' }}
          >
            {ALGORITHMS.array.map((a) => (
              <option key={a} value={a}>{LABELS[a] || a}</option>
            ))}
          </select>

          <AlgorithmInfo algorithm={algorithm} />

          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Array (comma separated)</label>
          <input
            value={arrText}
            onChange={(e) => setArrText(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--line)' }}
          />

          {NEEDS_TARGET.includes(algorithm) && (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Target</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--line)' }}
              />
            </>
          )}

          {NEEDS_K.includes(algorithm) && (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Window size (k)</label>
              <input
                value={k}
                onChange={(e) => setK(e.target.value)}
                className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--line)' }}
              />
            </>
          )}

          {error && <p className="text-sm mb-3" style={{ color: '#E0574F' }}>{error}</p>}

          <button
            onClick={run}
            disabled={busy || arr.length === 0}
            className="mt-auto w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {busy ? 'Tracing…' : 'Run trace'}
          </button>

          {trace.length > 0 && (
            <div className="mt-5 flex-1 min-h-0 flex flex-col">
              <LanguageToggle language={language} onChange={setLanguage} className="mb-2" />
              {language === 'python' ? (
                <CodePanel code={source} activeLine={activeLine} language="python" title="tracer_array.py" />
              ) : (
                <CodePanel code={CPP_REFERENCE.array[algorithm]} activeLine={null} language="cpp" title={`${algorithm}.cpp`} />
              )}
            </div>
          )}
        </div>
      }
      right={
        <div className="flex flex-col h-full">
          {/* Sticky within the panel — stays visible as you scroll the page to see variables below */}
          <div
            ref={visRef}
            className="sticky top-0 z-10 pb-4 mb-4 border-b"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          >
            <ArrayVisualization algorithm={algorithm} values={vars.arr || arr} variables={vars} />
          </div>

          {result !== null && result !== undefined && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm font-mono" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              result: {JSON.stringify(result)}
            </div>
          )}

          {trace.length > 0 && (
            <div className="mb-4">
              <VariablesPanel variables={vars} />
            </div>
          )}

          <div className="pt-4">
            <PlaybackControls
              step={step} setStep={setStep} total={trace.length}
              playing={playing} setPlaying={setPlaying}
              speed={speed} setSpeed={setSpeed}
              captureRef={visRef} gifFilename={`codevision-array-${algorithm}.gif`}
            />
          </div>
        </div>
      }
    />
  )
}
