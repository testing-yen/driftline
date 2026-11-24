#!/usr/bin/env bash
#
# agent-queue runner v2 — file-queue + git orchestration for headless
# Claude Code, with a runner-side security policy layer (Tier 1 hardening).
#
# What v2 changes vs v1:
#   - POLICY LAYER: task files can only tighten limits, never loosen them.
#     Numeric caps (budget, turns, timeout) are clamped to runner-side
#     maxima. permission_mode, base branch and tool names are checked
#     against runner-side allowlists; a task that asks for more than the
#     policy allows is REFUSED (moved to failed/ with a report) and
#     claude is never started.
#   - WORKTREE NEUTRALIZATION: repo-supplied executable config in the
#     worktree (.mcp.json, hooks in .claude/settings.json) is disabled
#     for the duration of the run and restored before commit, so a task
#     branch never inherits the change.
#   - WATCHDOG TIMEOUT: timeout_secs is enforced by the runner itself
#     (no gtimeout/coreutils needed). claude runs as a process-group
#     leader; on timeout the whole group is killed, and after a normal
#     exit the group is swept so detached children do not outlive the
#     task. (A child that calls setsid itself can still escape; that is
#     a documented residual risk, addressed by Tier 2 isolation.)
#   - SECRET SCAN: before anything is committed on the task branch, the
#     worktree is scanned for common credential patterns and sensitive
#     filenames. On a hit nothing is committed or pushed; the task is
#     marked failed and the report names the offending files (never the
#     matched values).
#   - DAILY CAP: aggregate per-day limits on task count and estimated
#     spend, kept in a local-only state file under runs/.
#
# Install model: this script is meant to live OUTSIDE the repo (a pinned
# local copy, e.g. ~/.agent-queue/runner.sh) and be pointed at the repo.
# The repo then carries only data (tasks, results), so write access to
# the queue branch can no longer replace the executable code.
#
# Usage:
#   runner.sh [repo-path]          (default: current directory)
#
# Environment:
#   QUEUE_BRANCH     branch holding the queue state (default: main)
#   MAX_TASKS        tasks per run (default: 1)
#   CLAUDE_BIN       claude executable (default: claude, must be on PATH)
#   WORKTREES_DIR    parent dir for per-task worktrees
#                    (default: <repo-parent>/<repo-name>-worktrees)
#   KEEP_WORKTREE    1 = keep worktree after the run (default), 0 = remove it
#
# Safety:
#   - Refuses to run with uncommitted changes in the main checkout.
#   - Briefly checks out QUEUE_BRANCH, then restores the original branch.
#   - Never passes --dangerously-skip-permissions.
#   - Single-runner only: the claim commit is the mutex. Do not run two
#     runners against the same repo.
#
# Exit codes: 0 = clean run (task processed, or queue empty),
#             1 = error (see log), 2 = skipped (dirty tree / no queue dir).

set -uo pipefail

REPO="${1:-$PWD}"
QUEUE_BRANCH="${QUEUE_BRANCH:-main}"
MAX_TASKS="${MAX_TASKS:-1}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
KEEP_WORKTREE="${KEEP_WORKTREE:-1}"
QUEUE_DIR=".agent-queue"
TASKS_DIR="$REPO/$QUEUE_DIR/tasks"
RESULTS_DIR="$REPO/$QUEUE_DIR/results"
RUNS_DIR="$REPO/$QUEUE_DIR/runs"
WORKTREES_DIR="${WORKTREES_DIR:-$(dirname "$REPO")/$(basename "$REPO")-worktrees}"
LOCK_DIR="/tmp/agent-queue.$(basename "$REPO").lock"
START_BRANCH=""
LAST_COST_USD="0"

