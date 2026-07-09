import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BOX_SIZE, BOX_GAP } from './ArrayBoxes.jsx'

// Per-algorithm: which trace variables are "pointers" worth drawing an
// arrow for, and which pair of variables (if any) bounds an active
// "region" worth bracketing. Variable names must match the actual
// Python local variable names emitted by tracer_array.py — that's the
// source of truth, not a guess.
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

export default function ArrayDiagram({ algorithm, variables = {}, arrLength }) {
  if (!arrLength) return null
  const pointers = POINTER_CONFIG[algorithm] || []
  const region = REGION_CONFIG[algorithm]

  const resolvedPointers = pointers
    .map((p) => ({ ...p, index: resolveIndex(variables, p.key) }))
    .filter((p) => p.index !== null && p.index >= 0 && p.index < arrLength)

  const regionFrom = region ? resolveIndex(variables, region.from) : null
  const regionTo = region ? resolveIndex(variables, region.to) : null
  const hasRegion = region && regionFrom !== null && regionTo !== null && regionFrom <= regionTo

  const slot = BOX_SIZE + BOX_GAP // px per array cell, including gap
  const offsetFor = (i) => i * slot + BOX_SIZE / 2 // center of box i, in px from grid start

  if (resolvedPointers.length === 0 && !hasRegion) return null

  return (
    <div className="relative w-full h-14 mb-1 overflow-x-auto select-none" aria-hidden="true">
      <div className="relative h-full" style={{ width: arrLength * slot - BOX_GAP, marginLeft: 8 }}>
        {hasRegion && (
          <motion.div
            layout
            className="absolute top-8 h-2 rounded-full"
            style={{
              left: regionFrom * slot,
              width: (regionTo - regionFrom + 1) * slot - BOX_GAP,
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
              animate={{ opacity: 1, y: 0, left: offsetFor(p.index) }}
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
    </div>
  )
}
