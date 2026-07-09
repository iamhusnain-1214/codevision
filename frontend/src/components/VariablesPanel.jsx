import React from 'react'

const TYPE_COLOR = {
  number: 'var(--accent)',
  string: 'var(--amber)',
  boolean: '#9B7FE0',
  array: 'var(--accent)',
  hash_map: 'var(--amber)',
  queue: '#9B7FE0',
  stack: '#E0A97F',
  priority_queue: '#E0A97F',
  set: '#5AA9E6',
  linked_list: '#E07F9B',
  tree: '#7FC77F',
  graph: '#E0A85A',
  object: 'var(--ink-muted)',
}

function formatValue(v) {
  if (v === null || v === undefined) return 'None'
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`
  if (typeof v === 'object') {
    const entries = Object.entries(v).map(([k, val]) => `${k}: ${formatValue(val)}`)
    return `{${entries.join(', ')}}`
  }
  if (typeof v === 'string') return `"${v}"`
  return String(v)
}

/**
 * Renders a step's variables like a debugger's "Variables" pane —
 * name, inferred type badge, and current value.
 */
export default function VariablesPanel({ variables = {}, structures = null }) {
  const rows = structures
    ? structures.map((s) => ({ name: s.name, type: s.type, value: s.value }))
    : Object.entries(variables).map(([name, value]) => ({
        name,
        type: Array.isArray(value) ? 'array' : typeof value === 'object' && value !== null ? 'hash_map' : typeof value,
        value,
      }))

  if (rows.length === 0) {
    return <p className="text-sm px-1" style={{ color: 'var(--ink-faint)' }}>No local variables yet.</p>
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b" style={{ borderColor: 'var(--line)', background: 'var(--raised)', color: 'var(--ink-muted)' }}>
        Variables
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
        {rows.map((r) => (
          <div key={r.name} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <span
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ background: TYPE_COLOR[r.type] || 'var(--ink-faint)' }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-semibold">{r.name}</span>
                <span className="text-[10px] uppercase tracking-wide" style={{ color: TYPE_COLOR[r.type] || 'var(--ink-faint)' }}>
                  {r.type}
                </span>
              </div>
              <div className="font-mono text-xs mt-0.5 break-words" style={{ color: 'var(--ink-muted)' }}>
                {formatValue(r.value)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
