"""
tracer_custom_cpp.py — real C++ execution tracing for the Custom Code
Visualizer (Module 4), the counterpart to tracer_custom.py's Python path.

APPROACH
--------
1. Compile the user's code with g++ -g -O0 (debug symbols, no optimizer
   reordering, so line numbers and locals stay meaningful).
2. Drive gdb through its machine interface (MI) via pygdbmi, single-
   stepping ("-exec-step") through the program.
3. Plain `step` also steps INTO every templated std:: call (vector,
   string, etc. all have line info because they're headers compiled
   into the user's own binary) — which would bury the trace in
   allocator internals. Instead of relying on gdb's `skip` command
   (unreliable with glob patterns in testing), we let `step` go wherever
   it wants, and the moment we land in a frame outside the user's own
   source file we immediately `-exec-finish` back out, repeatedly, until
   we're back in user code. This keeps every recorded step anchored to
   a real line the user wrote.
4. Consecutive stops that land on the very same (function, line) — which
   happens constantly, since a single source line like
   `current_sum = max(arr[i], current_sum + arr[i])` involves several
   step/finish round trips through operator[] and std::max — are
   collapsed into one trace entry, so the frontend sees one step per
   *statement*, matching the granularity of the Python tracer.
5. Locals are read with `-stack-list-variables --simple-values`, which
   gives clean values for primitives directly. For containers
   (vector/string/map) we separately evaluate the expression and parse
   gdb's own pretty-printed text (e.g. "std::vector of length 3, capacity
   4 = {1, 2, 3}") — this only handles one level of nesting; deeply
   nested containers fall back to showing the raw gdb text.
6. Target stdout arrives on the MI 'output' stream as the program runs
   and is accumulated verbatim.

SECURITY NOTE: same caveat as tracer_custom.py — this compiles and
*executes* arbitrary user-submitted C++ as a real native binary. It is
sandboxed with a CPU-time and address-space rlimit (see
`_limit_resources`) and a hard step ceiling, but this is a
classroom-tool safeguard, not a real sandbox (no seccomp/container/
network isolation). Don't expose this to the untrusted open internet
without wrapping it in proper OS-level isolation first.
"""

import os
import re
import shutil
import subprocess
import tempfile
import time

from pygdbmi.gdbcontroller import GdbController

MAX_STEPS = 800            # gdb-driven stepping is far slower than sys.settrace; keep this modest
COMPILE_TIMEOUT = 10       # seconds
STEP_TIMEOUT = 4           # seconds, per individual gdb command
WALL_CLOCK_BUDGET = 25     # seconds, whole trace

SOURCE_NAME = "user_code.cpp"
BINARY_NAME = "user_program.exe"  # the .exe suffix is required on Windows
                                  # (g++/MinGW appends it regardless of what
                                  # you pass to -o) and harmless on Linux/Mac,
                                  # so using it everywhere keeps gdb pointed
                                  # at the exact file g++ actually produced.


def _limit_resources():
    """preexec_fn for the compiled binary: cap CPU time and virtual memory
    so a runaway or hostile program can't consume the host. This runs in
    the forked child before exec, same spirit as tracer_custom.py's
    MAX_STEPS guard for the Python path."""
    import resource
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))


def _classify_cpp_type(type_str):
    t = (type_str or "").strip()
    # Reference/const/volatile qualifiers (`int &`, `const int&`, `int&`)
    # would otherwise fall through every check below to "object" — strip
    # them so a reference parameter is still recognized as its underlying
    # scalar type.
    core = re.sub(r"\b(const|volatile)\b", "", t).replace("&", "").strip()

    if core.startswith("int [") or core.startswith("double [") or core.startswith("char [") or re.search(r"\[\d+\]$", core):
        return "array"

    # GDB's type string for any container is its *fully expanded*
    # template signature — e.g. std::queue<int>'s is actually
    # "std::queue<int, std::deque<int, std::allocator<int> > >", and
    # std::unordered_map<std::string, int>'s key type expands out to
    # "std::__cxx11::basic_string<...>" buried inside it. A substring
    # search for "deque" or "basic_string" anywhere in that text matches
    # those buried occurrences and misclassifies the outer container —
    # so this checks what the type actually *is* (a prefix match on its
    # head, after stripping the std:: / std::__cxx11:: namespace) rather
    # than what substrings happen to appear anywhere inside it. Order
    # matters here too: more specific keywords (unordered_multimap) must
    # be checked before the shorter ones they contain (map).
    head = re.sub(r"^std::(__cxx11::)?", "", core)
    for kw, kind in (
        ("priority_queue", "priority_queue"),
        ("stack", "stack"),
        ("queue", "queue"),
        ("unordered_multiset", "hash_map"),
        ("unordered_multimap", "hash_map"),
        ("unordered_set", "hash_map"),
        ("unordered_map", "hash_map"),
        ("multiset", "hash_map"),
        ("multimap", "hash_map"),
        ("set", "hash_map"),
        ("map", "hash_map"),
        ("vector", "array"),
        ("deque", "array"),
        ("list", "array"),
        ("array", "array"),
        ("basic_string", "string"),
        ("pair", "pair"),
    ):
        if head.startswith(kw + "<") or head == kw:
            return kind

    if core in ("string", "std::string"):
        return "string"
    if core in ("int", "long", "long long", "unsigned int", "short", "size_t", "unsigned long", "unsigned short", "unsigned long long"):
        return "number"
    if core in ("float", "double"):
        return "number"
    if core == "bool":
        return "boolean"
    if core == "char":
        return "string"
    return "object"


_PRIMITIVE_POINTER_RE = re.compile(
    r"^(const\s+)?(int|long|long long|short|float|double|char|unsigned int|"
    r"unsigned long|unsigned short|unsigned long long|size_t)\s*\*+$"
)


