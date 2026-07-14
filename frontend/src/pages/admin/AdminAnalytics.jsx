import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

const SOURCE_COLOR = {
  cache: 'var(--accent)',
  gemini: '#3FA36B',
  grok: '#D98C2B',
  failed: '#E0574F',
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl2 border p-5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
      <p className="text-sm mb-1" style={{ color: 'var(--ink-muted)' }}>{label}</p>
      <p className="font-display font-bold text-2xl">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{sub}</p>}
    </div>
  )
}

export default function AdminAnalytics() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAnalytics(token)
      .then(setData)
      .catch((err) => setError(err.message || 'Could not load analytics'))
      .finally(() => setLoading(false))
  }, [token])

  const topModules = data?.module_usage.slice(0, 10) || []
  const maxCount = topModules.length ? topModules[0].count : 1

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-1">Usage & Analytics — Admin</h1>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
          Most-used algorithms and Fehm's AI provider mix.
        </p>

        {error && (
          <p className="text-sm mb-4 px-3.5 py-2.5 rounded-lg" style={{ background: 'var(--raised)', color: '#E0574F' }}>
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
        ) : data ? (
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <StatCard
                label="Fehm requests (all time)"
                value={data.fehm.total_requests}
              />
              <StatCard
                label="Cache hit rate"
                value={data.fehm.cache_hit_rate_pct != null ? `${data.fehm.cache_hit_rate_pct}%` : '—'}
                sub="Higher is better — saves API quota"
              />
              <StatCard
                label="Grok fallback rate"
                value={data.fehm.grok_fallback_rate_pct != null ? `${data.fehm.grok_fallback_rate_pct}%` : '—'}
                sub="Of live (non-cached) calls — rising trend may mean Gemini quota is tightening"
              />
            </div>

            <h2 className="font-display font-semibold text-xl mb-4">Most-used algorithms</h2>
            {topModules.length === 0 ? (
              <p className="text-sm mb-8" style={{ color: 'var(--ink-faint)' }}>No runs recorded yet.</p>
            ) : (
              <div className="rounded-xl2 border p-5 mb-8 grid gap-2.5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
                {topModules.map((m) => (
                  <div key={`${m.module}-${m.algorithm}`} className="grid grid-cols-[140px_1fr_40px] items-center gap-3 text-sm">
                    <span className="truncate" title={`${m.module} / ${m.algorithm}`}>
                      <span className="capitalize" style={{ color: 'var(--ink-muted)' }}>{m.module}</span>
                      {' · '}{m.algorithm}
                    </span>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--raised)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(m.count / maxCount) * 100}%`, background: 'var(--accent)' }}
                      />
                    </div>
                    <span className="text-right font-medium">{m.count}</span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="font-display font-semibold text-xl mb-4">Fehm request source breakdown</h2>
            <div className="rounded-xl2 border p-5 mb-8" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
              {Object.keys(data.fehm.by_source).length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No Fehm requests logged yet.</p>
              ) : (
                <div className="grid gap-2.5">
                  {Object.entries(data.fehm.by_source).map(([source, count]) => (
                    <div key={source} className="flex items-center gap-3 text-sm">
                      <span className="w-16 capitalize font-medium" style={{ color: SOURCE_COLOR[source] || 'var(--ink-muted)' }}>
                        {source}
                      </span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--raised)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / data.fehm.total_requests) * 100}%`,
                            background: SOURCE_COLOR[source] || 'var(--ink-muted)',
                          }}
                        />
                      </div>
                      <span className="w-10 text-right font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <h2 className="font-display font-semibold text-xl mb-4">Recent Fehm errors</h2>
            {data.fehm.recent_errors.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No errors logged — clean run so far.</p>
            ) : (
              <div className="grid gap-2">
                {data.fehm.recent_errors.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border p-3 text-xs font-mono"
                    style={{ borderColor: 'var(--line)', background: 'var(--surface)', color: '#E0574F' }}
                  >
                    <span className="font-sans font-medium" style={{ color: 'var(--ink-muted)' }}>
                      [{e.feature} · {e.source} · {new Date(e.created_at).toLocaleString()}]{' '}
                    </span>
                    {e.error}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
