import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar.jsx'

const MODULES = [
  { n: '01', name: 'Array & Sorting', desc: 'Kadane, quicksort, sliding window, two pointers — every comparison and swap, frame by frame.' },
  { n: '02', name: 'Recursion', desc: 'Watch the call stack grow and unwind for factorial, fibonacci, and beyond.' },
  { n: '03', name: 'Dynamic Programming', desc: 'LCS and knapsack tables fill in live, subproblem by subproblem.' },
  { n: '04', name: 'Custom Code', desc: 'Paste your own Python or C++. We detect the data structures and animate memory as it changes.' },
  { n: '05', name: 'Graphs', desc: 'BFS, Dijkstra, Kruskal, Floyd–Warshall — nodes light up as the algorithm reasons.' },
  { n: '06', name: 'Trees', desc: 'BST, AVL rotations, heaps, tries — the shape redraws after every insert.' },
  { n: '07', name: 'Algorithm Race', desc: 'Two sorting algorithms, one array, side by side — watch which one actually wins.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="text-sm font-semibold tracking-widest uppercase mb-5"
              style={{ color: 'var(--accent)' }}
            >
              Algorithm visualization, for real
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
              className="font-display font-bold text-5xl md:text-6xl leading-[1.05] tracking-tight mb-6"
            >
              Watch your code<br />
              <span style={{ color: 'var(--accent)' }}>think.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg leading-relaxed mb-9 max-w-md"
              style={{ color: 'var(--ink-muted)' }}
            >
              Every line, every recursive call, every array swap — traced and replayed as a smooth, scrubbable timeline. Code on the left. The truth on the right.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
              className="flex items-center gap-4"
            >
              <Link
                to="/register"
                className="px-6 py-3.5 rounded-xl font-semibold transition-transform hover:scale-[1.02]"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                Start visualizing
              </Link>
              <Link
                to="/login"
                className="px-6 py-3.5 rounded-xl font-semibold border transition-colors hover:bg-[var(--raised)]"
                style={{ borderColor: 'var(--line)' }}
              >
                Log in
              </Link>
            </motion.div>
          </div>

          {/* Signature: live trace-scrubber illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="rounded-xl2 border p-6 font-mono text-sm"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)', boxShadow: '0 20px 60px -20px var(--accent-glow)' }}
          >
            <div className="flex items-center gap-1.5 mb-5">
              <span className="w-3 h-3 rounded-full" style={{ background: 'var(--amber)' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: 'var(--line)' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: 'var(--line)' }} />
              <span className="ml-3 text-xs" style={{ color: 'var(--ink-faint)' }}>kadane.trace.json</span>
            </div>
            <div className="flex items-end gap-1.5 h-32 mb-5">
              {[4, 2, -5, 6, 1, 3, -2, 5].map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${(Math.abs(v) / 6) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.06 }}
                  className="flex-1 rounded-t-md relative"
                  style={{ background: i === 3 ? 'var(--accent)' : 'var(--raised)', minHeight: 8 }}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: 'var(--ink-faint)' }}>{v}</span>
                </motion.div>
              ))}
            </div>
            <div className="h-1.5 rounded-full relative" style={{ background: 'var(--raised)' }}>
              <div className="h-full rounded-full" style={{ width: '55%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent-glow)' }} />
            </div>
            <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
              <span>step 11 / 20</span>
              <span>max_sum = 9</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modules */}
      <section className="max-w-7xl mx-auto px-6 pb-28">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="font-display font-bold text-3xl tracking-tight">Seven modules. One mental model.</h2>
          <span className="text-sm hidden sm:block" style={{ color: 'var(--ink-muted)' }}>code left · visualization right</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((m, i) => (
            <motion.div
              key={m.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-xl2 border p-6 transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
            >
              <div className="text-xs font-mono mb-4" style={{ color: 'var(--accent)' }}>{m.n}</div>
              <h3 className="font-display font-semibold text-lg mb-2">{m.name}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8" style={{ borderColor: 'var(--line)' }}>
        <div className="max-w-7xl mx-auto px-6 text-sm" style={{ color: 'var(--ink-faint)' }}>
          CodeVision — built for people who want to see, not just believe.
        </div>
      </footer>
    </div>
  )
}
