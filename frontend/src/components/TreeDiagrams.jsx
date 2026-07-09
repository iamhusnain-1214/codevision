import React from 'react'

// Generic n-ary tree layout: works for binary trees (BST/AVL/heap) and
// wider trees (trie nodes can have many children). Leaves get sequential
// x slots; internal nodes center above their children — same approach as
// the recursion call-tree layout, just generalized past 2 children.
function layoutGeneric(root, getChildren) {
  const placed = []
  let leafCounter = 0

  function place(node, depth) {
    const children = getChildren(node) || []
    if (children.length === 0) {
      const x = leafCounter
      leafCounter += 1
      placed.push({ node, x, depth })
      return x
    }
    const xs = children.map((c) => place(c, depth + 1))
    const x = xs.reduce((a, b) => a + b, 0) / xs.length
    placed.push({ node, x, depth })
    return x
  }

  if (root) place(root, 0)
  return placed
}

const NODE_R = 20
const H_SPACING = 56
const V_SPACING = 64

export function TreeDiagram({ root, getChildren, getLabel, isHighlighted }) {
  if (!root) return <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Run a trace to see the tree build.</p>

  const placed = layoutGeneric(root, getChildren)
  const byNode = new Map(placed.map((p) => [p.node, p]))
  const maxX = Math.max(...placed.map((p) => p.x), 0)
  const maxDepth = Math.max(...placed.map((p) => p.depth), 0)
  const width = (maxX + 1) * H_SPACING + 40
  const height = (maxDepth + 1) * V_SPACING + 20

  const coordsOf = (p) => ({ cx: p.x * H_SPACING + 40, cy: p.depth * V_SPACING + 30 })

  return (
    <div className="overflow-auto w-full">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: Math.max(width, 320), height }}>
        {placed.map((p) => {
          const kids = getChildren(p.node) || []
          const { cx, cy } = coordsOf(p)
          return (
            <g key={`edges-${p.x}-${p.depth}`}>
              {kids.map((kid, i) => {
                const kp = byNode.get(kid)
                if (!kp) return null
                const kc = coordsOf(kp)
                return <line key={i} x1={cx} y1={cy} x2={kc.cx} y2={kc.cy} stroke="var(--line)" strokeWidth={1.5} />
              })}
            </g>
          )
        })}
        {placed.map((p, i) => {
          const { cx, cy } = coordsOf(p)
          const highlighted = isHighlighted?.(p.node)
          return (
            <g key={i}>
              <circle
                cx={cx} cy={cy} r={NODE_R}
                fill={highlighted ? 'var(--accent-dim)' : 'var(--surface)'}
                stroke={highlighted ? 'var(--accent)' : 'var(--line)'}
                strokeWidth={2}
              />
              <text x={cx} y={cy + 5} fontSize="13" fontWeight={600} textAnchor="middle" fill="var(--ink)" fontFamily="JetBrains Mono, monospace">
                {getLabel(p.node)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// BST/AVL: to_dict() gives {value, left, right} — used as-is.
export function bstChildren(n) { return [n.left, n.right].filter(Boolean) }
export function bstLabel(n) { return n.value ?? n.val ?? '·' }

// Heap: flat array -> implicit binary tree via index math (children of i
// are 2i+1, 2i+2), same as how a real binary heap is actually stored.
export function heapToTree(arr) {
  if (!arr || arr.length === 0) return null
  const build = (i) => (i >= arr.length ? null : { i, value: arr[i], left: build(2 * i + 1), right: build(2 * i + 2) })
  return build(0)
}
export function heapChildren(n) { return [n.left, n.right].filter(Boolean) }
export function heapLabel(n) { return n.value }

// Segment tree: classic array-backed layout where node i's children are
// 2i and 2i+1, root at index 1 (index 0 unused). Only render indices that
// have actually been computed so far in the trace (non-leaf placeholder
// zeros before their turn would be misleading).
export function segTreeToTree(arr, builtSet) {
  if (!arr || arr.length === 0) return null
  const n = arr.length
  const isLeaf = (i) => 2 * i >= n
  const build = (i) => {
    if (i >= n) return null
    if (!isLeaf(i) && !builtSet.has(i)) return { i, value: '?', left: build(2 * i), right: build(2 * i + 1), pending: true }
    return { i, value: arr[i], left: isLeaf(i) ? null : build(2 * i), right: isLeaf(i) ? null : build(2 * i + 1) }
  }
  return build(1)
}
export function segChildren(n) { return [n.left, n.right].filter(Boolean) }
export function segLabel(n) { return n.value }

// Trie: nested dict {char: {...}, "$end": true} -> tree nodes with a
// synthetic root labeled "•". Each real character becomes a node.
export function trieToTree(trie) {
  function build(node, label) {
    const children = Object.keys(node)
      .filter((k) => k !== '$end')
      .map((ch) => build(node[ch], ch))
    return { label, isEnd: !!node.$end, children }
  }
  return build(trie, '•')
}
export function trieChildren(n) { return n.children }
export function trieLabel(n) { return n.label }

// Full dispatcher matching TreeModule's renderVisualization, so History
// (and any other consumer) draws exactly the same picture the live module
// would have shown for a given algorithm + trace + step.
export function TreeVisualization({ algorithm, trace, step }) {
  const frame = trace[step] || {}

  if (trace.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Run a trace to see this structure build.</p>
  }

  if (algorithm === 'bst_insert' || algorithm === 'avl_insert') {
    const root = frame.tree || frame.root || frame.node
    return <TreeDiagram root={root} getChildren={bstChildren} getLabel={bstLabel} />
  }

  if (algorithm === 'heap_insert') {
    const root = heapToTree(frame.heap_array || [])
    return (
      <TreeDiagram
        root={root} getChildren={heapChildren} getLabel={heapLabel}
        isHighlighted={(n) => n.value === frame.inserted}
      />
    )
  }

  if (algorithm === 'segment_tree_build') {
    const builtSet = new Set(trace.slice(0, step + 1).map((s) => s.node_index))
    const root = segTreeToTree(frame.tree_array || [], builtSet)
    return (
      <TreeDiagram
        root={root} getChildren={segChildren} getLabel={segLabel}
        isHighlighted={(n) => n.i === frame.node_index}
      />
    )
  }

  if (algorithm === 'fenwick_tree_build') {
    const arr = frame.tree_array || []
    return (
      <div className="flex items-center flex-wrap gap-2 justify-center px-2">
        {arr.map((v, i) => {
          const active = i === frame.updated_index
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className="w-12 h-12 rounded-lg border flex items-center justify-center font-mono font-semibold text-sm"
                style={{
                  borderColor: 'var(--line)',
                  background: active ? 'var(--amber)' : i === 0 ? 'transparent' : 'var(--raised)',
                  color: active ? 'var(--bg)' : 'var(--ink)',
                  opacity: i === 0 ? 0.3 : 1,
                }}
              >
                {v}
              </div>
              <span className="text-[10px] font-mono mt-1" style={{ color: 'var(--ink-faint)' }}>{i}</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (algorithm === 'trie_insert') {
    const root = trieToTree(frame.trie || {})
    return (
      <TreeDiagram
        root={root} getChildren={trieChildren} getLabel={trieLabel}
        isHighlighted={(n) => n.isEnd}
      />
    )
  }

  return null
}
