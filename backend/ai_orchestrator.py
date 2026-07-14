"""
ai_orchestrator.py — Fehm's single entry point for all three AI features
(explain / complexity / debug). This is the ONLY module fehm_routes.py
should import from now — it owns the full resilience chain:

    1. Check Redis cache for this exact request -> return instantly if hit
    2. Try Gemini (primary provider)
    3. If Gemini fails (rate limit, error, bad JSON), try Grok (fallback)
    4. Cache whichever provider succeeded
    5. If BOTH fail, raise one clear error

Each response carries a "source" field ("cache" | "gemini" | "grok") so
the frontend/logs can see which path served a given request — useful for
noticing "we're falling back to Grok a lot" as an early warning sign
Gemini's free tier is getting tight.
"""

import logging

import db
import gemini_service
import grok_service
from ai_cache import get_cached, set_cached

logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """Raised only when every provider in the chain has failed."""
    pass


def _run_with_fallback(feature, cache_parts, gemini_fn, grok_fn):
    cached = get_cached(feature, *cache_parts)
    if cached is not None:
        result = dict(cached)
        result["source"] = "cache"
        db.log_fehm_request(feature, "cache")
        return result

    gemini_error = None
    try:
        result = gemini_fn()
        result = dict(result)
        result["source"] = "gemini"
        set_cached(feature, *cache_parts, value=result)
        db.log_fehm_request(feature, "gemini")
        return result
    except gemini_service.GeminiError as e:
        gemini_error = str(e)
        logger.warning("Gemini failed for '%s', falling back to Grok: %s", feature, gemini_error)

    try:
        result = grok_fn()
        result = dict(result)
        result["source"] = "grok"
        result["gemini_error"] = gemini_error  # surfaced for transparency, not shown as a hard error
        set_cached(feature, *cache_parts, value=result)
        db.log_fehm_request(feature, "grok", error=f"Gemini fell back: {gemini_error}")
        return result
    except grok_service.GrokError as e:
        combined_error = f"Gemini: {gemini_error} | Grok: {e}"
        db.log_fehm_request(feature, "failed", error=combined_error)
        raise AIServiceError(f"Both AI providers are currently unavailable. {combined_error}")


def explain_problem(problem_text):
    return _run_with_fallback(
        "explain",
        [problem_text.strip()],
        gemini_fn=lambda: gemini_service.explain_problem(problem_text),
        grok_fn=lambda: grok_service.explain_problem(problem_text),
    )


def compute_complexity(code, language):
    return _run_with_fallback(
        "complexity",
        [code.strip(), language],
        gemini_fn=lambda: gemini_service.compute_complexity(code, language),
        grok_fn=lambda: grok_service.compute_complexity(code, language),
    )


def debug_logic(code, language, expected, actual):
    return _run_with_fallback(
        "debug",
        [code.strip(), language, expected.strip(), actual.strip()],
        gemini_fn=lambda: gemini_service.debug_logic(code, language, expected, actual),
        grok_fn=lambda: grok_service.debug_logic(code, language, expected, actual),
    )