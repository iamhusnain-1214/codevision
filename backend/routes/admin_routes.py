"""
routes/admin_routes.py — Phase 1: Algorithm Request Queue

User-facing (any logged-in user, via @auth.token_required):
  POST /algorithm-requests            submit a new request
  GET  /algorithm-requests            view all requests (to upvote instead of duplicating)
  POST /algorithm-requests/<id>/upvote

Admin-only (via @auth.admin_required, requires profiles.is_admin = true):
  PATCH /admin/algorithm-requests/<id>   update status + optional admin_response

Valid status values: pending | in_progress | added | rejected
"""

from flask import Blueprint, request, jsonify
import auth
import db
import health_state

admin_bp = Blueprint("admin_bp", __name__)

VALID_STATUSES = {"pending", "in_progress", "added", "rejected"}
VALID_MODULES = {"array", "recursion", "dp", "graph", "tree", "custom"}
VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}


# ------------------------------------------------------- user-facing

@admin_bp.route("/algorithm-requests", methods=["POST"])
@auth.token_required
def submit_algorithm_request(current_user_id):
    data = request.get_json(force=True)
    algorithm_name = (data.get("algorithm_name") or "").strip()
    target_module = (data.get("target_module") or "").strip().lower()
    notes = data.get("notes")

    if not algorithm_name or not target_module:
        return jsonify({"error": "algorithm_name and target_module are required"}), 400

    if target_module not in VALID_MODULES:
        return jsonify({"error": f"target_module must be one of: {', '.join(sorted(VALID_MODULES))}"}), 400

    request_row = db.create_algorithm_request(current_user_id, algorithm_name, target_module, notes)
    if request_row is None:
        return jsonify({"error": "Could not submit request"}), 500

    return jsonify(request_row), 201


@admin_bp.route("/algorithm-requests", methods=["GET"])
@auth.token_required
def list_algorithm_requests(current_user_id):
    # Any logged-in user can view the full queue -- lets them upvote an
    # existing request instead of filing a duplicate. Status filter is
    # optional, e.g. GET /algorithm-requests?status=pending
    status = request.args.get("status")
    if status and status not in VALID_STATUSES:
        return jsonify({"error": f"status must be one of: {', '.join(sorted(VALID_STATUSES))}"}), 400

    return jsonify(db.get_algorithm_requests(status))


@admin_bp.route("/algorithm-requests/<int:request_id>/upvote", methods=["POST"])
@auth.token_required
def upvote_algorithm_request(current_user_id, request_id):
    existing = db.get_algorithm_request_by_id(request_id)
    if not existing:
        return jsonify({"error": "Request not found"}), 404

    ok, err = db.upvote_algorithm_request(request_id, current_user_id)
    if not ok:
        return jsonify({"error": err}), 400

    return jsonify({"message": "Upvoted"})


# ------------------------------------------------------------ admin-only

@admin_bp.route("/admin/algorithm-requests/<int:request_id>", methods=["PATCH"])
@auth.admin_required
def update_algorithm_request(current_user_id, request_id):
    existing = db.get_algorithm_request_by_id(request_id)
    if not existing:
        return jsonify({"error": "Request not found"}), 404

    data = request.get_json(force=True)
    status = data.get("status")
    admin_response = data.get("admin_response")

    if status is None and admin_response is None:
        return jsonify({"error": "Provide at least one of: status, admin_response"}), 400

    if status is not None and status not in VALID_STATUSES:
        return jsonify({"error": f"status must be one of: {', '.join(sorted(VALID_STATUSES))}"}), 400

    updated = db.update_algorithm_request_status(
        request_id,
        status=status if status is not None else existing["status"],
        admin_response=admin_response,
    )
    if updated is None:
        return jsonify({"error": "Could not update request"}), 500

    return jsonify(updated)


# ============================================================
# Phase 2: Algorithm CRUD Management
#
# This table is a METADATA layer only (title/intuition/complexity/
# publish-toggle) for an algorithm whose trace logic already exists in
# tracer_*.py. Creating a row here does NOT make the backend able to
# trace a brand-new algorithm -- that still requires writing the actual
# tracer_*.py function and redeploying. This CRUD only controls how an
# already-coded algorithm is described and when it becomes visible.
# ============================================================

def _validate_algorithm_payload(data, require_all=False):
    """Shared validation for create/update. Returns (fields_dict, error) --
    error is None if valid. require_all=True enforces module/title present
    (used on create); on update, only whatever's provided is checked."""
    fields = {}

    module = data.get("module")
    if module is not None:
        if module not in VALID_MODULES:
            return None, f"module must be one of: {', '.join(sorted(VALID_MODULES))}"
        fields["module"] = module
    elif require_all:
        return None, "module is required"

    title = data.get("title")
    if title is not None:
        title = title.strip()
        if not title:
            return None, "title cannot be empty"
        fields["title"] = title
    elif require_all:
        return None, "title is required"

    difficulty = data.get("difficulty")
    if difficulty is not None:
        if difficulty not in VALID_DIFFICULTIES:
            return None, f"difficulty must be one of: {', '.join(sorted(VALID_DIFFICULTIES))}"
        fields["difficulty"] = difficulty

    steps = data.get("steps")
    if steps is not None:
        if not isinstance(steps, list):
            return None, "steps must be a list of strings"
        fields["steps"] = steps

    for key in ("intuition", "complexity_time", "complexity_space", "pitfalls"):
        if key in data:
            fields[key] = data[key]

    if "is_published" in data:
        fields["is_published"] = bool(data["is_published"])

    return fields, None