# ---------------------------------------------------------------------------
# Security policy (runner-side; task files may only go below these limits)
# ---------------------------------------------------------------------------
POLICY_MAX_BUDGET_USD=10
POLICY_MAX_TURNS=40
POLICY_MAX_TIMEOUT_SECS=3600
POLICY_ALLOWED_MODES="acceptEdits dontAsk"
POLICY_ALLOWED_BASES="main"
POLICY_ALLOWED_TOOLS="Read Edit Write Glob Grep Bash WebFetch WebSearch NotebookEdit Task TodoWrite MultiEdit"
POLICY_DAILY_MAX_TASKS=10
POLICY_DAILY_MAX_USD=25

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "ERROR: $*"; exit 1; }

has_remote() { git -C "$REPO" config --get remote.origin.url >/dev/null 2>&1; }

sync_queue_branch() {
  if has_remote; then
    git -C "$REPO" fetch origin --quiet || die "git fetch failed"
    git -C "$REPO" pull --ff-only origin "$QUEUE_BRANCH" --quiet \
      || die "git pull --ff-only failed (queue branch diverged? resolve it by hand)"
  fi
}

push_if_remote() {
  if has_remote; then
    git -C "$REPO" push origin "$QUEUE_BRANCH" --quiet \
      || die "git push of queue branch failed"
  fi
}

restore_branch() {
  if [ -n "$START_BRANCH" ]; then
    git -C "$REPO" checkout --quiet "$START_BRANCH" 2>/dev/null || true
  fi
}

release_lock() { rmdir "$LOCK_DIR" 2>/dev/null || true; }

# Move a task file whether or not it is already tracked by git.
claim_move() {
  local src="$1" dst="$2"
  if git -C "$REPO" ls-files --error-unmatch "$src" >/dev/null 2>&1; then
    git -C "$REPO" mv "$src" "$dst"
  else
    mv "$src" "$dst"
    git -C "$REPO" add "$dst"
  fi
}

# Parse task frontmatter into shell variables (allowlist only).
# Sets: TASK_ID TITLE BASE MODEL ALLOWED_TOOLS PERMISSION_MODE MAX_TURNS
#       MAX_BUDGET BARE RESUME TIMEOUT_SECS, and writes the prompt body to $2.
parse_task() {
  local file="$1" body_out="$2"
  local parsed
  parsed="$(python3 - "$file" "$body_out" <<'PYEOF'
import re, shlex, sys

path, body_out = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
m = re.match(r"\A---\n(.*?)\n---\n?(.*)\Z", text, re.S)
if not m:
    sys.exit("task file has no YAML frontmatter (--- ... ---)")
front, body = m.group(1), m.group(2)
fields = {}
for line in front.splitlines():
    if not line.strip() or line.lstrip().startswith("#"):
        continue
    k, _, v = line.partition(":")
    fields[k.strip()] = v.strip().strip('"').strip("'")
open(body_out, "w", encoding="utf-8").write(body)
allowed = {
    "id": "TASK_ID", "title": "TITLE", "base": "BASE", "model": "MODEL",
    "allowed_tools": "ALLOWED_TOOLS", "permission_mode": "PERMISSION_MODE",
    "max_turns": "MAX_TURNS", "max_budget_usd": "MAX_BUDGET",
    "bare": "BARE", "resume": "RESUME", "timeout_secs": "TIMEOUT_SECS",
}
for k, var in allowed.items():
    if k in fields:
        print(f"{var}={shlex.quote(fields[k])}")
PYEOF
)" || die "failed to parse task file: $file"
  eval "$parsed"
  TASK_ID="${TASK_ID:-}"
  TITLE="${TITLE:-$TASK_ID}"
  BASE="${BASE:-main}"
  MODEL="${MODEL:-}"
  ALLOWED_TOOLS="${ALLOWED_TOOLS:-Read,Edit,Glob,Grep,Bash}"
  PERMISSION_MODE="${PERMISSION_MODE:-acceptEdits}"
  MAX_TURNS="${MAX_TURNS:-30}"
  MAX_BUDGET="${MAX_BUDGET:-5}"
  BARE="${BARE:-false}"
  RESUME="${RESUME:-}"
  TIMEOUT_SECS="${TIMEOUT_SECS:-1800}"
  case "$TASK_ID" in
    ''|*[!a-z0-9._-]*|.*|*..*) die "bad task id: '$TASK_ID'" ;;
  esac
}

