import React from 'react'
import { motion } from 'framer-motion'

/**
 * Renders the array as a row of uniform boxes with the value printed
 * inside each cell — the "teacher draws boxes on the board" mental model,
 * as opposed to a height-scaled bar chart. Height-scaling breaks down
 * with negative numbers and doesn't read as "an array" the way boxes do.
 */
export const BOX_SIZE = 56
export const BOX_GAP = 8

export default function ArrayBoxes({ values = [], currentIndices = [], highlightIndices = [], sortedIndices = [] }) {
  if (values.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Enter an array to begin.</p>
  }

  return (
    <div className="flex items-center justify-start overflow-x-auto px-2" style={{ gap: BOX_GAP }}>
      {values.map((v, i) => {
        const isCurrent = currentIndices.includes(i)
        const isHighlighted = highlightIndices.includes(i)
        const isSorted = sortedIndices.includes(i)
        const bg = isCurrent
          ? 'var(--amber)'
          : isHighlighted
          ? 'var(--accent)'
          : isSorted
          ? 'var(--accent-dim)'
          : 'var(--raised)'
        const fg = isCurrent || isHighlighted ? 'var(--bg)' : 'var(--ink)'
        return (
          <motion.div
            key={i}
            layout
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="flex flex-col items-center shrink-0"
          >
            <motion.div
              layout
              animate={{ backgroundColor: bg, color: fg }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="rounded-lg border flex items-center justify-center font-mono font-semibold text-sm md:text-base"
              style={{ borderColor: 'var(--line)', width: BOX_SIZE, height: BOX_SIZE }}
            >
              {v}
            </motion.div>
            <span className="text-[10px] font-mono mt-1" style={{ color: 'var(--ink-faint)' }}>{i}</span>
          </motion.div>
        )
      })}
    </div>
  )
}