def _looks_like_primitive_pointer(type_str):
    """A C-style array parameter like `int arr[]` decays to `int *` in the
    debug info — gdb then only ever gives us the pointer's address, never
    the array's contents, because a bare pointer carries no length. This
    just recognizes the shape so _read_variables can try recovering the
    actual elements using a sibling length parameter (see
    _read_pointer_array)."""
    return bool(_PRIMITIVE_POINTER_RE.match((type_str or "").strip()))


# Common parameter names for "the length that goes with this array" in
# typical DSA-style C++ (as opposed to Python, where len()/built-in
# containers make this unnecessary). This is a heuristic, not a real
# solution — a raw pointer fundamentally doesn't carry its own length.
_LENGTH_NAME_CANDIDATES = ("n", "len", "length", "size", "count", "cnt", "m", "k")


def _parse_gdb_value(kind, raw_value, is_map=False):
    """Turns gdb's own pretty-printed text for a value into the same
    {type, value} shape tracer_custom.py's _safe_snapshot produces, so
    the frontend's StructureView/VariablesPanel can render it exactly the
    same way regardless of which language produced the trace.

    Anything we can't confidently parse falls back to {"type": "string",
    value: raw_value} — NOT "object". The frontend's "object" renderer
    expects `value` to be a dict of named fields (for struct display) and
    will otherwise iterate a raw string character-by-character, which is
    where the wall of "0: undefined, 1: undefined, ..." came from."""
    if raw_value is None:
        return {"type": "string", "value": ""}

    if kind == "number":
        text = raw_value.strip()
        # References sometimes print as `@0xADDRESS: 5` instead of a bare
        # number — pull the trailing number out if present.
        m = re.search(r":\s*(-?\d+\.?\d*)\s*$", text)
        if m:
            text = m.group(1)
        try:
            return {"type": "number", "value": float(text) if "." in text else int(text)}
        except ValueError:
            return {"type": "string", "value": raw_value}

    if kind == "boolean":
        return {"type": "boolean", "value": raw_value.strip() in ("true", "1")}

    if kind == "string":
        m = re.search(r'"((?:[^"\\]|\\.)*)"', raw_value)
        return {"type": "string", "value": m.group(1) if m else raw_value}

    if kind == "array":
        # Two different gdb shapes land here: vector's pretty-print text
        # `std::vector of length 3, capacity 4 = {1, 2, 3}`, and a fixed
        # C-style array (`int[5]`) which gdb prints bare, with no leading
        # "=" at all: `{1, 2, 3, 4, 5}`. If neither shows up — which
        # happens for a vector that hasn't been constructed yet, at the
        # exact line that declares it — don't try to force-split whatever
        # garbage text we did get; that's how 20+ fake "undefined" array
        # entries appeared for one stack slot of uninitialized memory.
        m = re.search(r"=\s*\{(.*)\}\s*$", raw_value, re.DOTALL)
        if not m:
            m = re.match(r"^\{(.*)\}$", raw_value.strip(), re.DOTALL)
        if not m:
            return {"type": "string", "value": raw_value}
        items = _split_top_level(m.group(1))
        return {"type": "array", "value": [_parse_gdb_value(_guess_scalar_kind(v), v) for v in items]}

    if kind == "hash_map":
        # e.g. `std::map with 2 elements = {[1] = 2, [3] = 4}` — the
        # bracket really is the key there. But gdb's own printer for a
        # set/multiset ALSO uses `[i] = value` bracketing — except `i` is
        # just the bare position index (0, 1, 2, ...), not the element,
        # with the actual value living in the second half. Using that
        # bracket content as the key for a set silently throws the real
        # value away and displays a sequential index instead — so `is_map`
        # (known from the container's own declared type, not guessable
        # from this text alone) decides which half of `[i] = value` is
        # the thing actually worth keeping as the key.
        m = re.search(r"=\s*\{(.*)\}\s*$", raw_value, re.DOTALL)
        if not m:
            return {"type": "string", "value": raw_value}
        entries = _split_top_level(m.group(1))
        out = {}
        for entry in entries:
            entry = entry.strip()
            pm = re.match(r"\[(.*?)\]\s*=\s*(.*)", entry)
            if pm:
                bracket, val = pm.group(1).strip(), pm.group(2).strip()
                if is_map:
                    key_node = _parse_gdb_value(_guess_scalar_kind(bracket), bracket)
                    key_str = str(key_node.get("value", bracket))
                    out[key_str] = _parse_gdb_value(_guess_scalar_kind(val), val)
                else:
                    val_node = _parse_gdb_value(_guess_scalar_kind(val), val)
                    key_str = str(val_node.get("value", val))
                    out[key_str] = {"type": "boolean", "value": True}
            elif entry:
                out[entry] = {"type": "boolean", "value": True}
        return {"type": "hash_map", "value": out}



    if kind in ("stack", "queue", "priority_queue"):
        # gdb prints these adapters as e.g.
        # "std::stack wrapping: std::deque of length 3 = {1, 2, 3}" —
        # pull out whatever trailing {...} the wrapped container printed.
        m = re.search(r"=\s*\{(.*)\}\s*$", raw_value, re.DOTALL)
        if not m:
            return {"type": "string", "value": raw_value}
        items = _split_top_level(m.group(1))
        elems = [_parse_gdb_value(_guess_scalar_kind(v), v) for v in items]
        return {"type": kind, "value": elems}

    if kind == "pair":
        # e.g. `{first = 1, second = "abc"}`
        m = re.search(r"first\s*=\s*(.*?),\s*second\s*=\s*(.*)\}\s*$", raw_value, re.DOTALL)
        if m:
            first_raw, second_raw = m.group(1).strip(), m.group(2).strip()
            return {
                "type": "object",
                "value": {
                    "first": _parse_gdb_value(_guess_scalar_kind(first_raw), first_raw),
                    "second": _parse_gdb_value(_guess_scalar_kind(second_raw), second_raw),
                },
            }
        return {"type": "string", "value": raw_value}

    return {"type": "string", "value": raw_value}


