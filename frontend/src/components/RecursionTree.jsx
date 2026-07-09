import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import buildCallTree from '../utils/buildCallTree.js'

const BOX_W = 150
const BOX_H = 64
const H_GAP = 24
const V_GAP = 56

function unwrap(v) {
  if (v && typeof v === 'object' && 'type' in v && 'value' in v && Object.keys(v).length === 2) {
    return unwrap(v.value)
  }
  if (Array.isArray(v)) return v.map(unwrap)
  return v
}

function formatArgs(args = {}) {
  const entries = Object.entries(args)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${k}=${JSON.stringify(unwrap(v))}`).join(', ')
}

/**
 * Computes a simple tidy-tree layout: leaves get sequential x slots,
 * internal nodes are centered above their children. Good enough for the
 * shallow, narrow trees these recursion examples produce (factorial is a
 * straight line; fibonacci branches but stays small for reasonable n).
 */
function layout(nodes, rootId) {
  const childrenOf = {}
  nodes.forEach((n) => {
    if (n.parentId !== null) {
      childrenOf[n.parentId] = childrenOf[n.parentId] || []
      childrenOf[n.parentId].push(n.id)
    }
  })

  const positions = {}
  let leafCounter = 0

  function place(id, depth) {
    const kids = childrenOf[id] || []
    if (kids.length === 0) {
      positions[id] = { x: leafCounter, depth }
      leafCounter += 1
      return positions[id].x
    }
    const xs = kids.map((kid) => place(kid, depth + 1))
    const x = xs.reduce((a, b) => a + b, 0) / xs.length
    positions[id] = { x, depth }
    return x
  }

  if (rootId !== null) place(rootId, 0)
  return { positions, childrenOf }
}

export default function RecursionTree({ trace, currentStep }) {
  const { nodes, rootId } = useMemo(() => buildCallTree(trace), [trace])
  const { positions, childrenOf } = useMemo(() => layout(nodes, rootId), [nodes, rootId])

  if (nodes.length === 0) {
    return <p className="text-sm py-8 text-center" style={{ color: 'var(--ink-faint)' }}>Run a trace to see the call tree build.</p>
  }

  const visibleNodes = nodes.filter((n) => n.createdStep <= currentStep)
  const activeId = visibleNodes.reduce((latest, n) => {
    // "active" = most recently created frame that hasn't returned yet
    // (by current step) — i.e. the current top of the call stack.
    if (n.returnedStep !== null && n.returnedStep <= currentStep) return latest
    return latest === null || n.createdStep > nodes[latest].createdStep ? n.id : latest
  }, null)

  const maxX = Math.max(...Object.values(positions).map((p) => p.x))
  const maxDepth = Math.max(...Object.values(positions).map((p) => p.depth))
  const width = (maxX + 1) * (BOX_W + H_GAP)
  const height = (maxDepth + 1) * (BOX_H + V_GAP)

  const centerOf = (id) => {
    const p = positions[id]
    return { cx: p.x * (BOX_W + H_GAP) + BOX_W / 2, top: p.depth * (BOX_H + V_GAP), bottom: p.depth * (BOX_H + V_GAP) + BOX_H }
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative" style={{ width: Math.max(width, 100), height: Math.max(height, 100) }}>
        {/* connecting lines */}
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
          {visibleNodes.map((n) => {
            if (n.parentId === null) return null
            if (!positions[n.parentId] || !positions[n.id]) return null
            const parentC = centerOf(n.parentId)
            const childC = centerOf(n.id)
            const midY = (parentC.bottom + childC.top) / 2
            return (
              <path
                key={`edge-${n.id}`}
                d={`M ${parentC.cx} ${parentC.bottom} C ${parentC.cx} ${midY}, ${childC.cx} ${midY}, ${childC.cx} ${childC.top}`}
                fill="none"
                stroke="var(--line)"
                strokeWidth="2"
              />
            )
          })}
        </svg>

        {/* call boxes */}
        <AnimatePresence>
          {visibleNodes.map((n) => {
            const p = positions[n.id]
            const isActive = n.id === activeId
            const hasReturned = n.returnedStep !== null && n.returnedStep <= currentStep
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                className="absolute rounded-lg border px-3 py-2 font-mono text-xs"
                style={{
                  left: p.x * (BOX_W + H_GAP),
                  top: p.depth * (BOX_H + V_GAP),
                  width: BOX_W,
                  height: BOX_H,
                  borderColor: isActive ? 'var(--accent)' : hasReturned ? 'var(--line)' : 'var(--line)',
                  background: isActive ? 'var(--accent-dim)' : hasReturned ? 'var(--raised)' : 'var(--surface)',
                  boxShadow: isActive ? '0 0 0 1px var(--accent)' : 'none',
                }}
              >
                <div className="font-semibold truncate" style={{ color: isActive ? 'var(--accent)' : 'var(--ink)' }}>
                  {n.funcName}({formatArgs(n.args)})
                </div>
                <div className="mt-1" style={{ color: hasReturned ? 'var(--amber)' : 'var(--ink-faint)' }}>
                  {hasReturned ? `→ ${JSON.stringify(n.returnValue)}` : 'running…'}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