@admin_bp.route("/algorithms", methods=["GET"])
def list_public_algorithms():
    # No auth required -- this is the read path the live app itself would
    # use to show published algorithm metadata. Drafts are never returned
    # here regardless of who's asking.
    module = request.args.get("module")
    if module and module not in VALID_MODULES:
        return jsonify({"error": f"module must be one of: {', '.join(sorted(VALID_MODULES))}"}), 400
    return jsonify(db.get_algorithms(module=module, published_only=True))


@admin_bp.route("/admin/algorithms", methods=["GET"])
@auth.admin_required
def list_all_algorithms(current_user_id):
    # Admin sees drafts too, so they can stage new metadata before publishing.
    module = request.args.get("module")
    if module and module not in VALID_MODULES:
        return jsonify({"error": f"module must be one of: {', '.join(sorted(VALID_MODULES))}"}), 400
    return jsonify(db.get_algorithms(module=module, published_only=False))


@admin_bp.route("/admin/algorithms", methods=["POST"])
@auth.admin_required
def create_algorithm(current_user_id):
    data = request.get_json(force=True)
    id_ = (data.get("id") or "").strip()
    if not id_:
        return jsonify({"error": "id is required (must match the id used in tracer_*.py / ALGORITHMS)"}), 400

    if db.get_algorithm_by_id(id_):
        return jsonify({"error": f"An algorithm with id '{id_}' already exists"}), 409

    fields, err = _validate_algorithm_payload(data, require_all=True)
    if err:
        return jsonify({"error": err}), 400

    module = fields.pop("module")
    title = fields.pop("title")
    row = db.create_algorithm(id_, module, title, **fields)
    if row is None:
        return jsonify({"error": "Could not create algorithm"}), 500

    return jsonify(row), 201


@admin_bp.route("/admin/algorithms/<algorithm_id>", methods=["PATCH"])
@auth.admin_required
def update_algorithm(current_user_id, algorithm_id):
    existing = db.get_algorithm_by_id(algorithm_id)
    if not existing:
        return jsonify({"error": "Algorithm not found"}), 404

    data = request.get_json(force=True)
    fields, err = _validate_algorithm_payload(data, require_all=False)
    if err:
        return jsonify({"error": err}), 400

    if not fields:
        return jsonify({"error": "Provide at least one field to update"}), 400

    updated = db.update_algorithm(algorithm_id, **fields)
    if updated is None:
        return jsonify({"error": "Could not update algorithm"}), 500

    return jsonify(updated)


@admin_bp.route("/admin/algorithms/<algorithm_id>", methods=["DELETE"])
@auth.admin_required
def delete_algorithm(current_user_id, algorithm_id):
    existing = db.get_algorithm_by_id(algorithm_id)
    if not existing:
        return jsonify({"error": "Algorithm not found"}), 404

    ok = db.delete_algorithm(algorithm_id)
    if not ok:
        return jsonify({"error": "Could not delete algorithm"}), 500

    return jsonify({"message": "Deleted"})


# ============================================================
# Phase 3: Users Tab
#
# GET  /admin/users                       list all users
# POST /admin/users/<id>/ban               set is_banned = true
# POST /admin/users/<id>/unban             set is_banned = false
# POST /admin/users/<id>/reset-password    trigger Supabase's native reset email
#
# Reset password never lets the admin see or set an actual password --
# it only triggers the same "forgot password" email flow a user would
# trigger themselves, via profiles.email (not the admin.* API namespace,
# which has proven unreliable with our current key -- see db.py).
# ============================================================

@admin_bp.route("/admin/users", methods=["GET"])
@auth.admin_required
def list_users(current_user_id):
    return jsonify(db.get_all_profiles())


