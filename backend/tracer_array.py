"""
tracer_array.py — sys.settrace()-based tracer for array algorithms,
recursive functions, and DP table builders.

Core idea (same as before): sys.settrace() fires a callback on every
line executed. We snapshot local variables each time. The result is a
list of {step, line, variables} dicts the frontend can step through.

For RECURSIVE functions specifically, we also track the call stack
depth so the frontend can render nested frames (module 2 in the plan).
"""

import sys
import inspect


def get_source_info(func):
    """Returns {source, start_line} for a traced function — the frontend's
    code panel renders this exact text, so line numbers always line up with
    the `rel_line` field on each trace step. Never write a second copy of
    this code anywhere else, or the two will drift out of alignment."""
    src_lines, start_line = inspect.getsourcelines(func)
    return {"source": "".join(src_lines), "start_line": start_line}


def trace_function(func, *args, track_call_stack=False):
    steps = []
    step_counter = {"n": 0}
    call_stack = []  # list of function names currently "active"
    _, start_line = inspect.getsourcelines(func)

    def tracer(frame, event, arg):
        if frame.f_code.co_name != func.__name__:
            return tracer

        if event == "call":
            if track_call_stack:
                call_stack.append({
                    "function": frame.f_code.co_name,
                    "args": _make_json_safe(frame.f_locals),
                })
            return tracer

        if event == "line":
            step_counter["n"] += 1
            snapshot_vars = {k: v for k, v in frame.f_locals.items() if not k.startswith("__")}
            step = {
                "step": step_counter["n"],
                "line": frame.f_lineno,
                "rel_line": frame.f_lineno - start_line + 1,
                "variables": _make_json_safe(snapshot_vars),
            }
            if track_call_stack:
                step["call_stack_depth"] = len(call_stack)
                if call_stack:
                    call_stack[-1]["args"] = _make_json_safe(snapshot_vars)
                step["call_stack"] = [dict(f) for f in call_stack]
            steps.append(step)

        if event == "return":
            if track_call_stack and call_stack:
                finished = call_stack.pop()
                step_counter["n"] += 1
                steps.append({
                    "step": step_counter["n"],
                    "line": frame.f_lineno,
                    "rel_line": frame.f_lineno - start_line + 1,
                    "variables": {"return_value": _make_json_safe({"v": arg})["v"]},
                    "event": "return",
                    "function": finished["function"],
                    "call_stack_depth": len(call_stack),
                })

        return tracer

    old_tracer = sys.gettrace()
    sys.settrace(tracer)
    try:
        result = func(*args)
    finally:
        sys.settrace(old_tracer)

    return steps, result


def _make_json_safe(d):
    safe = {}
    for k, v in d.items():
        if isinstance(v, (int, float, str, bool, type(None))):
            safe[k] = v
        elif isinstance(v, (list, tuple)):
            safe[k] = list(v)
        elif isinstance(v, dict):
            safe[k] = dict(v)
        else:
            safe[k] = str(v)
    return safe


# =====================================================================
# ARRAY ALGORITHMS
# =====================================================================

def kadane(arr):
    current_sum = arr[0]
    max_sum = arr[0]
    for i in range(1, len(arr)):
        current_sum = max(arr[i], current_sum + arr[i])
        max_sum = max(max_sum, current_sum)
    return max_sum


def moore_voting(arr):
    candidate = None
    count = 0
    for num in arr:
        if count == 0:
            candidate = num
        count += 1 if num == candidate else -1
    return candidate


def binary_search(arr, target):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1


def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr


def selection_sort(arr):
    n = len(arr)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr


def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr


def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


def quick_sort(arr, low=0, high=None):
    if high is None:
        high = len(arr) - 1
    if low < high:
        pivot = arr[high]
        i = low - 1
        for j in range(low, high):
            if arr[j] <= pivot:
                i += 1
                arr[i], arr[j] = arr[j], arr[i]
        arr[i + 1], arr[high] = arr[high], arr[i + 1]
        pi = i + 1
        quick_sort(arr, low, pi - 1)
        quick_sort(arr, pi + 1, high)
    return arr


