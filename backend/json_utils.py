"""
json_utils.py — shared JSON-extraction logic used by both gemini_service.py
and grok_service.py, since both providers are prompted to return raw JSON
and both can (rarely) wrap it in fences or append trailing text.

Pulled out of gemini_service.py so Grok doesn't need its own copy — one
place to fix if a new failure mode shows up, instead of two.
"""

import json
import re


class AIJSONError(Exception):
    pass


def find_balanced_json_object(text):
    """Scans for the first top-level {...} object using actual brace
    depth-counting (respecting quoted strings), instead of a greedy regex
    that would match from the FIRST '{' to the LAST '}' in the whole
    string and swallow any trailing content the model appended."""
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


def extract_json(text, provider_name="AI provider"):
    """Strips markdown fences defensively, then parses. Falls back to a
    balanced-brace scan if the model appended anything after the JSON."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        candidate = find_balanced_json_object(cleaned)
        if candidate:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
        raise AIJSONError(f"{provider_name} did not return valid JSON.")
