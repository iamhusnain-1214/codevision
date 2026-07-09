import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export const BOX_SIZE = 56
const BOX_GAP = 8
const SLOT = BOX_SIZE + BOX_GAP

// Per-algorithm: which trace variables are "pointers" worth an arrow, and
// which pair of variables (if any) bounds an active "region" bracket.
// Names must match the actual Python local variable names emitted by
// tracer_array.py — that's the source of truth, not a guess.
const POINTER_CONFIG = {
  binary_search: [
    { key: 'low', label: 'low', color: 'var(--accent)' },
    { key: 'mid', label: 'mid', color: 'var(--amber)' },
    { key: 'high', label: 'high', color: 'var(--accent)' },
  ],
  two_pointer_pair_sum: [
    { key: 'left', label: 'left', color: 'var(--accent)' },
    { key: 'right', label: 'right', color: 'var(--amber)' },
  ],
  dutch_national_flag: [
    { key: 'low', label: 'low', color: 'var(--accent)' },
    { key: 'mid', label: 'mid', color: 'var(--amber)' },
    { key: 'high', label: 'high', color: '#E07F9B' },
  ],
  bubble_sort: [{ key: 'j', label: 'j', color: 'var(--accent)' }],
  selection_sort: [
    { key: 'j', label: 'j', color: 'var(--accent)' },
    { key: 'min_idx', label: 'min', color: 'var(--amber)' },
  ],
  insertion_sort: [{ key: 'j', label: 'j', color: 'var(--accent)' }],
  quick_sort: [
    { key: 'i', label: 'i', color: 'var(--accent)' },
    { key: 'j', label: 'j', color: 'var(--amber)' },
    { key: 'high', label: 'pivot', color: '#E07F9B' },
  ],
  sliding_window_max_sum: [{ key: 'i', label: 'i (window end)', color: 'var(--amber)' }],
  kadane: [{ key: 'i', label: 'i', color: 'var(--accent)' }],
  prefix_sum: [{ key: 'i', label: 'i', color: 'var(--accent)' }],
}

const REGION_CONFIG = {
  binary_search: { from: 'low', to: 'high', color: 'var(--accent)' },
  two_pointer_pair_sum: { from: 'left', to: 'right', color: 'var(--accent)' },
  sliding_window_max_sum: { from: (v) => Math.max(0, (v.i ?? 0) - (v.k ?? 1) + 1), to: 'i', color: 'var(--amber)' },
}

function resolveIndex(v, spec) {
  if (typeof spec === 'function') return spec(v)
  const val = v?.[spec]
  return typeof val === 'number' ? val : null
}

/**
 * Renders the array as uniform numbered boxes (the "teacher's board" look,
 * not a height-scaled bar chart) with pointer arrows and an active-region
 * bracket drawn above them. Arrows and boxes live in ONE shared
 * horizontally-scrolling container so they can never drift out of sync
 * with each other.
 */
export default function ArrayVisualization({ algorithm, values = [], variables = {} }) {
  if (values.length === 0) {
    return <p className="text-sm py-6 text-center" style={{ color: 'var(--ink-faint)' }}>Enter an array to begin.</p>
  }

  const pointers = POINTER_CONFIG[algorithm] || []
  const region = REGION_CONFIG[algorithm]

  const resolvedPointers = pointers
    .map((p) => ({ ...p, index: resolveIndex(variables, p.key) }))
    .filter((p) => p.index !== null && p.index >= 0 && p.index < values.length)

  const regionFrom = region ? resolveIndex(variables, region.from) : null
  const regionTo = region ? resolveIndex(variables, region.to) : null
  const hasRegion = region && regionFrom !== null && regionTo !== null && regionFrom <= regionTo

  const highlightIndices = variables.highlight || variables.compare || variables.indices || []
  const currentIndices = [variables.i, variables.j, variables.current, variables.min_idx].filter((x) => typeof x === 'number')

  const gridWidth = values.length * SLOT - BOX_GAP
  const needsArrowRow = resolvedPointers.length > 0 || hasRegion

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ width: gridWidth, minWidth: '100%' }}>
        {needsArrowRow && (
          <div className="relative h-12 mb-1" aria-hidden="true">
            {hasRegion && (
              <motion.div
                layout
                className="absolute top-8 h-2 rounded-full"
                style={{
                  left: regionFrom * SLOT,
                  width: (regionTo - regionFrom + 1) * SLOT - BOX_GAP,
                  background: region.color,
                  opacity: 0.25,
                }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              />
            )}
            <AnimatePresence>
              {resolvedPointers.map((p) => (
                <motion.div
                  key={p.label}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0, left: `${p.index * SLOT + BOX_SIZE / 2}px` }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ transform: 'translateX(-50%)' }}
                >
                  <span className="text-[10px] font-mono font-semibold mb-0.5 whitespace-nowrap" style={{ color: p.color }}>
                    {p.label}
                  </span>
                  <span style={{ color: p.color, lineHeight: 1, fontSize: '18px' }}>▼</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="flex items-center" style={{ gap: BOX_GAP }}>
          {values.map((v, i) => {
            const isCurrent = currentIndices.includes(i)
            const isHighlighted = highlightIndices.includes?.(i)
            const bg = isCurrent ? 'var(--amber)' : isHighlighted ? 'var(--accent)' : 'var(--raised)'
            const fg = isCurrent || isHighlighted ? 'var(--bg)' : 'var(--ink)'
            return (
              <div key={i} className="flex flex-col items-center shrink-0">
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
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
