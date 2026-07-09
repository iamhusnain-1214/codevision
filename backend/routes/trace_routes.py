"""
routes/trace_routes.py — the core endpoint. Every module (array, graph,
tree, recursion, DP) goes through /run-trace. The `module` field in the
request decides which tracer file handles it. Every successful run is
auto-saved to MySQL under the logged-in user.
"""

from flask import Blueprint, request, jsonify
import auth
import db

import inspect

from tracer_array import ARRAY_ALGORITHMS, RECURSION_ALGORITHMS, DP_ALGORITHMS, trace_function, get_source_info
from tracer_graph import GRAPH_ALGORITHMS
from tracer_tree import TREE_ALGORITHMS

trace_bp = Blueprint("trace_bp", __name__)


@trace_bp.route("/run-trace", methods=["POST"])
@auth.token_required
def run_trace(current_user_id):
    data = request.get_json(force=True)
    module = data.get("module")
    algorithm = data.get("algorithm")
    user_input = data.get("input", {})

    if module not in ("array", "recursion", "dp", "graph", "tree"):
        return jsonify({"error": f"Unknown module '{module}'"}), 400

    try:
        trace, result = _dispatch(module, algorithm, user_input)
    except KeyError:
        return jsonify({"error": f"Unknown algorithm '{algorithm}' for module '{module}'"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db.save_run(current_user_id, module, algorithm, user_input, trace)

    source_info = _get_source(module, algorithm)

    return jsonify({"trace": trace, "result": result, **source_info})


def _get_source(module, algorithm):
    """Every module page needs the algorithm's own source to show in the
    code panel. array/recursion/dp are line-traced via sys.settrace, so
    get_source_info gives start_line too (lines up with each step's
    rel_line). graph/tree snapshot manually instead of line-by-line, so we
    still show the source for reading, just without a per-step active line.
    """
    try:
        if module == "array":
            return get_source_info(ARRAY_ALGORITHMS[algorithm])
        if module == "recursion":
            return get_source_info(RECURSION_ALGORITHMS[algorithm])
        if module == "dp":
            return get_source_info(DP_ALGORITHMS[algorithm])
        if module == "graph":
            return {"source": inspect.getsource(GRAPH_ALGORITHMS[algorithm]), "start_line": None}
        if module == "tree":
            return {"source": inspect.getsource(TREE_ALGORITHMS[algorithm]), "start_line": None}
    except Exception:
        pass
    return {"source": None, "start_line": None}


def _dispatch(module, algorithm, user_input):
    if module == "array":
        func = ARRAY_ALGORITHMS[algorithm]
        args = _array_args(algorithm, user_input)
        return trace_function(func, *args)

    if module == "recursion":
        func = RECURSION_ALGORITHMS[algorithm]
        n = user_input["n"]
        return trace_function(func, n, track_call_stack=True)

    if module == "dp":
        func = DP_ALGORITHMS[algorithm]
        if algorithm == "lcs":
            trace, result = trace_function(func, user_input["s1"], user_input["s2"])
        else:  # knapsack
            trace, result = trace_function(func, user_input["weights"], user_input["values"], user_input["capacity"])
        return trace, result

    if module == "graph":
        func = GRAPH_ALGORITHMS[algorithm]
        nodes, edges = user_input["nodes"], user_input["edges"]
        if algorithm in ("bfs", "dfs", "dijkstra", "bellman_ford"):
            return func(nodes, edges, user_input["start"])
        return func(nodes, edges)

    if module == "tree":
        func = TREE_ALGORITHMS[algorithm]
        if algorithm in ("bst_insert", "avl_insert", "heap_insert", "trie_insert"):
            return func(user_input["values"])
        return func(user_input["values"])  # segment/fenwick also take a values list


def _array_args(algorithm, user_input):
    arr = user_input.get("arr")
    if algorithm == "binary_search":
        return [list(arr), user_input["target"]]
    if algorithm == "sliding_window_max_sum":
        return [list(arr), user_input["k"]]
    if algorithm == "two_pointer_pair_sum":
        return [list(arr), user_input["target"]]
    return [list(arr)]


@trace_bp.route("/history", methods=["GET"])
@auth.token_required
def history(current_user_id):
    module = request.args.get("module")
    runs = db.get_run_history(current_user_id, module=module)
    return jsonify({"runs": runs})


@trace_bp.route("/history/<int:run_id>", methods=["GET"])
@auth.token_required
def history_detail(current_user_id, run_id):
    run = db.get_run_by_id(run_id, current_user_id)
    if not run:
        return jsonify({"error": "Run not found"}), 404

    # The row only stores module/algorithm/input/trace — everything the
    # module pages need to render an *exact* replay (source, start_line,
    # language, the original input) has to be reattached here, the same
    # way /run-trace attaches it on a live run. Without this, History can
    # only dump raw trace JSON since it has no source/activeLine/inputs.
    module = run["module"]
    input_data = run.get("input_data") or {}

    if module == "custom_code":
        # For custom_code, run["algorithm"] is actually the language
        # ('python' or 'cpp'), and the source is exactly what the user
        # submitted — no reconstruction needed, it's already saved verbatim.
        run["language"] = run["algorithm"]
        run["source"] = input_data.get("code", "")
        run["start_line"] = None
    else:
        source_info = _get_source(module, run["algorithm"])
        run["source"] = source_info.get("source")
        run["start_line"] = source_info.get("start_line")
        run["language"] = "python"  # only Python actually executes for these modules today

    return jsonify(run)


@trace_bp.route("/history/<int:run_id>", methods=["DELETE"])
@auth.token_required
def delete_history_run(current_user_id, run_id):
    deleted = db.delete_run(run_id, current_user_id)
    if not deleted:
        return jsonify({"error": "Run not found"}), 404
    return jsonify({"deleted": True, "id": run_id})


@trace_bp.route("/history", methods=["DELETE"])
@auth.token_required
def delete_history_all(current_user_id):
    module = request.args.get("module")
    count = db.delete_all_runs(current_user_id, module=module)
    return jsonify({"deleted": True, "count": count})