def _guess_scalar_kind(text):
    text = text.strip()
    if text.startswith('"'):
        return "string"
    if "_M_dataplus" in text and "_M_p" in text:
        # gdb with no libstdc++ pretty-printer for std::string prints its
        # raw internal layout instead of "text" — but _M_p is a plain
        # char*, and gdb always shows a char* as `0xADDR "content"`
        # regardless of pretty-printers (that's basic pointer-to-char
        # handling, not a C++-aware feature), so the actual string
        # content is still recoverable from this dump; just needs the
        # quoted portion pulled out rather than the field names.
        return "string"
    if text in ("true", "false"):
        return "boolean"
    try:
        float(text)
        return "number"
    except ValueError:
        return "object"


def _split_top_level(text):
    """Splits a comma-joined gdb list on top-level commas only, respecting
    nested {}/[] so e.g. a vector-of-vectors doesn't get split in the
    middle of an inner group. One level of nesting only, see module note."""
    parts, depth, current = [], 0, ""
    for ch in text:
        if ch in "{[":
            depth += 1
        elif ch in "}]":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current)
    return [p.strip() for p in parts if p.strip()]


def _send_until_settled(gdb, cmd, initial_timeout, settle_budget=2.0):
    """Writes an MI command and keeps draining gdb's response stream until
    we see a 'stopped' or thread-group-exited notification, or run out of
    settle_budget. Needed because the fast polling interval (see
    _trace_binary) can return before gdb has finished emitting the async
    records for a command like -exec-run or -exec-finish, which arrive
    after some intermediate library-loaded notifications."""
    messages = gdb.write(cmd, timeout_sec=initial_timeout)
    deadline = time.time() + settle_budget
    while time.time() < deadline:
        if any(m.get("message") in ("stopped",) for m in messages):
            break
        if any(m.get("message") == "error" for m in messages):
            break
        messages += gdb.get_gdb_response(timeout_sec=0.05, raise_error_on_timeout=False)
    return messages


def _stopped_payload(messages):
    for m in messages:
        if m.get("message") == "stopped":
            return m["payload"]
    return None


def _collect_output(messages, sink):
    for m in messages:
        if m.get("type") == "output" and isinstance(m.get("payload"), str):
            sink.append(m["payload"])


def _program_exited(payload):
    if not payload:
        return False
    reason = payload.get("reason", "")
    return reason in ("exited-normally", "exited", "signal-received")


_CONTAINER_KEYWORDS = (
    "vector", "deque", "list", "unordered_multiset", "multiset", "unordered_set", "set",
    "unordered_multimap", "multimap", "unordered_map", "map",
    "priority_queue", "queue", "stack",
)

_ADAPTER_DEFAULT_CONTAINER = {
    "stack": "deque",
    "queue": "deque",
    "priority_queue": "vector",
}


def _find_container_decls(source):
    """Scans the raw source text for declarations like `stack<int> s;` or
    `map<string, int> m;` (with correct handling of nested angle brackets,
    e.g. `map<int, vector<int>>`, which a naive '<([^>]*)>' regex would
    mis-split on the first '>'). Returns a de-duplicated list of
    (keyword, element_type) pairs. This is a heuristic text scan, not a
    real parser — it's only used to decide which template instantiations
    to force (see _build_instantiation_preamble), so a missed or
    over-matched declaration just means one fewer container gets the
    fallback fast-path, not a correctness bug."""
    seen = set()
    decls = []
    for kw in _CONTAINER_KEYWORDS:
        for m in re.finditer(r"\b" + kw + r"\s*<", source):
            i = m.end()
            depth = 1
            while i < len(source) and depth > 0:
                if source[i] == "<":
                    depth += 1
                elif source[i] == ">":
                    depth -= 1
                i += 1
            if depth != 0:
                continue
            elem_type = source[m.end():i - 1].strip()
            rest = source[i:i + 80]
            if not re.match(r"\s*[&*]?\s*[A-Za-z_]\w*\s*[;=({]", rest):
                continue  # not actually a variable declaration at this spot
            key = (kw, elem_type)
            if elem_type and key not in seen:
                seen.add(key)
                decls.append(key)
    return decls


def _build_instantiation_preamble(source):
    """Builds a block of code that gets prepended to the user's source
    before compiling. It never runs (everything meaningful is inside
    `if (false)`), but the compiler still generates real machine code for
    whatever member functions it references — which is what makes them
    callable by gdb later. Without this, `.size()`, `.begin()`, `.end()`,
    etc. only exist in the binary if the user's own code happened to call
    them, since C++ templates only instantiate members that are actually
    used (ODR-use) — a `std::queue<int>` where the user only calls
    push/pop/front never gets a compiled `size()` at all, so gdb has
    nothing to call and _read_via_iteration would silently fail. This
    forces every detected container type's iteration interface to exist
    regardless of what the user's code happens to touch."""
    decls = _find_container_decls(source)
    if not decls:
        return "", 0

    lines = [
        "#include <vector>",
        "#include <deque>",
        "#include <list>",
        "#include <set>",
        "#include <map>",
        "#include <unordered_set>",
        "#include <unordered_map>",
        "#include <stack>",
        "#include <queue>",
        "#include <string>",
        "#include <utility>",
        "// The forced dummy declarations below copy element types verbatim",
        "// from the user's own code (e.g. `string`, not `std::string`), since",
        "// that's however the user actually wrote it. Rather than depend on",
        "// the user's own `using namespace std;` being in scope by the time",
        "// this preamble lands (fragile, and some MinGW libstdc++ header",
        "// layouts don't transitively expose <string> the way glibc++ does),",
        "// this preamble brings its own so bare `string`/`pair`/etc. always",
        "// resolve no matter where in the file it gets inserted.",
        "using namespace std;",
        "",
        "template <typename __CVContainer>",
        "static inline void __cv_touch_seq(__CVContainer& __cv_c) {",
        "    if (false) {",
        "        (void)__cv_c.size();",
        "        (void)__cv_c.empty();",
        "        auto __cv_b = __cv_c.begin();",
        "        auto __cv_e = __cv_c.end();",
        "        if (__cv_b != __cv_e) { (void)(*__cv_b); ++__cv_b; }",
        "    }",
        "}",
        "template <typename __CVAdapter>",
        "static inline void __cv_touch_adapter(__CVAdapter& __cv_a) {",
        "    if (false) { (void)__cv_a.size(); (void)__cv_a.empty(); }",
        "}",
        "namespace __cv_instantiate {",
        "static inline void __cv_force() {",
    ]
    for idx, (kw, elem_type) in enumerate(decls):
        dummy = f"__cv_dummy_{idx}"
        lines.append(f"    std::{kw}<{elem_type}> {dummy};")
        if kw in _ADAPTER_DEFAULT_CONTAINER:
            underlying = _ADAPTER_DEFAULT_CONTAINER[kw]
            udummy = f"__cv_udummy_{idx}"
            lines.append(f"    std::{underlying}<{elem_type}> {udummy};")
            lines.append(f"    __cv_touch_seq({udummy});")
            lines.append(f"    __cv_touch_adapter({dummy});")
        else:
            lines.append(f"    __cv_touch_seq({dummy});")
    lines += [
        "}",
        "struct __CVInit { __CVInit() { __cv_force(); } };",
        "static __CVInit __cv_init_instance;",
        "}",
        "",
    ]
    preamble = "\n".join(lines) + "\n"
    return preamble, preamble.count("\n")


