#!/bin/bash
# verify_files.sh — run this from inside your backend/ folder to confirm
# every file was copied in correctly before you git push.
#
# Usage:
#   cd path/to/codevision2/backend
#   bash verify_files.sh

echo "=== Checking backend files ==="

check() {
    file="$1"
    marker="$2"
    label="$3"
    if [ ! -f "$file" ]; then
        echo "[MISSING] $file not found at all"
    elif grep -q "$marker" "$file" 2>/dev/null; then
        echo "[OK]      $file — $label"
    else
        echo "[STALE?]  $file exists but marker not found — $label — did you copy the NEW version in?"
    fi
}

check "config.py" "console.groq.com" "Groq config comment present"
check "gemini_service.py" "thought part" "thinking-part filter present"
check "tracer_custom_cpp.py" "_write_exec_wrapper" "sandbox wrapper present"
check "json_utils.py" "find_balanced_json_object" "new file present"
check "prompts.py" "def debug_logic_prompt" "new file present"
check "ai_cache.py" "DEFAULT_TTL_SECONDS" "new file present"
check "grok_service.py" "api.groq.com" "correct Groq endpoint present"
check "ai_orchestrator.py" "_run_with_fallback" "new file present"
check "requirements.txt" "^redis$" "redis dependency present"
check "routes/fehm_routes.py" "ai_orchestrator" "fehm_routes updated to use orchestrator"

echo ""
echo "=== Sanity check: does everything still import cleanly? ==="
python3 -c "
import sys
sys.path.insert(0, '.')
try:
    import json_utils, prompts, ai_cache, gemini_service, grok_service, ai_orchestrator
    print('[OK]      All new/updated modules import without errors')
except Exception as e:
    print('[ERROR]  ', type(e).__name__, '-', e)
"
