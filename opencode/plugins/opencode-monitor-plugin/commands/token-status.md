---
description: Show detailed token usage for the current or specified session
---

# Token Status

Show detailed token usage data collected by the monitor plugin.

## Usage

- `/token-status` — default summary
- `/token-status daily=true` — daily breakdown
- `/token-status agent_view=execution` — filter by agent
- `/token-status trend_days=30` — 30-day trend

## Execution

Use the `token_status` tool to retrieve and display the data with the arguments provided:

```
$ARGUMENTS
```

Parse these arguments as key=value pairs and pass them to the `token_status` tool. Show the result directly to the user.
