# opencode-monitor-plugin Design

## Overview

OpenCode plugin for collecting and querying token usage statistics and session logs (input/output of model interactions). Data stored in files under `~/.local/share/opencode/opencode-monitor-plugin/`.

## Stack

- TypeScript
- npm package
- `@opencode-ai/plugin` v1.14.41
- Package name: `@opencode-ai/opencode-monitor-plugin`

## Data Flow

```
event hook (message.updated) ──→ token-collector ──→ token_status/YYYY-MM-DD.csv
chat.message hook               ──→ session-collector ──→ session-logs/YYYY-MM-DD.jsonl

Tool/CLI ──→ queries/token-query.ts ──→ SDK (live) + CSV (historical) → markdown/ascii-table
Tool/CLI ──→ queries/session-query.ts ──→ JSONL → text output
```

## Architecture

### File Structure

```
opencode-monitor-plugin/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                      # plugin entry
│   ├── collectors/
│   │   ├── token-collector.ts        # event → CSV
│   │   └── session-collector.ts      # chat.message → JSONL
│   ├── storage/
│   │   ├── csv-writer.ts             # append to CSV by date
│   │   └── jsonl-writer.ts           # append to JSONL by date
│   ├── queries/
│   │   ├── token-query.ts            # read CSV + aggregate
│   │   └── session-query.ts          # read/search JSONL
│   ├── tools/
│   │   └── token-status.ts           # opencode tool
│   └── cli/
│       ├── index.ts                  # CLI entry
│       └── commands/
│           ├── token-status.ts       # CLI token query
│           └── session-log.ts        # CLI log viewer
```

### File Storage

Root: `~/.local/share/opencode/opencode-monitor-plugin/`

```
token_status/
  2026-05-14.csv
  2026-05-15.csv
  ...

session-logs/
  2026-05-14.jsonl
  2026-05-15.jsonl
  ...
```

### File Schemas

#### token_status CSV

```
timestamp,agent,session_id,provider_id,model_id,input_tokens,output_tokens,reasoning_tokens,cache_read,cache_write,cost
```

No header row written per file; tool reads and parses with known column order. Files split by date (UTC). One row per `message.updated` event.

#### session-logs JSONL

One JSON object per line:

```json
{
  "timestamp": "2026-05-14T06:55:42.000Z",
  "agent": "default",
  "session_id": "58a91aab-63d2-4e12-ab4e-ca3342260b0f",
  "input": "user query text",
  "output": "model response in markdown",
  "thinking": "reasoning chain (optional)",
  "skills": ["skill-name"]
}
```

### Data Collection

**token-collector:**
- Hook: `event` → filter `type === "message.updated"` → check `properties.info` has `tokens` field (AssistantMessage)
- Extract: timestamp from event, agent from session context, `info.tokens`, `info.cost`, `info.modelID`, `info.providerID`
- Write: append row to `token_status/YYYY-MM-DD.csv`

**session-collector:**
- Hook: `chat.message` → receives UserMessage input and Parts[]
- On each UserMessage→AssistantMessage pair: extract text parts from input, text+reasoning parts from output
- Write: append JSON line to `session-logs/YYYY-MM-DD.jsonl`

### Tool: token_status

Registered as opencode tool with parameters from requirement:
- `session_id` (optional): query live via `client.session.messages()` if provided
- `include_children` (optional): recurse into child sessions
- `agent_view` / `agent_sort` / `agent_top_n`: filtering and sorting
- `trend_days` / `scope`: read CSV files, aggregate by date
- `compact` / `debug`: output control

Output: markdown table with sections:
1. Current session summary (live SDK)
2. Agent breakdown table
3. Trend chart (sparklines or simple text table)
4. Debug info (if debug=true)

### CLI

Entry via package bin (`opencode-monitor`):

```
opencode-monitor token-status [options]
    --session-id <id>        Session ID (default: current)
    --include-children       Include child sessions
    --agent-view <view>      execution|initiator|both
    --agent-sort <sort>      cost|tokens
    --agent-top-n <n>        Show top N agents
    --trend-days <n>         Days for trend analysis
    --scope <scope>          project|all
    --compact                Skip heavy tables
    --debug                  Debug info

opencode-monitor session-log <session-id>
opencode-monitor session-log list [--date YYYY-MM-DD]
opencode-monitor session-log search <text> [--date YYYY-MM-DD]
```

### Error Handling

- SDK unavailable: show "SDK unavailable, using file data" + fallback to CSV/JSONL
- Corrupted file line: skip + log warning
- Empty result: "No data found"
- File lock contention: single retry, skip on failure
- Large files: streaming reads (line-by-line for CSV/JSONL), no full load
- Fresh session with no data: "Session active, no token data yet"

### Testing

- Unit: CSV/JSONL parsing, aggregation logic
- Integration: hook → file write → tool read pipeline