def _find_preamble_insertion_point(source):
    """Finds the character offset right after the user's own #include and
    using-namespace lines, so the instantiation preamble can be inserted
    there instead of at the absolute top of the file. Two things break
    if the preamble goes first instead: (1) it declares e.g.
    std::unordered_map<...> before the user's own #include <unordered_map>
    has run, and (2) container element types are copied verbatim from the
    user's code (e.g. `string` instead of `std::string`), which only
    resolves if the user's `using namespace std;` is already in effect."""
    lines = source.split("\n")
    last_idx = -1
    for i, line in enumerate(lines):
        if re.match(r"^\s*#include\b", line) or re.match(r"^\s*using\s+namespace\b", line):
            last_idx = i
    if last_idx == -1:
        return 0
    return sum(len(l) + 1 for l in lines[: last_idx + 1])


def run_custom_cpp_trace(code):
    workdir = tempfile.mkdtemp(prefix="codevision_cpp_")
    source_path = os.path.join(workdir, SOURCE_NAME)
    binary_path = os.path.join(workdir, BINARY_NAME)

    preamble, injected_lines = _build_instantiation_preamble(code)
    insert_at = _find_preamble_insertion_point(code)
    combined_source = code[:insert_at] + preamble + code[insert_at:]

    try:
        with open(source_path, "w") as f:
            f.write(combined_source)

        compile_proc = subprocess.run(
            ["g++", "-g", "-O0", "-std=c++17", "-o", binary_path, source_path],
            capture_output=True, text=True, timeout=COMPILE_TIMEOUT,
        )
        if compile_proc.returncode != 0:
            # Trim gdb/g++ paths back to the filename the user actually sees,
            # and shift line numbers in the message back by the number of
            # lines our (invisible) instantiation preamble added, so a
            # compile error still points at the line the user actually
            # wrote — otherwise every reported line would be off by
            # `injected_lines` whenever any container gets detected.
            cleaned = compile_proc.stderr.replace(source_path, SOURCE_NAME)
            if injected_lines:
                def _shift(m):
                    return f"{SOURCE_NAME}:{max(int(m.group(1)) - injected_lines, 1)}:"
                cleaned = re.sub(rf"{re.escape(SOURCE_NAME)}:(\d+):", _shift, cleaned)
            return {"error": f"Compile error:\n{cleaned[:2000]}"}

        if not os.path.exists(binary_path):
            # g++ reported success but the expected binary isn't where we
            # think it is — this used to happen silently on Windows before
            # BINARY_NAME included ".exe". Fail loudly instead of returning
            # an empty trace with no explanation.
            return {"error": f"Compiled binary not found at expected path: {binary_path}"}

        result = _trace_binary(binary_path, source_path)
        if injected_lines:
            # Shift every reported step back onto the user's original line
            # numbering, and drop any step that landed inside the injected
            # preamble itself (shouldn't normally happen since it's all
            # unreachable code, but guards against a stray stop there).
            adjusted = []
            for step in result.get("trace", []):
                step["line"] = step["line"] - injected_lines
                if step["line"] > 0:
                    adjusted.append(step)
            result["trace"] = adjusted
        return result
    except subprocess.TimeoutExpired:
        return {"error": f"Compilation timed out after {COMPILE_TIMEOUT}s."}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _trace_binary(binary_path, source_path):
    # Default pygdbmi behavior waits a fixed ~0.2s after every response
    # "just in case" more output is coming — fine for a human at a REPL,
    # but multiplied by the hundreds of MI commands a single trace needs
    # (step + finish + variable reads per line) it makes traces take
    # unusably long. A much shorter settle time keeps traces fast without
    # meaningfully risking truncated responses (variables/output).
    gdb = GdbController(
        command=["gdb", "--nx", "--quiet", "--interpreter=mi3"],
        time_to_check_for_additional_output_sec=0.02,
    )
    steps = []
    stdout_chunks = []
    error = None
    start_time = time.time()

    def send(cmd, timeout=STEP_TIMEOUT):
        return gdb.write(cmd, timeout_sec=timeout)

    try:
        # gdb's MI command parser treats an unquoted path as a bare
        # whitespace-delimited token, which breaks on Windows paths (raw
        # backslashes aren't handled the way you'd expect from a plain
        # file argument, and a path with a space in it truncates
        # entirely). Quoting the path and using forward slashes (gdb on
        # Windows/MinGW accepts these fine) avoids both problems.
        gdb_binary_path = binary_path.replace("\\", "/")
        load_resp = send(f'-file-exec-and-symbols "{gdb_binary_path}"')
        load_errors = [m.get("payload", {}).get("msg", "") for m in load_resp if m.get("message") == "error"]
        if load_errors:
            error = "gdb couldn't load the compiled binary: " + "; ".join(load_errors)
            raise RuntimeError(error)

        send("-break-insert main")
        # Redirect the inferior's stdin from the OS's "nothing" device: a
        # `cin >>` in user code would otherwise block forever waiting for
        # input gdb never provides. Uses the console form since -exec-run
        # has no redirection syntax of its own. Windows has no /dev/null —
        # its equivalent is NUL.
        null_device = "NUL" if os.name == "nt" else "/dev/null"
        run_resp = _send_until_settled(gdb, f'-interpreter-exec console "run < {null_device}"', STEP_TIMEOUT)
        _collect_output(run_resp, stdout_chunks)
        stop = _stopped_payload(run_resp)

        if stop is None:
            gdb_errors = [m.get("payload", {}).get("msg", "") for m in run_resp if m.get("message") == "error"]
            if gdb_errors:
                error = "gdb error while starting the program: " + "; ".join(gdb_errors)

        last_key = None
        step_count = 0

        while stop and not _program_exited(stop):
            if time.time() - start_time > WALL_CLOCK_BUDGET:
                error = f"Execution stopped after exceeding the {WALL_CLOCK_BUDGET}s time budget (possible infinite loop)."
                break
            step_count += 1
            if step_count > MAX_STEPS:
                error = f"Execution stopped after {MAX_STEPS} steps (possible infinite loop)."
                break

            resp = _send_until_settled(gdb, "-exec-step", STEP_TIMEOUT)
            _collect_output(resp, stdout_chunks)
            stop = _stopped_payload(resp)
            if stop is None:
                break
            if _program_exited(stop):
                break

            frame = stop.get("frame", {})
            guard = 0
            while os.path.basename(frame.get("file") or "") != os.path.basename(source_path) and guard < 25:
                if time.time() - start_time > WALL_CLOCK_BUDGET:
                    break
                fin_resp = _send_until_settled(gdb, "-exec-finish", STEP_TIMEOUT)
                _collect_output(fin_resp, stdout_chunks)
                fin_stop = _stopped_payload(fin_resp)
                if fin_stop is None or _program_exited(fin_stop):
                    stop = fin_stop
                    frame = {}
                    break
                stop = fin_stop
                frame = stop.get("frame", {})
                guard += 1

            if not frame or _program_exited(stop or {}):
                break

            depth = _read_depth(send)
            key = (frame.get("func"), frame.get("line"), depth)
            if key == last_key:
                continue
            last_key = key

            try:
                line_no = int(frame.get("line"))
            except (TypeError, ValueError):
                continue

            variables = _read_variables(send)
            steps.append({
                "step": len(steps) + 1,
                "line": line_no,
                "variables": variables,
                "call_stack_depth": depth,
            })

        send("-gdb-exit", timeout=2)
    except Exception as e:  # pygdbmi timeouts, broken pipe, etc.
        error = error or f"{type(e).__name__}: {e}"
    finally:
        try:
            gdb.exit()
        except Exception:
            pass

    result = {"trace": steps, "stdout": "".join(stdout_chunks)}
    if error:
        result["error"] = error
    return result


