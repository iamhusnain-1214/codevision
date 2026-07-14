"""
db.py — Supabase (Postgres) queries for everything except auth itself.

Auth (signup/login/email verification) is handled by Supabase Auth directly
-> see auth.py. This file only touches: profiles, runs, snippets.

Uses the SERVICE ROLE client, because our Flask backend is a trusted
server context validating its own JWTs (see auth.py's token_required),
not a per-request user session. Row-level security policies still apply
correctly because we always filter explicitly by user_id below — the
service key just lets our backend read/write on the user's behalf.

SCHEMA (run once in Supabase SQL Editor — see supabase_schema.sql):
  profiles(id uuid pk -> auth.users, username, is_premium, created_at)
  runs(id, user_id -> auth.users, module, algorithm, input_data, trace_data, created_at)
  snippets(id, user_id -> auth.users, title, language, code, created_at)
"""

import json
import time
from datetime import datetime, timezone
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_client() -> Client:
    return _client


# ---------------------------------------------------------------- profiles

def create_profile(user_id: str, username: str, email: str = None, insert_retries: int = 8):
    """Called right after Supabase Auth signup succeeds, to store the
    app-specific fields (username, is_premium, email) tied to the new auth user.

    email is stored here (duplicating auth.users.email) specifically so
    the Phase 3 admin "reset password" feature can call
    auth.reset_password_email() without ever needing the admin.*
    namespace, which -- per the note below -- doesn't reliably work with
    our current key.

    NOTE: an earlier version of this function tried to actively confirm
    the user was visible via _client.auth.admin.get_user_by_id() before
    attempting the insert. That call consistently failed with "User not
    allowed" regardless of timing -- the admin.* namespace doesn't accept
    our current key the way regular table operations do, so that check
    was pure dead weight (always failed, wasted ~10s every signup). It
    has been removed. This function now relies entirely on retrying the
    insert itself with backoff, which is the only operation we've
    actually observed succeeding after a delay.
    """
    # Uses its own freshly-created client rather than the shared module-level
    # _client. The shared client's connection pool gets touched every 10
    # minutes by the /health cron ping -- pooled connections that sit idle
    # between uses can go stale on Supabase's side (Supavisor), and reusing
    # one at the wrong moment has been a suspected contributor to the
    # intermittent RLS failures here. A fresh client per call sidesteps that.
    fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    payload = {"id": user_id, "username": username}
    if email is not None:
        payload["email"] = email

    for attempt in range(insert_retries):
        try:
            result = fresh_client.table("profiles").insert(payload).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"create_profile error (attempt {attempt + 1}/{insert_retries}):", e)
            if attempt < insert_retries - 1:
                time.sleep(min(1.3 * (attempt + 1), 8))  # 1.3s,2.6s,3.9s,5.2s,6.5s,7.8s,8s,8s
    return None


def get_profile_by_username(username: str):
    try:
        result = _client.table("profiles").select("*").eq("username", username).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print("get_profile_by_username error:", e)
        return None


