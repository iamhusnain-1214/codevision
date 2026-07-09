import React, { useEffect, useRef } from 'react'

/**
 * Every backend module (array, recursion, dp, graph, tree) returns the same
 * shape: a flat `trace` array of step snapshots. This scrubber is the one
 * signature control that ties every module page together — same timeline,
 * same feel, whatever algorithm is running underneath.
 *
 * `captureRef` is optional: pass a ref to the DOM node that renders the
 * visualization and an "Export GIF" button appears, letting the student
 * download the whole run as an animated GIF for a report or presentation.
 */
export default function PlaybackControls({
  step, setStep, total, playing, setPlaying, speed, setSpeed, captureRef, gifFilename,
}) {
  const raf = useRef(null)
  const last = useRef(0)

  useEffect(() => {
    if (!playing) return
    const tick = (t) => {
      if (!last.current) last.current = t
      const interval = 900 / speed
      if (t - last.current >= interval) {
        last.current = t
        setStep((s) => {
          if (s >= total - 1) { setPlaying(false); return s }
          return s + 1
        })
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf.current); last.current = 0 }
  }, [playing, speed, total])

  if (total === 0) return null

  return (
    <div className="rounded-xl2 border px-5 py-4" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button
          onClick={() => setStep(0)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--raised)]"
          aria-label="Restart"
        >⏮</button>

        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--raised)]"
          aria-label="Step back"
        >◀</button>

        <button
          onClick={() => setPlaying((p) => !p)}
          className="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-transform hover:scale-105"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        <button
          onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--raised)]"
          aria-label="Step forward"
        >▶|</button>

        <button
          onClick={() => setStep(total - 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--raised)]"
          aria-label="Jump to end"
        >⏭</button>

        <div className="ml-2 text-sm mono-num" style={{ color: 'var(--ink-muted)' }}>
          step <span style={{ color: 'var(--ink)' }}>{step + 1}</span> / {total}
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
      
          <div className="flex items-center gap-2">
            <span>speed</span>
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="px-2 py-1 rounded-md transition-colors"
                style={{
                  background: speed === s ? 'var(--accent-dim)' : 'transparent',
                  color: speed === s ? 'var(--accent)' : 'var(--ink-muted)',
                  fontWeight: speed === s ? 600 : 400,
                }}
              >{s}×</button>
            ))}
          </div>
        </div>
      </div>

      {/* the scrubber timeline itself */}
      <div className="relative h-2 rounded-full trace-track" style={{ background: 'var(--raised)' }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-[width] duration-150"
          style={{ width: `${(step / Math.max(1, total - 1)) * 100}%`, background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}
        />
        <input
          type="range"
          min={0}
          max={total - 1}
          value={step}
          onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)) }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 w-3.5 h-3.5 rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none border-2"
          style={{ left: `${(step / Math.max(1, total - 1)) * 100}%`, background: 'var(--bg)', borderColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
