# CodeVision

A full-stack algorithm visualizer and debugger — built to teach *how* code executes, not just animate it.

**Live:** https://codevision-roan.vercel.app
**Backend:** https://codevision-we1n.onrender.com

---

## What it does

CodeVision traces code execution step by step — every variable, every call stack frame, every line — across six modules:

- **Array & Sorting** — Kadane, Moore Voting, Binary Search, Bubble/Selection/Insertion/Merge/Quick/Heap Sort, Prefix Sum, Sliding Window, Two Pointer, Dutch National Flag
- **Recursion** — Factorial, Fibonacci, Sum of Digits, Tower of Hanoi, with full call-stack tracking per step
- **Dynamic Programming** — LCS, 0/1 Knapsack, with the full DP table returned
- **Graph** — BFS, DFS, Dijkstra, Prim, Kruskal, Bellman-Ford, Floyd-Warshall, Topological Sort
- **Tree** — BST insert, AVL insert (with rotations), Heap insert, Segment Tree build, Fenwick Tree build, Trie insert
- **Custom Code Visualizer** — paste your own Python or C++ and trace it live (not just pre-built algorithms)

Plus:
- **Fehm** (فہم — Urdu for "understanding") — an AI logic coach with three modes: explain a problem's pattern before you code it, get the authoritative Big-O verdict on your own code, or debug a wrong-output bug the way a TA would — by pointing at the conceptual mistake, never by rewriting your code for you.
- **Complexity Analyzer** — deterministic AST-based (Python) / heuristic (C++) Big-O estimator, used as Fehm's fallback if the AI providers are ever unreachable.
- **Run history** — every trace auto-saves under your account and is fully replayable later.

---

## Tech stack

**Frontend**
React, Vite, Tailwind CSS, Framer Motion, React Router, Monaco Editor — deployed on **Vercel**

**Backend**
Flask, Gunicorn, Docker (custom image with GCC/GDB/G++) — deployed on **Render**

**Database & Auth**
Supabase (Postgres + Supabase Auth + email verification)

**AI**
Gemini (primary) + Groq (fallback), behind a cache-first orchestration layer:
1. Check **Redis (Upstash)** for an identical prior request — instant return, zero API cost
2. Try Gemini
3. If Gemini fails (rate limit, error), automatically retry against Groq
4. If both fail, fall back to the deterministic complexity analyzer (complexity endpoint only)

**Tracing engines**
- Python: `sys.settrace()`
- C++: real compilation (`g++`) + `pygdbmi`/GDB (MI3 interface) stepping, sandboxed via `ulimit` (CPU time, memory, process count, file size, open file descriptors) applied through GDB's `exec-wrapper` mechanism, plus a compiler-side memory cap

**Email**
Brevo SMTP relay (verification emails, 300/day free tier)

**Uptime**
cron-job.org pings `/health` every 10 minutes — this endpoint also touches Supabase, so a single ping keeps both Render and Supabase's free tier from sleeping/pausing simultaneously

---

## Local setup

### Backend
```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in `backend/` with:
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite
GROK_API_KEY=...          # this is actually a Groq (console.groq.com) key, not xAI
GROK_MODEL=llama-3.3-70b-versatile
REDIS_URL=rediss://...    # Upstash connection string
```

Run the Supabase schema once (Supabase Dashboard → SQL Editor → paste `supabase_schema.sql`).

C++ tracing also needs system packages (not pip):
```bash
sudo apt-get install -y g++ gdb   # Debian/Ubuntu
```

```bash
python app.py   # runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # opens on http://localhost:5173
```

If your backend runs somewhere other than `localhost:5000`, set `VITE_API_URL` in a `.env` file in the frontend folder.

---

## API quick reference

### Auth
```
POST /register   {username, email, password}
POST /login       {email, password} -> {access_token, refresh_token}
GET  /me          (Authorization: Bearer <token>)
```

### Tracing (all require Authorization header)
```
POST /run-trace          {module, algorithm, input}
POST /run-custom-trace   {code, language}
GET  /history             (?module=array optional filter)
GET  /history/<run_id>
```

### Complexity
```
POST /analyze-complexity   {code, language}   -- deterministic, no AI
```

### Fehm (AI-powered, all require Authorization header)
```
POST /fehm/explain-problem     {problem}
POST /fehm/analyze-complexity  {code, language}
POST /fehm/debug-logic         {code, language, expected, actual}
```

Every Fehm response includes a `"source"` field — `"cache"`, `"gemini"`, or `"grok"` — so you can see which layer of the fallback chain actually served the request.

---

## Known limitations

- C++ sandboxing covers the realistic threats (infinite loops, memory/fork bombs, disk-fill) via resource limits, but does **not** include network namespace isolation, filesystem jailing, or seccomp — a determined attacker with low-level tricks could still find gaps. Full containment would need a per-run container/VM (Docker-in-Docker or gVisor), which is a larger infra investment than the current free-tier deployment supports.
- Ollama/local-model fallback was considered and intentionally deferred — free-tier hosting doesn't have the RAM/GPU to run a local model reliably, and it would need its own always-on server. On the roadmap if the project moves to paid infra.

---

## Team

Built by **Husnain Ali** and **Khadija Ashraf**, as a summer project - designed to stay live and usable well past graduation.
