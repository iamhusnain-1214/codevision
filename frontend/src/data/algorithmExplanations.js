// Plain-English "how it works" content for each algorithm.
// Keyed by the same algorithm id used in ALGORITHMS (src/api/client.js).
// Add new entries here as new algorithms/modules are wired up.

const explanations = {
  kadane: {
    title: "Kadane's Algorithm",
    intuition:
      "Walk through the array once, keeping a running sum. If that running sum ever drops below the value of the current element alone, it's dragging you down — throw it away and restart the sum from here. Track the best sum seen so far.",
    steps: [
      'Start current_sum and max_sum at the first element.',
      'For each next element, decide: extend the current subarray, or start a new one at this element.',
      'Update max_sum whenever current_sum beats it.',
    ],
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: 'Forgetting that a subarray must be contiguous — this is not about picking any elements, only a run of consecutive ones.',
  },
  moore_voting: {
    title: "Moore's Voting Algorithm",
    intuition:
      "Think of it as a cancellation game: pair up the majority element against every other element. Since the majority appears more than n/2 times, it always survives the cancellation and is left standing as the candidate.",
    steps: [
      'Keep a candidate and a count, starting at zero.',
      'If count hits zero, the current element becomes the new candidate.',
      'Increase count when the element matches the candidate, decrease otherwise.',
    ],
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: 'This only guarantees correctness if a majority element (>n/2 occurrences) is guaranteed to exist.',
  },
  binary_search: {
    title: 'Binary Search',
    intuition:
      'The array is sorted, so instead of checking every element, repeatedly check the middle of the remaining range. Whichever half the target can\'t be in gets discarded entirely.',
    steps: [
      'Track a left and right boundary around the region that could still contain the target.',
      'Check the middle element: if it matches, done. If target is bigger, discard the left half; if smaller, discard the right half.',
      'Repeat until the range is empty.',
    ],
    complexity: { time: 'O(log n)', space: 'O(1)' },
    pitfalls: 'Only works on sorted data. Off-by-one errors in the mid/low/high updates are the classic bug.',
  },
  bubble_sort: {
    title: 'Bubble Sort',
    intuition:
      'Repeatedly sweep through the array, swapping any two neighbors that are out of order. Each full pass "bubbles" the largest remaining unsorted value to its correct position at the end.',
    steps: [
      'Compare each adjacent pair left to right.',
      'Swap them if the left is bigger than the right.',
      'After each full pass, the largest unsorted element is in place — shrink the range by one and repeat.',
    ],
    complexity: { time: 'O(n²) worst/avg, O(n) best', space: 'O(1)' },
    pitfalls: 'Simple but slow — mainly useful for teaching, not for large inputs.',
  },
  selection_sort: {
    title: 'Selection Sort',
    intuition:
      'Repeatedly find the smallest remaining element and swap it into the next open sorted position.',
    steps: [
      'Scan the unsorted portion to find its minimum.',
      'Swap that minimum into the front of the unsorted portion.',
      'Move the sorted/unsorted boundary forward one step and repeat.',
    ],
    complexity: { time: 'O(n²)', space: 'O(1)' },
    pitfalls: 'Always O(n²) even on nearly-sorted input, unlike insertion sort.',
  },
  insertion_sort: {
    title: 'Insertion Sort',
    intuition:
      'Like sorting playing cards in your hand — take the next card and slide it backward into the already-sorted portion until it lands in the right spot.',
    steps: [
      'Take the next unsorted element (the "key").',
      'Shift all larger elements in the sorted portion one step right.',
      'Drop the key into the gap that opens up.',
    ],
    complexity: { time: 'O(n²) worst, O(n) best (nearly sorted)', space: 'O(1)' },
    pitfalls: 'Efficient for small or nearly-sorted arrays; poor for large random ones.',
  },
  merge_sort: {
    title: 'Merge Sort',
    intuition:
      'Split the array in half recursively until pieces are single elements (already "sorted"), then merge sorted halves back together in order.',
    steps: [
      'Recursively split the array into halves.',
      'Once down to single elements, start merging pairs back together, always taking the smaller front element first.',
      'Keep merging up until the whole array is one sorted sequence.',
    ],
    complexity: { time: 'O(n log n) always', space: 'O(n)' },
    pitfalls: 'Uses extra memory for the merge step, unlike quicksort.',
  },
  quick_sort: {
    title: 'Quick Sort',
    intuition:
      'Pick a pivot element, then partition the array so everything smaller ends up to its left and everything bigger to its right. Recurse on each side.',
    steps: [
      'Choose a pivot (here, the last element of the range).',
      'Partition: walk through, moving anything smaller than the pivot to the left side.',
      'Place the pivot in its final position, then recursively quicksort the left and right partitions.',
    ],
    complexity: { time: 'O(n log n) avg, O(n²) worst', space: 'O(log n) recursion stack' },
    pitfalls: 'Worst case happens on already-sorted input with a naive pivot choice.',
  },
  heap_sort: {
    title: 'Heap Sort',
    intuition:
      'Build a max-heap out of the array (so the largest element is always at the root), then repeatedly pull the root out to the end and re-heapify what remains.',
    steps: [
      'Build a max-heap from the unsorted array.',
      'Swap the root (largest) with the last unsorted element.',
      'Shrink the heap by one and "sift down" the new root to restore the heap property, then repeat.',
    ],
    complexity: { time: 'O(n log n) always', space: 'O(1)' },
    pitfalls: 'Not stable (equal elements may be reordered), unlike merge sort.',
  },
  prefix_sum: {
    title: 'Prefix Sum',
    intuition:
      'Precompute running totals so any range-sum query later becomes a single subtraction instead of re-adding elements every time.',
    steps: [
      'prefix[0] = arr[0].',
      'Each next prefix[i] = prefix[i-1] + arr[i].',
      'Any range sum [i..j] is then prefix[j] - prefix[i-1].',
    ],
    complexity: { time: 'O(n) to build, O(1) per query', space: 'O(n)' },
    pitfalls: 'Watch the index boundary when the range starts at 0.',
  },
  sliding_window_max_sum: {
    title: 'Sliding Window — Max Sum',
    intuition:
      'Instead of recomputing the sum of every window of size k from scratch, slide the window one step at a time: add the new element entering, subtract the one leaving.',
    steps: [
      'Compute the sum of the first window of size k.',
      'Slide right: add the new element, subtract the element that fell out of the window.',
      'Track the maximum window sum seen.',
    ],
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: 'Only works cleanly for fixed-size windows; variable-size windows need a different pattern.',
  },
  two_pointer_pair_sum: {
    title: 'Two Pointer — Pair Sum',
    intuition:
      'On a sorted array, place one pointer at each end. If the pair sums too high, move the right pointer in; if too low, move the left pointer up.',
    steps: [
      'Sort the array first.',
      'Start left at index 0, right at the last index.',
      'Compare the pair sum to the target and move whichever pointer narrows the gap toward the target.',
    ],
    complexity: { time: 'O(n log n) for the sort, O(n) for the scan', space: 'O(1) extra (besides the sort)' },
    pitfalls: 'Requires sorted input — sorting changes original indices if those matter downstream.',
  },
  dutch_national_flag: {
    title: 'Dutch National Flag',
    intuition:
      'Partition an array of three distinct values (0s, 1s, 2s) into three regions in one pass using three pointers: low, mid, high.',
    steps: [
      'low tracks the boundary after all 0s, high tracks the boundary before all 2s, mid scans through.',
      'If arr[mid] is 0, swap it to the low region and advance both low and mid.',
      'If it\'s 1, just advance mid. If it\'s 2, swap it to the high region and pull high back (mid stays, to re-check the swapped-in value).',
    ],
    complexity: { time: 'O(n)', space: 'O(1)' },
    pitfalls: 'Mixing up when to advance mid vs. leave it in place after a swap is the classic bug.',
  },
  factorial: {
    title: 'Factorial (Recursion)',
    intuition:
      'n! is n times (n-1)!, all the way down to the base case 1! = 1. Each call waits on the answer from a smaller version of the same problem.',
    steps: [
      'Base case: if n <= 1, return 1.',
      'Otherwise, return n * factorial(n - 1).',
      'Calls stack up until the base case, then multiply back up as they return.',
    ],
    complexity: { time: 'O(n)', space: 'O(n) call stack' },
    pitfalls: 'No memoization needed here since every subproblem is unique, unlike fibonacci.',
  },
  fibonacci: {
    title: 'Fibonacci (Naive Recursion)',
    intuition:
      'fib(n) = fib(n-1) + fib(n-2). This naive version recomputes the same subproblems many times — that overlap is exactly what the call-stack visualization makes visible.',
    steps: [
      'Base case: fib(0) = 0, fib(1) = 1.',
      'Otherwise, return fib(n-1) + fib(n-2).',
      'Notice how the same fib(k) gets called repeatedly — this is why naive fibonacci is exponential.',
    ],
    complexity: { time: 'O(2^n) naive (O(n) with memoization)', space: 'O(n) call stack depth' },
    pitfalls: 'Exponential blow-up for even moderately sized n — this is the canonical example for why memoization/DP matters.',
  },
  lcs: {
    title: 'Longest Common Subsequence',
    intuition:
      "Build a table where dp[i][j] answers: what's the longest subsequence common to the first i characters of s1 and first j characters of s2? If the current characters match, extend the diagonal answer by one. If not, take the best of skipping a character from either string.",
    steps: [
      'If s1[i-1] == s2[j-1], dp[i][j] = dp[i-1][j-1] + 1.',
      'Otherwise, dp[i][j] = max(dp[i-1][j], dp[i][j-1]).',
      'The answer ends up in the bottom-right cell, dp[m][n].',
    ],
    complexity: { time: 'O(m·n)', space: 'O(m·n)' },
    pitfalls: 'A "subsequence" doesn\'t need to be contiguous — that\'s what distinguishes it from a substring problem.',
  },
  knapsack: {
    title: '0/1 Knapsack',
    intuition:
      'For each item, decide: include it or not. dp[i][w] tracks the best value achievable using the first i items within capacity w. Since each item can only be used once, the decision for item i falls back to the row above it.',
    steps: [
      'If the item fits (weight[i-1] <= w), take the better of including it (value + dp[i-1][w-weight]) or skipping it (dp[i-1][w]).',
      'If it doesn\'t fit, just carry forward dp[i-1][w].',
      'The answer is dp[n][capacity].',
    ],
    complexity: { time: 'O(n·capacity)', space: 'O(n·capacity)' },
    pitfalls: 'This is the 0/1 variant — each item used at most once. The "unbounded" knapsack variant (unlimited copies) needs a different recurrence.',
  },
  bfs: {
    title: 'Breadth-First Search',
    intuition:
      'Explore the graph in layers, one "ring" of distance at a time, using a queue. Everything at distance 1 gets visited before anything at distance 2.',
    steps: [
      'Start at the source node, mark it visited, push it into a queue.',
      'Pop the front of the queue, visit its unvisited neighbors, push them in.',
      'Repeat until the queue is empty — this guarantees shortest path in unweighted graphs.',
    ],
    complexity: { time: 'O(V + E)', space: 'O(V)' },
    pitfalls: 'Using a stack instead of a queue turns this into DFS — the data structure is the whole difference.',
  },
  dfs: {
    title: 'Depth-First Search',
    intuition:
      'Go as deep as possible down one path before backtracking, using recursion or an explicit stack.',
    steps: [
      'Visit a node, mark it visited.',
      'Recurse into an unvisited neighbor immediately.',
      'When no unvisited neighbors remain, backtrack to the previous call.',
    ],
    complexity: { time: 'O(V + E)', space: 'O(V) recursion stack' },
    pitfalls: "Doesn't guarantee shortest paths the way BFS does on unweighted graphs.",
  },
  dijkstra: {
    title: "Dijkstra's Algorithm",
    intuition:
      'Find shortest paths from a source in a weighted graph (no negative edges) by always expanding the closest unvisited node next, using a priority queue.',
    steps: [
      'Set distance to source = 0, everything else = infinity.',
      'Repeatedly pop the unvisited node with the smallest known distance.',
      'Relax its edges: if going through it gives a shorter path to a neighbor, update that neighbor\'s distance.',
    ],
    complexity: { time: 'O((V + E) log V) with a binary heap', space: 'O(V)' },
    pitfalls: 'Breaks with negative edge weights — use Bellman-Ford instead in that case.',
  },
  bellman_ford: {
    title: 'Bellman-Ford Algorithm',
    intuition:
      'Also finds shortest paths from a source, but works with negative edge weights by relaxing every edge repeatedly, V-1 times.',
    steps: [
      'Initialize distance to source = 0, others = infinity.',
      'Relax every edge in the graph, V-1 times total.',
      'A V-th pass that still finds an improvement means there\'s a negative-weight cycle.',
    ],
    complexity: { time: 'O(V · E)', space: 'O(V)' },
    pitfalls: 'Slower than Dijkstra, but necessary whenever negative weights are possible.',
  },
  floyd_warshall: {
    title: 'Floyd-Warshall Algorithm',
    intuition:
      'Finds shortest paths between every pair of nodes at once by considering, for each node k, whether routing through k shortens the path between every other pair (i, j).',
    steps: [
      'Initialize distances directly from the edge weights (infinity where no edge exists).',
      'For each intermediate node k, and every pair (i, j), check if dist[i][k] + dist[k][j] beats dist[i][j].',
      'After considering all nodes as intermediates, the table holds all-pairs shortest distances.',
    ],
    complexity: { time: 'O(V³)', space: 'O(V²)' },
    pitfalls: 'Cubic time makes this impractical for very large graphs — fine for dense, small-to-medium ones.',
  },
  prim: {
    title: "Prim's Algorithm (Minimum Spanning Tree)",
    intuition:
      'Grow a single tree outward from an arbitrary start node, always adding the cheapest edge that connects the tree to a new, unvisited node.',
    steps: [
      'Start with any node in the "tree" set.',
      'Repeatedly pick the minimum-weight edge that connects the tree to a node outside it.',
      'Add that node and edge to the tree; repeat until all nodes are included.',
    ],
    complexity: { time: 'O(E log V) with a binary heap', space: 'O(V)' },
    pitfalls: 'Assumes a connected graph — disconnected graphs need Prim run per component.',
  },
  kruskal: {
    title: "Kruskal's Algorithm (Minimum Spanning Tree)",
    intuition:
      'Sort all edges by weight, then greedily add each edge as long as it doesn\'t form a cycle, using a union-find structure to check that quickly.',
    steps: [
      'Sort every edge in the graph by weight, ascending.',
      'Go through the sorted edges; add an edge if its two endpoints are in different components.',
      'Stop once V-1 edges have been added — that\'s a full spanning tree.',
    ],
    complexity: { time: 'O(E log E)', space: 'O(V)' },
    pitfalls: 'Needs an efficient union-find (with path compression) or the cycle checks become slow.',
  },
  topological_sort: {
    title: 'Topological Sort',
    intuition:
      'Order the nodes of a directed acyclic graph so that every edge points from an earlier node to a later one — like a valid sequence of prerequisite-respecting tasks.',
    steps: [
      'Repeatedly find a node with no unprocessed incoming edges (in-degree zero).',
      'Add it to the order, then remove its outgoing edges (decrementing neighbors\' in-degrees).',
      'Repeat until every node is placed.',
    ],
    complexity: { time: 'O(V + E)', space: 'O(V)' },
    pitfalls: 'Only defined for DAGs — if a cycle exists, no valid topological order can be produced.',
  },
  bst_insert: {
    title: 'Binary Search Tree — Insert',
    intuition:
      'Starting at the root, compare the new value against each node: go left if smaller, right if bigger, until you find an empty spot to place it.',
    steps: [
      'Compare the new value to the current node.',
      'Move left if smaller, right if larger.',
      'When you reach an empty child pointer, attach the new node there.',
    ],
    complexity: { time: 'O(log n) average, O(n) worst (unbalanced)', space: 'O(1) iterative / O(h) recursive' },
    pitfalls: 'A BST can degrade into a linked list (O(n) per op) if inserted in sorted order — that\'s exactly why AVL trees exist.',
  },
  avl_insert: {
    title: 'AVL Tree — Insert',
    intuition:
      'A self-balancing BST: after a normal BST insert, walk back up and check the balance factor at each ancestor. If any node becomes unbalanced, apply a rotation to restore balance.',
    steps: [
      'Insert as you would in a plain BST.',
      'Walking back up, compute each ancestor\'s balance factor (height of left minus height of right subtree).',
      'If unbalanced (|balance| > 1), apply the appropriate single or double rotation to fix it.',
    ],
    complexity: { time: 'O(log n) guaranteed', space: 'O(log n) recursion stack' },
    pitfalls: 'Four rotation cases (LL, RR, LR, RL) — picking the wrong one is the most common bug.',
  },
  heap_insert: {
    title: 'Binary Heap — Insert',
    intuition:
      'Add the new element at the next open slot (keeping the tree complete), then "bubble it up" by swapping with its parent as long as the heap property is violated.',
    steps: [
      'Place the new value at the end of the array-backed tree.',
      'Compare it to its parent; swap if it violates the heap order (e.g. child bigger than parent in a max-heap).',
      'Keep bubbling up until the heap property holds or the root is reached.',
    ],
    complexity: { time: 'O(log n)', space: 'O(1)' },
    pitfalls: 'Heaps only guarantee the root is min/max — the rest of the tree is not fully sorted.',
  },
  segment_tree_build: {
    title: 'Segment Tree',
    intuition:
      'A binary tree over array ranges where each node stores an aggregate (like sum or min) of a range. This lets you answer range queries and handle point updates in logarithmic time instead of scanning the whole array.',
    steps: [
      'Build recursively: each leaf covers one array element; each internal node covers the union of its two children\'s ranges.',
      'To query a range, recurse down only into the parts of the tree that overlap the query range.',
      'To update a value, walk down to the corresponding leaf, then update every ancestor on the way back up.',
    ],
    complexity: { time: 'O(log n) per query/update, O(n) to build', space: 'O(n)' },
    pitfalls: 'More setup complexity than a Fenwick tree, but far more flexible (supports min/max/gcd, not just sums).',
  },
  fenwick_tree_build: {
    title: 'Fenwick Tree (Binary Indexed Tree)',
    intuition:
      "A compact structure for prefix sums that supports updates, using each index's lowest set bit to decide which range it's responsible for.",
    steps: [
      'To update index i, add the delta there, then jump to i += (i & -i) and repeat, updating all responsible ancestors.',
      'To query a prefix sum up to i, add up values while jumping i -= (i & -i) down to 0.',
      'A range sum [l..r] is just prefixSum(r) - prefixSum(l-1).',
    ],
    complexity: { time: 'O(log n) per update/query', space: 'O(n)' },
    pitfalls: 'The bit-trick indexing (i & -i) is compact but not intuitive at first — worth tracing through by hand once.',
  },
  trie_insert: {
    title: 'Trie — Insert',
    intuition:
      "A tree where each path from the root spells out a prefix of characters. Inserting a word walks character by character, creating new branches only where the path doesn't already exist.",
    steps: [
      'Start at the root.',
      'For each character in the word, move to the child node for that character — creating it if it doesn\'t exist yet.',
      'Mark the final node as "end of word".',
    ],
    complexity: { time: 'O(L) where L is word length', space: 'O(total characters stored)' },
    pitfalls: 'Great for prefix queries (autocomplete) but uses more memory than a hash set for the same word list.',
  },
  sum_digits: {
    title: 'Sum of Digits (Recursion)',
    intuition:
      'Peel off the last digit (n % 10) and recurse on the rest of the number (n // 10), adding digits together as the calls return.',
    steps: [
      'Base case: if n has only one digit left (n < 10), return it directly.',
      'Otherwise, return (last digit) + sum_digits(remaining digits).',
      'Calls stack up one per digit, then add together as they return.',
    ],
    complexity: { time: 'O(d) where d = number of digits', space: 'O(d) call stack' },
    pitfalls: "Doesn't handle negative numbers as written — worth tracing what n % 10 does for negative n.",
  },
  tower_of_hanoi: {
    title: 'Tower of Hanoi',
    intuition:
      'To move n disks from source to target, first move the top n-1 disks out of the way (to the spare peg), move the single largest disk directly, then move those n-1 disks from the spare peg onto the target.',
    steps: [
      'Base case: 0 disks to move takes 0 moves.',
      'Move n-1 disks from source to auxiliary (using target as the spare).',
      'Move the last disk from source to target, then move the n-1 disks from auxiliary to target (using source as the spare).',
    ],
    complexity: { time: 'O(2^n)', space: 'O(n) call stack' },
    pitfalls: 'The number of moves grows exponentially — 20 disks alone is already over a million moves.',
  },
}

export default explanations