def _read_depth(send):
    """Number of frames currently on the stack — used to tell apart two
    stops that land on the same (function, line) at different recursion
    depths (e.g. the `n * factorial(n - 1)` line is visited once on the
    way down and again, at a shallower depth, on the way back up)."""
    try:
        resp = send("-stack-info-depth")
    except Exception:
        return 0
    for m in resp:
        if m.get("message") == "done" and m.get("payload"):
            try:
                return int(m["payload"].get("depth", 0))
            except (TypeError, ValueError):
                return 0
    return 0


def _read_vector_elements(send, name):
    """Fallback for std::vector when gdb has no libstdc++ pretty-printers
    loaded — this turned out to be the case on the MSYS2/MinGW gdb build,
    unlike the Linux gdb this module was developed against, which prints
    vectors as clean text automatically. Without that, gdb's default
    printer dumps raw internal fields (_M_start, _M_finish, allocator
    bookkeeping...) instead of the actual contents.

    Reconstructs the elements directly instead: `_M_finish - _M_start` is
    ordinary pointer arithmetic on a typed pointer, so it's already the
    element count (not a byte count); `*_M_start@count` is gdb's own
    array-slice syntax and renders as a plain `{a, b, c}` list with no
    pretty-printer involved at all."""
    try:
        size_resp = send(f'-data-evaluate-expression "{name}._M_impl._M_finish - {name}._M_impl._M_start"')
    except Exception:
        return None
    size_raw = None
    for m in size_resp:
        if m.get("message") == "done" and m.get("payload"):
            size_raw = m["payload"].get("value")
        if m.get("message") == "error":
            return None
    try:
        count = int(size_raw)
    except (TypeError, ValueError):
        return None
    if count <= 0:
        return {"type": "array", "value": []}
    count = min(count, 500)  # sane display cap

    try:
        elems_resp = send(f'-data-evaluate-expression "*{name}._M_impl._M_start@{count}"')
    except Exception:
        return None
    elems_raw = None
    for m in elems_resp:
        if m.get("message") == "done" and m.get("payload"):
            elems_raw = m["payload"].get("value")
        if m.get("message") == "error":
            return None
    if elems_raw is None:
        return None

    m2 = re.search(r"\{(.*)\}\s*$", elems_raw, re.DOTALL)
    inner = m2.group(1) if m2 else elems_raw
    items = _split_top_level(inner)
    return {"type": "array", "value": [_parse_gdb_value(_guess_scalar_kind(v), v) for v in items]}


