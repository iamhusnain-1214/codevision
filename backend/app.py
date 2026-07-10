"""
app.py — the Flask app entry point. Registers all route blueprints.
No business logic lives here directly.
"""

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


@app.route("/health")
def health():
    # A plain Flask-only health check would keep Render awake but NOT
    # Supabase -- Supabase pauses free-tier projects after ~7 days with
    # zero API activity, regardless of whether Render itself is up. This
    # lightweight query touches Supabase on every health check, so a
    # single external uptime ping (e.g. cron-job.org hitting this URL
    # every few days) keeps both services alive together.
    supabase_status = "unknown"
    try:
        import db
        db.get_client().table("profiles").select("id").limit(1).execute()
        supabase_status = "ok"
    except Exception as e:
        supabase_status = f"error: {e}"

    return jsonify({"status": "ok", "supabase": supabase_status})


if __name__ == "__main__":
    app.run(debug=True, port=5000)