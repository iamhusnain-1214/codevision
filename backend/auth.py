"""
auth.py — registration, login, and session handling via Supabase Auth.

Flow (now handled mostly by Supabase, not us):
  1. User registers -> Supabase creates the auth user, sends a
     verification email automatically (Confirm Email is on by default).
  2. User must click the email link before login succeeds. Supabase
     enforces this itself -- login attempts by unverified users fail
     with "Email not confirmed".
  3. User logs in -> Supabase returns an access_token (JWT) + refresh_token.
     Frontend stores + sends access_token as "Authorization: Bearer <token>"
     same as before.
  4. Every protected route uses @token_required, which now verifies the
     token via Supabase's own auth.get_user() instead of our own decode.

We no longer store passwords or issue JWTs ourselves -- Supabase's
auth.users table (which we never touch directly) owns all of that.
Our own `profiles` table (see db.py) only holds app-specific fields.
"""

from functools import wraps
from flask import request, jsonify

import db
from db import get_client

_client = get_client()


def register_user(username, email, password):
    # Reject if username already taken in our profiles table first,
    # to give a clean error before even hitting Supabase.
    if db.get_profile_by_username(username):
        return None, "Username already taken"

    try:
        result = _client.auth.sign_up({
            "email": email,
            "password": password,
        })
    except Exception as e:
        # Supabase raises for things like "invalid email", "already registered", weak password, etc.
        return None, str(e)

    if not result.user:
        return None, "Could not create account (email may already be registered)"

    # Supabase's anti-enumeration protection: if this email is already
    # registered (even unconfirmed), sign_up() returns a user-*like* object
    # with a random id that was NEVER actually inserted into auth.users --
    # to avoid confirming to an attacker that the email exists. The
    # giveaway is an empty `identities` list. Trying to create a profile
    # for that fake id would fail with a foreign-key error, so catch it
    # here with a clear message instead.
    if not result.user.identities:
        return None, "This email is already registered — try logging in, or use 'Resend verification' if you haven't confirmed it yet"

    existing_profile = db.get_profile_by_id(result.user.id)
    if existing_profile:
        return result.user.id, None

    profile = db.create_profile(result.user.id, username)
    if profile is None:
        return None, "Account created but profile setup failed — contact support"

    return result.user.id, None


def login_user(email, password):
    try:
        result = _client.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
    except Exception as e:
        msg = str(e)
        if "Email not confirmed" in msg:
            return None, "Please verify your email before logging in — check your inbox"
        return None, "Invalid email or password"

    if not result.session:
        return None, "Invalid email or password"

    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "user_id": result.user.id,
    }, None


def resend_verification_email(email):
    try:
        _client.auth.resend({"type": "signup", "email": email})
        return True, None
    except Exception as e:
        return False, str(e)


def decode_token(token):
    """Verifies the Supabase-issued JWT and returns the user_id."""
    try:
        user_response = _client.auth.get_user(token)
        if not user_response or not user_response.user:
            return None, "Invalid token"
        return user_response.user.id, None
    except Exception as e:
        return None, str(e)


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        user_id, err = decode_token(token)
        if err:
            return jsonify({"error": err}), 401

        return f(current_user_id=user_id, *args, **kwargs)
    return decorated