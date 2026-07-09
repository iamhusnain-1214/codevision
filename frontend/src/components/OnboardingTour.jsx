import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const STORAGE_KEY = 'cv-onboarding-seen-v1'

const STEPS = [
  {
    title: 'Welcome to CodeVision',
    body: "It's a debugger-style algorithm visualizer — your code sits on the left, and a live visualization plays out on the right as it runs, step by step.",
  },
  {
    title: 'Six modules to explore',
    body: 'Array & Sorting, Recursion, Dynamic Programming, Graphs, Trees, and a Custom Code Visualizer that detects your own data structures automatically. Pick any card on the dashboard to start tracing.',
  },
  {
    title: 'Meet Fehm, your AI logic coach',
    body: 'Stuck on a problem? Fehm reveals hints one step at a time instead of dumping the answer. It can also diagnose a bug in your logic, or work out the real time/space complexity of any snippet.',
  },
  {
    title: 'Everything is saved',
    body: 'Every trace you run is auto-saved to History and fully replayable later. Curious how two sorting algorithms stack up? Check out Race for a side-by-side comparison.',
  },
]

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true // if storage is unavailable, don't force the tour on every load
  }
}

function markOnboardingSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore — storage may be unavailable (private browsing, etc.) */
  }
}

export default function OnboardingTour({ onClose }) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1

  const finish = () => {
    markOnboardingSeen()
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: 'color-mix(in srgb, black 55%, transparent)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-xl2 border p-7"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 22 : 8,
                  background: i <= step ? 'var(--accent)' : 'var(--line)',
                }}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <h2 className="font-display font-bold text-xl mb-2">{STEPS[step].title}</h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--ink-muted)' }}>
                {STEPS[step].body}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={finish}
              className="text-sm font-medium"
              style={{ color: 'var(--ink-faint)' }}
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
                >
                  Back
                </button>
              )}
              <button
                onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-transform hover:scale-[1.02]"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                {isLast ? 'Get started' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
