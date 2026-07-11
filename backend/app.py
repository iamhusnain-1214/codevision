"""
app.py — the Flask app entry point. Registers all route blueprints.
No business logic lives here directly.
"""

import time

from flask import Flask, jsonify
from flask_cors import CORS

from routes.auth_routes import auth_bp
from routes.trace_routes import trace_bp
from routes.complexity_routes import complexity_bp
from routes.custom_routes import custom_bp
from routes.fehm_routes import fehm_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(auth_bp)
app.register_blueprint(trace_bp)
app.register_blueprint(complexity_bp)
app.register_blueprint(custom_bp)
app.register_blueprint(fehm_bp)


# The cron-job.org pinger still hits this route every 10 minutes -- that
# cadence is what keeps Render itself from cold-starting, and that part is
# unchanged. What changed is what happens to Supabase on each of those
# pings: touching Supabase's DB on every single one (every 10 min, ~144
# times/day) turned out to be a plausible contributor to the intermittent
# "row-level security policy" errors on signup -- the shared client's
# pooled connection getting touched on a steady 10-minute idle/use cycle
# is exactly the pattern that can cause a pooled connection to go stale
# on Supabase's side (Supavisor). Supabase only actually needs to see
# activity once every several days to avoid its own 7-day auto-pause, so
# there's no reason to hit it anywhere near that often just for keep-alive.
_last_supabase_ping = {"time": 0}
SUPABASE_PING_INTERVAL = 3 * 60 * 60  # touch Supabase at most once every 3 hours


@app.route("/health")
def health():
    # Every request here (every ~10 min via cron) keeps Render's container
    # itself warm -- that part happens just by Flask responding, no
    # Supabase call required.
    supabase_status = "skipped (not due yet)"

    now = time.time()
    if now - _last_supabase_ping["time"] > SUPABASE_PING_INTERVAL:
        try:
            import db
            db.get_client().table("profiles").select("id").limit(1).execute()
            supabase_status = "ok"
            _last_supabase_ping["time"] = now
        except Exception as e:
            supabase_status = f"error: {e}"

    return jsonify({"status": "ok", "supabase": supabase_status})


if __name__ == "__main__":
    app.run(debug=True, port=5000)