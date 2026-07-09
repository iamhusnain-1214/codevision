import React, { useState } from 'react'
import { exportTraceAsVideo } from '../utils/exportRecording.js'

/**
 * Lives inside PlaybackControls. Walks the module's own `step`/`setStep`
 * through every frame (0..total-1), capturing `captureRef.current` at each
 * one, then restores whatever step the student was actually on. No browser
 * permission dialog — the capture never leaves an offscreen canvas.
 */
export default function ExportRecordingButton({ captureRef, step, setStep, total, filename }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const run = async () => {
    if (!captureRef?.current) {
      setError('Nothing to export yet.')
      return
    }
    setError('')
    setBusy(true)
    setProgress(0)
    const originalStep = step
    try {
      await exportTraceAsVideo({
        node: captureRef.current,
        totalSteps: total,
        setStep,
        filename,
        onProgress: setProgress,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setStep(originalStep)
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={busy || total < 1}
        title="Export this trace as a video"
        className="px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors disabled:opacity-50 whitespace-nowrap"
        style={{ borderColor: 'var(--line)', color: busy ? 'var(--accent)' : 'var(--ink-muted)' }}
      >
        {busy ? `Exporting ${Math.round(progress * 100)}%` : '⬇ Export Video'}
      </button>
      {error && <span className="text-xs" style={{ color: '#E0574F' }}>{error}</span>}
    </div>
  )
}
