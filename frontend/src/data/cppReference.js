// Static C++ reference implementations shown when a module's language
// toggle is switched to "C++". These are read-only reference text — the
// live trace/variable-stepping still runs the Python tracer under the
// hood (see tracer_array.py etc.), so there is no per-step active line
// for C++ yet. Real C++ execution tracing (compiling with -g and driving
// gdb) is a separate, bigger effort tracked on the roadmap.
//
// Keys mirror ALGORITHMS in api/client.js exactly, so each module page
// can do CPP_REFERENCE[module][algorithm].

export const CPP_REFERENCE = {
  array: {
    kadane: `int kadane(vector<int>& arr) {
    int current_sum = arr[0];
    int max_sum = arr[0];
    for (int i = 1; i < arr.size(); i++) {
        current_sum = max(arr[i], current_sum + arr[i]);
        max_sum = max(max_sum, current_sum);
    }
    return max_sum;
}`,
    moore_voting: `int mooreVoting(vector<int>& arr) {
    int candidate = 0;
    int count = 0;
    for (int num : arr) {
        if (count == 0) candidate = num;
        count += (num == candidate) ? 1 : -1;
    }
    return candidate;
}`,
    binary_search: `int binarySearch(vector<int>& arr, int target) {
    int low = 0, high = arr.size() - 1;
    while (low <= high) {
        int mid = (low + high) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}`,
    bubble_sort: `void bubbleSort(vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                swap(arr[j], arr[j + 1]);
            }
        }
    }
}`,
    selection_sort: `void selectionSort(vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n; i++) {
        int minIdx = i;
        for (int j = i + 1; j < n; j++) {
            if (arr[j] < arr[minIdx]) minIdx = j;
        }
        swap(arr[i], arr[minIdx]);
    }
}`,
    insertion_sort: `void insertionSort(vector<int>& arr) {
    for (int i = 1; i < arr.size(); i++) {
        int key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}`,
    merge_sort: `vector<int> mergeSort(vector<int> arr) {
    if (arr.size() <= 1) return arr;
    int mid = arr.size() / 2;
    vector<int> left = mergeSort(vector<int>(arr.begin(), arr.begin() + mid));
    vector<int> right = mergeSort(vector<int>(arr.begin() + mid, arr.end()));

    vector<int> result;
    int i = 0, j = 0;
    while (i < left.size() && j < right.size()) {
        if (left[i] <= right[j]) result.push_back(left[i++]);
        else result.push_back(right[j++]);
    }
    while (i < left.size()) result.push_back(left[i++]);
    while (j < right.size()) result.push_back(right[j++]);
    return result;
}`,
    quick_sort: `void quickSort(vector<int>& arr, int low, int high) {
    if (low < high) {
        int pivot = arr[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (arr[j] <= pivot) {
                i++;
                swap(arr[i], arr[j]);
            }
        }
        swap(arr[i + 1], arr[high]);
        int pi = i + 1;
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}`,
    prefix_sum: `vector<int> prefixSum(vector<int>& arr) {
    vector<int> prefix(arr.size());
    prefix[0] = arr[0];
    for (int i = 1; i < arr.size(); i++) {
        prefix[i] = prefix[i - 1] + arr[i];
    }
    return prefix;
}`,
    sliding_window_max_sum: `int slidingWindowMaxSum(vector<int>& arr, int k) {
    int windowSum = 0;
    for (int i = 0; i < k; i++) windowSum += arr[i];
    int maxSum = windowSum;
    for (int i = k; i < arr.size(); i++) {
        windowSum += arr[i] - arr[i - k];
        maxSum = max(maxSum, windowSum);
    }
    return maxSum;
}`,
    two_pointer_pair_sum: `pair<int,int> twoPointerPairSum(vector<int> arr, int target) {
    sort(arr.begin(), arr.end());
    int left = 0, right = arr.size() - 1;
    while (left < right) {
        int s = arr[left] + arr[right];
        if (s == target) return {arr[left], arr[right]};
        else if (s < target) left++;
        else right--;
    }
    return {-1, -1}; // no pair found
}`,
    dutch_national_flag: `void dutchNationalFlag(vector<int>& arr) {
    int low = 0, mid = 0, high = arr.size() - 1;
    while (mid <= high) {
        if (arr[mid] == 0) {
            swap(arr[low++], arr[mid++]);
        } else if (arr[mid] == 1) {
            mid++;
        } else {
            swap(arr[mid], arr[high--]);
        }
    }
}`,
    heap_sort: `void heapify(vector<int>& arr, int n, int i) {
    int largest = i;
    int l = 2 * i + 1, r = 2 * i + 2;
    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;
    if (largest != i) {
        swap(arr[i], arr[largest]);
        heapify(arr, n, largest);
    }
}

void heapSort(vector<int>& arr) {
    int n = arr.size();
    for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);
    for (int i = n - 1; i > 0; i--) {
        swap(arr[0], arr[i]);
        heapify(arr, i, 0);
    }
}`,
  },

  recursion: {
    factorial: `long long factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}`,
    fibonacci: `int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}`,
    sum_digits: `int sumDigits(int n) {
    if (n < 10) return n;
    return n % 10 + sumDigits(n / 10);
}`,
    tower_of_hanoi: `// Returns the total number of moves to solve Tower of Hanoi with n disks.
int towerOfHanoi(int n, char source = 'A', char target = 'C', char auxiliary = 'B') {
    if (n == 0) return 0;
    int moves = towerOfHanoi(n - 1, source, auxiliary, target);
    moves += 1;
    moves += towerOfHanoi(n - 1, auxiliary, target, source);
    return moves;
}`,
  },

  dp: {
    lcs: `// Longest Common Subsequence. Returns length; dp table filled in-place.
int lcs(const string& s1, const string& s2, vector<vector<int>>& dp) {
    int m = s1.size(), n = s2.size();
    dp.assign(m + 1, vector<int>(n + 1, 0));
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (s1[i - 1] == s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
            else dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}`,
    knapsack: `int knapsack(vector<int>& weights, vector<int>& values, int capacity, vector<vector<int>>& dp) {
    int n = weights.size();
    dp.assign(n + 1, vector<int>(capacity + 1, 0));
    for (int i = 1; i <= n; i++) {
        for (int w = 0; w <= capacity; w++) {
            if (weights[i - 1] <= w) {
                dp[i][w] = max(values[i - 1] + dp[i - 1][w - weights[i - 1]], dp[i - 1][w]);
            } else {
                dp[i][w] = dp[i - 1][w];
            }
        }
    }
    return dp[n][capacity];
}`,
  },

  graph: {
    bfs: `vector<int> bfs(vector<vector<pair<int,int>>>& adj, int start) {
    vector<bool> visited(adj.size(), false);
    queue<int> q;
    vector<int> order;
    visited[start] = true;
    q.push(start);
    while (!q.empty()) {
        int current = q.front(); q.pop();
        order.push_back(current);
        for (auto& [neighbor, weight] : adj[current]) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                q.push(neighbor);
            }
        }
    }
    return order;
}`,
    dfs: `void visit(int node, vector<vector<pair<int,int>>>& adj, vector<bool>& visited, vector<int>& order) {
    visited[node] = true;
    order.push_back(node);
    for (auto& [neighbor, weight] : adj[node]) {
        if (!visited[neighbor]) visit(neighbor, adj, visited, order);
    }
}

vector<int> dfs(vector<vector<pair<int,int>>>& adj, int start) {
    vector<bool> visited(adj.size(), false);
    vector<int> order;
    visit(start, adj, visited, order);
    return order;
}`,
    dijkstra: `vector<int> dijkstra(vector<vector<pair<int,int>>>& adj, int start) {
    vector<int> dist(adj.size(), INT_MAX);
    dist[start] = 0;
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;
    pq.push({0, start});
    vector<bool> visited(adj.size(), false);

    while (!pq.empty()) {
        auto [d, node] = pq.top(); pq.pop();
        if (visited[node]) continue;
        visited[node] = true;
        for (auto& [neighbor, weight] : adj[node]) {
            if (dist[node] + weight < dist[neighbor]) {
                dist[neighbor] = dist[node] + weight;
                pq.push({dist[neighbor], neighbor});
            }
        }
    }
    return dist;
}`,
    prim: `int prim(vector<vector<pair<int,int>>>& adj, int start) {
    vector<bool> visited(adj.size(), false);
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;
    pq.push({0, start});
    int totalWeight = 0;

    while (!pq.empty()) {
        auto [weight, u] = pq.top(); pq.pop();
        if (visited[u]) continue;
        visited[u] = true;
        totalWeight += weight;
        for (auto& [v, w] : adj[u]) {
            if (!visited[v]) pq.push({w, v});
        }
    }
    return totalWeight;
}`,
    kruskal: `int find(vector<int>& parent, int x) {
    while (parent[x] != x) x = parent[x];
    return x;
}

void unite(vector<int>& parent, int x, int y) {
    parent[find(parent, x)] = find(parent, y);
}

int kruskal(int n, vector<array<int,3>>& edges) {
    // edges: {u, v, weight}
    sort(edges.begin(), edges.end(), [](auto& a, auto& b) { return a[2] < b[2]; });
    vector<int> parent(n);
    for (int i = 0; i < n; i++) parent[i] = i;

    int mstWeight = 0;
    for (auto& [u, v, w] : edges) {
        if (find(parent, u) != find(parent, v)) {
            unite(parent, u, v);
            mstWeight += w;
        }
    }
    return mstWeight;
}`,
    bellman_ford: `vector<int> bellmanFord(int n, vector<array<int,3>>& edges, int start) {
    vector<int> dist(n, INT_MAX);
    dist[start] = 0;
    for (int i = 0; i < n - 1; i++) {
        for (auto& [u, v, w] : edges) {
            if (dist[u] != INT_MAX && dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
            }
        }
    }
    return dist;
}`,
    floyd_warshall: `vector<vector<int>> floydWarshall(int n, vector<vector<int>> dist) {
    for (int k = 0; k < n; k++) {
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                if (dist[i][k] + dist[k][j] < dist[i][j]) {
                    dist[i][j] = dist[i][k] + dist[k][j];
                }
            }
        }
    }
    return dist;
}`,
    topological_sort: `void visit(int node, vector<vector<pair<int,int>>>& adj, vector<bool>& visited, vector<int>& stack) {
    visited[node] = true;
    for (auto& [neighbor, weight] : adj[node]) {
        if (!visited[neighbor]) visit(neighbor, adj, visited, stack);
    }
    stack.push_back(node);
}

vector<int> topologicalSort(int n, vector<vector<pair<int,int>>>& adj) {
    vector<bool> visited(n, false);
    vector<int> stack;
    for (int i = 0; i < n; i++) {
        if (!visited[i]) visit(i, adj, visited, stack);
    }
    reverse(stack.begin(), stack.end());
    return stack;
}`,
  },

  tree: {
    bst_insert: `struct Node {
    int value;
    Node* left = nullptr;
    Node* right = nullptr;
    Node(int v) : value(v) {}
};

Node* insert(Node* node, int value) {
    if (node == nullptr) return new Node(value);
    if (value < node->value) node->left = insert(node->left, value);
    else node->right = insert(node->right, value);
    return node;
}`,
    avl_insert: `struct Node {
    int value, height = 1;
    Node* left = nullptr;
    Node* right = nullptr;
    Node(int v) : value(v) {}
};

int height(Node* n) { return n ? n->height : 0; }
int balanceFactor(Node* n) { return n ? height(n->left) - height(n->right) : 0; }

Node* rotateRight(Node* y) {
    Node* x = y->left;
    y->left = x->right;
    x->right = y;
    y->height = 1 + max(height(y->left), height(y->right));
    x->height = 1 + max(height(x->left), height(x->right));
    return x;
}

Node* rotateLeft(Node* x) {
    Node* y = x->right;
    x->right = y->left;
    y->left = x;
    x->height = 1 + max(height(x->left), height(x->right));
    y->height = 1 + max(height(y->left), height(y->right));
    return y;
}

Node* insert(Node* node, int value) {
    if (node == nullptr) return new Node(value);
    if (value < node->value) node->left = insert(node->left, value);
    else node->right = insert(node->right, value);

    node->height = 1 + max(height(node->left), height(node->right));
    int balance = balanceFactor(node);

    if (balance > 1 && value < node->left->value) return rotateRight(node);
    if (balance < -1 && value > node->right->value) return rotateLeft(node);
    if (balance > 1 && value > node->left->value) {
        node->left = rotateLeft(node->left);
        return rotateRight(node);
    }
    if (balance < -1 && value < node->right->value) {
        node->right = rotateRight(node->right);
        return rotateLeft(node);
    }
    return node;
}`,
    heap_insert: `void siftUp(vector<int>& heap, int i) {
    while (i > 0) {
        int parent = (i - 1) / 2;
        if (heap[i] < heap[parent]) {
            swap(heap[i], heap[parent]);
            i = parent;
        } else {
            break;
        }
    }
}

void heapInsert(vector<int>& heap, int value) {
    heap.push_back(value);
    siftUp(heap, heap.size() - 1);
}`,
    segment_tree_build: `vector<int> buildSegmentTree(vector<int>& arr) {
    int n = arr.size();
    vector<int> tree(2 * n, 0);
    for (int i = 0; i < n; i++) tree[n + i] = arr[i];
    for (int i = n - 1; i > 0; i--) {
        tree[i] = tree[2 * i] + tree[2 * i + 1];
    }
    return tree;
}`,
    fenwick_tree_build: `vector<int> buildFenwickTree(vector<int>& arr) {
    int n = arr.size();
    vector<int> tree(n + 1, 0);
    for (int i = 1; i <= n; i++) {
        int idx = i;
        while (idx <= n) {
            tree[idx] += arr[i - 1];
            idx += idx & (-idx);
        }
    }
    return tree;
}`,
    trie_insert: `struct TrieNode {
    unordered_map<char, TrieNode*> children;
    bool isEnd = false;
};

void trieInsert(TrieNode* root, const string& word) {
    TrieNode* node = root;
    for (char ch : word) {
        if (node->children.find(ch) == node->children.end()) {
            node->children[ch] = new TrieNode();
        }
        node = node->children[ch];
    }
    node->isEnd = true;
}`,
  },
}
