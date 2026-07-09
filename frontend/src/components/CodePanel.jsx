import React, { useEffect, useRef } from 'react'

/**
 * Shows the actual reference source for the running algorithm, with the
 * currently-executing line highlighted — like stepping through VS Code's
 * debugger. `activeLine` is 0-indexed against `code` (matches the
 * backend's `rel_line`, which is relative to the function's def line).
 */
export default function CodePanel({ code, activeLine, language = 'python', title, highlightLines = [] }) {
  const lines = (code || '').split('\n')
  const containerRef = useRef(null)
  const activeRef = useRef(null)
  const highlightSet = new Set(highlightLines)

  useEffect(() => {
    const container = containerRef.current
    const el = activeRef.current
    if (!container || !el) return
    // Scroll only this box's own scroll position — never the page. Using
    // scrollIntoView here would also scroll outer/sticky ancestors (that's
    // what was dragging the pinned visualization out of view above it).
    const elTop = el.offsetTop
    const elBottom = elTop + el.offsetHeight
    const viewTop = container.scrollTop
    const viewBottom = viewTop + container.clientHeight
    if (elTop < viewTop || elBottom > viewBottom) {
      container.scrollTop = elTop - container.clientHeight / 2 + el.offsetHeight / 2
    }
  }, [activeLine])

  return (
    <div className="rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--line)', background: 'var(--raised)' }}>
        <span className="text-xs font-mono" style={{ color: 'var(--ink-faint)' }}>{title || 'reference.py'}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
          {language}
        </span>
      </div>
      <div ref={containerRef} className="overflow-auto max-h-[420px] font-mono text-[13px] leading-6">
        {lines.map((line, i) => {
          const lineNo = i + 1 // highlightLines/activeLine both use 1-indexed line numbers
          const isActive = i === activeLine
          const isHighlighted = highlightSet.has(lineNo)
          return (
            <div
              key={i}
              ref={isActive ? activeRef : null}
              className="flex px-2 transition-colors duration-150"
              style={{
                background: isActive ? 'var(--accent-dim)' : isHighlighted ? 'color-mix(in srgb, var(--amber) 16%, transparent)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : isHighlighted ? '3px solid var(--amber)' : '3px solid transparent',
              }}
            >
              <span className="select-none w-8 text-right pr-3 shrink-0 mono-num" style={{ color: 'var(--ink-faint)' }}>
                {i}
              </span>
              <span className="whitespace-pre" style={{ color: isActive ? 'var(--ink)' : 'var(--ink-muted)' }}>
                {line || ' '}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
