"""
tracer_custom.py — powers the Custom Code Visualizer (Module 4).

Scope for this version: PYTHON ONLY. C++ needs a real compiler +
debugger hook (gdb/lldb machine interface, or a from-scratch instrumented
interpreter) which isn't something we can safely stand up here — that's
flagged as a separate, larger backend project. The /run-custom-trace
route below returns a clear 400 if language == 'cpp' for now.

SECURITY NOTE: this executes arbitrary user-submitted Python with
sys.settrace(), inside a restricted globals dict and with a hard
instruction-count ceiling to stop infinite loops. This is NOT a real
sandbox (no seccomp, no container, no memory limits) — it is a
reasonable safeguard for a classroom tool with trusted logged-in users,
not something to expose to the open internet unauthenticated. Before
any public deployment, replace this with subprocess isolation
(resource limits) or a container-per-run model.
"""

import sys
import io
import builtins
import contextlib
import types

MAX_STEPS = 5000  # hard ceiling so a `while True` doesn't hang the server

_BLOCKED_NAMES = {
    "open", "exec", "eval", "compile", "input",
    "exit", "quit", "help", "globals", "locals", "vars", "dir",
}

# Stdlib modules safe for a classroom DSA tool (no filesystem, network,
# process, or interpreter-introspection access). This is what lets
# `import heapq`, `import collections`, etc. work instead of every
# import blanket-failing. Anything else (os, sys, subprocess, socket,
# importlib, shutil, ...) still raises ImportError.
_ALLOWED_MODULES = {
    "heapq", "collections", "math", "itertools", "functools", "bisect",
    "string", "re", "copy", "random", "statistics", "json", "queue",
    "operator", "array", "enum", "typing", "dataclasses", "fractions",
    "decimal", "abc",
}


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".")[0]
    if root not in _ALLOWED_MODULES:
        raise ImportError(
            f"import of '{name}' is not allowed here — supported modules: "
            f"{', '.join(sorted(_ALLOWED_MODULES))}"
        )
    return builtins.__import__(name, globals, locals, fromlist, level)


_SAFE_BUILTINS = {name: getattr(builtins, name) for name in dir(builtins)}
for _blocked in _BLOCKED_NAMES:
    _SAFE_BUILTINS.pop(_blocked, None)
_SAFE_BUILTINS["__import__"] = _safe_import


def classify(value):
    """Looks at a Python value and guesses which visual it should render
    as on the frontend. This is the core of 'auto-detect the data
    structure' — matched against the value's runtime type and, for
    objects, its attribute names."""
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, dict):
        return "hash_map"
    if isinstance(value, set):
        return "hash_map"  # rendered as a bucket set, same visual family as a hash map
    if isinstance(value, (list, tuple)):
        return "array"
    if value.__class__.__name__ in ("deque",):
        return "queue"
    attrs = set(dir(value)) if hasattr(value, "__dict__") else set()
    if hasattr(value, "__dict__"):
        instance_attrs = set(vars(value).keys())
        if {"next"} & instance_attrs:
            return "linked_list"
        if {"left", "right"} & instance_attrs:
            return "tree"
        if {"neighbors", "edges", "adj"} & instance_attrs:
            return "graph"
    if value is None:
        return "none"
    return "object"


def _safe_snapshot(value, _depth=0):
    """Recursively converts a value to something JSON-serializable, tagging
    each with its detected structure type. Bails out on depth to avoid
    infinite recursion on self-referential structures."""
    if _depth > 4:
        return {"type": "truncated", "value": "..."}

    kind = classify(value)

    if kind in ("number", "string", "boolean", "none"):
        return {"type": kind, "value": value}

    if kind == "array":
        return {"type": "array", "value": [_safe_snapshot(v, _depth + 1) for v in value]}

    if kind == "hash_map":
        if isinstance(value, set):
            return {"type": "hash_map", "value": {str(v): {"type": "boolean", "value": True} for v in value}}
        return {"type": "hash_map", "value": {str(k): _safe_snapshot(v, _depth + 1) for k, v in value.items()}}

    if kind == "queue":
        return {"type": "queue", "value": [_safe_snapshot(v, _depth + 1) for v in value]}

    if kind in ("linked_list", "tree", "graph", "object"):
        try:
            attrs = vars(value)
            return {
                "type": kind,
                "value": {k: _safe_snapshot(v, _depth + 1) for k, v in attrs.items()},
            }
        except TypeError:
            return {"type": "object", "value": str(value)}

    return {"type": "object", "value": str(value)}