def _read_pointer_array(send, name, count):
    """Like _read_vector_elements, but for a raw pointer (e.g. a decayed
    `int arr[]` parameter) once we already know how many elements it
    should have — from a sibling `n`/`len`/`size` parameter, see
    _LENGTH_NAME_CANDIDATES. `*ptr@count` is gdb's own array-slice syntax."""
    try:
        resp = send(f'-data-evaluate-expression "*{name}@{count}"')
    except Exception:
        return None
    raw = None
    for m in resp:
        if m.get("message") == "done" and m.get("payload"):
            raw = m["payload"].get("value")
        if m.get("message") == "error":
            return None
    if raw is None:
        return None
    m2 = re.search(r"\{(.*)\}\s*$", raw, re.DOTALL)
    inner = m2.group(1) if m2 else raw
    items = _split_top_level(inner)
    return {"type": "array", "value": [_parse_gdb_value(_guess_scalar_kind(v), v) for v in items]}


def _call_expr(send, expr):
    """Evaluate an arbitrary expression and return gdb's raw text, or
    None on any error."""
    try:
        resp = send(f'-data-evaluate-expression "{expr}"')
    except Exception:
        return None
    raw = None
    for m in resp:
        if m.get("message") == "done" and m.get("payload"):
            raw = m["payload"].get("value")
        if m.get("message") == "error":
            return None
    return raw


def _read_deque_elements(send, expr):
    """Reads a std::deque's elements via raw field navigation and pointer
    arithmetic only — never calling .size()/.begin()/.end()/operator++,
    which are real function calls into the debuggee. MinGW/Windows gdb
    builds are known to be unreliable calling functions in the target
    process (unlike Linux gdb, where those calls generally just work),
    so any approach built on them silently fails there and falls back to
    raw pretty-printer text — which is exactly what was happening for
    stack/queue (both deque-backed by default).

    libstdc++'s deque stores elements across one or more fixed-size
    buffer "nodes". The vast majority of classroom-scale examples never
    grow past the first node, so the fast path here handles that case
    (pointer subtraction + gdb's array-slice syntax, same trick already
    used for vector) and simply declines (returns None, falling back to
    the text parser) for the rarer multi-node case rather than risking
    an incorrect read."""
    base = f"({expr})._M_impl"
    start_node = _call_expr(send, f"{base}._M_start._M_node")
    finish_node = _call_expr(send, f"{base}._M_finish._M_node")
    if start_node is None or finish_node is None:
        return None
    if start_node.strip() != finish_node.strip():
        return None  # spans multiple buffer nodes — decline rather than guess

    count_raw = _call_expr(send, f"({base}._M_finish._M_cur) - ({base}._M_start._M_cur)")
    try:
        count = int(count_raw.strip())
    except (TypeError, ValueError, AttributeError):
        return None
    if count == 0:
        return {"type": "array", "value": []}
    if count < 0 or count > 500:
        return None

    elems_raw = _call_expr(send, f"*({base}._M_start._M_cur)@{count}")
    if elems_raw is None:
        return None
    m = re.search(r"\{(.*)\}\s*$", elems_raw, re.DOTALL)
    inner = m.group(1) if m else elems_raw
    items = _split_top_level(inner)
    return {"type": "array", "value": [_parse_gdb_value(_guess_scalar_kind(v), v) for v in items]}


def _looks_unparsed(result):
    """True if a parsed array result actually just fell back to raw,
    un-pretty-printed gdb struct text (e.g. '_M_impl', '_Deque_base') —
    signals that a pointer-based reader should be tried instead of
    trusting this result."""
    if result is None:
        return True
    for item in result.get("value", []):
        if item.get("type") == "string" and "_M_" in str(item.get("value", "")):
            return True
    return False




def _split_angle_top_level(text):
    """Splits a template argument list on top-level commas only,
    respecting nested <...> (needed for e.g. std::map<std::string,
    std::vector<int>>, where the inner vector's comma-free here but
    nested angle brackets still must not confuse the split)."""
    parts, depth, current = [], 0, ""
    for ch in text:
        if ch in "<(":
            depth += 1
        elif ch in ">)":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current)
    return [p.strip() for p in parts if p.strip()]


def _extract_container_value_type(core, is_map):
    """Pulls the key (and, for a map, value) type out of a set/map's full
    gdb type string, e.g. 'std::map<std::string, int, std::less<...>,
    ...>' -> ('std::string', 'int'). Needed so the red-black-tree walker
    can cast a raw node pointer to the exact stored type, rather than
    reading it through a member name — that name ('_M_value_field' before
    GCC 7, '_M_storage' after) differs across libstdc++ versions, while
    a byte-offset cast past the node's base fields works on any of them."""
    idx = core.find("<")
    if idx == -1:
        return None
    depth, end = 0, None
    for i in range(idx, len(core)):
        if core[i] == "<":
            depth += 1
        elif core[i] == ">":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end is None:
        return None
    args = _split_angle_top_level(core[idx + 1:end])
    if not args:
        return None
    if is_map:
        return (args[0], args[1]) if len(args) >= 2 else None
    return (args[0], None)


def _read_hashtable_pairs(send, name, type_str, is_map):
    """Walks a std::unordered_set/unordered_map's internal hash table
    using only raw pointer fields — same motivation as _read_rbtree_pairs
    (avoiding .size()/.begin()/.end()/operator++ calls, which are
    unreliable on MinGW/Windows gdb builds).

    libstdc++'s _Hashtable stores every element in one singly-linked list
    regardless of which bucket it hashes to (buckets just hold a pointer
    into this list for O(1) lookup) — so, unlike the red-black tree case,
    this is a plain linked-list walk via each node's _M_nxt, with no
    per-bucket logic needed at all.

    Wrapped in one broad try/except for the same reason as the rbtree
    walker: many gdb round-trips in a row, and any single unanticipated
    None anywhere shouldn't crash the whole trace request."""
    try:
        return _read_hashtable_pairs_inner(send, name, type_str, is_map)
    except Exception:
        return None