@admin_bp.route("/admin/users/<user_id>/ban", methods=["POST"])
@auth.admin_required
def ban_user(current_user_id, user_id):
    if user_id == current_user_id:
        return jsonify({"error": "You can't ban your own account"}), 400

    target = db.get_profile_by_id(user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    updated = db.set_banned(user_id, True)
    if updated is None:
        return jsonify({"error": "Could not ban user"}), 500
    return jsonify(updated)


@admin_bp.route("/admin/users/<user_id>/unban", methods=["POST"])
@auth.admin_required
def unban_user(current_user_id, user_id):
    target = db.get_profile_by_id(user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    updated = db.set_banned(user_id, False)
    if updated is None:
        return jsonify({"error": "Could not unban user"}), 500
    return jsonify(updated)


@admin_bp.route("/admin/users/<user_id>/reset-password", methods=["POST"])
@auth.admin_required
def reset_user_password(current_user_id, user_id):
    target = db.get_profile_by_id(user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    email = target.get("email")
    if not email:
        return jsonify({
            "error": "No email on file for this user (registered before email backfill) — "
                     "run the backfill SQL in supabase_schema.sql, then retry"
        }), 400

    ok, err = auth.trigger_password_reset(email)
    if not ok:
        return jsonify({"error": err or "Could not send reset email"}), 500

    return jsonify({"message": f"Password reset email sent to {email}"})


# ============================================================
# Phase 4: System Health Dashboard
#
# GET /admin/health — on-demand status of backend/Supabase/Redis, plus
# when /health was last hit by the cron-job.org uptime pinger.
#
# Supabase and Redis checks here are deliberately LIVE, ad-hoc checks
# every time this route is called (unlike app.py's /health, which
# throttles its Supabase touch to once per 3 hours to avoid the
# connection-staleness issue documented there). That's fine here because
# an admin opening this dashboard is inherently occasional, manual
# traffic -- nothing like the steady 10-minute cron cadence that caused
# problems.
#
# The Redis check also deliberately does NOT reuse ai_cache._get_client(),
# because that module sticks with "connection_failed = True" for the rest
# of the process once Redis fails once (by design, to avoid retrying a
# broken connection on every single Fehm request). That sticky flag would
# make this dashboard permanently show Redis as down even after it
# recovers, until the whole backend process restarts. A fresh redis-py
# connection attempt here always reflects the current, real state.
# ============================================================

@admin_bp.route("/admin/health", methods=["GET"])
@auth.admin_required
def system_health(current_user_id):
    import redis
    from config import REDIS_URL

    # Supabase — a cheap, real query using a fresh client (same pattern
    # used elsewhere in db.py to sidestep pooled-connection staleness).
    try:
        fresh = create_client_for_health_check()
        fresh.table("profiles").select("id").limit(1).execute()
        supabase_status = "ok"
        supabase_detail = None
    except Exception as e:
        supabase_status = "error"
        supabase_detail = str(e)

    # Redis (Upstash) — fresh connection, short timeout, never reuses
    # ai_cache's sticky failure flag (see docstring above).
    try:
        r = redis.from_url(REDIS_URL, socket_connect_timeout=3, socket_timeout=3)
        r.ping()
        redis_status = "ok"
        redis_detail = None
    except Exception as e:
        redis_status = "error"
        redis_detail = str(e)

    last_ping = health_state.get_last_ping()

    return jsonify({
        "backend": "ok",  # trivially true -- we're answering this request
        "supabase": {"status": supabase_status, "detail": supabase_detail},
        "redis": {"status": redis_status, "detail": redis_detail},
        "last_cron_ping": last_ping,  # unix timestamp, or null if never hit this process
    })


def create_client_for_health_check():
    from supabase import create_client
    from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ============================================================
# Phase 5: Custom Code Moderation
#
# GET /admin/custom-submissions — recent custom code submissions
# (success/error/timeout), optionally filtered by status. Read-only:
# there's no action to take here beyond viewing -- if a pattern of abuse
# shows up, that's handled via the existing Users tab (ban/suspend).
# ============================================================

VALID_SUBMISSION_STATUSES = {"success", "error", "timeout"}


@admin_bp.route("/admin/custom-submissions", methods=["GET"])
@auth.admin_required
def list_custom_submissions(current_user_id):
    status = request.args.get("status")
    if status and status not in VALID_SUBMISSION_STATUSES:
        return jsonify({"error": f"status must be one of: {', '.join(sorted(VALID_SUBMISSION_STATUSES))}"}), 400

    limit = request.args.get("limit", default=100, type=int)
    limit = max(1, min(limit, 500))

    return jsonify(db.get_custom_submissions(status=status, limit=limit))


# ============================================================
# Phase 6: Usage & Analytics
#
# GET /admin/analytics — most-used modules/algorithms (from the existing
# `runs` table), Fehm stats (cache hit rate, Gemini vs Grok ratio, from
# the new fehm_requests log), and a quick list of recent Fehm failures.
# ============================================================

@admin_bp.route("/admin/analytics", methods=["GET"])
@auth.admin_required
def analytics(current_user_id):
    module_usage = db.get_module_usage_stats()
    fehm_stats = db.get_fehm_stats()

    total_fehm = fehm_stats["total"]
    cache_hits = fehm_stats["by_source"].get("cache", 0)
    cache_hit_rate = round(100 * cache_hits / total_fehm, 1) if total_fehm else None

    gemini_count = fehm_stats["by_source"].get("gemini", 0)
    grok_count = fehm_stats["by_source"].get("grok", 0)
    live_calls = gemini_count + grok_count  # excludes cache hits and total failures
    grok_fallback_rate = round(100 * grok_count / live_calls, 1) if live_calls else None

    return jsonify({
        "module_usage": module_usage,
        "fehm": {
            "total_requests": total_fehm,
            "by_source": fehm_stats["by_source"],
            "by_feature": fehm_stats["by_feature"],
            "cache_hit_rate_pct": cache_hit_rate,
            "grok_fallback_rate_pct": grok_fallback_rate,
            "recent_errors": fehm_stats["recent_errors"],
        },
    })