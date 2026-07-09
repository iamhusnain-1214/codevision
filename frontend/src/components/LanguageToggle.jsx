import React from 'react'

/**
 * Python/C++ display toggle for a module's code panel. This only switches
 * which reference source is *shown* — the trace itself (variables,
 * playback, active-line highlighting) is always driven by the Python
 * tracer, so C++ mode shows static reference code with no active line.
 * Real C++ execution tracing is a separate effort (compiling with -g and
 * driving gdb) tracked on the roadmap.
 */
export default function LanguageToggle({ language, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {['python', 'cpp'].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
          style={{
            borderColor: 'var(--line)',
            background: language === l ? 'var(--accent-dim)' : 'transparent',
            color: language === l ? 'var(--accent)' : 'var(--ink-muted)',
          }}
        >
          {l === 'python' ? 'Python' : 'C++'}
        </button>
      ))}
      {language === 'cpp' && (
        <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
          static reference — live trace runs in Python
        </span>
      )}
    </div>
  )
}
