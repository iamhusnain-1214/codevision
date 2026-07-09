"""
tracer_graph.py — graph algorithms tracer.

Graphs don't fit the sys.settrace() line-by-line model as cleanly as
arrays do (the interesting state is "which node is current, what's in
the queue, what's the distance table" — not individual variable values).
So here we manually record a snapshot after each meaningful step inside
the algorithm itself. Same output shape philosophy: a list of dicts the
frontend steps through, just with graph-specific fields.

Graph input format:
    nodes: ["A", "B", "C", "D"]
    edges: [["A","B",4], ["A","C",1], ["C","B",2], ["B","D",1], ["C","D",5]]
            (source, target, weight — weight ignored for unweighted algos)
"""

import heapq


def build_adjacency(nodes, edges, directed=False):
    adj = {n: [] for n in nodes}
    for edge in edges:
        u, v, w = edge[0], edge[1], edge[2] if len(edge) > 2 else 1
        adj[u].append((v, w))
        if not directed:
            adj[v].append((u, w))
    return adj


def bfs(nodes, edges, start):
    adj = build_adjacency(nodes, edges)
    visited = set([start])
    queue = [start]
    steps = []
    order = []

    steps.append({"step": 0, "current": None, "visited": list(visited), "queue": list(queue), "order": list(order)})

    while queue:
        current = queue.pop(0)
        order.append(current)
        steps.append({"step": len(steps), "current": current, "visited": list(visited), "queue": list(queue), "order": list(order)})

        for neighbor, _ in adj[current]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
                steps.append({"step": len(steps), "current": current, "visited": list(visited), "queue": list(queue), "order": list(order), "note": f"discovered {neighbor}"})

    return steps, order


def dfs(nodes, edges, start):
    adj = build_adjacency(nodes, edges)
    visited = set()
    steps = []
    order = []

    def visit(node):
        visited.add(node)
        order.append(node)
        steps.append({"step": len(steps), "current": node, "visited": list(visited), "order": list(order)})
        for neighbor, _ in adj[node]:
            if neighbor not in visited:
                visit(neighbor)

    visit(start)
    return steps, order


def dijkstra(nodes, edges, start):
    adj = build_adjacency(nodes, edges, directed=True)
    dist = {n: float("inf") for n in nodes}
    dist[start] = 0
    visited = set()
    pq = [(0, start)]
    steps = []

    steps.append({"step": 0, "current": None, "distances": dict(dist), "visited": list(visited)})

    while pq:
        d, node = heapq.heappop(pq)
        if node in visited:
            continue
        visited.add(node)
        steps.append({"step": len(steps), "current": node, "distances": {k: (v if v != float("inf") else None) for k, v in dist.items()}, "visited": list(visited)})

        for neighbor, weight in adj[node]:
            if dist[node] + weight < dist[neighbor]:
                dist[neighbor] = dist[node] + weight
                heapq.heappush(pq, (dist[neighbor], neighbor))
                steps.append({
                    "step": len(steps), "current": node, "relaxed": neighbor,
                    "distances": {k: (v if v != float("inf") else None) for k, v in dist.items()},
                    "visited": list(visited),
                })

    return steps, {k: (v if v != float("inf") else None) for k, v in dist.items()}


def prim(nodes, edges):
    adj = build_adjacency(nodes, edges)
    start = nodes[0]
    visited = {start}
    mst_edges = []
    pq = [(w, start, v) for v, w in adj[start]]
    heapq.heapify(pq)
    steps = []

    steps.append({"step": 0, "visited": list(visited), "mst_edges": list(mst_edges)})

    while pq and len(visited) < len(nodes):
        weight, u, v = heapq.heappop(pq)
        if v in visited:
            continue
        visited.add(v)
        mst_edges.append([u, v, weight])
        steps.append({"step": len(steps), "current": v, "visited": list(visited), "mst_edges": list(mst_edges)})
        for neighbor, w in adj[v]:
            if neighbor not in visited:
                heapq.heappush(pq, (w, v, neighbor))

    return steps, mst_edges


def kruskal(nodes, edges):
    parent = {n: n for n in nodes}

    def find(x):
        while parent[x] != x:
            x = parent[x]
        return x

    def union(x, y):
        parent[find(x)] = find(y)

    sorted_edges = sorted(edges, key=lambda e: e[2] if len(e) > 2 else 1)
    mst_edges = []
    steps = []
    steps.append({"step": 0, "mst_edges": list(mst_edges), "considering": None})

    for u, v, w in sorted_edges:
        root_u, root_v = find(u), find(v)
        accepted = root_u != root_v
        if accepted:
            union(u, v)
            mst_edges.append([u, v, w])
        steps.append({
            "step": len(steps), "considering": [u, v, w],
            "accepted": accepted, "mst_edges": list(mst_edges),
        })

    return steps, mst_edges


def bellman_ford(nodes, edges, start):
    dist = {n: float("inf") for n in nodes}
    dist[start] = 0
    steps = []
    steps.append({"step": 0, "distances": dict(dist), "relaxed_edge": None})

    for i in range(len(nodes) - 1):
        for u, v, w in edges:
            if dist[u] != float("inf") and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                steps.append({
                    "step": len(steps), "iteration": i + 1,
                    "relaxed_edge": [u, v, w],
                    "distances": {k: (val if val != float("inf") else None) for k, val in dist.items()},
                })

    return steps, {k: (v if v != float("inf") else None) for k, v in dist.items()}


def floyd_warshall(nodes, edges):
    dist = {u: {v: float("inf") for v in nodes} for u in nodes}
    for n in nodes:
        dist[n][n] = 0
    for u, v, w in edges:
        dist[u][v] = w

    steps = []
    for k in nodes:
        for i in nodes:
            for j in nodes:
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
                    steps.append({
                        "step": len(steps), "via": k, "from": i, "to": j,
                        "new_distance": dist[i][j],
                    })

    clean_dist = {i: {j: (v if v != float("inf") else None) for j, v in row.items()} for i, row in dist.items()}
    return steps, clean_dist


def topological_sort(nodes, edges):
    adj = build_adjacency(nodes, edges, directed=True)
    visited = set()
    stack = []
    steps = []

    def visit(node):
        visited.add(node)
        steps.append({"step": len(steps), "current": node, "visited": list(visited), "stack": list(stack)})
        for neighbor, _ in adj[node]:
            if neighbor not in visited:
                visit(neighbor)
        stack.append(node)
        steps.append({"step": len(steps), "finished": node, "visited": list(visited), "stack": list(stack)})

    for n in nodes:
        if n not in visited:
            visit(n)

    return steps, list(reversed(stack))


GRAPH_ALGORITHMS = {
    "bfs": bfs,
    "dfs": dfs,
    "dijkstra": dijkstra,
    "prim": prim,
    "kruskal": kruskal,
    "bellman_ford": bellman_ford,
    "floyd_warshall": floyd_warshall,
    "topological_sort": topological_sort,
}
