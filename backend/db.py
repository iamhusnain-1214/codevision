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
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_client() -> Client:
    return _client


# ---------------------------------------------------------------- profiles

def create_profile(user_id: str, username: str, insert_retries: int = 8):
    """Called right after Supabase Auth signup succeeds, to store the
    app-specific fields (username, is_premium) tied to the new auth user.

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
    for attempt in range(insert_retries):
        try:
            result = _client.table("profiles").insert({
                "id": user_id,
                "username": username,
            }).execute()
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