import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import explanations from '../data/algorithmExplanations.js'

/**
 * "How it works" toggle + panel. Renders nothing (gracefully) if there's
 * no explanation entry yet for the given algorithm id, so it's safe to
 * drop into any module without needing every algorithm covered up front.
 */
export default function AlgorithmInfo({ algorithm }) {
  const [open, setOpen] = useState(false)
  const info = explanations[algorithm]

  if (!info) return null

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors"
        style={{
          borderColor: 'var(--line)',
          color: open ? 'var(--accent)' : 'var(--ink-muted)',
          background: open ? 'var(--accent-dim)' : 'transparent',
        }}
      >
        <span style={{ fontSize: '0.95em' }}>{open ? '▾' : '▸'}</span>
        How it works
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="mt-3 p-4 rounded-lg border text-sm leading-relaxed"
              style={{ borderColor: 'var(--line)', background: 'var(--raised)' }}
            >
              <h4 className="font-display font-semibold mb-2">{info.title}</h4>

              <p className="mb-3" style={{ color: 'var(--ink-muted)' }}>{info.intuition}</p>

              {info.steps && (
                <ol className="mb-3 list-decimal list-inside space-y-1">
                  {info.steps.map((s, i) => (
                    <li key={i} style={{ color: 'var(--ink-muted)' }}>{s}</li>
                  ))}
                </ol>
              )}

              {info.complexity && (
                <div className="flex gap-4 mb-3 font-mono text-xs">
                  <span className="px-2 py-1 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                    time: {info.complexity.time}
                  </span>
                  <span className="px-2 py-1 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                    space: {info.complexity.space}
                  </span>
                </div>
              )}

              {info.pitfalls && (
                <p className="text-xs" style={{ color: 'var(--amber)' }}>
                  ⚠ {info.pitfalls}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