def _make_json_safe_value(v):
    """Like _safe_snapshot but returns a plain JSON-safe value (not the
    {type, value} wrapper) — used for the return_value on 'return' steps,
    matching the shape tracer_array.py uses for the same field."""
    if isinstance(v, (int, float, str, bool, type(None))):
        return v
    if isinstance(v, (list, tuple)):
        return [_make_json_safe_value(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _make_json_safe_value(val) for k, val in v.items()}
    return str(v)


def run_custom_python_trace(code):
    steps = []
    step_counter = {"n": 0}
    stop = {"hit_limit": False}
    # Tracks every active function call in the user's code (any function,
    # not just one named one) — this is what lets the frontend rebuild a
    # real call tree for arbitrary user-submitted recursive code, the same
    # way tracer_array.py's track_call_stack=True path works for the
    # built-in recursion module.
    call_stack = []

    def snapshot_locals(frame):
        snapshot_vars = {}
        for k, v in frame.f_locals.items():
            if k.startswith("__"):
                continue
            # An import like `from collections import deque` or
            # `import heapq` binds the module/class/function itself into
            # locals right alongside real data (e.g. `q = deque()`).
            # Snapshotting the class/module recurses into its method
            # table (vars() of a class returns its namespace dict) and
            # renders as a wall of nonsense keys — skip these, they're
            # never the thing being visualized.
            if isinstance(v, (types.ModuleType, type, types.FunctionType,
                               types.BuiltinFunctionType, types.BuiltinMethodType)):
                continue
            try:
                snapshot_vars[k] = _safe_snapshot(v)
            except Exception:
                snapshot_vars[k] = {"type": "object", "value": str(v)}
        return snapshot_vars

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != "<custom_user_code>":
            return tracer

        if event == "call":
            if frame.f_code.co_name == "<module>":
                return tracer  # the script's own top-level frame, not a real function call
            call_stack.append({
                "function": frame.f_code.co_name,
                "args": snapshot_locals(frame),
            })
            return tracer

        if event == "line":
            step_counter["n"] += 1
            if step_counter["n"] > MAX_STEPS:
                stop["hit_limit"] = True
                sys.settrace(None)
                raise TimeoutError(f"Execution stopped after {MAX_STEPS} steps (possible infinite loop).")

            snapshot_vars = snapshot_locals(frame)
            step = {
                "step": step_counter["n"],
                "line": frame.f_lineno,
                "variables": snapshot_vars,
            }
            if call_stack:
                call_stack[-1]["args"] = snapshot_vars
                step["call_stack"] = [dict(f) for f in call_stack]
                step["call_stack_depth"] = len(call_stack)
            steps.append(step)
            return tracer

        if event == "return":
            if call_stack:
                finished = call_stack.pop()
                step_counter["n"] += 1
                try:
                    return_snapshot = _safe_snapshot(arg)
                except Exception:
                    return_snapshot = {"type": "object", "value": str(arg)}
                steps.append({
                    "step": step_counter["n"],
                    "line": frame.f_lineno,
                    # Wrapped in the same {type, value} shape as every other
                    # variable snapshot — the frontend's StructureView/
                    # VariablesPanel always destructure {type, value}, so a
                    # bare raw value here rendered as "NUMBER / undefined".
                    "variables": {"return_value": return_snapshot},
                    "event": "return",
                    "function": finished["function"],
                    "call_stack_depth": len(call_stack),
                })
            return tracer

        return tracer

    restricted_globals = {"__builtins__": _SAFE_BUILTINS, "__name__": "__main__"}
    stdout_capture = io.StringIO()

    old_trace = sys.gettrace()
    try:
        compiled = compile(code, "<custom_user_code>", "exec")
    except SyntaxError as e:
        return {"error": f"Syntax error: {e}"}

    try:
        sys.settrace(tracer)
        with contextlib.redirect_stdout(stdout_capture):
            exec(compiled, restricted_globals)
    except TimeoutError as e:
        return {"error": str(e), "trace": steps, "stdout": stdout_capture.getvalue()}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}", "trace": steps, "stdout": stdout_capture.getvalue()}
    finally:
        sys.settrace(old_trace)

    return {"trace": steps, "stdout": stdout_capture.getvalue()}
