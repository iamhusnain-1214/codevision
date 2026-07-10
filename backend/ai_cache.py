"""
ai_cache.py — Redis-backed cache for Fehm's AI responses (explain/
complexity/debug). Two students pasting the same sample bug, or two
students independently googling the same LeetCode problem, is common —
caching identical requests means the second one costs zero API quota
and returns instantly.

DESIGN PRINCIPLE: caching is a performance/cost optimization, not a
correctness requirement. If Redis is down, slow, or misconfigured, every
function here degrades to "no cache" (returns None on read, silently
no-ops on write) rather than raising and breaking the actual AI request.
A cache outage should never become a Fehm outage.

Uses Upstash (or any standard Redis) via REDIS_URL from config.py.
"""

import hashlib
import json
import logging

import redis

from config import REDIS_URL

logger = logging.getLogger(__name__)

DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7  # 1 week — these prompts/answers don't go stale

_client = None
_connection_failed = False  # avoid retrying a broken connection on every single request


def _get_client():
    global _client, _connection_failed
    if _connection_failed:
        return None
    if _client is None:
        try:
            _client = redis.from_url(REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
            _client.ping()
        except Exception as e:
            logger.warning("Redis unavailable, caching disabled for this process: %s", e)
            _connection_failed = True
            _client = None
    return _client


def _cache_key(feature, *parts):
    """feature: 'explain' | 'complexity' | 'debug'. parts: the actual
    request content (problem text, or code+language+expected+actual).
    Hashed because raw code/problem text can be long and may contain
    characters Redis keys don't love."""
    raw = feature + "|" + "|".join(parts)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"fehm:{feature}:{digest}"


def get_cached(feature, *parts):
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(_cache_key(feature, *parts))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.warning("Redis read failed, falling back to a live call: %s", e)
        return None


def set_cached(feature, *parts, value, ttl=DEFAULT_TTL_SECONDS):
    client = _get_client()
    if client is None:
        return
    try:
        client.set(_cache_key(feature, *parts), json.dumps(value), ex=ttl)
    except Exception as e:
        logger.warning("Redis write failed (non-fatal, response still returned to user): %s", e)
