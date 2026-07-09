import React from 'react'
import { motion } from 'framer-motion'

export default function DPTable({ frame }) {
  // The tracer snapshots local variables as-is, so the 2D grid actually
  // lives at frame.variables.dp (the local var is literally named `dp`
  // inside lcs()/knapsack()) — not at the top level of the frame. Check
  // there first, then fall back to older/alternate shapes just in case.
  const vars = frame.variables || {}
  const table = vars.dp || frame.table || frame.dp || frame.grid || []

  if (!Array.isArray(table) || table.length === 0 || !Array.isArray(table[0])) {
    return <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Run a trace to watch the table fill in.</p>
  }

  return (
    <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${table[0]?.length || 1}, minmax(34px, 1fr))` }}>
      {table.flatMap((row, ri) =>
        row.map((cell, ci) => (
          <motion.div
            key={`${ri}-${ci}`}
            animate={{
              backgroundColor: vars.i === ri && (vars.j ?? vars.w) === ci ? 'var(--amber)' : cell ? 'var(--accent-dim)' : 'var(--raised)',
              scale: vars.i === ri && (vars.j ?? vars.w) === ci ? 1.08 : 1,
            }}
            transition={{ duration: 0.2 }}
            className="w-9 h-9 rounded-md flex items-center justify-center text-xs font-mono border"
            style={{ borderColor: 'var(--line)' }}
          >
            {cell ?? 0}
          </motion.div>
        ))
      )}
    </div>
  )
}
