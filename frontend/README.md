# CodeVision — Frontend

React + Vite + Tailwind + Framer Motion. Talks to your Flask backend (`codevision2/backend`) exactly as it exists today — no assumed endpoints except `/run-custom-trace`, which is called nowhere in code and is a known gap (see Module 4 notes below).

## Run it

```powershell
cd codevision-frontend
npm install
npm run dev
```

Opens at http://localhost:5173. Make sure the Flask backend is running at http://localhost:5000 (`python app.py` in your backend folder) — CORS is already enabled there.

If your backend runs somewhere else, create a `.env` file:

```
VITE_API_URL=http://localhost:5000
```

## What's wired to real endpoints

- `/register`, `/login`, `/me` → Login, Register, auth context
- `/run-trace` → Array, Recursion, DP, Graph, Tree modules (module field matches your backend's `("array","recursion","dp","graph","tree")` check exactly)
- `/history`, `/history/<id>` → History page
- `/analyze-complexity` → Complexity Analyzer page

## What's NOT wired yet

**Module 4 — Custom Code Visualizer.** The UI is fully built (language toggle, code editor, structure-detection results panel, playback controls) but there is no `/run-custom-trace` endpoint on the backend. It needs:

1. A sandboxed executor for arbitrary Python (and separately, C++)
2. Line-by-line tracing (same `sys.settrace()` technique as `tracer_array.py`, for Python; a debugger hook or instrumented build for C++)
3. A classifier that looks at each snapshot's variables and tags them as array / stack / queue / linked list / tree / graph / heap / hash map, so the frontend knows which visual to render

The frontend already has a clear contract to build against: match the same `{trace: [...], result: ...}` shape every other module uses, and each snapshot should include a `structures` field describing what was detected, e.g.:

```json
{
  "line": 4,
  "structures": [
    { "name": "seen", "type": "hash_map", "value": {"2": 0} },
    { "name": "nums", "type": "array", "value": [2, 7, 11, 15] }
  ]
}
```

Say the word when you want to build that endpoint — happy to do it next.

## Design tokens

Light/dark mode toggle in the navbar, persisted to `localStorage`. Colors, fonts, and spacing all live as CSS variables in `src/index.css` — change the palette there and it propagates everywhere via Tailwind's `var(--...)` mapping in `tailwind.config.js`.

- Display font: Sora · Body: Inter · Code: JetBrains Mono
- Accent: teal/emerald (`--accent`), same hue in both themes, different luminance
