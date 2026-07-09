"""
routes/custom_routes.py — /run-custom-trace, powering Module 4
(Custom Code Visualizer). Supports both Python (sys.settrace, see
tracer_custom.py) and C++ (real compile + gdb/MI stepping, see
tracer_custom_cpp.py).
"""

from flask import Blueprint, request, jsonify
import auth
import db
from tracer_custom import run_custom_python_trace
from tracer_custom_cpp import run_custom_cpp_trace

custom_bp = Blueprint("custom_bp", __name__)


@custom_bp.route("/run-custom-trace", methods=["POST"])
@auth.token_required
def run_custom_trace(current_user_id):
    data = request.get_json(force=True)
    code = data.get("code", "")
    language = data.get("language", "python")

    if not code.strip():
        return jsonify({"error": "No code provided"}), 400

    if language == "python":
        result = run_custom_python_trace(code)
    elif language == "cpp":
        result = run_custom_cpp_trace(code)
    else:
        return jsonify({"error": f"Unsupported language '{language}'"}), 400

    if "trace" in result:
        db.save_run(current_user_id, "custom_code", language, {"code": code}, result["trace"])

    if "error" in result and "trace" not in result:
        return jsonify(result), 400

    return jsonify(result)
