import React from 'react'
import { useTheme } from '../context/ThemeContext.jsx'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      aria-label="Toggle color theme"
      className="relative w-14 h-8 rounded-full border transition-colors duration-300 flex items-center px-1"
      style={{ background: 'var(--raised)', borderColor: 'var(--line)' }}
    >
      <span
        className="absolute w-6 h-6 rounded-full transition-transform duration-300 flex items-center justify-center text-[11px]"
        style={{
          background: 'var(--accent)',
          transform: dark ? 'translateX(24px)' : 'translateX(0px)',
        }}
      >
        {dark ? '🌙' : '☀'}
      </span>
    </button>
  )
}
