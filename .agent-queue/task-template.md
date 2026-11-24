---
id: "20261115-example-task"
title: "One-line summary, used as the git commit message"
base: "main"
model: ""
allowed_tools: "Read,Edit,Glob,Grep,Bash"
permission_mode: "acceptEdits"
max_turns: 30
max_budget_usd: 5
bare: false
resume: ""
timeout_secs: 1800
---

Write the task prompt here, exactly as you would paste it into Claude Code.
The runner passes this whole body as one prompt to `claude -p` inside an
isolated git worktree on branch `agent/<id>`.

Frontmatter fields:

- id (required): lowercase letters, digits, `.`, `_`, `-`. Date-prefix it
  so lexical order is chronological order. Must be unique per repo.
- title (required): one line, becomes the commit message on the task branch.
- base: branch the worktree starts from (default: main).
- model: empty means the CLI default. Set only to pin a model.
- allowed_tools: permission-rule syntax, e.g. "Read,Edit,Bash(npm test *)".
  Bare tool names allow the tool outright; Bash(...) scopes shell commands.
- permission_mode: acceptEdits (edits auto-approved, anything else must be
  in allowed_tools) or dontAsk (stricter: anything needing approval is
  denied). Never bypassPermissions on unattended runs.
- max_turns / max_budget_usd: hard caps for the run. No cap exists unless
  you set one; the defaults above are the scaffold's.
- bare: true skips CLAUDE.md, hooks, skills, plugins and MCP servers.
  Default false keeps the repo's normal Claude Code setup.
- resume: a session_id from a previous result report, to continue that
  session instead of starting fresh. Empty for a new session.
- timeout_secs: wall-clock kill switch (needs gtimeout or GNU timeout;
  on macOS install coreutils, otherwise the run is unbounded by time).

The runner never passes --dangerously-skip-permissions. If a task needs
something outside allowed_tools, widen that field deliberately, in the
task file, where it stays visible in git history.
