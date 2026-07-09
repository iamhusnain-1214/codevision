import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from '../../components/ModuleLayout.jsx'
import PlaybackControls from '../../components/PlaybackControls.jsx'
import CodePanel from '../../components/CodePanel.jsx'
import AlgorithmInfo from '../../components/AlgorithmInfo.jsx'
import LanguageToggle from '../../components/LanguageToggle.jsx'
import { CPP_REFERENCE } from '../../data/cppReference.js'
import { api, ALGORITHMS } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { TreeVisualization } from '../../components/TreeDiagrams.jsx'

export default function TreeModule() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const visRef = useRef(null)
  const [language, setLanguage] = useState('python')
  const [algorithm, setAlgorithm] = useState('bst_insert')
  const [valuesText, setValuesText] = useState('50, 30, 70, 20, 40, 60, 80')
  const [trace, setTrace] = useState([])
  const [source, setSource] = useState(null)
  const [result, setResult] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isTrie = algorithm === 'trie_insert'

  const handleAlgorithmChange = (newAlgo) => {
    setAlgorithm(newAlgo)
    setError('')
    if (newAlgo === 'trie_insert') {
      setValuesText('cat, car, card, dog, do')
    } else if (newAlgo === 'avl_insert') {
      setValuesText('10, 20, 30, 40, 50, 25')
    } else if (valuesText === 'cat, car, card, dog, do' || valuesText === '10, 20, 30, 40, 50, 25') {
      setValuesText('50, 30, 70, 20, 40, 60, 80')
    }
  }

  const run = async () => {
    setError(''); setBusy(true); setPlaying(false)
    try {
      const values = isTrie
        ? valuesText.split(',').map((s) => s.trim())
        : valuesText.split(',').map((s) => Number(s.trim()))
      const data = await api.runTrace(token, 'tree', algorithm, { values })
      setTrace(data.trace || [])
      setResult(data.result)
      setSource(data.source || null)
      setStep(0)
    } catch (err) {
      setError(err.message); setTrace([])
    } finally { setBusy(false) }
  }

  const frame = trace[step] || {}

  const analyzeThisComplexity = () => {
    const prefillCode = language === 'python' ? source : CPP_REFERENCE.tree[algorithm]
    navigate('/complexity', { state: { prefillCode, prefillLanguage: language } })
  }

  return (
    <ModuleLayout
      eyebrow="Module 06"
      title="Trees"
      subtitle="BST, AVL (with real rotations), heaps, segment trees, Fenwick trees, tries."
      left={
        <div className="flex flex-col h-full">
          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Structure</label>
          <select value={algorithm} onChange={(e) => handleAlgorithmChange(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }}>
            {ALGORITHMS.tree.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>

          <AlgorithmInfo algorithm={algorithm} />

          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>
            {isTrie ? 'Words (comma separated)' : 'Values (comma separated)'}
          </label>
          <input value={valuesText} onChange={(e) => setValuesText(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />

          {error && <p className="text-sm mb-3" style={{ color: '#E0574F' }}>{error}</p>}

          <button onClick={run} disabled={busy} className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            {busy ? 'Tracing…' : 'Run trace'}
          </button>

          {trace.length > 0 && (
            <div className="mt-4">
              <PlaybackControls
                step={step} setStep={setStep} total={trace.length}
                playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
                captureRef={visRef} gifFilename={`codevision-tree-${algorithm}.gif`}
              />
            </div>
          )}

          {source && (
            <div className="mt-5 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <LanguageToggle language={language} onChange={setLanguage} />
                <button
                  onClick={analyzeThisComplexity}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  Analyze complexity →
                </button>
              </div>
              {language === 'python' ? (
                <CodePanel code={source} activeLine={null} language="python" title="tracer_tree.py" />
              ) : (
                <CodePanel code={CPP_REFERENCE.tree[algorithm]} activeLine={null} language="cpp" title={`${algorithm}.cpp`} />
              )}
            </div>
          )}
        </div>
      }
      right={
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center min-h-[280px] overflow-auto" ref={visRef}>
            <TreeVisualization algorithm={algorithm} trace={trace} step={step} />
          </div>
        </div>
      }
    />
  )
}
