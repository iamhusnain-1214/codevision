import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

const MODULES = ['array', 'recursion', 'dp', 'graph', 'tree', 'custom']
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced']

const emptyForm = {
  id: '', module: 'array', title: '', intuition: '',
  steps: '', complexity_time: '', complexity_space: '', pitfalls: '', difficulty: 'beginner',
}

// steps is stored as a jsonb array in the DB; the form edits it as
// newline-separated text for simplicity, converted at submit time.
function stepsTextToArray(text) {
  return text.split('\n').map((s) => s.trim()).filter(Boolean)
}
function stepsArrayToText(arr) {
  return Array.isArray(arr) ? arr.join('\n') : ''
}

export default function AdminAlgorithms() {
  const { token } = useAuth()
  const [algorithms, setAlgorithms] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = creating new
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    setLoading(true)
    api.listAllAlgorithms(token, filter || undefined)
      .then(setAlgorithms)
      .catch((err) => setError(err.message || 'Could not load algorithms'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token, filter])

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  const startEdit = (algo) => {
    setEditingId(algo.id)
    setForm({
      id: algo.id,
      module: algo.module,
      title: algo.title || '',
      intuition: algo.intuition || '',
      steps: stepsArrayToText(algo.steps),
      complexity_time: algo.complexity_time || '',
      complexity_space: algo.complexity_space || '',
      pitfalls: algo.pitfalls || '',
      difficulty: algo.difficulty || 'beginner',
    })
    setShowForm(true)
    setError('')
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        module: form.module,
        title: form.title.trim(),
        intuition: form.intuition.trim() || undefined,
        steps: stepsTextToArray(form.steps),
        complexity_time: form.complexity_time.trim() || undefined,
        complexity_space: form.complexity_space.trim() || undefined,
        pitfalls: form.pitfalls.trim() || undefined,
        difficulty: form.difficulty,
      }

      if (editingId) {
        const updated = await api.updateAlgorithm(token, editingId, payload)
        setAlgorithms((prev) => prev.map((a) => (a.id === editingId ? updated : a)))
      } else {
        if (!form.id.trim()) throw new Error('id is required (must match tracer_*.py / ALGORITHMS entry)')
        const created = await api.createAlgorithm(token, { id: form.id.trim(), ...payload })
        setAlgorithms((prev) => [...prev, created])
      }
      cancelForm()
    } catch (err) {
      setError(err.message || 'Could not save algorithm')
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (algo) => {
    setError('')
    try {
      const updated = await api.updateAlgorithm(token, algo.id, { is_published: !algo.is_published })
      setAlgorithms((prev) => prev.map((a) => (a.id === algo.id ? updated : a)))
    } catch (err) {
      setError(err.message || 'Could not update publish status')
    }
  }

  const remove = async (algo) => {
    if (!window.confirm(`Delete "${algo.title}" (${algo.id})? This only removes the metadata — any tracer_*.py code stays untouched.`)) return
    setError('')
    try {
      await api.deleteAlgorithm(token, algo.id)
      setAlgorithms((prev) => prev.filter((a) => a.id !== algo.id))
    } catch (err) {
      setError(err.message || 'Could not delete algorithm')
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <h1 className="font-display font-bold text-3xl tracking-tight">Algorithm CRUD — Admin</h1>
          <button
            onClick={startCreate}
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-transform hover:scale-[1.02]"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            + New algorithm metadata
          </button>
        </div>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
          Manage description/complexity/publish status for algorithms whose tracer code already exists.
          This never writes trace logic — adding a genuinely new algorithm still needs a tracer_*.py change + redeploy.
        </p>

        <div className="flex gap-2 flex-wrap mb-6">
          {['', ...MODULES].map((m) => (
            <button
              key={m || 'all'}
              onClick={() => setFilter(m)}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize"
              style={{
                borderColor: 'var(--line)',
                background: filter === m ? 'var(--accent-dim)' : 'transparent',
                color: filter === m ? 'var(--accent)' : 'var(--ink-muted)',
              }}
            >
              {m || 'All'}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm mb-4 px-3.5 py-2.5 rounded-lg" style={{ background: 'var(--raised)', color: '#E0574F' }}>
            {error}
          </p>
        )}

        {showForm && (
          <form
            onSubmit={submit}
            className="rounded-xl2 border p-6 mb-8 grid gap-4"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          >
            <h2 className="font-display font-semibold text-lg">
              {editingId ? `Editing: ${editingId}` : 'New algorithm metadata'}
            </h2>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  id {editingId && <span style={{ color: 'var(--ink-faint)' }}>(locked)</span>}
                </label>
                <input
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  disabled={!!editingId}
                  placeholder="e.g. radix_sort"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm disabled:opacity-60"
                  style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                  required={!editingId}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Module</label>
                <select
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm capitalize"
                  style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                >
                  {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm capitalize"
                  style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                >
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Radix Sort"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Intuition</label>
              <textarea
                value={form.intuition}
                onChange={(e) => setForm({ ...form, intuition: e.target.value })}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Steps (one per line)</label>
              <textarea
                value={form.steps}
                onChange={(e) => setForm({ ...form, steps: e.target.value })}
                rows={4}
                placeholder={'Bucket digits by least significant place\nRepeat for each digit place\n...'}
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm resize-none font-mono"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Time complexity</label>
                <input
                  value={form.complexity_time}
                  onChange={(e) => setForm({ ...form, complexity_time: e.target.value })}
                  placeholder="e.g. O(nk)"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Space complexity</label>
                <input
                  value={form.complexity_space}
                  onChange={(e) => setForm({ ...form, complexity_space: e.target.value })}
                  placeholder="e.g. O(n + k)"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Pitfalls</label>
              <textarea
                value={form.pitfalls}
                onChange={(e) => setForm({ ...form, pitfalls: e.target.value })}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="text-sm font-semibold px-5 py-2.5 rounded-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create (as draft)'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="text-sm font-medium px-5 py-2.5 rounded-lg border transition-colors"
                style={{ borderColor: 'var(--line)' }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <h2 className="font-display font-semibold text-xl mb-4">All algorithm metadata</h2>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
        ) : algorithms.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
            No algorithm metadata yet{filter ? ` for module "${filter}"` : ''} — add one above.
          </p>
        ) : (
          <div className="grid gap-3">
            {algorithms.map((a) => (
              <div
                key={a.id}
                className="rounded-xl2 border p-4 flex items-start justify-between gap-4"
                style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{a.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--raised)', color: 'var(--ink-muted)' }}>
                      {a.module}
                    </span>
                    {a.difficulty && (
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--raised)', color: 'var(--ink-muted)' }}>
                        {a.difficulty}
                      </span>
                    )}
                    <span className="text-xs font-medium" style={{ color: a.is_published ? '#3FA36B' : 'var(--ink-faint)' }}>
                      {a.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>id: {a.id}</p>
                  {(a.complexity_time || a.complexity_space) && (
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                      {a.complexity_time && `Time: ${a.complexity_time}`}
                      {a.complexity_time && a.complexity_space && ' · '}
                      {a.complexity_space && `Space: ${a.complexity_space}`}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex gap-2">
                  <button
                    onClick={() => togglePublished(a)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:border-[var(--accent)]"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {a.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => startEdit(a)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:border-[var(--accent)]"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(a)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                    style={{ borderColor: 'var(--line)', color: '#E0574F' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
