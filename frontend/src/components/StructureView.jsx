import React from 'react'

const COLOR = {
  array: 'var(--accent)',
  queue: '#9B7FE0',
  stack: '#E0A97F',
  priority_queue: '#E0A97F',
  hash_map: 'var(--amber)',
  linked_list: '#E07F9B',
  tree: '#7FC77F',
  graph: '#5AA9E6',
  object: 'var(--ink-muted)',
}

function Primitive({ node }) {
  if (!node) return <span style={{ color: 'var(--ink-faint)' }}>—</span>
  const { type, value } = node
  if (type === 'array' || type === 'queue' || type === 'stack' || type === 'priority_queue') {
    return (
      <div className="flex gap-1 flex-wrap">
        {value.map((v, i) => (
          <div
            key={i}
            className="min-w-[36px] px-2 py-1.5 rounded-md border text-xs font-mono text-center"
            style={{ borderColor: COLOR[type], background: 'var(--raised)' }}
          >
            <Primitive node={v} />
          </div>
        ))}
        {value.length === 0 && <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>empty</span>}
      </div>
    )
  }
  if (type === 'hash_map') {
    const entries = Object.entries(value)
    return (
      <div className="flex flex-col gap-1">
        {entries.length === 0 && <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>empty</span>}
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 px-2 py-1 rounded-md border text-xs font-mono" style={{ borderColor: COLOR.hash_map, background: 'var(--raised)' }}>
            <span style={{ color: 'var(--amber)' }}>{k}</span>
            <span style={{ color: 'var(--ink-faint)' }}>→</span>
            <Primitive node={v} />
          </div>
        ))}
      </div>
    )
  }
  if (type === 'linked_list') {
    const chain = []
    let cur = node
    let guard = 0
    while (cur && cur.type === 'linked_list' && guard < 50) {
      chain.push(cur.value)
      cur = cur.value.next
      guard++
    }
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {chain.map((n, i) => (
          <React.Fragment key={i}>
            <div className="px-2.5 py-1.5 rounded-md border text-xs font-mono" style={{ borderColor: COLOR.linked_list, background: 'var(--raised)' }}>
              <Primitive node={n.val ?? n.value} />
            </div>
            {i < chain.length - 1 && <span style={{ color: 'var(--ink-faint)' }}>→</span>}
          </React.Fragment>
        ))}
        <span style={{ color: 'var(--ink-faint)' }}>→ null</span>
      </div>
    )
  }
  if (type === 'tree') {
    const label = node.value.val ?? node.value.value ?? '·'
    const left = node.value.left
    const right = node.value.right
    return (
      <div className="inline-flex flex-col items-center">
        <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-mono" style={{ borderColor: COLOR.tree, background: 'var(--raised)' }}>
          {label}
        </div>
        {(left || right) && (
          <div className="flex gap-4 mt-1 pt-1">
            <div>{left ? <Primitive node={left} /> : <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>·</span>}</div>
            <div>{right ? <Primitive node={right} /> : <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>·</span>}</div>
          </div>
        )}
      </div>
    )
  }
  if (type === 'object') {
    const entries = Object.entries(value || {})
    return (
      <div className="flex flex-col gap-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="text-xs font-mono"><span style={{ color: 'var(--ink-faint)' }}>{k}: </span><Primitive node={v} /></div>
        ))}
      </div>
    )
  }
  if (type === 'string') return <span style={{ color: 'var(--amber)' }}>"{value}"</span>
  if (type === 'none') return <span style={{ color: 'var(--ink-faint)' }}>None</span>
  return <span>{String(value)}</span>
}

/**
 * Renders one block per top-level variable, each drawn as the pictorial
 * shape matching its detected type — this is what "auto-detect the data
 * structure and draw it" actually looks like, vs. a JSON dump.
 */
export default function StructureView({ variables = {} }) {
  const entries = Object.entries(variables)
  if (entries.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No variables in scope yet.</p>
  }
  return (
    <div className="flex flex-col gap-4 w-full">
      {entries.map(([name, node]) => (
        <div key={name} className="rounded-lg border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-sm font-semibold">{name}</span>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: COLOR[node?.type] || 'var(--ink-muted)' }}>
              {node?.type || typeof node}
            </span>
          </div>
          <Primitive node={node} />
        </div>
      ))}
    </div>
  )
}
