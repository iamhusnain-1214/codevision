"""
gemini_service.py — thin wrapper around the Gemini API (free tier).

Model: gemini-3.1-flash-lite
  - Google's fastest current model, free-tier eligible.
  - We use the plain (non "-preview") model string since the preview
    endpoint variant is being sunset by Google.

This module is the ONLY place that talks to Gemini. Nothing else in the
backend should import `requests`/build the Gemini payload directly —
route files call the functions below and get back plain Python dicts.

Auth: reads GEMINI_API_KEY from the environment (see config.py). Get a
free key from Google AI Studio (https://aistudio.google.com/apikey) —
no credit card needed. IMPORTANT: keep this project's billing disabled,
or the free tier disappears for that Cloud project entirely.
"""

import json
import re
import requests

from config import GEMINI_API_KEY, GEMINI_MODEL

GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


class GeminiError(Exception):
    pass


def _call_gemini(prompt, thinking_level="low", max_output_tokens=2048):
    """Low-level call to the Gemini API. Returns the raw text response.

    thinking_level: 'minimal' | 'low' | 'medium' | 'high'
      - minimal/low: near-instant, fine for structured/short tasks
        (complexity explanations).
      - medium: a bit more reasoning depth, used for the Logic Coach,
        where the model needs to actually work out the problem pattern
        before it explains it.
    """
    if not GEMINI_API_KEY:
        raise GeminiError(
            "GEMINI_API_KEY is not set. Get a free key at "
            "https://aistudio.google.com/apikey and set it as an "
            "environment variable before starting the server."
        )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": max_output_tokens,
            "thinkingConfig": {"thinkingLevel": thinking_level},
            # Forces Gemini to emit ONLY a valid JSON value. Without this,
            # a model confident about a very famous problem (e.g. the
            # two_sum sample bug) can ignore the "don't add extra text"
            # prompt instruction and append trailing prose/fences, which
            # broke the old greedy _extract_json fallback below. This
            # fixes it at the source instead of just patching the parser.
            "responseMimeType": "application/json",
        },
    }

    try:
        resp = requests.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
            timeout=30,
        )
    except requests.RequestException as e:
        raise GeminiError(f"Could not reach Gemini API: {e}")

    if resp.status_code == 429:
        raise GeminiError(
            "Gemini free-tier rate limit hit — please wait a moment and try again."
        )
    if not resp.ok:
        raise GeminiError(f"Gemini API error ({resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    try:
        candidates = data["candidates"]
        parts = candidates[0]["content"]["parts"]
        # IMPORTANT: with thinkingConfig enabled, Gemini can return a
        # separate reasoning part tagged "thought": true alongside the
        # real answer part. Blindly joining every part's text (the old
        # behavior) glues that internal reasoning prose onto the actual
        # JSON answer before we ever try to parse it — which breaks
        # parsing regardless of responseMimeType or how forgiving the
        # extraction regex is, since the contamination happens upstream
        # of both. This was the real root cause of "Gemini did not
        # return valid JSON" (the two_sum sample uses thinking_level
        # "medium", which is exactly when a thought part shows up).
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    except (KeyError, IndexError):
        raise GeminiError("Gemini returned an unexpected response shape.")

    if not text.strip():
        raise GeminiError("Gemini returned an empty response — try again.")

    return text


def _find_balanced_json_object(text):
    """Scans for the first top-level {...} object using actual brace
    depth-counting (respecting quoted strings), instead of a greedy regex.

    The old greedy regex (opening brace .* closing brace, DOTALL) matched
    from the FIRST '{' to the LAST '}' in the whole string. That's fine if the response is
    pure JSON, but if Gemini ever appends anything after the JSON block
    (extra commentary, a second code fence, an example snippet with its
    own braces — which becomes more likely on problems the model is very
    confident about, like the two_sum sample bug), the greedy match
    swallows that trailing content's braces too and produces something
    json.loads() chokes on. Depth-counting stops at the FIRST object's own
    closing brace, so trailing junk after it is simply ignored.
    """
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def _extract_json(text):
    """Gemini is instructed to return raw JSON (and the API call now also
    sets responseMimeType: application/json), but models sometimes wrap
    it in ```json fences anyway — strip those defensively before parsing."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Last resort: grab just the first balanced {...} object, ignoring
        # any trailing content Gemini may have appended after it.
        candidate = _find_balanced_json_object(cleaned)
        if candidate:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
        raise GeminiError("Gemini did not return valid JSON.")


def explain_problem(problem_text):
    """Fehm's core feature: takes a raw DSA problem statement and returns
    a structured logic breakdown — pattern, plain-language walkthrough of
    the reasoning (not code), and pseudocode.
    """
    prompt = f"""You are Fehm ("فہم" — Urdu for "understanding"), an AI teacher \
inside a DSA learning platform called CodeVision. A student has pasted a \
programming problem. Your job is to build their LOGIC, not just hand them \
code.

Respond with ONLY raw JSON (no markdown fences, no commentary) matching \
exactly this shape:

{{
  "restated_problem": "one or two plain-English sentences restating what is actually being asked",
  "pattern": "the underlying technique/pattern, e.g. 'Sliding Window', 'Two Pointers', 'Dynamic Programming — 0/1 Knapsack', 'Binary Search on Answer'",
  "why_this_pattern": "1-3 sentences on what clue in the problem signals this pattern",
  "steps": [
    {{"title": "short step title", "explanation": "plain-language explanation of this step's reasoning, written like a teacher explaining on a whiteboard — describe WHAT is happening and WHY, not code"}},
    ...  (4-7 steps total, walking through the full logic from start to finish)
  ],
  "pseudocode": "clean, language-agnostic pseudocode as a single string with \\n line breaks — no real Python/C++ syntax, just plain algorithmic pseudocode",
  "time_complexity": "Big-O with a short reason",
  "space_complexity": "Big-O with a short reason",
  "common_mistakes": ["short bullet", "short bullet"]
}}

Rules:
- Do NOT include a full code solution in any language. Pseudocode only.
- Keep "explanation" fields concrete — refer to actual variables/indices you introduce (e.g. "left" and "right" pointers), not vague hand-waving.
- If the problem text is not actually a programming/DSA problem, still respond in this JSON shape but set "pattern" to "Not a recognizable DSA problem" and keep other fields short and honest.

Problem:
\"\"\"{problem_text.strip()}\"\"\"
"""
    text = _call_gemini(prompt, thinking_level="medium", max_output_tokens=2048)
    return _extract_json(text)


def compute_complexity(code, language):
    """Fehm computes the AUTHORITATIVE time/space complexity verdict itself
    (this is now the single source of truth the frontend displays) —
    it is not just explaining a pre-computed static-analysis result.

    This matters because naive AST/heuristic analysis of user-written
    loops/recursion misses complexity hiding inside standard-library calls
    (e.g. `.sort()`, `sorted()`, `list.sort()`, `set()` construction,
    `in` on a list, etc.) — Gemini reasons about the whole picture instead.
    """
    prompt = f"""You are Fehm, an AI teaching assistant inside CodeVision, \
a DSA visualizer. A student pasted the {language} code below. Compute the \
CORRECT Big-O time and space complexity yourself — do not assume there is \
no complexity just because the student didn't write an explicit loop or \
recursive call. In particular, account for:
- Standard library calls with their own complexity, e.g. `.sort()` / \
`sorted()` (O(n log n)), `in` membership checks on a list (O(n)), building \
a `set`/`dict` from an iterable (O(n)), string concatenation in a loop, etc.
- Nested loops, recursion, and any halving/binary patterns.
- The overall dominant term — always give the tightest correct upper bound.

Respond with ONLY raw JSON (no markdown fences, no commentary), matching exactly:

{{
  "time_complexity": "e.g. O(n log n)",
  "space_complexity": "e.g. O(n)",
  "reason": "2-4 sentences explaining WHY, in plain teacher-style language, referencing the actual lines/constructs (loops, recursion, or specific library calls) that drive the verdict",
  "walkthrough": [
    "short bullet describing what happens on the 1st pass/level",
    "short bullet describing what happens on further passes/levels",
    "short bullet tying it back to the final Big-O verdict"
  ],
  "key_lines": [
    {{"line": <line number, 1-indexed>, "why": "short reason this line matters, e.g. 'sort() here dominates the runtime'"}}
  ],
  "tip": "one short, encouraging, concrete tip — e.g. how to improve it, or confirmation it's already optimal"
}}

Rules:
- "key_lines" must reference REAL line numbers from the code as given (count from line 1).
- Be precise and honest — if the code is already optimal, say so in "tip" rather than inventing a fake improvement.

Code:
\"\"\"{code.strip()}\"\"\"
"""
    text = _call_gemini(prompt, thinking_level="low", max_output_tokens=1024)
    return _extract_json(text)


def debug_logic(code, language, expected, actual):
    """Fehm's 'Debug My Logic' mode. The student's code is producing the
    wrong output — diagnose the CONCEPTUAL mistake like a TA would during
    office hours, rather than just rewriting their code for them.
    """
    prompt = f"""You are Fehm, an AI teaching assistant inside CodeVision, \
a DSA visualizer. A student's {language} code is producing the wrong \
output. Diagnose the LOGICAL/CONCEPTUAL mistake the way a teaching \
assistant would during office hours — help them understand WHY it's \
wrong, don't just hand them corrected code.

Respond with ONLY raw JSON (no markdown fences), matching exactly:

{{
  "diagnosis": "1-3 sentences pinpointing the actual conceptual mistake (e.g. 'your loop condition lets the right pointer cross the left pointer' or 'you're not handling the empty-array base case') — be specific and reference real variable/line context from their code",
  "why_it_breaks": "1-3 sentences on WHY this causes the observed wrong output, connecting the mistake to the expected-vs-actual mismatch given",
  "guiding_questions": [
    "a Socratic question that nudges the student toward noticing the bug themselves, e.g. 'What happens to your left pointer when the array has only one element?'",
    "a second guiding question, different angle"
  ],
  "fix_hint": "a short, conceptual nudge toward the fix — NOT full corrected code, just the idea (e.g. 'Try adding a boundary check before comparing the two pointers')",
  "key_lines": [
    {{"line": <1-indexed line number>, "why": "short reason this specific line is where the bug lives"}}
  ]
}}

Rules:
- Never output a full corrected version of their code. Conceptual guidance only.
- If you cannot tell what's wrong from the given info, say so honestly in "diagnosis" and ask what input they tried, rather than guessing.

Code:
\"\"\"{code.strip()}\"\"\"

Expected output: {expected.strip()}
Actual output: {actual.strip()}
"""
    text = _call_gemini(prompt, thinking_level="medium", max_output_tokens=1024)
    return _extract_json(text)