# ---------------------------------------------------------------------------
# Policy layer
#
# policy_check reads the parsed task variables, clamps the numeric caps
# (appending a note to $POLICY_NOTES_FILE for the report) and refuses the
# task outright when it asks for a disallowed permission mode, base
# branch or tool. On refusal it returns 1 and sets POLICY_REFUSAL.
# ---------------------------------------------------------------------------
POLICY_REFUSAL=""
policy_check() {
  local out rc=0
  out="$(TASK_MAX_BUDGET="$MAX_BUDGET" TASK_MAX_TURNS="$MAX_TURNS" \
    TASK_TIMEOUT="$TIMEOUT_SECS" TASK_MODE="$PERMISSION_MODE" \
    TASK_BASE="$BASE" TASK_TOOLS="$ALLOWED_TOOLS" \
    P_MAX_BUDGET="$POLICY_MAX_BUDGET_USD" P_MAX_TURNS="$POLICY_MAX_TURNS" \
    P_MAX_TIMEOUT="$POLICY_MAX_TIMEOUT_SECS" \
    P_MODES="$POLICY_ALLOWED_MODES" P_BASES="$POLICY_ALLOWED_BASES" \
    P_TOOLS="$POLICY_ALLOWED_TOOLS" python3 - <<'PYEOF'
import os, re, shlex, sys

def num(name, default):
    try:
        return float(os.environ[name])
    except (KeyError, ValueError):
        return default

notes = []
budget = num("TASK_MAX_BUDGET", 5)
turns = num("TASK_MAX_TURNS", 30)
timeout = num("TASK_TIMEOUT", 1800)
for label, var, val, cap in (
    ("max_budget_usd", "MAX_BUDGET", budget, float(os.environ["P_MAX_BUDGET"])),
    ("max_turns", "MAX_TURNS", turns, float(os.environ["P_MAX_TURNS"])),
    ("timeout_secs", "TIMEOUT_SECS", timeout, float(os.environ["P_MAX_TIMEOUT"])),
):
    if val > cap:
        notes.append(f"{label} clamped {val:g} -> {cap:g} (runner policy)")
        val = cap
    print(f"{var}={shlex.quote(format(val, 'g'))}")

mode = os.environ.get("TASK_MODE", "")
if mode not in os.environ["P_MODES"].split():
    print(f"REFUSAL={shlex.quote('permission_mode ' + repr(mode) + ' is not allowed by runner policy')}")
    sys.exit(3)
base = os.environ.get("TASK_BASE", "")
if base not in os.environ["P_BASES"].split():
    print(f"REFUSAL={shlex.quote('base branch ' + repr(base) + ' is not allowed by runner policy')}")
    sys.exit(3)
tools_raw = re.sub(r"\([^)]*\)", "", os.environ.get("TASK_TOOLS", ""))
tools = [t.strip() for t in tools_raw.split(",") if t.strip()]
allowed = set(os.environ["P_TOOLS"].split())
bad = [t for t in tools if t not in allowed]
if bad:
    print(f"REFUSAL={shlex.quote('tools not allowed by runner policy: ' + ', '.join(bad))}")
    sys.exit(3)
for n in notes:
    print(f"NOTE={shlex.quote(n)}")
PYEOF
)" || rc=$?
  local line
  while IFS= read -r line; do
    case "$line" in
      REFUSAL=*) eval "$line"; POLICY_REFUSAL="$REFUSAL" ;;
      NOTE=*) eval "$line"; printf '%s\n' "$NOTE" >> "$POLICY_NOTES_FILE" ;;
      *=*) eval "$line" ;;
    esac
  done <<EOF
