# session-log Params Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add filter parameters to `session-log <session-id>` to match `--flag=value` style of `token-status` and `cleanup` commands.

**Architecture:** Extend `runSessionLogCLI()` to accept additional filter parameters (`LogFilters` interface), update CLI dispatcher to pass parsed args, and add field filtering in output display.

**Tech Stack:** TypeScript, Node.js test runner (`node:test`), JSONL reader

---

### Task 1: Update LogFilters interface and runSessionLogCLI signature

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.ts:4-10`

- [ ] **Step 1: Read current LogFilters interface**

```typescript
interface LogFilters {
  sessionId?: string;
  searchText?: string;
  date?: string;
}
```

- [ ] **Step 2: Update LogFilters to include new filter parameters**

```typescript
interface LogFilters {
  sessionId?: string;
  searchText?: string;
  date?: string;
  // New filters
  since?: string;
  until?: string;
  agent?: string;
  field?: "input" | "output" | "thinking" | "all";
  tail?: number;
  error?: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.ts
git commit -m "feat(session-log): add filter params to LogFilters interface"
```

---

### Task 2: Implement filter logic in runSessionLogCLI

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.ts:32-54`

- [ ] **Step 1: Write failing test for filter logic**

Create file `src/cli/commands/session-log.test.ts`:

```typescript
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSessionLogCLI } from "./session-log.js";

let testNum = 0;
function freshDir(): string {
  const dir = join(tmpdir(), "monitor-session-test-" + Date.now() + "-" + (testNum++));
  return dir;
}

function writeSessionRecord(base: string, record: object) {
  const dir = join(base, "session-logs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "2026-05-14.jsonl"), JSON.stringify(record) + "\n");
}

describe("session-log filters", () => {
  it("should filter by date", () => {
    const base = freshDir();
    writeSessionRecord(base, { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "test1", output: "result1" });
    writeSessionRecord(base, { timestamp: "2026-05-15T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "test2", output: "result2" });
    
    const output = runSessionLogCLI("view", { sessionId: "sess-1", date: "2026-05-14" }, base);
    assert.match(output, /test1/);
    assert.notMatch(output, /test2/);
  });

  it("should filter by agent", () => {
    const base = freshDir();
    writeSessionRecord(base, { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "feature input" });
    writeSessionRecord(base, { timestamp: "2026-05-14T11:00:00.000Z", session_id: "sess-1", agent: "explore", input: "explore input" });
    
    const output = runSessionLogCLI("view", { sessionId: "sess-1", agent: "feature" }, base);
    assert.match(output, /feature input/);
    assert.notMatch(output, /explore input/);
  });

  it("should return tail N records", () => {
    const base = freshDir();
    for (let i = 1; i <= 10; i++) {
      writeSessionRecord(base, { timestamp: `2026-05-14T${String(i).padStart(2,"0")}:00:00.000Z`, session_id: "sess-1", agent: "feature", input: `input${i}`, output: `output${i}` });
    }
    
    const output = runSessionLogCLI("view", { sessionId: "sess-1", tail: 3 }, base);
    assert.match(output, /input10/);
    assert.notMatch(output, /input1/);
  });

  it("should filter by error", () => {
    const base = freshDir();
    writeSessionRecord(base, { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", output: "ok" });
    writeSessionRecord(base, { timestamp: "2026-05-14T11:00:00.000Z", session_id: "sess-1", agent: "feature", output: "error output", error: { type: "api_error", message: "timeout" } });
    
    const output = runSessionLogCLI("view", { sessionId: "sess-1", error: true }, base);
    assert.match(output, /error output/);
    assert.notMatch(output, /^ok$/m);
  });

  it("should show only specified field", () => {
    const base = freshDir();
    writeSessionRecord(base, { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "user input", output: "ai output", thinking: "reasoning" });
    
    const outputInput = runSessionLogCLI("view", { sessionId: "sess-1", field: "input" }, base);
    assert.match(outputInput, /user input/);
    assert.notMatch(outputInput, /ai output/);
    
    const outputThinking = runSessionLogCLI("view", { sessionId: "sess-1", field: "thinking" }, base);
    assert.match(outputThinking, /reasoning/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npm test -- session-log.test.ts`
Expected: FAIL (filters not implemented yet)

- [ ] **Step 3: Update runSessionLogCLI to accept base path and filters**

Update function signature from:
```typescript
export function runSessionLogCLI(action: string, filters: LogFilters): string
```
to:
```typescript
export function runSessionLogCLI(action: string, filters: LogFilters, basePath?: string): string
```

- [ ] **Step 4: Add filter logic in view action**

Modify the view action (around line 32) to apply filters before outputting:

```typescript
if (action === "view" && filters.sessionId) {
  let records = readJSONL(base, "session-logs");
  
  // Apply filters
  if (filters.date) {
    records = records.filter((r) => String(r.timestamp).slice(0, 10) === filters.date);
  }
  if (filters.since) {
    records = records.filter((r) => String(r.timestamp).slice(0, 10) >= filters.since);
  }
  if (filters.until) {
    records = records.filter((r) => String(r.timestamp).slice(0, 10) <= filters.until);
  }
  if (filters.agent) {
    records = records.filter((r) => String(r.agent) === filters.agent);
  }
  if (filters.error) {
    records = records.filter((r) => r.error !== undefined && r.error !== null);
  }
  
  // Apply tail after other filters
  if (filters.tail && filters.tail > 0) {
    records = records.slice(-filters.tail);
  }
  
  // Rest of existing logic...
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run build && npm test -- session-log.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/session-log.ts src/cli/commands/session-log.test.ts
git commit -m "feat(session-log): add filter params - date, agent, tail, error, field"
```

---

### Task 3: Update CLI dispatcher to pass parsed args to session-log

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/cli/index.ts:33-46`

- [ ] **Step 1: Update session-log case in main() to pass parsed args**

Current code (lines 33-46):
```typescript
case "session-log": {
  const sub = args[1];
  if (sub === "list") {
    console.log(runSessionLogCLI("list", {}));
  } else if (sub === "search") {
    const text = args.slice(2).join(" ");
    console.log(runSessionLogCLI("search", { searchText: text }));
  } else if (sub) {
    console.log(runSessionLogCLI("view", { sessionId: sub }));
  } else {
    console.log(runSessionLogCLI("help", {}));
  }
  break;
}
```

New code:
```typescript
case "session-log": {
  const sub = args[1];
  const opts = parseArgs(args);
  
  if (sub === "list") {
    console.log(runSessionLogCLI("list", {}, base));
  } else if (sub === "search") {
    const text = args.slice(2).join(" ");
    console.log(runSessionLogCLI("search", { searchText: text }, base));
  } else if (sub) {
    // Build filters from parsed args
    const filters = {
      sessionId: sub,
      date: opts.date as string | undefined,
      since: opts.since as string | undefined,
      until: opts.until as string | undefined,
      agent: opts.agent as string | undefined,
      field: (opts.field as "input" | "output" | "thinking" | "all") || "all",
      tail: opts.tail as number | undefined,
      error: opts.error === true,
    };
    console.log(runSessionLogCLI("view", filters, base));
  } else {
    console.log(runSessionLogCLI("help", {}, base));
  }
  break;
}
```

Note: Need to define `base` at the top of main() using getDataDir(). Add import at top:
```typescript
import { getDataDir } from "./paths.js";
```

And at start of main():
```typescript
const base = getDataDir();
```

- [ ] **Step 2: Build and test manually**

Run: `npm run build`
Run: `cd /tmp && mkdir -p test-session && echo '{"timestamp":"2026-05-14T10:00:00Z","session_id":"test-1","agent":"feature","input":"hello"}' > session-logs/2026-05-14.jsonl`

Actually, test with real data dir or mock. Verify basic view works.

- [ ] **Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat(session-log): wire filter args in CLI dispatcher"
```

---

### Task 4: Update help text and README

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/cli/index.ts:64-86`
- Modify: `opencode/plugins/opencode-monitor-plugin/README.md`

- [ ] **Step 1: Update help text in default case**

Add to the usage string (around line 64-86):

```
Options for session-log:
  --date <YYYY-MM-DD>     Filter by specific date
  --since <YYYY-MM-DD>    Filter from date (inclusive)
  --until <YYYY-MM-DD>    Filter until date (inclusive)
  --agent <name>          Filter by agent name
  --field <field>         Field to show: input|output|thinking|all
  --tail <N>              Show last N records
  --error                 Show only records with errors
```

- [ ] **Step 2: Update README with session-log params**

Add/update session-log section in README.md with filter parameters table.

- [ ] **Step 3: Commit**

```bash
git add src/cli/index.ts README.md
git commit -m "docs(session-log): add filter params to help and README"
```

---

### Task 5: Final verification

**Files:**
- Run tests: `npm run test`
- Build: `npm run build`

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: All pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(session-log): final verification and build"
```

---

## Execution

**Plan complete.** Files modified:
- `src/cli/commands/session-log.ts` - filter logic
- `src/cli/commands/session-log.test.ts` - new tests
- `src/cli/index.ts` - dispatcher update + help
- `README.md` - documentation

Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?