def prefix_sum(arr):
    prefix = [0] * len(arr)
    prefix[0] = arr[0]
    for i in range(1, len(arr)):
        prefix[i] = prefix[i - 1] + arr[i]
    return prefix


def sliding_window_max_sum(arr, k):
    window_sum = sum(arr[:k])
    max_sum = window_sum
    for i in range(k, len(arr)):
        window_sum += arr[i] - arr[i - k]
        max_sum = max(max_sum, window_sum)
    return max_sum


def two_pointer_pair_sum(arr, target):
    arr = sorted(arr)
    left, right = 0, len(arr) - 1
    while left < right:
        s = arr[left] + arr[right]
        if s == target:
            return (arr[left], arr[right])
        elif s < target:
            left += 1
        else:
            right -= 1
    return None


def dutch_national_flag(arr):
    low, mid, high = 0, 0, len(arr) - 1
    while mid <= high:
        if arr[mid] == 0:
            arr[low], arr[mid] = arr[mid], arr[low]
            low += 1; mid += 1
        elif arr[mid] == 1:
            mid += 1
        else:
            arr[mid], arr[high] = arr[high], arr[mid]
            high -= 1
    return arr


def heap_sort(arr):
    n = len(arr)

    def heapify(n, i):
        largest = i
        l, r = 2 * i + 1, 2 * i + 2
        if l < n and arr[l] > arr[largest]:
            largest = l
        if r < n and arr[r] > arr[largest]:
            largest = r
        if largest != i:
            arr[i], arr[largest] = arr[largest], arr[i]
            heapify(n, largest)

    for i in range(n // 2 - 1, -1, -1):
        heapify(n, i)
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]
        heapify(i, 0)
    return arr


# =====================================================================
# RECURSION
# =====================================================================

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)


def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


def sum_digits(n):
    if n < 10:
        return n
    return n % 10 + sum_digits(n // 10)


def tower_of_hanoi(n, source="A", target="C", auxiliary="B"):
    """Returns the total number of moves to solve Tower of Hanoi with n disks."""
    if n == 0:
        return 0
    moves = tower_of_hanoi(n - 1, source, auxiliary, target)
    moves += 1
    moves += tower_of_hanoi(n - 1, auxiliary, target, source)
    return moves


# =====================================================================
# DYNAMIC PROGRAMMING
# =====================================================================

def lcs(s1, s2):
    """Longest Common Subsequence. Returns (length, dp_table)."""
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n], dp


def knapsack(weights, values, capacity):
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for w in range(capacity + 1):
            if weights[i - 1] <= w:
                dp[i][w] = max(values[i - 1] + dp[i - 1][w - weights[i - 1]], dp[i - 1][w])
            else:
                dp[i][w] = dp[i - 1][w]
    return dp[n][capacity], dp


# =====================================================================
# REGISTRY — maps algorithm id -> (function, needs_call_stack_tracking)
# =====================================================================

ARRAY_ALGORITHMS = {
    "kadane": kadane,
    "moore_voting": moore_voting,
    "binary_search": binary_search,
    "bubble_sort": bubble_sort,
    "selection_sort": selection_sort,
    "insertion_sort": insertion_sort,
    "merge_sort": merge_sort,
    "quick_sort": quick_sort,
    "prefix_sum": prefix_sum,
    "sliding_window_max_sum": sliding_window_max_sum,
    "two_pointer_pair_sum": two_pointer_pair_sum,
    "dutch_national_flag": dutch_national_flag,
    "heap_sort": heap_sort,
}

RECURSION_ALGORITHMS = {
    "factorial": factorial,
    "fibonacci": fibonacci,
    "sum_digits": sum_digits,
    "tower_of_hanoi": tower_of_hanoi,
}

DP_ALGORITHMS = {
    "lcs": lcs,
    "knapsack": knapsack,
}