$out
EOF
  [ "$rc" -eq 3 ] && return 1
  [ "$rc" -eq 0 ] || die "policy check failed unexpectedly (rc=$rc)"
  return 0
}

# ---------------------------------------------------------------------------
# Worktree neutralization: disable repo-supplied executable config for
# the duration of the run. NEUTRALIZED_PATHS records what was touched so
# it can be restored to the base state before anything is committed.
# ---------------------------------------------------------------------------
NEUTRALIZED_PATHS=""
neutralize_worktree() {
  local worktree="$1"
  if [ -f "$worktree/.mcp.json" ]; then
    rm -f "$worktree/.mcp.json"
    NEUTRALIZED_PATHS="$NEUTRALIZED_PATHS .mcp.json"
    printf '%s\n' "neutralized .mcp.json in worktree (restored before commit)" \
      >> "$POLICY_NOTES_FILE"
    log "neutralized .mcp.json in worktree"
  fi
  if [ -f "$worktree/.claude/settings.json" ]; then
    if python3 - "$worktree/.claude/settings.json" <<'PYEOF'
import json, sys
p = sys.argv[1]
try:
    d = json.load(open(p, encoding="utf-8"))
except Exception:
    sys.exit(1)
if isinstance(d, dict) and "hooks" in d:
    del d["hooks"]
    json.dump(d, open(p, "w", encoding="utf-8"), indent=2)
    sys.exit(0)
sys.exit(1)
PYEOF
    then
      NEUTRALIZED_PATHS="$NEUTRALIZED_PATHS .claude/settings.json"
      printf '%s\n' "stripped hooks from .claude/settings.json in worktree (restored before commit)" \
        >> "$POLICY_NOTES_FILE"
      log "stripped hooks from .claude/settings.json in worktree"
    fi
  fi
}

restore_neutralized() {
  local worktree="$1" p
  for p in $NEUTRALIZED_PATHS; do
    git -C "$worktree" checkout -- "$p" 2>/dev/null || true
  done
}

