#!/usr/bin/env bash
#
# agent-queue runner — file-queue + git orchestration for headless Claude Code.
#
# One run processes up to MAX_TASKS (default 1) from .agent-queue/tasks/pending/
# in the target repo:
#   1. claim the task (pending -> running, committed + pushed)
#   2. create an isolated git worktree on branch agent/<task-id>
#   3. run `claude -p` headless inside the worktree
#   4. commit + push whatever changed on agent/<task-id> (even on failure,
#      so partial work is never lost)
#   5. write .agent-queue/results/<task-id>.md and move the task to done/failed/
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
#   - Never passes --dangerously-skip-permissions; every run is capped by
#     --max-turns and --max-budget-usd from the task file.
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

# Build the result report from the run artifacts.
write_report() {
  local status="$1" report="$2" raw_json="$3" stderr_log="$4"
  local changed_files="$5" worktree="$6" branch="$7" exit_code="$8"
  python3 - "$report" "$raw_json" "$stderr_log" "$changed_files" \
    "$status" "$TASK_ID" "$TITLE" "$worktree" "$branch" "$exit_code" <<'PYEOF'
import json, sys

(report, raw_json, stderr_log, changed_files, status, task_id, title,
 worktree, branch, exit_code) = sys.argv[1:11]
result, session_id, cost, turns = "", "", "", ""
try:
    d = json.load(open(raw_json, encoding="utf-8"))
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

process_one() {
  local task_file
  task_file="$(find "$TASKS_DIR/pending" -maxdepth 1 -type f -name '*.md' \
    | LC_ALL=C sort | head -n 1)"
  [ -n "$task_file" ] || { log "queue empty, nothing to do"; return 2; }

  local rel_task="${task_file#"$REPO"/}"
  local body_file run_dir raw_json stderr_log changed_list
  body_file="$(mktemp)"
  parse_task "$task_file" "$body_file"

  local branch="agent/$TASK_ID"
  local worktree="$WORKTREES_DIR/$TASK_ID"
  run_dir="$RUNS_DIR/$TASK_ID"
  raw_json="$run_dir/claude-output.json"
  stderr_log="$run_dir/claude-stderr.log"
  changed_list="$run_dir/changed-files.txt"
  mkdir -p "$run_dir"

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

  # Build the headless command. Prompt goes as one argv element (no quoting
  # issues); stdout must be exactly one JSON object.
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

  local timeout_cmd=()
  if command -v gtimeout >/dev/null 2>&1; then timeout_cmd=(gtimeout "$TIMEOUT_SECS")
  elif command -v timeout >/dev/null 2>&1; then timeout_cmd=(timeout "$TIMEOUT_SECS")
  else log "WARNING: no timeout/gtimeout found, run is unbounded by wall clock"; fi

  log "running claude -p in $worktree (max_turns=$MAX_TURNS, budget=\$$MAX_BUDGET)"
  local exit_code=0
  # Two branches instead of an empty array: macOS /bin/bash is 3.2, where
  # expanding an empty "${arr[@]}" under `set -u` is an error.
  if [ "${#timeout_cmd[@]}" -gt 0 ]; then
    ( cd "$worktree" && "${timeout_cmd[@]}" "$CLAUDE_BIN" "${args[@]}" "$prompt" \
        >"$raw_json" 2>"$stderr_log" ) || exit_code=$?
  else
    ( cd "$worktree" && "$CLAUDE_BIN" "${args[@]}" "$prompt" \
        >"$raw_json" 2>"$stderr_log" ) || exit_code=$?
  fi
  log "claude exited with code $exit_code"

  # Commit whatever changed on the task branch, success or failure.
  local changed=""
  if ( cd "$worktree" && git add -A && ! git diff --cached --quiet ); then
    ( cd "$worktree" && git commit --quiet -m "agent: $TITLE [$TASK_ID]" ) \
      || die "worktree commit failed"
    if has_remote; then
      ( cd "$worktree" && git push --quiet -u origin "$branch" ) \
        || log "WARNING: push of $branch failed (commit stays local)"
    fi
    changed="$(cd "$worktree" && git show --stat --format='%h %s' HEAD)"
  fi
  printf '%s\n' "$changed" > "$changed_list"

  local status="done"
  [ "$exit_code" -eq 0 ] || status="failed"

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
  rm -f "$body_file"
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
    process_one || rc=$?
    [ "$rc" -eq 2 ] && break
    [ "$rc" -ne 0 ] && exit "$rc"
    processed=$((processed + 1))
    rc=0
  done
  log "run finished: $processed task(s) processed"
}

main "$@"
