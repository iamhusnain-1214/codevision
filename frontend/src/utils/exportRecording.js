/**
 * exportRecording.js — records a trace as a clean WebM video of ONLY the
 * visualization panel, with no browser permission prompt and no
 * "you are sharing this tab" banner.
 *
 * How it avoids the old GIF export's problems:
 *  - The previous version used getDisplayMedia() (real tab/screen capture),
 *    which forces the student through a "pick a tab to share" dialog and
 *    keeps a system-level sharing indicator on screen the entire time. That
 *    reads as a screen recorder bolted onto the app, not a feature of it.
 *  - This version renders each step of the panel into an *offscreen*
 *    canvas via html-to-image (which serializes the DOM's actual computed
 *    styles, not a re-implementation of CSS like html2canvas), then feeds
 *    those frames to a MediaRecorder driven by a manually-clocked
 *    canvas.captureStream(0). Nothing outside the canvas is ever touched,
 *    so there's nothing to grant permission for.
 *
 * Known limitation: Chromium's SVG <foreignObject> (which html-to-image
 * relies on) does not composite `backdrop-filter` blur. If a panel leans
 * on backdrop blur for its look, that blur won't appear in the exported
 * video — everything else (gradients, color-mix backgrounds, box-shadows,
 * Framer Motion's transform/opacity animations) captures correctly because
 * those are resolved to concrete inline values before the frame is drawn.
 */

export async function exportTraceAsVideo({
  node,
  totalSteps,
  setStep,
  filename = 'codevision-trace.webm',
  frameDelayMs = 700,
  settleMs = 350,
  onProgress,
}) {
  if (!node) throw new Error('Nothing to capture — the visualization panel was not found.')
  if (!totalSteps || totalSteps < 1) throw new Error('Run a trace first — there are no steps to export yet.')
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser doesn't support video export — try Chrome or Edge.")
  }

  const { toCanvas } = await import('html-to-image')

  const rect = node.getBoundingClientRect()
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1)
  const width = Math.max(2, Math.round(rect.width * pixelRatio))
  const height = Math.max(2, Math.round(rect.height * pixelRatio))

  const outCanvas = document.createElement('canvas')
  outCanvas.width = width
  outCanvas.height = height
  const ctx = outCanvas.getContext('2d')

  const bg = getComputedStyle(node).backgroundColor || '#0b0d10'
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  const stream = outCanvas.captureStream(0) // 0 = manual clock, we push frames ourselves
  const track = stream.getVideoTracks()[0]

  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
  const chunks = []
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }

  const recordingStopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve
    recorder.onerror = (e) => reject(e.error || new Error('Recording failed.'))
  })

  recorder.start()

  try {
    for (let i = 0; i < totalSteps; i++) {
      setStep(i)
      // Let React re-render and any Framer Motion springs (pointer arrows,
      // region brackets, cell color transitions) settle before capturing.
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, settleMs)))

      const frame = await toCanvas(node, { pixelRatio, cacheBust: true, backgroundColor: bg })

      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(frame, 0, 0, width, height)
      track.requestFrame()

      onProgress?.((i + 1) / totalSteps)
      // Hold the frame for frameDelayMs of real time so the exported video
      // has the same pacing the student sees when actually stepping through it.
      await new Promise((resolve) => setTimeout(resolve, frameDelayMs))
    }
    track.requestFrame() // make sure the final frame is actually flushed
    await new Promise((resolve) => setTimeout(resolve, 100))
  } finally {
    recorder.stop()
    await recordingStopped
    stream.getTracks().forEach((t) => t.stop())
  }

  const blob = new Blob(chunks, { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