def get_profile_by_id(user_id: str):
    try:
        result = _client.table("profiles").select("*").eq("id", user_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print("get_profile_by_id error:", e)
        return None


def set_premium(user_id: str, is_premium: bool = True):
    try:
        _client.table("profiles").update({"is_premium": is_premium}).eq("id", user_id).execute()
    except Exception as e:
        print("set_premium error:", e)


def get_all_profiles():
    """Admin-facing user list. Newest signups first.

    Uses a fresh client rather than the shared module-level _client --
    same reasoning as create_profile/create_algorithm elsewhere in this
    file: the shared client's pooled connection can go stale on
    Supabase's side (Supavisor), which has been an observed cause of
    queries silently behaving as if RLS-restricted instead of using the
    service role's full bypass."""
    try:
        fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        result = fresh_client.table("profiles").select("*").order("created_at", desc=True).execute()
        return result.data
    except Exception as e:
        print("get_all_profiles error:", e)
        return []


def set_banned(user_id: str, banned: bool):
    try:
        result = (
            _client.table("profiles")
            .update({"is_banned": banned})
            .eq("id", user_id)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        print("set_banned error:", e)
        return None


# ---------------------------------------------------------- custom code moderation

def log_custom_submission(user_id: str, language: str, code: str, status: str, error_message: str = None):
    """Called on EVERY /run-custom-trace request regardless of outcome --
    unlike save_run below (which only ever gets called on success), this
    is what the Phase 5 moderation dashboard reads, since the failing/
    suspicious submissions are exactly what moderation cares about.
    status must be one of: success | error | timeout."""
    try:
        fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        fresh_client.table("custom_code_submissions").insert({
            "user_id": user_id,
            "language": language,
            "code": code,
            "status": status,
            "error_message": error_message,
        }).execute()
    except Exception as e:
        # Logging failures should never break the actual code-run response
        # the user is waiting on -- print and move on, same philosophy as
        # ai_cache.py's "a cache outage should never become a Fehm outage".
        print("log_custom_submission error:", e)


def get_custom_submissions(status: str = None, limit: int = 100):
    try:
        fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        query = fresh_client.table("custom_code_submissions").select("*")
        if status:
            query = query.eq("status", status)
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data
    except Exception as e:
        print("get_custom_submissions error:", e)
        return []


# ---------------------------------------------------------------- analytics

def log_fehm_request(feature: str, source: str, error: str = None):
    """Called from ai_orchestrator.py on every Fehm request outcome --
    source is one of: cache | gemini | grok | failed. Logging failures
    here should never break the actual Fehm response the user is
    waiting on, same philosophy as log_custom_submission above."""
    try:
        fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        fresh_client.table("fehm_requests").insert({
            "feature": feature,
            "source": source,
            "error": error,
        }).execute()
    except Exception as e:
        print("log_fehm_request error:", e)


def get_module_usage_stats():
    """Counts of runs grouped by (module, algorithm), most-used first.
    Pulled from the existing `runs` table -- no new table needed, since
    every successful /run-trace call already saves a row there."""
    try:
        fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        result = fresh_client.table("runs").select("module, algorithm").execute()
    except Exception as e:
        print("get_module_usage_stats error:", e)
        return []

    counts = {}
    for row in result.data:
        key = (row["module"], row["algorithm"])
        counts[key] = counts.get(key, 0) + 1

    return sorted(
        [{"module": m, "algorithm": a, "count": c} for (m, a), c in counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )


def get_fehm_stats():
    """Aggregate counts by source (cache/gemini/grok/failed) and by
    feature (explain/complexity/debug), plus the most recent failures
    for a quick error-log glance."""
    try:
        fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        result = fresh_client.table("fehm_requests").select("*").order("created_at", desc=True).limit(2000).execute()
    except Exception as e:
        print("get_fehm_stats error:", e)
        return {"total": 0, "by_source": {}, "by_feature": {}, "recent_errors": []}

    rows = result.data
    by_source = {}
    by_feature = {}
    recent_errors = []

    for row in rows:
        by_source[row["source"]] = by_source.get(row["source"], 0) + 1
        by_feature[row["feature"]] = by_feature.get(row["feature"], 0) + 1
        if row.get("error") and len(recent_errors) < 20:
            recent_errors.append(row)

    return {
        "total": len(rows),
        "by_source": by_source,
        "by_feature": by_feature,
        "recent_errors": recent_errors,
    }


# ---------------------------------------------------------------- runs

def save_run(user_id: str, module: str, algorithm: str, input_data, trace_data):
    try:
        result = _client.table("runs").insert({
            "user_id": user_id,
            "module": module,
            "algorithm": algorithm,
            "input_data": json.dumps(input_data),
            "trace_data": json.dumps(trace_data),
        }).execute()
        return result.data[0]["id"] if result.data else None
    except Exception as e:
        print("save_run error:", e)
        return None


def get_run_history(user_id: str, module: str = None, limit: int = 50):
    try:
        query = (
            _client.table("runs")
            .select("id, module, algorithm, input_data, created_at")
            .eq("user_id", user_id)
        )
        if module:
            query = query.eq("module", module)
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data
    except Exception as e:
        print("get_run_history error:", e)
        return []


def get_run_by_id(run_id, user_id: str):
    try:
        result = (
            _client.table("runs")
            .select("*")
            .eq("id", run_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            return None
        row = result.data[0]
        row["input_data"] = json.loads(row["input_data"])
        row["trace_data"] = json.loads(row["trace_data"])
        return row
    except Exception as e:
        print("get_run_by_id error:", e)
        return None


def delete_run(run_id, user_id: str) -> bool:
    """Scoped to user_id so one user can never delete another's history,
    same guarantee as before, now double-enforced by RLS too."""
    try:
        result = (
            _client.table("runs")
            .delete()
            .eq("id", run_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        print("delete_run error:", e)
        return False


def delete_all_runs(user_id: str, module: str = None) -> int:
    try:
        query = _client.table("runs").delete().eq("user_id", user_id)
        if module:
            query = query.eq("module", module)
        result = query.execute()
        return len(result.data)
    except Exception as e:
        print("delete_all_runs error:", e)
        return 0


# --------------------------------------------------- algorithm requests

def create_algorithm_request(user_id: str, algorithm_name: str, target_module: str, notes: str = None):
    try:
        result = _client.table("algorithm_requests").insert({
            "user_id": user_id,
            "algorithm_name": algorithm_name,
            "target_module": target_module,
            "notes": notes,
        }).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print("create_algorithm_request error:", e)
        return None


def get_algorithm_requests(status: str = None):
    """Admin-facing list, newest first. Optionally filtered by status
    (pending | in_progress | added | rejected)."""
    try:
        query = _client.table("algorithm_requests").select("*")
        if status:
            query = query.eq("status", status)
        result = query.order("upvote_count", desc=True).order("created_at", desc=True).execute()
        return result.data
    except Exception as e:
        print("get_algorithm_requests error:", e)
        return []


def get_algorithm_request_by_id(request_id):
    try:
        result = _client.table("algorithm_requests").select("*").eq("id", request_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print("get_algorithm_request_by_id error:", e)
        return None


def update_algorithm_request_status(request_id, status: str, admin_response: str = None):
    """status must be one of: pending | in_progress | added | rejected."""
    try:
        payload = {
            "status": status,
            # Postgres only recognizes the bare word 'now' (no parens) as a
            # special timestamp literal -- 'now()' is NOT valid input for a
            # timestamp column and raises "invalid input syntax for type
            # timestamp". Generating the value in Python sidesteps that
            # entirely and works with any column type.
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if admin_response is not None:
            payload["admin_response"] = admin_response
        result = (
            _client.table("algorithm_requests")
            .update(payload)
            .eq("id", request_id)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        print("update_algorithm_request_status error:", e)
        return None


def upvote_algorithm_request(request_id, user_id: str):
    """Returns (ok, error_message). Fails cleanly if the user already
    voted, thanks to the (request_id, user_id) primary key on
    algorithm_request_votes -- Postgres raises a unique-violation which
    we catch and turn into a friendly message rather than a 500."""
    try:
        _client.table("algorithm_request_votes").insert({
            "request_id": request_id,
            "user_id": user_id,
        }).execute()
    except Exception as e:
        if "duplicate key" in str(e).lower() or "23505" in str(e):
            return False, "You've already upvoted this request"
        print("upvote_algorithm_request error:", e)
        return False, "Could not upvote"

    try:
        current = _client.table("algorithm_requests").select("upvote_count").eq("id", request_id).execute()
        if not current.data:
            return False, "Request not found"
        new_count = current.data[0]["upvote_count"] + 1
        _client.table("algorithm_requests").update({"upvote_count": new_count}).eq("id", request_id).execute()
        return True, None
    except Exception as e:
        print("upvote_algorithm_request count-update error:", e)
        return False, "Could not update vote count"


# ---------------------------------------------------------------- algorithms (Phase 2 CRUD)
# Metadata layer only — title/intuition/complexity/publish-toggle for an
# algorithm whose actual trace logic already exists in tracer_*.py. This
# table never contains executable code; publishing an id here just makes
# it show up in the frontend's metadata lookups (e.g. AlgorithmInfo.jsx),
# it does NOT make the backend able to trace an algorithm that isn't
# already implemented in tracer_*.py.

def create_algorithm(id_: str, module: str, title: str, insert_retries: int = 3, **fields):
    """fields may include: intuition, steps (list), complexity_time,
    complexity_space, pitfalls, difficulty, is_published (default False).

    Uses a fresh client + retry-with-backoff, same fix already proven for
    create_profile in this file: the shared client's pooled connection can
    go stale on Supabase's side (Supavisor) between uses, which has been
    an observed cause of spurious "row-level security policy" errors even
    on service-role writes that should otherwise bypass RLS entirely."""
    payload = {"id": id_, "module": module, "title": title, **fields}
    for attempt in range(insert_retries):
        try:
            fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            result = fresh_client.table("algorithms").insert(payload).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"create_algorithm error (attempt {attempt + 1}/{insert_retries}):", e)
            if attempt < insert_retries - 1:
                time.sleep(min(1.3 * (attempt + 1), 4))
    return None


def get_algorithms(module: str = None, published_only: bool = False):
    try:
        query = _client.table("algorithms").select("*")
        if module:
            query = query.eq("module", module)
        if published_only:
            query = query.eq("is_published", True)
        result = query.order("module").order("title").execute()
        return result.data
    except Exception as e:
        print("get_algorithms error:", e)
        return []


def get_algorithm_by_id(id_: str):
    try:
        result = _client.table("algorithms").select("*").eq("id", id_).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print("get_algorithm_by_id error:", e)
        return None


def update_algorithm(id_: str, **fields):
    """fields: any of module, title, intuition, steps, complexity_time,
    complexity_space, pitfalls, difficulty, is_published."""
    try:
        fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = (
            fresh_client.table("algorithms")
            .update(fields)
            .eq("id", id_)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        print("update_algorithm error:", e)
        return None


def delete_algorithm(id_: str) -> bool:
    try:
        fresh_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        result = fresh_client.table("algorithms").delete().eq("id", id_).execute()
        return len(result.data) > 0
    except Exception as e:
        print("delete_algorithm error:", e)
        return False


# ---------------------------------------------------------------- snippets

def save_snippet(user_id: str, title: str, language: str, code: str):
    try:
        result = _client.table("snippets").insert({
            "user_id": user_id,
            "title": title,
            "language": language,
            "code": code,
        }).execute()
        return result.data[0]["id"] if result.data else None
    except Exception as e:
        print("save_snippet error:", e)
        return None


def get_snippets(user_id: str):
    try:
        result = (
            _client.table("snippets")
            .select("id, title, language, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data
    except Exception as e:
        print("get_snippets error:", e)
        return []