def _read_hashtable_pairs_inner(send, name, type_str, is_map):
    core = re.sub(r"\b(const|volatile)\b", "", type_str or "").replace("&", "").strip()
    parsed = _extract_container_value_type(core, is_map)
    if parsed is None:
        return None
    key_type, val_type = parsed
    value_type_expr = f"std::pair<const {key_type}, {val_type}>" if is_map else key_type
    HNB = "std::__detail::_Hash_node_base"

    node = _call_expr(send, f"(({name})._M_h._M_before_begin._M_nxt)")
    if node is None:
        return None
    node = node.strip()

    base_size_raw = _call_expr(send, f"sizeof({HNB})")
    try:
        offset = int(base_size_raw.strip())
    except (TypeError, ValueError, AttributeError):
        return None

    pairs = []
    guard = 0
    while node and node != "0x0" and guard < 500:
        guard += 1
        val_raw = _call_expr(send, f"*({value_type_expr}*)((char*){node} + {offset})")
        if val_raw is None:
            return None
        if is_map:
            m = re.search(r"first\s*=\s*(.*?),\s*second\s*=\s*(.*)\}\s*$", val_raw, re.DOTALL)
            if not m:
                return None
            pairs.append((m.group(1).strip(), m.group(2).strip()))
        else:
            pairs.append((val_raw.strip(), None))

        nxt = _call_expr(send, f"(({HNB}*){node})->_M_nxt")
        if nxt is None:
            return None
        node = nxt.strip()
    return pairs


def _read_rbtree_pairs(send, name, type_str, is_map):
    """Walks a std::set/map/multiset/multimap container's internal
    red-black tree using only raw pointer fields, mirroring libstdc++'s
    own in-order successor algorithm, instead of calling
    size()/begin()/end()/operator++ in the debuggee. Those calls are
    unreliable on MinGW/Windows gdb builds (the same root cause as the
    stack/queue text-dump bug) — a failed call there doesn't raise an
    error gdb can report, it just returns nothing.

    Everything below is wrapped in one broad try/except: this walker
    touches many gdb round-trips in a row, and if any single one comes
    back None in a spot we didn't anticipate, the old behavior was to
    crash the entire trace request with an AttributeError. Now it just
    gives up on this one variable and falls back to raw text instead.

    NOTE: unordered_set/unordered_map use a hash table, not a red-black
    tree, and aren't walkable with this algorithm — they're intentionally
    left out of the kw check in _read_variables below and keep using the
    old iterator-based path (or fall back to raw text) until a bucket-list
    walker is written."""
    try:
        return _read_rbtree_pairs_inner(send, name, type_str, is_map)
    except Exception:
        return None


def _read_rbtree_pairs_inner(send, name, type_str, is_map):
    core = re.sub(r"\b(const|volatile)\b", "", type_str or "").replace("&", "").strip()
    parsed = _extract_container_value_type(core, is_map)
    if parsed is None:
        return None
    key_type, val_type = parsed
    value_type_expr = f"std::pair<const {key_type}, {val_type}>" if is_map else key_type
    NB = "std::_Rb_tree_node_base"

    header_addr = _call_expr(send, f"&(({name})._M_t._M_impl._M_header)")
    if header_addr is None:
        return None
    header_addr = header_addr.strip()

    node = _call_expr(send, f"(({name})._M_t._M_impl._M_header._M_left)")
    if node is None:
        return None
    node = node.strip()

    base_size_raw = _call_expr(send, f"sizeof({NB})")
    try:
        offset = int(base_size_raw.strip())
    except (TypeError, ValueError, AttributeError):
        return None

    pairs = []
    guard = 0
    while node and node not in ("0x0", header_addr) and guard < 500:
        guard += 1
        val_raw = _call_expr(send, f"*({value_type_expr}*)((char*){node} + {offset})")
        if val_raw is None:
            return None
        if is_map:
            m = re.search(r"first\s*=\s*(.*?),\s*second\s*=\s*(.*)\}\s*$", val_raw, re.DOTALL)
            if not m:
                return None
            pairs.append((m.group(1).strip(), m.group(2).strip()))
        else:
            pairs.append((val_raw.strip(), None))

        # In-order successor (mirrors std::_Rb_tree_increment): if there's
        # a right subtree, the successor is its leftmost node; otherwise
        # walk up until we're not our parent's right child.
        right = _call_expr(send, f"(({NB}*){node})->_M_right")
        if right is None:
            return None
        right = right.strip()
        if right != "0x0":
            node = right
            while True:
                left = _call_expr(send, f"(({NB}*){node})->_M_left")
                if left is None:
                    return None
                left = left.strip()
                if left == "0x0":
                    break
                node = left
        else:
            parent = _call_expr(send, f"(({NB}*){node})->_M_parent")
            if parent is None:
                return None
            parent = parent.strip()
            while parent != header_addr:
                p_right = _call_expr(send, f"(({NB}*){parent})->_M_right")
                if p_right is None:
                    return None
                if p_right.strip() != node:
                    break
                node = parent
                parent = _call_expr(send, f"(({NB}*){parent})->_M_parent")
                if parent is None:
                    return None
                parent = parent.strip()
            node = parent
    return pairs


def _read_ordered_container_pairs(send, name, is_map):
    """Fallback for unordered_set/unordered_map when no pretty-printer is
    loaded. NOTE: unlike the deque/vector readers, this still calls
    .size()/.begin()/.end()/operator++ in the debuggee — if these are
    still showing raw internals after the stack/queue fix, it's the same
    root cause (MinGW gdb's unreliable inferior function calls) and this
    function is the next one to convert to a pure pointer-based
    hash-bucket walker.
    walks begin()..end() with a gdb convenience variable, since these
    associative containers have no operator[] indexing by position the
    way vector/deque do. Returns a list of (key, value_raw) pairs — for a
    set, value_raw is None and the element itself is the key."""
    try:
        return _read_ordered_container_pairs_inner(send, name, is_map)
    except Exception:
        return None