# ---------------------------------------------------------------------------
# Secret scan: look for common credential shapes and sensitive filenames
# anywhere in the worktree (excluding .git). Prints one "file (rule)"
# line per hit on stdout; returns 0 when clean, 1 on any hit. Matched
# values are never printed.
# ---------------------------------------------------------------------------
secret_scan() {
  local worktree="$1" hits="" f
  local patterns="
AKIA[0-9A-Z]{16}:aws-access-key-id
ghp_[A-Za-z0-9]{36,}:github-token
github_pat_[A-Za-z0-9_]{30,}:github-pat
sk-ant-[A-Za-z0-9_-]{16,}:anthropic-api-key
xox[baprs]-[A-Za-z0-9-]{10,}:slack-token
AIza[0-9A-Za-z_-]{35}:google-api-key
-----BEGIN [A-Z ]*PRIVATE KEY-----:private-key
"
  local all_files pat name
  all_files="$(find "$worktree" -path '*/.git' -prune -o -type f -print 2>/dev/null)"
  while IFS=: read -r pat name; do
    [ -n "$pat" ] || continue
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      hits="$hits
$f (rule: $name)"
    done <<EOF
$(printf '%s\n' "$all_files" | xargs grep -lIE -e "$pat" 2>/dev/null | sed "s|^$worktree/||")
EOF
  done <<EOF
$patterns
EOF
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    hits="$hits
$f (rule: sensitive-filename)"
  done <<EOF
$(find "$worktree" -path '*/.git' -prune -o -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' -o -name 'id_rsa*' -o -name 'credentials.json' \) ! -name '*.example' -print 2>/dev/null | sed "s|^$worktree/||")
EOF
  hits="$(printf '%s\n' "$hits" | sed '/^$/d' | LC_ALL=C sort -u)"
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Daily aggregate cap (local-only state in runs/daily-cap.json)
# ---------------------------------------------------------------------------
daily_cap_reached() {
  python3 - "$RUNS_DIR/daily-cap.json" "$(date +%F)" \
    "$POLICY_DAILY_MAX_TASKS" "$POLICY_DAILY_MAX_USD" <<'PYEOF'
import json, os, sys
path, today = sys.argv[1], sys.argv[2]
max_tasks, max_usd = int(sys.argv[3]), float(sys.argv[4])
state = {}
if os.path.exists(path):
    try:
        state = json.load(open(path, encoding="utf-8"))
    except Exception:
        state = {}
if state.get("date") != today:
    state = {"date": today, "tasks": 0, "cost": 0.0}
# exit 0 = cap reached, 1 = room left
sys.exit(0 if (state["tasks"] >= max_tasks or state["cost"] >= max_usd) else 1)
PYEOF
}

daily_cap_add() {
  local cost="$1"
  python3 - "$RUNS_DIR/daily-cap.json" "$(date +%F)" "$cost" <<'PYEOF'
import json, os, sys
path, today, cost = sys.argv[1], sys.argv[2], float(sys.argv[3])
state = {}
if os.path.exists(path):
    try:
        state = json.load(open(path, encoding="utf-8"))
    except Exception:
        state = {}
if state.get("date") != today:
    state = {"date": today, "tasks": 0, "cost": 0.0}
state["tasks"] += 1
state["cost"] = round(state["cost"] + cost, 6)
json.dump(state, open(path, "w", encoding="utf-8"))
PYEOF
}

# Extract total_cost_usd from claude's JSON output (object or result list).
extract_cost() {
  python3 - "$1" <<'PYEOF'
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding="utf-8"))
    if isinstance(d, list):
        d = next((e for e in reversed(d)
                  if isinstance(e, dict) and e.get("type") == "result"), {})
    print(d.get("total_cost_usd", 0))
except Exception:
    print(0)
PYEOF
}

# Build the result report from the run artifacts.
write_report() {
  local status="$1" report="$2" raw_json="$3" stderr_log="$4"
  local changed_files="$5" worktree="$6" branch="$7" exit_code="$8"
  python3 - "$report" "$raw_json" "$stderr_log" "$changed_files" \
    "$status" "$TASK_ID" "$TITLE" "$worktree" "$branch" "$exit_code" \
    "$POLICY_NOTES_FILE" <<'PYEOF'
import json, os, sys

(report, raw_json, stderr_log, changed_files, status, task_id, title,
 worktree, branch, exit_code, notes_file) = sys.argv[1:12]
result, session_id, cost, turns = "", "", "", ""
try:
    d = json.load(open(raw_json, encoding="utf-8"))
    if isinstance(d, list):
        d = next((e for e in reversed(d)
                  if isinstance(e, dict) and e.get("type") == "result"), {})
    result = str(d.get("result", ""))
    session_id = str(d.get("session_id", ""))
    cost = str(d.get("total_cost_usd", ""))
    turns = str(d.get("num_turns", ""))
except Exception as e:
    result = f"(could not parse claude JSON output: {e})"
stderr_tail = ""
try:
    lines = open(stderr_log, encoding="utf-8", errors="replace").read().splitlines()
    stderr_tail = "\n".join(lines[-30:])
except OSError:
    pass
changed = open(changed_files, encoding="utf-8").read() if changed_files else ""
notes = ""
try:
    notes = open(notes_file, encoding="utf-8").read().strip()
except OSError:
    pass
if len(result) > 12000:
    result = result[:12000] + "\n\n... (truncated, full text in runs/<id>/claude-output.json)"
lines = [
    f"# Result: {title}",
    "",
    f"- task: `{task_id}`",
    f"- status: **{status}** (claude exit code {exit_code})",
    f"- branch: `{branch}`",
    f"- worktree: `{worktree}`",
    f"- session_id: `{session_id}`",
    f"- total_cost_usd: `{cost}`",
    f"- num_turns: `{turns}`",
    "",
    "## Files changed",
    "",
    "```",
    changed or "(none)",
    "```",
    "",
    "## Agent result",
    "",
    result or "(empty)",
]
if notes:
    lines += ["", "## Runner policy", "", notes]
if status != "done" and stderr_tail:
    lines += ["", "## stderr (last 30 lines)", "", "```", stderr_tail, "```"]
if session_id:
    lines += [
        "",
        "## Continue this session",
        "",
        f"New task file with frontmatter `resume: \"{session_id}\"` continues "
        "the same Claude session instead of starting fresh.",
    ]
open(report, "w", encoding="utf-8").write("\n".join(lines) + "\n")
PYEOF
}

