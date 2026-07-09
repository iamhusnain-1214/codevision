import React, { useMemo } from 'react'

// simple deterministic circular layout for however many nodes are given
export function layoutGraph(nodes) {
  const R = 150, cx = 220, cy = 200
  return Object.fromEntries(
    nodes.map((id, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      return [id, { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }]
    })
  )
}

// nodes: string[]; edges: {from, to, weight}[]; frame: current trace step
export default function GraphView({ nodes, edges, frame }) {
  const pos = useMemo(() => layoutGraph(nodes), [nodes])
  const visited = new Set(frame.visited || [])
  const current = frame.current || frame.node
  const activeEdge = frame.edge

  if (nodes.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No nodes to display.</p>
  }

  return (
    <svg viewBox="0 0 440 400" className="w-full max-w-md">
      {edges.map((e, i) => {
        const a = pos[e.from], b = pos[e.to]
        if (!a || !b) return null
        const isActive = activeEdge && ((activeEdge[0] === e.from && activeEdge[1] === e.to) || (activeEdge[0] === e.to && activeEdge[1] === e.from))
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isActive ? 'var(--accent)' : 'var(--line)'} strokeWidth={isActive ? 3 : 1.5} />
            <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} fontSize="11" fill="var(--ink-faint)" textAnchor="middle" fontFamily="JetBrains Mono, monospace">{e.weight}</text>
          </g>
        )
      })}
      {nodes.map((id) => {
        const p = pos[id]
        if (!p) return null
        const isVisited = visited.has(id)
        const isCurrent = current === id
        return (
          <g key={id}>
            <circle
              cx={p.x} cy={p.y} r={22}
              fill={isCurrent ? 'var(--amber)' : isVisited ? 'var(--accent)' : 'var(--raised)'}
              stroke="var(--line)" strokeWidth={1.5}
              style={{ transition: 'fill 0.3s ease' }}
            />
            <text x={p.x} y={p.y + 5} fontSize="13" fontWeight={600} textAnchor="middle" fill={isVisited || isCurrent ? 'var(--bg)' : 'var(--ink)'} fontFamily="Inter, sans-serif">
              {id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
