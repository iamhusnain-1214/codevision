"""
health_state.py — tiny shared module so app.py's /health route and
routes/admin_routes.py's /admin/health route can both see "when was
/health last hit" without importing each other (app.py registers
admin_routes' blueprint, so admin_routes importing app.py back would be
circular).

This only tracks the raw ping timestamp -- the actual Supabase/Redis
status checks live in their own places (app.py's throttled Supabase
touch, admin_routes.py's on-demand admin health check).
"""

import time

_last_ping = {"time": None}


def record_ping():
    _last_ping["time"] = time.time()


def get_last_ping():
    """Returns a unix timestamp (float) or None if /health has never
    been hit since this process started."""
    return _last_ping["time"]