# Run claude as a process-group leader under a watchdog. Enforces
# TIMEOUT_SECS without gtimeout; after the run (any outcome) the whole
# process group is swept so detached children do not outlive the task.
# $1 = worktree, $2 = raw_json, $3 = stderr_log; remaining context comes
# from the globals set by process_one (args array, prompt).
run_claude_watchdog() {
  local worktree="$1" raw_json="$2" stderr_log="$3"
  local pid waited=0 status=0 timed_out=0
  set -m
  ( cd "$worktree" && exec "$CLAUDE_BIN" "${args[@]}" "$prompt" ) \
    >"$raw_json" 2>"$stderr_log" &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$waited" -ge "$TIMEOUT_SECS" ]; then
      timed_out=1
      log "watchdog: timeout after ${TIMEOUT_SECS}s, killing process group $pid"
      kill -TERM -"$pid" 2>/dev/null || true
      sleep 5
      kill -KILL -"$pid" 2>/dev/null || true
      break
    fi
    sleep 2
    waited=$((waited + 2))
  done
  wait "$pid" 2>/dev/null || status=$?
  # Sweep any leftovers still in the process group (detached children
  # that did not setsid). A group that is already gone fails silently.
  kill -TERM -"$pid" 2>/dev/null || true
  set +m
  [ "$timed_out" -eq 1 ] && status=124
  return "$status"
}

