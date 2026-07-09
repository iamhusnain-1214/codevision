import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from '../../components/ModuleLayout.jsx'
import PlaybackControls from '../../components/PlaybackControls.jsx'
import CodePanel from '../../components/CodePanel.jsx'
import AlgorithmInfo from '../../components/AlgorithmInfo.jsx'
import LanguageToggle from '../../components/LanguageToggle.jsx'
import { CPP_REFERENCE } from '../../data/cppReference.js'
import { api, ALGORITHMS } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import GraphView from '../../components/GraphView.jsx'

const NEEDS_START = ['bfs', 'dfs', 'dijkstra', 'bellman_ford']

export default function GraphModule() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const visRef = useRef(null)
  const [language, setLanguage] = useState('python')
  const [algorithm, setAlgorithm] = useState('bfs')
  const [nodesText, setNodesText] = useState('A, B, C, D, E')
  const [edgesText, setEdgesText] = useState('A-B:1, A-C:4, B-C:2, B-D:5, C-D:1, D-E:3')
  const [start, setStart] = useState('A')
  const [trace, setTrace] = useState([])
  const [source, setSource] = useState(null)
  const [result, setResult] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const nodes = useMemo(() => nodesText.split(',').map((s) => s.trim()).filter(Boolean), [nodesText])
  const edges = useMemo(() => edgesText.split(',').map((s) => {
    const [pair, w] = s.trim().split(':')
    const [from, to] = pair.split('-').map((x) => x.trim())
    return { from, to, weight: w ? Number(w) : 1 }
  }).filter((e) => e.from && e.to), [edgesText])

  const run = async () => {
    setError(''); setBusy(true); setPlaying(false)
    try {
      const input = { nodes, edges: edges.map((e) => [e.from, e.to, e.weight]) }
      if (NEEDS_START.includes(algorithm)) input.start = start
      const data = await api.runTrace(token, 'graph', algorithm, input)
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
    const prefillCode = language === 'python' ? source : CPP_REFERENCE.graph[algorithm]
    navigate('/complexity', { state: { prefillCode, prefillLanguage: language } })
  }

  return (
    <ModuleLayout
      eyebrow="Module 05"
      title="Graphs"
      subtitle="BFS, DFS, Dijkstra, Prim, Kruskal, Bellman–Ford, Floyd–Warshall, topological sort."
      left={
        <div className="flex flex-col h-full">
          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Algorithm</label>
          <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }}>
            {ALGORITHMS.graph.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>

          <AlgorithmInfo algorithm={algorithm} />

          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Nodes</label>
          <input value={nodesText} onChange={(e) => setNodesText(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />

          <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Edges (from-to:weight)</label>
          <input value={edgesText} onChange={(e) => setEdgesText(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />

          {NEEDS_START.includes(algorithm) && (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Start node</label>
              <input value={start} onChange={(e) => setStart(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm focus:border-[var(--accent)]" style={{ borderColor: 'var(--line)' }} />
            </>
          )}

          {error && <p className="text-sm mb-3" style={{ color: '#E0574F' }}>{error}</p>}

          <button onClick={run} disabled={busy} className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            {busy ? 'Tracing…' : 'Run trace'}
          </button>

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
                <CodePanel code={source} activeLine={null} language="python" title="tracer_graph.py" />
              ) : (
                <CodePanel code={CPP_REFERENCE.graph[algorithm]} activeLine={null} language="cpp" title={`${algorithm}.cpp`} />
              )}
            </div>
          )}
        </div>
      }
      right={
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center min-h-[280px]" ref={visRef}>
            {nodes.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Define nodes and edges to begin.</p>
            ) : (
              <GraphView nodes={nodes} edges={edges} frame={frame} />
            )}
          </div>

          {result !== null && result !== undefined && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm font-mono max-h-24 overflow-auto" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              result: {JSON.stringify(result)}
            </div>
          )}

          <PlaybackControls
            step={step} setStep={setStep} total={trace.length}
            playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
            captureRef={visRef} gifFilename={`codevision-graph-${algorithm}.gif`}
          />
        </div>
      }
    />
  )
}
