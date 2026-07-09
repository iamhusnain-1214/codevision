"""
routes/fehm_routes.py — /fehm/explain-problem, /fehm/analyze-complexity, /fehm/debug-logic

Fehm (فہم — Urdu for "understanding") is CodeVision's AI logic coach.
This blueprint is intentionally thin: all prompt-building and Gemini
calls live in gemini_service.py. This file just validates input, calls
the right service, and shapes the HTTP response.
"""

from flask import Blueprint, request, jsonify
import auth
from gemini_service import explain_problem, compute_complexity, debug_logic, GeminiError
from complexity_analyzer import analyze_complexity

fehm_bp = Blueprint("fehm_bp", __name__)


@fehm_bp.route("/fehm/explain-problem", methods=["POST"])
@auth.token_required
def explain_problem_route(current_user_id):
    data = request.get_json(force=True)
    problem = data.get("problem", "")
    if not problem.strip():
        return jsonify({"error": "No problem text provided"}), 400
    if len(problem) > 6000:
        return jsonify({"error": "Problem text is too long (6000 char max)"}), 400

    try:
        result = explain_problem(problem)
    except GeminiError as e:
        return jsonify({"error": str(e)}), 502

    return jsonify(result)


@fehm_bp.route("/fehm/analyze-complexity", methods=["POST"])
@auth.token_required
def analyze_complexity_route(current_user_id):
    """The authoritative complexity endpoint — Fehm computes the verdict
    itself (accounts for library-call complexity like .sort(), which the
    old pure-AST analyzer missed). The deterministic analyzer only runs
    as a fallback if Gemini is unreachable, clearly labeled as such.
    """
    data = request.get_json(force=True)
    code = data.get("code", "")
    language = data.get("language", "python")

    if not code.strip():
        return jsonify({"error": "No code provided"}), 400
    if language not in ("python", "cpp"):
        return jsonify({"error": f"Unsupported language '{language}'"}), 400

    try:
        result = compute_complexity(code, language)
        result["source"] = "fehm"
        return jsonify(result)
    except GeminiError as e:
        fallback = analyze_complexity(code, language)
        if "error" in fallback:
            return jsonify({"error": str(e)}), 502
        fallback["source"] = "static_fallback"
        fallback["fehm_error"] = str(e)
        return jsonify(fallback)


@fehm_bp.route("/fehm/debug-logic", methods=["POST"])
@auth.token_required
def debug_logic_route(current_user_id):
    """'Debug My Logic' mode — student's code gives wrong output, Fehm
    diagnoses the conceptual mistake (TA-office-hours style) instead of
    just rewriting their code."""
    data = request.get_json(force=True)
    code = data.get("code", "")
    language = data.get("language", "python")
    expected = data.get("expected", "")
    actual = data.get("actual", "")

    if not code.strip():
        return jsonify({"error": "No code provided"}), 400
    if not expected.strip() or not actual.strip():
        return jsonify({"error": "Please provide both expected and actual output"}), 400
    if language not in ("python", "cpp"):
        return jsonify({"error": f"Unsupported language '{language}'"}), 400

    try:
        result = debug_logic(code, language, expected, actual)
    except GeminiError as e:
        return jsonify({"error": str(e)}), 502

    return jsonify(result)
