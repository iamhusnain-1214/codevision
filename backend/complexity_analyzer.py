"""
complexity_analyzer.py — static analysis of pasted code. No AI here;
this is deterministic reasoning about code structure.

Python path: uses the built-in `ast` module (exact parse tree).
C++ path: `ast` can't parse C++, so we use a brace-depth heuristic
scanner instead — it can't reason as precisely as a real parser, but
it's dependency-free and good enough to catch nested loops and
self-recursive functions, which is what drives the Big-O verdict.
"""

import ast
import re


class ComplexityVisitor(ast.NodeVisitor):
    def __init__(self):
        self.max_loop_depth = 0
        self.current_loop_depth = 0
        self.has_recursion = False
        self.has_halving = False
        self.function_names = set()
        self.recursive_calls = []
        self.loop_details = []

    def visit_FunctionDef(self, node):
        self.function_names.add(node.name)
        self.generic_visit(node)

    def visit_For(self, node):
        self._enter_loop(node, "for")

    def visit_While(self, node):
        if _loop_body_halves(node.body):
            self.has_halving = True
        self._enter_loop(node, "while")

    def _enter_loop(self, node, kind):
        self.current_loop_depth += 1
        self.max_loop_depth = max(self.max_loop_depth, self.current_loop_depth)
        self.loop_details.append({"type": kind, "line": node.lineno, "depth": self.current_loop_depth})
        self.generic_visit(node)
        self.current_loop_depth -= 1

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id in self.function_names:
            self.has_recursion = True
            self.recursive_calls.append(node.lineno)
        self.generic_visit(node)


def _is_const_two(node):
    return isinstance(node, ast.Constant) and node.value == 2


def _loop_body_halves(body):
    """True if the loop body either (a) directly halves some variable each
    iteration (`x //= 2`, `x = x // 2`, `x >>= 1`), or (b) follows the
    classic binary-search shape: a midpoint computed as (low + high) // 2.
    Either pattern means the search space shrinks geometrically, so a
    single such loop is O(log n), not O(n) — a plain loop-depth count
    can't tell the difference, which is exactly why binary search used to
    get flagged as O(n).
    """
    for stmt in body:
        for node in ast.walk(stmt):
            # x //= 2  |  x >>= 1
            if isinstance(node, ast.AugAssign) and isinstance(node.op, (ast.FloorDiv, ast.Div, ast.RShift)):
                if isinstance(node.op, ast.RShift):
                    if isinstance(node.value, ast.Constant) and node.value.value == 1:
                        return True
                elif _is_const_two(node.value):
                    return True
            # x = x // 2  |  x = x >> 1
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.BinOp):
                op = node.value.op
                if isinstance(op, ast.RShift) and isinstance(node.value.right, ast.Constant) and node.value.right.value == 1:
                    return True
                if isinstance(op, (ast.FloorDiv, ast.Div)) and _is_const_two(node.value.right):
                    # mid = (low + high) // 2 also matches here since the
                    # right side is still "/ 2" — this single check covers
                    # both the direct-halving and binary-search-midpoint shapes.
                    return True
    return False


def analyze_complexity(code, language="python"):
    """Dispatches to the right analyzer. `language` is 'python' or 'cpp'."""
    if language == "cpp":
        return _analyze_cpp(code)
    return _analyze_python(code)


def _analyze_python(code):
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {"error": f"Syntax error: {e}"}

    # First pass: collect function names so recursive calls can be detected
    visitor = ComplexityVisitor()
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            visitor.function_names.add(node.name)

    visitor.visit(tree)

    # --- Heuristic time complexity ---
    if visitor.has_recursion:
        # crude divide-and-conquer detection: recursive call inside a function
        # that also slices/halves its input is treated as O(n log n),
        # otherwise assume O(2^n) branching or O(n) linear recursion based on call count
        time_estimate = "O(2^n)" if len(visitor.recursive_calls) > 1 else "O(n)"
        reason = (
            "Recursion detected. Multiple recursive calls per function suggest "
            "exponential branching; a single recursive call per function suggests linear recursion."
            if len(visitor.recursive_calls) > 1
            else "Single recursive call per function detected — behaves like a linear chain of calls."
        )
    elif visitor.max_loop_depth >= 3:
        time_estimate = "O(n^3) or higher"
        reason = f"{visitor.max_loop_depth} nested loops detected."
    elif visitor.max_loop_depth == 2:
        time_estimate = "O(n^2)"
        reason = "Two nested loops detected."
    elif visitor.max_loop_depth == 1 and visitor.has_halving:
        time_estimate = "O(log n)"
        reason = "A single loop that halves its search range each iteration was detected (binary-search-style)."
    elif visitor.max_loop_depth == 1:
        time_estimate = "O(n)"
        reason = "A single loop over the input detected."
    else:
        time_estimate = "O(1)"
        reason = "No loops or recursion detected."

    # --- Heuristic space complexity ---
    space_estimate = "O(n)" if ("[]" in code or "list(" in code or "{}" in code) else "O(1)"
    if visitor.has_recursion:
        space_estimate += " + O(depth) recursion stack"

    return {
        "time_complexity": time_estimate,
        "space_complexity": space_estimate,
        "reason": reason,
        "details": {
            "max_loop_depth": visitor.max_loop_depth,
            "loops": visitor.loop_details,
            "has_recursion": visitor.has_recursion,
            "recursive_call_lines": visitor.recursive_calls,
            "has_halving": visitor.has_halving,
        },
    }


