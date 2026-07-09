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

GROK_API_KEY = os.environ.get("GROK_API_KEY", "")
GROK_MODEL = os.environ.get("GROK_MODEL", "grok-code-fast-1")

# --- Redis (caching / rate-limit quotas, added in a later step) --------
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")