process_one() {
  local task_file
  task_file="$(find "$TASKS_DIR/pending" -maxdepth 1 -type f -name '*.md' \
    | LC_ALL=C sort | head -n 1)"
  [ -n "$task_file" ] || { log "queue empty, nothing to do"; return 2; }

  local rel_task="${task_file#"$REPO"/}"
  local body_file run_dir raw_json stderr_log changed_list
  body_file="$(mktemp)"
  POLICY_NOTES_FILE="$(mktemp)"
  parse_task "$task_file" "$body_file"

  local branch="agent/$TASK_ID"
  local worktree="$WORKTREES_DIR/$TASK_ID"
  run_dir="$RUNS_DIR/$TASK_ID"
  raw_json="$run_dir/claude-output.json"
  stderr_log="$run_dir/claude-stderr.log"
  changed_list="$run_dir/changed-files.txt"
  mkdir -p "$run_dir"
  LAST_COST_USD="0"

  # --- Policy gate: refuse before claiming or running anything. ---
  if ! policy_check; then
    log "task $TASK_ID refused by policy: $POLICY_REFUSAL"
    printf '%s\n' "refused by runner policy: $POLICY_REFUSAL" >> "$POLICY_NOTES_FILE"
    printf '{"result": "Task refused by runner policy: %s", "session_id": "", "total_cost_usd": 0, "num_turns": 0}\n' \
      "$POLICY_REFUSAL" > "$raw_json"
    : > "$stderr_log"
    printf '' > "$changed_list"
    write_report "failed" "$RESULTS_DIR/$TASK_ID.md" \
      "$raw_json" "$stderr_log" "$changed_list" "(none)" "$branch" "refused"
    claim_move "$rel_task" "$QUEUE_DIR/tasks/failed/$(basename "$task_file")"
    git -C "$REPO" add "$QUEUE_DIR/tasks" "$RESULTS_DIR/$TASK_ID.md"
    git -C "$REPO" commit --quiet -m "queue: $TASK_ID failed (policy refusal)" \
      || die "refusal commit failed"
    push_if_remote
    rm -f "$body_file" "$POLICY_NOTES_FILE"
    return 0
  fi

  log "claimed task $TASK_ID: $TITLE"

  if git -C "$REPO" show-ref --verify --quiet "refs/heads/$branch"; then
    die "branch $branch already exists; task ids must be unique"
  fi
  git -C "$REPO" rev-parse --verify --quiet "$BASE" >/dev/null \
    || die "base branch '$BASE' does not exist"

  # Claim: pending -> running, committed + pushed immediately.
  claim_move "$rel_task" "$QUEUE_DIR/tasks/running/$(basename "$task_file")"
  git -C "$REPO" commit --quiet -m "queue: claim $TASK_ID" || die "claim commit failed"
  push_if_remote

  # Isolated worktree on a fresh branch.
  mkdir -p "$WORKTREES_DIR"
  git -C "$REPO" worktree add --quiet "$worktree" -b "$branch" "$BASE" \
    || die "git worktree add failed"

  # Disable repo-supplied executable config for this run only.
  NEUTRALIZED_PATHS=""
  neutralize_worktree "$worktree"

  # Build the headless command. Prompt goes as one argv element (no quoting
  # issues); stdout must be exactly one JSON object or result list.
  local prompt
  prompt="$(cat "$body_file")"
  local args=(-p --output-format json
    --permission-mode "$PERMISSION_MODE"
    --allowedTools "$ALLOWED_TOOLS"
    --max-turns "$MAX_TURNS"
    --max-budget-usd "$MAX_BUDGET")
  [ -n "$MODEL" ] && args+=(--model "$MODEL")
  [ "$BARE" = "true" ] && args+=(--bare)
  [ -n "$RESUME" ] && args+=(--resume "$RESUME")

  log "running claude -p in $worktree (max_turns=$MAX_TURNS, budget=\$$MAX_BUDGET, timeout=${TIMEOUT_SECS}s)"
  local exit_code=0
  run_claude_watchdog "$worktree" "$raw_json" "$stderr_log" || exit_code=$?
  log "claude exited with code $exit_code"
  LAST_COST_USD="$(extract_cost "$raw_json")"

  # Undo the runtime-only neutralization before anything is committed.
  restore_neutralized "$worktree"

  local status="done"
  [ "$exit_code" -eq 0 ] || status="failed"

  # Secret scan gates the commit: on a hit, nothing is committed or
  # pushed and the task fails with the offending files named.
  local changed="" scan_hits=""
  if scan_hits="$(secret_scan "$worktree")"; then
    printf '%s\n' "secret scan: clean" >> "$POLICY_NOTES_FILE"
    if ( cd "$worktree" && git add -A && ! git diff --cached --quiet ); then
      ( cd "$worktree" && git commit --quiet -m "agent: $TITLE [$TASK_ID]" ) \
        || die "worktree commit failed"
      if has_remote; then
        ( cd "$worktree" && git push --quiet -u origin "$branch" ) \
          || log "WARNING: push of $branch failed (commit stays local)"
      fi
      changed="$(cd "$worktree" && git show --stat --format='%h %s' HEAD)"
    fi
  else
    status="failed"
    printf '%s\n' "secret scan: HIT, commit and push withheld" >> "$POLICY_NOTES_FILE"
    while IFS= read -r scan_hits; do
      [ -n "$scan_hits" ] && printf 'secret scan hit: %s\n' "$scan_hits" >> "$POLICY_NOTES_FILE"
    done <<EOF
$scan_hits
EOF
    changed="(withheld: secret scan hit, nothing committed)"
    log "secret scan hit for $TASK_ID, commit withheld"
  fi
  printf '%s\n' "$changed" > "$changed_list"

  write_report "$status" "$RESULTS_DIR/$TASK_ID.md" \
    "$raw_json" "$stderr_log" "$changed_list" "$worktree" "$branch" "$exit_code"

  claim_move "$QUEUE_DIR/tasks/running/$(basename "$task_file")" \
    "$QUEUE_DIR/tasks/$status/$(basename "$task_file")"
  git -C "$REPO" add "$QUEUE_DIR/tasks" "$RESULTS_DIR/$TASK_ID.md"
  git -C "$REPO" commit --quiet -m "queue: $TASK_ID $status" || die "result commit failed"
  push_if_remote

  if [ "$KEEP_WORKTREE" != "1" ]; then
    git -C "$REPO" worktree remove --force "$worktree" 2>/dev/null || true
    log "worktree removed: $worktree"
  else
    log "worktree kept for review: $worktree"
  fi
  rm -f "$body_file" "$POLICY_NOTES_FILE"
  log "task $TASK_ID -> $status (report: $QUEUE_DIR/results/$TASK_ID.md)"
  return 0
}