_LOOP_KEYWORD_RE = re.compile(r"\b(for|while)\s*\(")
_FUNC_DEF_RE = re.compile(r"\b[\w:<>,\s\*&]+?\s+(\w+)\s*\([^;{}]*\)\s*\{")
_KEYWORDS_NOT_FUNCS = {"if", "for", "while", "switch", "catch", "return"}

# Same idea as the Python `_loop_body_halves` check, just as regexes since
# there's no real parse tree for C++ here: catches `x /= 2`, `x >>= 1`,
# `x = x / 2`, `x = x >> 1`, and the classic binary-search midpoint
# `mid = (low + high) / 2` (which is still just "assigned = ... / 2").
_HALVING_RES = [
    re.compile(r"\w+\s*/=\s*2\b"),
    re.compile(r"\w+\s*>>=\s*1\b"),
    re.compile(r"=\s*[^;{}]*?/\s*2\s*;"),
    re.compile(r"=\s*[^;{}]*?>>\s*1\s*;"),
]


def _contains_halving(text):
    return any(pat.search(text) for pat in _HALVING_RES)


def _strip_cpp_comments(code):
    code = re.sub(r"/\*.*?\*/", "", code, flags=re.S)
    code = re.sub(r"//.*", "", code)
    return code


def _analyze_cpp(code):
    if not code.strip():
        return {"error": "No code provided"}

    code = _strip_cpp_comments(code)

    # crude brace-matching sanity check so obviously broken input gets a clear error
    if code.count("{") == 0 and ("for" in code or "while" in code):
        return {"error": "Syntax error: no function/loop bodies found (missing braces?)"}

    def _matching_paren(text, open_idx):
        depth = 0
        i = open_idx
        while i < len(text):
            if text[i] == "(":
                depth += 1
            elif text[i] == ")":
                depth -= 1
                if depth == 0:
                    return i
            i += 1
        return len(text) - 1

    def _find_stmt_end(text, pos):
        """Return the index just past the statement/block starting at `pos`
        (after skipping leading whitespace). Handles a brace block, a
        header-based construct (if/for/while/switch, optionally chained
        with else, or do-while), or a plain `;`-terminated statement —
        which is what a brace-less loop body actually is. This is what
        lets a loop with no `{}` around its single-line body still get
        measured correctly, instead of silently vanishing like before.
        """
        n = len(text)
        while pos < n and text[pos] in " \t\r\n":
            pos += 1
        if pos >= n:
            return pos

        if text[pos] == "{":
            return _matching_brace(text, pos) + 1

        header_m = re.match(r"(if|for|while|switch)\s*\(", text[pos:])
        if header_m:
            paren_open = pos + header_m.end() - 1
            paren_close = _matching_paren(text, paren_open)
            end = _find_stmt_end(text, paren_close + 1)
            if header_m.group(1) == "if":
                # optional trailing "else <stmt>"
                probe = end
                while probe < n and text[probe] in " \t\r\n":
                    probe += 1
                if text[probe:probe + 4] == "else" and (probe + 4 >= n or not (text[probe + 4].isalnum() or text[probe + 4] == "_")):
                    end = _find_stmt_end(text, probe + 4)
            return end

        if text[pos:pos + 2] == "do" and (pos + 2 >= n or not (text[pos + 2].isalnum() or text[pos + 2] == "_")):
            body_end = _find_stmt_end(text, pos + 2)
            probe = body_end
            while probe < n and text[probe] in " \t\r\n":
                probe += 1
            while_m = re.match(r"while\s*\(", text[probe:])
            if while_m:
                paren_open = probe + while_m.end() - 1
                paren_close = _matching_paren(text, paren_open)
                semi = text.find(";", paren_close + 1)
                return (semi + 1) if semi != -1 else paren_close + 1
            return body_end

        # plain statement: scan to the next top-level ';', respecting
        # nested parens/brackets/braces (e.g. initializer lists) along the way
        depth = 0
        i = pos
        while i < n:
            c = text[i]
            if c in "([{":
                depth += 1
            elif c in ")]}":
                depth -= 1
            elif c == ";" and depth <= 0:
                return i + 1
            i += 1
        return n

    def _matching_brace(text, open_idx):
        depth = 0
        i = open_idx
        while i < len(text):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    return i
            i += 1
        return len(text) - 1

    # A call only counts as recursion if it appears INSIDE that function's
    # own body (found via real brace matching) — not just anywhere later in
    # the file, which would wrongly flag every function that gets called
    # from main() as "recursive".
    has_recursion = False
    recursive_calls = []
    for m in _FUNC_DEF_RE.finditer(code):
        name = m.group(1)
        if name in _KEYWORDS_NOT_FUNCS:
            continue
        brace_open = m.end() - 1
        brace_close = _matching_brace(code, brace_open)
        body = code[brace_open:brace_close]
        for call in re.finditer(rf"\b{re.escape(name)}\s*\(", body):
            has_recursion = True
            abs_pos = brace_open + call.start()
            recursive_calls.append(code.count("\n", 0, abs_pos) + 1)

    # For every for/while header found anywhere in the code, work out the
    # span of its body (braced or not — see _find_stmt_end), then a loop's
    # depth is just 1 + how many *other* loop bodies contain its header.
    # This replaces the old "must have '{' right after the header" scan,
    # which silently missed any brace-less single-statement loop body
    # (extremely common C++: `for (int x : v) ans += x;`).
    loop_spans = []  # (header_pos, body_start, body_end, line)
    for m in _LOOP_KEYWORD_RE.finditer(code):
        paren_open = m.end() - 1
        paren_close = _matching_paren(code, paren_open)
        body_start = paren_close + 1
        body_end = _find_stmt_end(code, body_start)
        line = code.count("\n", 0, m.start()) + 1
        loop_spans.append((m.start(), body_start, body_end, line))

    max_loop_depth = 0
    loop_details = []
    for header_pos, _, _, line in loop_spans:
        depth = 1 + sum(
            1 for (h2, bs2, be2, _) in loop_spans
            if h2 != header_pos and bs2 <= header_pos < be2
        )
        max_loop_depth = max(max_loop_depth, depth)
        loop_details.append({"type": "loop", "line": line, "depth": depth})
    loop_details.sort(key=lambda d: d["line"])

    if has_recursion:
        time_estimate = "O(2^n)" if len(recursive_calls) > 1 else "O(n)"
        reason = (
            "Recursion detected. Multiple recursive call sites suggest exponential "
            "branching; a single recursive call site suggests linear recursion."
            if len(recursive_calls) > 1
            else "Single recursive call site detected — behaves like a linear chain of calls."
        )
    elif max_loop_depth >= 3:
        time_estimate = "O(n^3) or higher"
        reason = f"{max_loop_depth} nested loops detected."
    elif max_loop_depth == 2:
        time_estimate = "O(n^2)"
        reason = "Two nested loops detected."
    elif max_loop_depth == 1 and _contains_halving(code):
        time_estimate = "O(log n)"
        reason = "A single loop that halves its search range each iteration was detected (binary-search-style)."
    elif max_loop_depth == 1:
        time_estimate = "O(n)"
        reason = "A single loop over the input detected."
    else:
        time_estimate = "O(1)"
        reason = "No loops or recursion detected."

    def _strip_signature_params(text):
        # Blank out the parenthesized parameter list of any "(...) {" that
        # looks like a function signature, so container *types* used only
        # as parameters (very commonly passed by reference, e.g.
        # `vector<int>& v`) don't get mistaken for a local allocation.
        out = []
        i = 0
        n = len(text)
        while i < n:
            if text[i] == "(":
                close = _matching_paren(text, i)
                j = close + 1
                while j < n and text[j] in " \t\r\n":
                    j += 1
                if j < n and text[j] == "{":
                    out.append("(" + " " * (close - i - 1) + ")")
                    i = close + 1
                    continue
            out.append(text[i])
            i += 1
        return "".join(out)

    space_scan_code = _strip_signature_params(code)
    space_estimate = "O(n)" if re.search(r"\b(vector|array|map|unordered_map|set|new\s)\b", space_scan_code) else "O(1)"
    if has_recursion:
        space_estimate += " + O(depth) recursion stack"

    return {
        "time_complexity": time_estimate,
        "space_complexity": space_estimate,
        "reason": reason,
        "details": {
            "max_loop_depth": max_loop_depth,
            "loops": loop_details,
            "has_recursion": has_recursion,
            "recursive_call_lines": recursive_calls,
        },
        "note": "C++ analysis uses a brace-depth heuristic, not a full parser — very unusual formatting may confuse it.",
    }
