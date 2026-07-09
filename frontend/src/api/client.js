const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))

  if (res.status === 401 && token) {
    // Token expired or invalid mid-session — clear it and bounce to login
    // with a friendly message instead of leaving scattered "401"/"Token
    // expired" errors littered across whatever component happened to be
    // mid-request when it expired.
    localStorage.removeItem('cv-token')
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login?expired=1'
    }
  }

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const api = {
  register: (username, email, password) =>
    req('/register', { method: 'POST', body: { username, email, password } }),

  // Login is by EMAIL now (Supabase Auth requirement), not username.
  login: (email, password) =>
    req('/login', { method: 'POST', body: { email, password } }),

  resendVerification: (email) =>
    req('/resend-verification', { method: 'POST', body: { email } }),

  me: (token) => req('/me', { token }),

  // module: 'array' | 'recursion' | 'dp' | 'graph' | 'tree'
  runTrace: (token, module, algorithm, input) =>
    req('/run-trace', { method: 'POST', token, body: { module, algorithm, input } }),

  history: (token, module) =>
    req(`/history${module ? `?module=${module}` : ''}`, { token }),

  historyDetail: (token, runId) => req(`/history/${runId}`, { token }),

  deleteRun: (token, runId) => req(`/history/${runId}`, { method: 'DELETE', token }),

  deleteAllRuns: (token, module) =>
    req(`/history${module ? `?module=${module}` : ''}`, { method: 'DELETE', token }),

  analyzeComplexity: (token, code, language = 'python') =>
    req('/analyze-complexity', { method: 'POST', token, body: { code, language } }),

  runCustomTrace: (token, code, language = 'python') =>
    req('/run-custom-trace', { method: 'POST', token, body: { code, language } }),

  // Fehm — AI logic coach + authoritative complexity verdict + debug mode
  explainProblem: (token, problem) =>
    req('/fehm/explain-problem', { method: 'POST', token, body: { problem } }),

  analyzeComplexityFehm: (token, code, language = 'python') =>
    req('/fehm/analyze-complexity', { method: 'POST', token, body: { code, language } }),

  debugLogic: (token, code, language, expected, actual) =>
    req('/fehm/debug-logic', { method: 'POST', token, body: { code, language, expected, actual } }),
}

// Reference of what the backend actually supports (routes/trace_routes.py):
export const ALGORITHMS = {
  array: [
    'kadane', 'moore_voting', 'binary_search', 'bubble_sort', 'selection_sort',
    'insertion_sort', 'merge_sort', 'quick_sort', 'prefix_sum',
    'sliding_window_max_sum', 'two_pointer_pair_sum', 'dutch_national_flag', 'heap_sort',
  ],
  recursion: ['factorial', 'fibonacci', 'sum_digits', 'tower_of_hanoi', 'custom'],
  dp: ['lcs', 'knapsack'],
  graph: ['bfs', 'dfs', 'dijkstra', 'prim', 'kruskal', 'bellman_ford', 'floyd_warshall', 'topological_sort'],
  tree: ['bst_insert', 'avl_insert', 'heap_insert', 'segment_tree_build', 'fenwick_tree_build', 'trie_insert'],
}