main() {
  cd "$REPO" || die "cannot cd to $REPO"
  git rev-parse --git-dir >/dev/null 2>&1 || die "$REPO is not a git repo"
  command -v "$CLAUDE_BIN" >/dev/null 2>&1 \
    || die "claude not found (looked for '$CLAUDE_BIN'). Run 'which claude' in your terminal, then set CLAUDE_BIN to that path."
  command -v python3 >/dev/null 2>&1 || die "python3 not found"

  mkdir "$LOCK_DIR" 2>/dev/null || die "another runner holds the lock ($LOCK_DIR)"
  trap 'release_lock; restore_branch' EXIT

  mkdir -p "$TASKS_DIR"/{pending,running,done,failed} "$RESULTS_DIR" "$RUNS_DIR"

  # Never touch a dirty checkout. Queue-internal files (dropped-in tasks,
  # local run logs) are excluded: they must not block the runner.
  [ -z "$(git -C "$REPO" status --porcelain -- ":!$QUEUE_DIR")" ] \
    || { log "working tree has uncommitted changes, skipping this run"; exit 2; }

  START_BRANCH="$(git -C "$REPO" branch --show-current)"
  [ -n "$START_BRANCH" ] || die "detached HEAD; check out a branch first"

  if [ "$START_BRANCH" != "$QUEUE_BRANCH" ]; then
    git -C "$REPO" checkout --quiet "$QUEUE_BRANCH" || die "cannot check out $QUEUE_BRANCH"
  fi
  sync_queue_branch

  # Run logs stay local-only; ignore them from the first run on.
  if [ ! -f "$REPO/$QUEUE_DIR/.gitignore" ]; then
    printf 'runs/\n' > "$REPO/$QUEUE_DIR/.gitignore"
    git -C "$REPO" add "$QUEUE_DIR/.gitignore"
    git -C "$REPO" commit --quiet -m "queue: ignore local run logs" || true
    push_if_remote
  fi

  local processed=0 rc=0
  while [ "$processed" -lt "$MAX_TASKS" ]; do
    if daily_cap_reached; then
      log "daily cap reached (max $POLICY_DAILY_MAX_TASKS tasks / \$$POLICY_DAILY_MAX_USD per day), leaving tasks pending"
      break
    fi
    process_one || rc=$?
    [ "$rc" -eq 2 ] && break
    [ "$rc" -ne 0 ] && exit "$rc"
    daily_cap_add "$LAST_COST_USD"
    processed=$((processed + 1))
    rc=0
  done
  log "run finished: $processed task(s) processed"
}

main "$@"
