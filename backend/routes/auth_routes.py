"""
routes/auth_routes.py — /register, /login, /me, /resend-verification

Note: login is now by EMAIL, not username (Supabase Auth requirement).
Frontend's Login.jsx needs its field relabeled/renamed from
"username" to "email" accordingly — flag this to update there too.
"""

from flask import Blueprint, request, jsonify
import auth
import db

auth_bp = Blueprint("auth_bp", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"error": "username, email, and password are required"}), 400

    user_id, err = auth.register_user(username, email, password)
    if err:
        return jsonify({"error": err}), 400

    return jsonify({
        "message": "Account created — please check your email to verify before logging in.",
        "user_id": user_id,
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    session, err = auth.login_user(email, password)
    if err:
        return jsonify({"error": err}), 401

    # Frontend should store access_token and send it as
    # "Authorization: Bearer <access_token>" on protected routes.
    return jsonify(session)


@auth_bp.route("/resend-verification", methods=["POST"])
def resend_verification():
    data = request.get_json(force=True)
    email = data.get("email")
    if not email:
        return jsonify({"error": "email is required"}), 400

    ok, err = auth.resend_verification_email(email)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"message": "Verification email resent"})


@auth_bp.route("/me", methods=["GET"])
@auth.token_required
def me(current_user_id):
    profile = db.get_profile_by_id(current_user_id)
    if not profile:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify(profile)