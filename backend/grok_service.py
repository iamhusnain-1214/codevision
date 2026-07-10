"""
grok_service.py — fallback AI provider, used when Gemini is rate-limited
or unreachable. Uses the same prompts.py templates as gemini_service.py
so both providers are held to the exact same instructions — this is
Fehm's SECONDARY provider only, wired in via ai_orchestrator.py.

NOTE ON NAMING: this module is named after the GROK_API_KEY/GROK_MODEL
env vars already set up in Render, but the actual provider here is
GROQ (console.groq.com — fast inference cloud), not xAI's "Grok".
Groq's API is OpenAI-compatible: a standard chat/completions endpoint
with {model, messages, temperature}, and it supports a native JSON
response_format the same way OpenAI does, which we use here for the
same reason Gemini uses responseMimeType — force the shape at the API
level instead of hoping the prompt instruction is obeyed.
"""

import requests

from config import GROK_API_KEY, GROK_MODEL
from json_utils import extract_json
from prompts import explain_problem_prompt, complexity_prompt, debug_logic_prompt

GROK_URL = "https://api.groq.com/openai/v1/chat/completions"


class GrokError(Exception):
    pass


def _call_grok(prompt, max_tokens=2048):
    if not GROK_API_KEY:
        raise GrokError("GROK_API_KEY is not set — fallback provider unavailable.")

    payload = {
        "model": GROK_MODEL,
        "messages": [
            {"role": "system", "content": "Respond with ONLY raw JSON. No markdown fences, no commentary before or after the JSON object."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
        # Groq (OpenAI-compatible) supports forcing JSON output the same
        # way Gemini's responseMimeType does — belt and braces alongside
        # the system-prompt instruction above.
        "response_format": {"type": "json_object"},
    }

    try:
        resp = requests.post(
            GROK_URL,
            headers={"Authorization": f"Bearer {GROK_API_KEY}"},
            json=payload,
            timeout=30,
        )
    except requests.RequestException as e:
        raise GrokError(f"Could not reach Groq API: {e}")

    if resp.status_code == 429:
        raise GrokError("Groq rate limit hit.")
    if not resp.ok:
        raise GrokError(f"Groq API error ({resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise GrokError("Groq returned an unexpected response shape.")

    if not text or not text.strip():
        raise GrokError("Groq returned an empty response.")

    return text


def _extract(text):
    try:
        return extract_json(text, provider_name="Groq")
    except Exception as e:
        raise GrokError(str(e))


def explain_problem(problem_text):
    text = _call_grok(explain_problem_prompt(problem_text), max_tokens=2048)
    return _extract(text)


def compute_complexity(code, language):
    text = _call_grok(complexity_prompt(code, language), max_tokens=1024)
    return _extract(text)


def debug_logic(code, language, expected, actual):
    text = _call_grok(debug_logic_prompt(code, language, expected, actual), max_tokens=1024)
    return _extract(text)
