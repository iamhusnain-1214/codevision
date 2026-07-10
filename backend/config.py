"""
config.py — all settings in one place. Reads from environment variables,
loaded here from a local .env file for local dev (never commit that file —
see .gitignore). In production (Railway/Render), set these same variable
names directly in the hosting platform's dashboard instead of a .env file.
"""

import os
from dotenv import load_dotenv

load_dotenv()  # reads backend/.env if present; does nothing if it's absent

# --- Supabase ---------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# --- Fehm (AI features) -------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

# Fallback provider is Groq (console.groq.com) — NOT xAI's "Grok". Env
# var names kept as GROK_* to match what's already set in Render; only
# the actual endpoint/model target Groq's API (see grok_service.py).
GROK_API_KEY = os.environ.get("GROK_API_KEY", "")
GROK_MODEL = os.environ.get("GROK_MODEL", "llama-3.3-70b-versatile")

# --- Redis (caching / rate-limit quotas) --------------------------------
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
