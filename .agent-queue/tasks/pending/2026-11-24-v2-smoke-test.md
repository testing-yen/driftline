---
id: "2026-11-24-v2-smoke-test"
title: "V2 smoke test: create V2-SMOKE.md"
base: "main"
model: ""
allowed_tools: "Read,Edit,Write,Bash"
permission_mode: "acceptEdits"
max_turns: 10
max_budget_usd: 2
bare: false
resume: ""
timeout_secs: 600
---

Create a file named V2-SMOKE.md at the repository root containing exactly one line:

agent-queue runner v2 smoke test

Make no other changes. Do not run the test suite. When the file exists, stop and report what you did in one sentence.
