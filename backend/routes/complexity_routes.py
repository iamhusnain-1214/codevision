"""
routes/complexity_routes.py — /analyze-complexity
"""

from flask import Blueprint, request, jsonify
import auth
from complexity_analyzer import analyze_complexity

complexity_bp = Blueprint("complexity_bp", __name__)


@complexity_bp.route("/analyze-complexity", methods=["POST"])
@auth.token_required
def analyze(current_user_id):
    data = request.get_json(force=True)
    code = data.get("code", "")
    language = data.get("language", "python")
    if not code.strip():
        return jsonify({"error": "No code provided"}), 400
    if language not in ("python", "cpp"):
        return jsonify({"error": f"Unsupported language '{language}'"}), 400

    result = analyze_complexity(code, language)
    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)
