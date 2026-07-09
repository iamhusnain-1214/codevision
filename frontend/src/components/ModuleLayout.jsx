import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from './Navbar.jsx'

export default function ModuleLayout({ eyebrow, title, subtitle, left, right, footer, infoButton }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="max-w-[1500px] w-full mx-auto px-6 py-8 flex-1 flex flex-col">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link to="/dashboard" className="text-sm mb-3 inline-block" style={{ color: 'var(--ink-faint)' }}>← Dashboard</Link>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>{eyebrow}</div>
            <h1 className="font-display font-bold text-2xl md:text-3xl tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>{subtitle}</p>}
          </div>
          {infoButton && <div className="shrink-0">{infoButton}</div>}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 flex-1 min-h-0 items-start">
          <div
            className="rounded-xl2 border p-5 flex flex-col min-h-[420px]"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          >
            {left}
          </div>
          <div
            className="rounded-xl2 border p-5 flex flex-col min-h-[420px]"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          >
            {right}
          </div>
        </div>

        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  )
}
