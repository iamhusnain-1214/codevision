# CodeVision Backend — Full Version

## Everything included
- **Auth**: JWT-based register/login, premium flag on users (auth.py, routes/auth_routes.py)
- **Array module**: Kadane, Moore Voting, Binary Search, Bubble/Selection/Insertion/Merge/Quick/Heap Sort, Prefix Sum, Sliding Window, Two Pointer, Dutch National Flag (tracer_array.py)
- **Recursion module**: Factorial, Fibonacci — WITH call stack tracking per step (tracer_array.py)
- **DP module**: LCS, 0/1 Knapsack — full DP table returned (tracer_array.py)
- **Graph module**: BFS, DFS, Dijkstra, Prim, Kruskal, Bellman-Ford, Floyd-Warshall, Topological Sort (tracer_graph.py)
- **Tree module**: BST insert, AVL insert (with rotations), Heap insert, Segment Tree build, Fenwick Tree build, Trie insert (tracer_tree.py)
- **Complexity Analyzer**: AST-based Big-O estimator with reasoning, no AI yet (complexity_analyzer.py)
- **Auto-save**: every /run-trace call saves to the `runs` table under the logged-in user automatically

## Tested
Every algorithm in every module was run standalone and produced correct results
(e.g. Kadane=8, factorial(4)=24, LCS=3, Knapsack=9, Dijkstra/Bellman-Ford distances match,
Prim/Kruskal MSTs match, segment tree root=36, bubble sort correctly flagged O(n^2),
fibonacci correctly flagged O(2^n)). Full Flask app imports cleanly, all 9 routes registered.

## Setup
1. cd backend
2. pip install -r requirements.txt
3. In MySQL, run the CREATE TABLE statements at the top of db.py
4. Edit DB_CONFIG in config.py with your MySQL username/password
5. python app.py  ->  runs on http://localhost:5000

## API quick reference

### Auth
POST /register   {username, email, password} -> {token, user_id}
POST /login       {username, password} -> {token}
GET  /me          (needs Authorization: Bearer <token>) -> user info

### Running an algorithm (all need Authorization header)
POST /run-trace
{
  "module": "array" | "recursion" | "dp" | "graph" | "tree",
  "algorithm": "kadane" | "bfs" | "bst_insert" | etc,
  "input": { ...depends on algorithm, see routes/trace_routes.py _dispatch() and _array_args() }
}
-> { "trace": [...steps...], "result": ... }

### History (auto-saved runs)
GET /history                 -> all past runs for this user
GET /history?module=array    -> filtered by module
GET /history/<run_id>        -> full trace data for one run

### Complexity
POST /analyze-complexity   {code: "..."} -> {time_complexity, space_complexity, reason, details}

## What's NOT built yet (on purpose, per your plan)
- Frontend (next phase, after backend is fully done)
- C++ tracer (GDB-based) — stretch goal, added after Python side is solid
- AI integration (ai_helper.py) — added at the very end per your instructions
- Custom user-pasted-code visualizer for arbitrary code (currently only pre-built algorithms are traced — this is module 4 from your original doc, comes after the algorithm library is complete)

## Suggested next step
Tell me which of the "not built yet" items to do next, or if you want more algorithms
added to the existing modules first (e.g. Boyer-Moore, Segment Tree updates/queries, etc.)
