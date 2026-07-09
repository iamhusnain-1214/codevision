import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from '../../components/ModuleLayout.jsx'
import PlaybackControls from '../../components/PlaybackControls.jsx'
import CodePanel from '../../components/CodePanel.jsx'
import StructureView from '../../components/StructureView.jsx'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

const SAMPLES = {
  python: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []

result = two_sum([2, 7, 11, 15], 9)
print(result)
`,
  cpp: `#include <vector>
#include <iostream>
using namespace std;

int main() {
    vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    for (int i = 0; i < nums.size(); i++) {
        for (int j = i + 1; j < nums.size(); j++) {
            if (nums[i] + nums[j] == target) {
                cout << i << " " << j << endl;
                return 0;
            }
        }
    }
    return 0;
}
`,
}

export default function CustomCodeModule() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const visRef = useRef(null)
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState(SAMPLES.python)
  const [trace, setTrace] = useState([])
  const [stdout, setStdout] = useState('')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [viewingTrace, setViewingTrace] = useState(false)

  const switchLanguage = (l) => {
    setLanguage(l)
    setCode(SAMPLES[l])
    setTrace([])
    setError('')
    setViewingTrace(false)
  }

  const run = async () => {
    setError('')
    setBusy(true)
    setPlaying(false)
    try {
      const data = await api.runCustomTrace(token, code, language)
      setTrace(data.trace || [])
      setStdout(data.stdout || '')
      setStep(0)
      setViewingTrace((data.trace || []).length > 0)
      if (data.error) setError(data.error) // partial trace + error (e.g. hit the infinite-loop guard)
    } catch (err) {
      setError(err.message)
      setTrace([])
    } finally {
      setBusy(false)
    }
  }

  const frame = trace[step] || {}
  const activeLine = frame.line != null ? frame.line - 1 : null

  const debugWithFehm = () => {
    navigate('/fehm', {
      state: {
        mode: 'debug',
        code,
        language,
        actual: error,
      },
    })
  }

  return (
    <ModuleLayout
      eyebrow="Module 04"
      title="Custom Code Visualizer"
      subtitle="Paste your own Python. The engine detects arrays, stacks, linked lists, trees, and hash maps automatically and draws them as they change."
      left={
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            {['python', 'cpp'].map((l) => (
              <button
                key={l}
                onClick={() => switchLanguage(l)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
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
              <span className="text-xs ml-1" style={{ color: 'var(--ink-faint)' }}>compiled with g++ -std=c++17, stepped via gdb — slower than Python</span>
            )}
          </div>

          {viewingTrace ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>Stepping through your code</span>
                <button onClick={() => setViewingTrace(false)} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Edit code</button>
              </div>
              <div className="flex-1 mb-4">
                <CodePanel code={code} activeLine={activeLine} language={language} title="your code" />
              </div>
            </>
          ) : (
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full mb-4 px-4 py-3 rounded-lg border bg-transparent outline-none font-mono text-sm leading-relaxed resize-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--line)', minHeight: 220 }}
            />
          )}

          {error && (
            <div className="mb-3 px-4 py-3 rounded-lg text-sm" style={{ background: '#E0574F1a', color: '#E0574F' }}>
              <p className="mb-2">{error}</p>
              <button
                onClick={debugWithFehm}
                className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                Debug with Fehm →
              </button>
            </div>
          )}

          <button
            onClick={run}
            disabled={busy}
            className="w-full py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {busy ? 'Tracing…' : 'Trace code'}
          </button>

          {stdout && (
            <div className="mt-4 rounded-lg border p-3 font-mono text-xs" style={{ borderColor: 'var(--line)', background: 'var(--raised)' }}>
              <div className="mb-1" style={{ color: 'var(--ink-faint)' }}>stdout</div>
              <pre className="whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>{stdout}</pre>
            </div>
          )}
        </div>
      }
      right={
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-auto min-h-[280px] mb-4" ref={visRef}>
            {trace.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center px-6">
                <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
                  Detected structures will render here — array cells, linked-list chains, tree shapes, or hash map entries — based on what your code actually uses.
                </p>
              </div>
            ) : (
              <StructureView variables={frame.variables || {}} />
            )}
          </div>
          <PlaybackControls
            step={step} setStep={setStep} total={trace.length}
            playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
            captureRef={visRef} gifFilename={`codevision-custom-${language}.gif`}
          />
        </div>
      }
    />
  )
}