def _read_ordered_container_pairs_inner(send, name, is_map):
    size_raw = _call_expr(send, f"({name}).size()")
    try:
        count = min(int(size_raw.strip()), 500)
    except (TypeError, ValueError, AttributeError):
        return None
    if count == 0:
        return []

    # A fresh convenience-variable name per call avoids collisions if
    # several set/map locals are read within the same stop.
    cv = f"$cv_{abs(hash(name)) % 100000}"
    if _call_expr(send, f"{cv} = ({name}).begin()") is None:
        return None

    pairs = []
    for _ in range(count):
        if is_map:
            key_raw = _call_expr(send, f"(*{cv}).first")
            val_raw = _call_expr(send, f"(*{cv}).second")
            if key_raw is None:
                return None
            pairs.append((key_raw, val_raw))
        else:
            val_raw = _call_expr(send, f"*{cv}")
            if val_raw is None:
                return None
            pairs.append((val_raw, None))
        if _call_expr(send, f"++{cv}") is None:
            break
    return pairs


def _read_variables(send):
    variables = {}
    try:
        resp = send("-stack-list-variables --simple-values")
    except Exception:
        return variables

    var_list = []
    for m in resp:
        if m.get("message") == "done" and m.get("payload"):
            var_list = m["payload"].get("variables", [])

    for var in var_list:
        name = var.get("name")
        if not name or name.startswith("__"):
            continue
        type_str = var.get("type", "")
        kind = _classify_cpp_type(type_str)

        if "value" in var and kind in ("number", "boolean"):
            variables[name] = _parse_gdb_value(kind, var["value"])
            continue

        if kind == "array" and ("vector" in type_str or "deque" in type_str):
            vec_result = _read_vector_elements(send, name)
            if vec_result is None or _looks_unparsed(vec_result):
                deque_result = _read_deque_elements(send, name)
                if deque_result is not None:
                    vec_result = deque_result
            if vec_result is not None:
                variables[name] = vec_result
                continue

        if kind in ("stack", "queue", "priority_queue"):
            # These adapters wrap an internal container (deque by default
            # for stack/queue, vector for priority_queue) in a protected
            # member called `c`. Read that member's elements via pure
            # pointer arithmetic — no .size()/operator[] calls, which
            # are unreliable to invoke in the debuggee on MinGW/Windows
            # gdb builds (see _read_deque_elements for the full reasoning).
            if kind == "priority_queue":
                inner_result = _read_vector_elements(send, f"{name}.c")
            else:
                inner_result = _read_deque_elements(send, f"{name}.c")
            if inner_result is not None:
                variables[name] = {"type": kind, "value": inner_result["value"]}
                continue
            # Fall through to the generic evaluate-and-parse path below,
            # which will at least attempt to parse gdb's own text if a
            # pretty-printer happens to be present.

        if kind == "hash_map":
            try:
                is_map = "map" in type_str and "set" not in type_str
                is_ordered = "unordered" not in type_str
                probe = _call_expr(send, str(name))
                needs_fallback = probe is None or "_M_" in probe or "Rb_tree" in probe
                if needs_fallback:
                    if is_ordered:
                        pairs = _read_rbtree_pairs(send, name, type_str, is_map)
                    else:
                        pairs = _read_hashtable_pairs(send, name, type_str, is_map)
                    if pairs is not None:
                        out = {}
                        for key_raw, val_raw in pairs:
                            key_node = _parse_gdb_value(_guess_scalar_kind(key_raw), key_raw)
                            key_str = str(key_node.get("value", key_raw))
                            if is_map:
                                out[key_str] = _parse_gdb_value(_guess_scalar_kind(val_raw), val_raw)
                            else:
                                out[key_str] = {"type": "boolean", "value": True}
                        variables[name] = {"type": "hash_map", "value": out}
                        continue
            except Exception:
                pass  # falls through to the generic evaluate-and-parse path below

        # Complex type (or simple-values omitted it): evaluate directly so
        # we get gdb's pretty-printed text for vectors/strings/maps.
        try:
            eval_resp = send(f"-data-evaluate-expression {name}")
        except Exception:
            # Same rule as _parse_gdb_value: never hand the frontend a raw
            # string under an "object" type tag, since StructureView's
            # object renderer does Object.entries() on it and iterates it
            # character-by-character, producing a wall of fake "undefined"
            # entries — this is exactly where that bug came from for
            # reference parameters (int&) on some gdb builds.
            variables[name] = {"type": "string", "value": var.get("value", "?")}
            continue
        raw = None
        for m in eval_resp:
            if m.get("message") == "done" and m.get("payload"):
                raw = m["payload"].get("value")
            if m.get("message") == "error":
                raw = None
        if raw is None:
            variables[name] = {"type": "string", "value": var.get("value", "<unavailable>")}
        else:
            is_map = "map" in type_str and "set" not in type_str
            variables[name] = _parse_gdb_value(kind, raw, is_map=is_map)

    # Second pass: a decayed C-array parameter (`int arr[]` → `int *`) only
    # ever gives gdb a bare address, since a pointer alone carries no
    # length. If a sibling parameter looks like the array's length, use it
    # to recover the actual elements the same way _read_vector_elements
    # does for std::vector.
    for var in var_list:
        name = var.get("name")
        if not name or variables.get(name, {}).get("type") != "string":
            continue
        if not _looks_like_primitive_pointer(var.get("type", "")):
            continue
        for cand in _LENGTH_NAME_CANDIDATES:
            length_var = variables.get(cand)
            if length_var and length_var.get("type") == "number":
                try:
                    count = int(length_var["value"])
                except (TypeError, ValueError):
                    continue
                if 0 < count <= 500:
                    arr_result = _read_pointer_array(send, name, count)
                    if arr_result is not None:
                        variables[name] = arr_result
                break

    return variables
