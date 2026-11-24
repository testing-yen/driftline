# Result: <title>

- task: `<id>`
- status: **done** | **failed** (claude exit code N)
- branch: `agent/<id>`
- worktree: `<absolute path>`
- session_id: `<id or empty>`
- total_cost_usd: `<estimate>`
- num_turns: `<n>`

## Files changed

```
<git show --stat of the task-branch commit, or (none)>
```

## Agent result

<the `result` field of the claude JSON output, truncated at 12000 chars>

## stderr (last 30 lines)

<only when status is failed>

## Continue this session

<only when a session_id exists: new task file with resume: "<session_id>">
