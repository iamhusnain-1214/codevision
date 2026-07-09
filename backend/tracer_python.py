"""
tracer_python.py — turns a Python algorithm into a step-by-step trace.

Core idea: sys.settrace() lets us register a callback that Python calls
before executing every single line. Inside that callback we snapshot
whatever local variables exist at that moment. Collect one snapshot per
line executed -> that list IS the trace the frontend will play back.

This file currently ships with a few algorithms pre-registered
(ALGORITHMS dict at the bottom). Adding a new algorithm to the visualizer
library later = writing one more Python function + one dict entry.
No frontend or architecture changes needed.
"""

import sys


def trace_function(func, *args):
    """
    Runs `func(*args)` line by line, returns a list of snapshot dicts.

    Each snapshot:
        {
            "step": int,
            "line": int,          # line number executing next
            "variables": {...}    # local variables at this point
        }
    """
    steps = []
    step_counter = {"n": 0}

    def tracer(frame, event, arg):
        # Only trace lines inside our target function, not internals.
        if frame.f_code.co_name != func.__name__:
            return tracer

        if event == "line":
            step_counter["n"] += 1
            snapshot_vars = {
                k: v for k, v in frame.f_locals.items()
                if not k.startswith("__")
            }
            steps.append({
                "step": step_counter["n"],
                "line": frame.f_lineno,
                "variables": _make_json_safe(snapshot_vars),
            })
        return tracer

    old_tracer = sys.gettrace()
    sys.settrace(tracer)
    try:
        func(*args)
    finally:
        sys.settrace(old_tracer)

    return steps


def _make_json_safe(d):
    """Converts values that json.dumps can't handle (rare, but be safe)."""
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


# ---------------------------------------------------------------------
# Algorithm implementations. Each one gets traced exactly the same way.
# ---------------------------------------------------------------------

def kadane(arr):
    current_sum = arr[0]
    max_sum = arr[0]
    for i in range(1, len(arr)):
        current_sum = max(arr[i], current_sum + arr[i])
        max_sum = max(max_sum, current_sum)
    return max_sum


def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
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


def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)


# Registry: maps an algorithm id (used by the frontend/API) to
# (function, how-to-build-args-from-user-input).
ALGORITHMS = {
    "kadane": lambda arr: trace_function(kadane, arr),
    "binary_search": lambda arr, target: trace_function(binary_search, arr, target),
    "bubble_sort": lambda arr: trace_function(bubble_sort, list(arr)),
    "factorial": lambda n: trace_function(factorial, n),
}
