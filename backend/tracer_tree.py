"""
tracer_tree.py — BST, AVL, Heap, Segment Tree, Fenwick Tree, Trie.

Same manual-snapshot approach as tracer_graph.py: after each meaningful
operation (insert, rotate, update), we record the tree's current shape
as a nested dict so the frontend can redraw it.

Tree snapshot shape for BST/AVL:
    {"value": 8, "left": {...} or None, "right": {...} or None}
"""


# =====================================================================
# BST
# =====================================================================

class BSTNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None

    def to_dict(self):
        return {
            "value": self.value,
            "left": self.left.to_dict() if self.left else None,
            "right": self.right.to_dict() if self.right else None,
        }


def bst_insert_sequence(values):
    root = None
    steps = []

    def insert(node, value):
        if node is None:
            return BSTNode(value)
        if value < node.value:
            node.left = insert(node.left, value)
        else:
            node.right = insert(node.right, value)
        return node

    for v in values:
        root = insert(root, v)
        steps.append({
            "step": len(steps),
            "inserted": v,
            "tree": root.to_dict() if root else None,
        })

    return steps, root.to_dict() if root else None


# =====================================================================
# AVL (self-balancing BST)
# =====================================================================

class AVLNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None
        self.height = 1

    def to_dict(self):
        return {
            "value": self.value,
            "left": self.left.to_dict() if self.left else None,
            "right": self.right.to_dict() if self.right else None,
        }


def _height(n):
    return n.height if n else 0


def _balance(n):
    return _height(n.left) - _height(n.right) if n else 0


def _rotate_right(y):
    x = y.left
    y.left = x.right
    x.right = y
    y.height = 1 + max(_height(y.left), _height(y.right))
    x.height = 1 + max(_height(x.left), _height(x.right))
    return x


def _rotate_left(x):
    y = x.right
    x.right = y.left
    y.left = x
    x.height = 1 + max(_height(x.left), _height(x.right))
    y.height = 1 + max(_height(y.left), _height(y.right))
    return y


def avl_insert_sequence(values):
    root = None
    steps = []

    def insert(node, value):
        if node is None:
            return AVLNode(value)
        if value < node.value:
            node.left = insert(node.left, value)
        else:
            node.right = insert(node.right, value)

        node.height = 1 + max(_height(node.left), _height(node.right))
        balance = _balance(node)

        if balance > 1 and value < node.left.value:
            return _rotate_right(node)
        if balance < -1 and value > node.right.value:
            return _rotate_left(node)
        if balance > 1 and value > node.left.value:
            node.left = _rotate_left(node.left)
            return _rotate_right(node)
        if balance < -1 and value < node.right.value:
            node.right = _rotate_right(node.right)
            return _rotate_left(node)

        return node

    for v in values:
        root = insert(root, v)
        steps.append({
            "step": len(steps),
            "inserted": v,
            "tree": root.to_dict() if root else None,
        })

    return steps, root.to_dict() if root else None


# =====================================================================
# HEAP (array-based binary heap, min-heap)
# =====================================================================

def heap_insert_sequence(values):
    heap = []
    steps = []

    def sift_up(i):
        while i > 0:
            parent = (i - 1) // 2
            if heap[i] < heap[parent]:
                heap[i], heap[parent] = heap[parent], heap[i]
                i = parent
            else:
                break

    for v in values:
        heap.append(v)
        sift_up(len(heap) - 1)
        steps.append({"step": len(steps), "inserted": v, "heap_array": list(heap)})

    return steps, list(heap)


# =====================================================================
# SEGMENT TREE (sum queries)
# =====================================================================

def build_segment_tree(arr):
    n = len(arr)
    tree = [0] * (2 * n)
    steps = []

    for i in range(n):
        tree[n + i] = arr[i]
    for i in range(n - 1, 0, -1):
        tree[i] = tree[2 * i] + tree[2 * i + 1]
        steps.append({"step": len(steps), "node_index": i, "value": tree[i], "tree_array": list(tree)})

    return steps, tree


# =====================================================================
# FENWICK TREE (Binary Indexed Tree, prefix sums)
# =====================================================================

def build_fenwick_tree(arr):
    n = len(arr)
    tree = [0] * (n + 1)
    steps = []

    for i, val in enumerate(arr, start=1):
        idx = i
        while idx <= n:
            tree[idx] += val
            steps.append({"step": len(steps), "updated_index": idx, "value": tree[idx], "tree_array": list(tree)})
            idx += idx & (-idx)

    return steps, tree


# =====================================================================
# TRIE
# =====================================================================

def trie_insert_sequence(words):
    trie = {}
    steps = []

    for word in words:
        node = trie
        for ch in word:
            if ch not in node:
                node[ch] = {}
            node = node[ch]
        node["$end"] = True
        steps.append({"step": len(steps), "inserted_word": word, "trie": _trie_copy(trie)})

    return steps, trie


def _trie_copy(node):
    return {k: (True if k == "$end" else _trie_copy(v)) for k, v in node.items()}


TREE_ALGORITHMS = {
    "bst_insert": bst_insert_sequence,
    "avl_insert": avl_insert_sequence,
    "heap_insert": heap_insert_sequence,
    "segment_tree_build": build_segment_tree,
    "fenwick_tree_build": build_fenwick_tree,
    "trie_insert": trie_insert_sequence,
}
