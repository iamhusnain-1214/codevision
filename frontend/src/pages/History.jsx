import React, { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import PlaybackControls from '../components/PlaybackControls.jsx'
import CodePanel from '../components/CodePanel.jsx'
import VariablesPanel from '../components/VariablesPanel.jsx'
import StructureView from '../components/StructureView.jsx'
import ArrayVisualization from '../components/ArrayVisualization.jsx'
import RecursionTree from '../components/RecursionTree.jsx'
import GraphView from '../components/GraphView.jsx'
import DPTable from '../components/DPTable.jsx'
import { TreeVisualization } from '../components/TreeDiagrams.jsx'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const MODULES = ['', 'array', 'recursion', 'dp', 'graph', 'tree', 'custom_code']

const CODE_TITLE = {
  array: 'tracer_array.py',
  recursion: 'tracer_array.py — recursion',
  dp: 'tracer_array.py — dp',
  graph: 'tracer_graph.py',
  tree: 'tracer_tree.py',
}

// Parses the same "from-to:weight" edge shape the Graph module saves as
// input, back into the {from, to, weight} objects GraphView expects.
function parseGraphInput(input) {
  const nodes = input?.nodes || []
  const rawEdges = input?.edges || []
  const edges = rawEdges.map((e) => {
    if (Array.isArray(e)) return { from: e[0], to: e[1], weight: e[2] ?? 1 }
    return e
  })
  return { nodes, edges }
}

export default function History() {
  const { token } = useAuth()
  const visRef = useRef(null)
  const [filter, setFilter] = useState('')
  const [runs, setRuns] = useState([])
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.history(token, filter || undefined)
      .then((d) => setRuns(d.runs || []))
      .finally(() => setLoading(false))
  }, [token, filter])

  const openRun = async (run) => {
    setDetailLoading(true)
    setPlaying(false)
    try {
      const detail = await api.historyDetail(token, run.id)
      setSelected(detail)
      setStep(0)
    } finally {
      setDetailLoading(false)
    }
  }

  const deleteRun = async (e, run) => {
    e.stopPropagation() // don't trigger openRun on the row
    if (!window.confirm('Delete this saved run? This can\'t be undone.')) return
    setDeletingId(run.id)
    try {
      await api.deleteRun(token, run.id)
      setRuns((prev) => prev.filter((r) => r.id !== run.id))
      if (selected?.id === run.id) {
        setSelected(null)
        setStep(0)
      }
    } catch (err) {
      window.alert(err.message || 'Could not delete this run.')
    } finally {
      setDeletingId(null)
    }
  }

  const clearAll = async () => {
    const label = filter ? `all ${filter.replace('_', ' ')} runs` : 'all your history'
    if (!window.confirm(`Clear ${label}? This can't be undone.`)) return
    setClearing(true)
    try {
      await api.deleteAllRuns(token, filter || undefined)
      setRuns([])
      setSelected(null)
      setStep(0)
    } catch (err) {
      window.alert(err.message || 'Could not clear history.')
    } finally {
      setClearing(false)
    }
  }

  const trace = selected?.trace_data || []
  const frame = trace[step] || {}
  const input = selected?.input_data || {}
  const module = selected?.module
  const isCustom = module === 'custom_code'

  const activeLine = useMemo(() => {
    if (isCustom) return frame.line != null ? frame.line - 1 : null
    return frame.rel_line != null ? frame.rel_line - 1 : null
  }, [frame, isCustom])

  const graphData = useMemo(() => (module === 'graph' ? parseGraphInput(input) : null), [module, input])

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-1">History</h1>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>Every trace you've ever run, saved and replayable.</p>

        <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {MODULES.map((m) => (
              <button
                key={m || 'all'}
                onClick={() => setFilter(m)}
                className="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize"
                style={{
                  borderColor: 'var(--line)',
                  background: filter === m ? 'var(--accent-dim)' : 'transparent',
                  color: filter === m ? 'var(--accent)' : 'var(--ink-muted)',
                }}
              >
                {m ? m.replace('_', ' ') : 'All'}
              </button>
            ))}
          </div>
          {runs.length > 0 && (
            <button
              onClick={clearAll}
              disabled={clearing}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-60"
              style={{ borderColor: 'var(--line)', color: '#E0574F' }}
            >
              {clearing ? 'Clearing…' : filter ? `Clear ${filter.replace('_', ' ')}` : 'Clear all'}
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-[280px_1fr] gap-6">
          <div className="rounded-xl2 border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            {loading ? (
              <p className="text-sm p-5" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
            ) : runs.length === 0 ? (
              <p className="text-sm p-5" style={{ color: 'var(--ink-faint)' }}>No runs yet.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {runs.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => openRun(r)}
                    role="button"
                    tabIndex={0}
                    className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-[var(--raised)] flex items-start justify-between gap-2 cursor-pointer"
                    style={{ background: selected?.id === r.id ? 'var(--raised)' : 'transparent' }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium capitalize truncate">{r.module.replace('_', ' ')} · {r.algorithm}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{r.created_at}</div>
                    </div>
                    <button
                      onClick={(e) => deleteRun(e, r)}
                      disabled={deletingId === r.id}
                      title="Delete this run"
                      className="shrink-0 text-xs font-medium px-2 py-1 rounded-md transition-colors disabled:opacity-50 hover:bg-[var(--bg)]"
                      style={{ color: '#E0574F' }}
                    >
                      {deletingId === r.id ? '…' : '✕'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl2 border p-6 flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            {detailLoading ? (
              <p className="text-sm py-10 text-center" style={{ color: 'var(--ink-faint)' }}>Loading replay…</p>
            ) : !selected ? (
              <p className="text-sm py-10 text-center" style={{ color: 'var(--ink-faint)' }}>Select a run to replay it.</p>
            ) : (
              <>
                <div className="grid lg:grid-cols-2 gap-6 items-start">
                  {/* left: the exact source, with the active line for this step highlighted */}
                  <div
                    className="rounded-xl2 border p-4 min-h-[420px] flex flex-col"
                    style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                  >
                    <CodePanel
                      code={selected.source}
                      activeLine={module === 'graph' || module === 'tree' ? null : activeLine}
                      language={selected.language || 'python'}
                      title={isCustom ? 'your code' : (CODE_TITLE[module] || 'source')}
                    />
                  </div>

                  {/* right: the same visualization component + wrapper the live module uses for this module type */}
                  <div
                    ref={visRef}
                    className="rounded-xl2 border p-4 min-h-[420px] flex flex-col"
                    style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                  >
                    {(module === 'graph' || module === 'tree' || module === 'dp') ? (
                      // these three center their visualization within a fixed-minimum-height box, same as their live module
                      <div className="flex-1 flex items-center justify-center min-h-[280px] overflow-auto">
                        {module === 'dp' && <DPTable frame={frame} />}
                        {module === 'graph' && graphData && <GraphView nodes={graphData.nodes} edges={graphData.edges} frame={frame} />}
                        {module === 'tree' && <TreeVisualization algorithm={selected.algorithm} trace={trace} step={step} />}
                      </div>
                    ) : (
                      // array / recursion / custom code render as a top-aligned block, same as their live module
                      <div className="flex-1 overflow-auto min-h-[280px] mb-4">
                        {module === 'array' && (
                          <ArrayVisualization algorithm={selected.algorithm} values={frame.variables?.arr || input.arr || []} variables={frame.variables || {}} />
                        )}
                        {module === 'recursion' && <RecursionTree trace={trace} currentStep={step} />}
                        {isCustom && <StructureView variables={frame.variables || {}} />}
                      </div>
                    )}

                    {(module === 'array' || module === 'recursion' || module === 'dp') && (
                      <div className="mb-4">
                        <VariablesPanel variables={frame.variables || {}} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                  <PlaybackControls
                    step={step} setStep={setStep} total={trace.length}
                    playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
                    captureRef={visRef} gifFilename={`codevision-${module}-${selected.algorithm}.gif`}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
