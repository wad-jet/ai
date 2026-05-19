# Code Quality Fixes Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared utilities, improve type hygiene, isolate tests, and refactor `runSessionLogCLI` from monolithic to modular.

**Architecture:** 6 tasks, each independently testable. Foundation first (constants, utils), then mechanical refactors (magic strings, type extraction), then higher-risk changes (test isolation, function split). All changes are refactoring-only — no behavioural changes.

**Tech Stack:** TypeScript, node:test, ESM

**Files Created:**
- `src/constants.ts` — shared string constants
- `src/storage/utils.ts` — shared datePartition utility

**Files Modified:**
- `src/storage/csv-writer.ts`
- `src/storage/jsonl-writer.ts`
- `src/storage/csv-writer.test.ts`
- `src/storage/jsonl-writer.test.ts`
- `src/queries/token-query.ts`
- `src/cli/commands/session-log.ts`
- `src/cli/commands/session-log.test.ts`
- `src/collectors/session-collector.ts`
- `src/collectors/session-collector.test.ts`
- `src/collectors/token-collector.ts`
- `src/collectors/token-collector.test.ts`
- `src/index.ts`
- `src/index.test.ts`
- `src/cli/commands/cleanup.ts`
- `src/cli/commands/token-status.ts`
- `src/queries/token-query.test.ts`

---
### Task 1: Create shared constants and utilities

**Files:**
- Create: `src/constants.ts`
- Create: `src/storage/utils.ts`
- Modify: `src/storage/csv-writer.ts`
- Modify: `src/storage/jsonl-writer.ts`
- Modify: `src/queries/token-query.ts`

- [ ] **Step 1: Create `src/constants.ts`**

```typescript
export const SESSION_LOGS = "session-logs";
export const TOKEN_STATUS = "token-status";
```

- [ ] **Step 2: Create `src/storage/utils.ts`**

```typescript
export function datePartition(): string {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 3: Update `csv-writer.ts` — remove local `datePartition`, import from utils**

Delete lines 4-6 (`function datePartition`) from `src/storage/csv-writer.ts`.
Add import at top:

```typescript
import { datePartition } from "./utils.js";
```

- [ ] **Step 4: Update `jsonl-writer.ts` — remove local `datePartition`, import from utils**

Delete lines 4-6 (`function datePartition`) from `src/storage/jsonl-writer.ts`.
Add import at top:

```typescript
import { datePartition } from "./utils.js";
```

- [ ] **Step 5: Add `roundCost` helper to `token-query.ts`**

Add after the `COL` const (around line 8):

```typescript
function roundCost(cost: number): number {
  return Math.round(cost * 1e6) / 1e6;
}
```

Then replace 3 usages of `Math.round(... * 1e6) / 1e6` with `roundCost(...)`:

Line 33: `summary.totalCost = Math.round(summary.totalCost * 1e6) / 1e6;`
→ `summary.totalCost = roundCost(summary.totalCost);`

Line 72-74 in `queryDailyBreakdown`:
```typescript
    entry.cost = Math.round(entry.cost * 1e6) / 1e6;
```
→
```typescript
    entry.cost = roundCost(entry.cost);
```

Line 97-99 in `queryAgentBreakdown`:
```typescript
    entry.cost = Math.round(entry.cost * 1e6) / 1e6;
```
→
```typescript
    entry.cost = roundCost(entry.cost);
```

- [ ] **Step 6: Build and run tests**

Run: `cd /Users/odemidov/Documents/dev/github/ai/opencode/plugins/opencode-monitor-plugin && npm run build && node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail

- [ ] **Step 7: Commit**

```bash
git add src/constants.ts src/storage/utils.ts src/storage/csv-writer.ts src/storage/jsonl-writer.ts src/queries/token-query.ts
git commit -m "refactor: extract shared constants, datePartition, and roundCost utilities"
```

---

### Task 2: Extract `PartUpdateEvent` interface + remove `_columns` parameter

**Files:**
- Modify: `src/collectors/session-collector.ts`
- Modify: `src/storage/csv-writer.ts`
- Modify: `src/collectors/token-collector.ts`
- Modify: `src/queries/token-query.test.ts`
- Modify: `src/storage/csv-writer.test.ts`

- [ ] **Step 1: Add `PartUpdateEvent` interface to `session-collector.ts`**

Add after line 19 (`PendingPart` interface):

```typescript
interface PartUpdateEvent {
  properties?: {
    part?: {
      id?: string;
      type?: string;
      text?: string;
      messageID?: string;
      time?: { end?: number };
    };
  };
}
```

Then update `handlePartUpdate` signature (line 80-82). Replace:

```typescript
export function handlePartUpdate(
  base: string,
  event: { properties?: { part?: { id?: string; type?: string; text?: string; messageID?: string; time?: { end?: number } } } },
): void {
```

With:

```typescript
export function handlePartUpdate(
  base: string,
  event: PartUpdateEvent,
): void {
```

- [ ] **Step 2: Remove `_columns` parameter from `appendCSV`**

In `src/storage/csv-writer.ts`, change the function signature from:

```typescript
export function appendCSV(
  baseDir: string,
  subdir: string,
  _columns: string[],
  values: string[],
  date?: string,
): void {
```

To:

```typescript
export function appendCSV(
  baseDir: string,
  subdir: string,
  values: string[],
  date?: string,
): void {
```

- [ ] **Step 3: Update call sites for `appendCSV`**

**In `src/collectors/token-collector.ts`** (line 35):
```typescript
  appendCSV(base, "token-status", COLUMNS, [
```
→
```typescript
  appendCSV(base, "token-status", [
```

Remove the `COLUMNS` constant declaration (lines 23-26, the array) since it's no longer used.

**In `src/queries/token-query.test.ts`** — 1 call site in `writeCSV` helper (line 26):
```typescript
    appendCSV(base, "token-status", cols, row, date);
```
→
```typescript
    appendCSV(base, "token-status", row, date);
```

Also update `src/storage/csv-writer.test.ts` — 2 calls (lines 22, 31):

Line 22: `appendCSV(tmpDir, "test-tokens", cols, vals);`
→ `appendCSV(tmpDir, "test-tokens", vals);`

Line 31: `appendCSV(tmpDir, "test-tokens", ["ts", "agent", "tokens"], ["2026-01-01", "agent-a", "50"]);`
→ `appendCSV(tmpDir, "test-tokens", ["2026-01-01", "agent-a", "50"]);`

Also line 32: same pattern. Remove the `cols` argument from all calls.

- [ ] **Step 4: Build and run tests**

Run: `npm run build && node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add src/collectors/session-collector.ts src/storage/csv-writer.ts src/collectors/token-collector.ts src/queries/token-query.test.ts src/storage/csv-writer.test.ts
git commit -m "refactor: extract PartUpdateEvent interface, remove unused _columns param"
```

---

### Task 3: Replace magic strings with constants

**Files:**
- Modify: `src/index.ts`
- Modify: `src/collectors/session-collector.ts`
- Modify: `src/collectors/token-collector.ts`
- Modify: `src/cli/commands/cleanup.ts`
- Modify: `src/cli/commands/session-log.ts`
- Modify: `src/queries/token-query.ts`
- Modify: `src/index.test.ts`
- Modify: `src/collectors/session-collector.test.ts`
- Modify: `src/collectors/token-collector.test.ts`
- Modify: `src/queries/token-query.test.ts`
- Modify: `src/storage/csv-writer.test.ts`
- Modify: `src/storage/jsonl-writer.test.ts`
- Modify: `src/tools/token-status.ts`

- [ ] **Step 1: Replace all `"session-logs"` with `SESSION_LOGS` constant**

In every file that uses the string `"session-logs"` (excluding plan/spec .md files), replace with `SESSION_LOGS` and add the import from `../../constants.js` (or appropriate relative path).

Files and their import paths:
- `src/index.ts` → `import { SESSION_LOGS } from "./constants.js";`
- `src/collectors/session-collector.ts` → `import { SESSION_LOGS } from "../constants.js";`
- `src/cli/commands/session-log.ts` → `import { SESSION_LOGS } from "../../constants.js";`
- `src/cli/commands/cleanup.ts` → `import { SESSION_LOGS } from "../../constants.js";`
- `src/index.test.ts` — not needed (doesn't reference string directly, uses handleChatMessage)
- `src/collectors/session-collector.test.ts` — not needed (uses handleChatMessage, doesn't reference string directly)
- `src/storage/csv-writer.test.ts` — uses "test-tokens" not "session-logs"
- `src/storage/jsonl-writer.test.ts` — uses "test-logs" not "session-logs"

**NOTE:** `src/index.test.ts` does NOT directly use the string `"session-logs"` or `"token-status"` — it uses `readCSV(BASE, "token-status", 11)` and `readJSONL(BASE, "session-logs")`. These should be updated too.

- [ ] **Step 2: Replace all `"token-status"` with `TOKEN_STATUS` constant**

Files:
- `src/index.ts` — not used directly
- `src/collectors/token-collector.ts` → `import { TOKEN_STATUS } from "../constants.js";`
- `src/cli/commands/cleanup.ts` → `import { TOKEN_STATUS } from "../../constants.js";`
- `src/queries/token-query.ts` → `import { TOKEN_STATUS } from "../constants.js";`
- `src/tools/token-status.ts` → `import { TOKEN_STATUS } from "../constants.js";`
- `src/index.test.ts` — `readCSV(BASE, "token-status", 11)` → use constant
- `src/collectors/token-collector.test.ts` — `readCSV(BASE, "token-status", 11)` → use constant
- `src/queries/token-query.test.ts` — `appendCSV(base, "token-status", ...)` → use constant
- `src/storage/csv-writer.test.ts` — `readCSV(tmpDir, "test-tokens", 3)` — NOT "token-status", skip

**IMPORTANT:** Each import path must be correct relative to the file. Check that `../../constants.js` vs `../constants.js` is correct for each file:

| File | Relative to src/ | Import path |
|------|-----------------|-------------|
| `src/index.ts` | `src/` | `"./constants.js"` |
| `src/collectors/session-collector.ts` | `src/collectors/` | `"../constants.js"` |
| `src/collectors/token-collector.ts` | `src/collectors/` | `"../constants.js"` |
| `src/collectors/token-collector.test.ts` | `src/collectors/` | `"../constants.js"` |
| `src/queries/token-query.ts` | `src/queries/` | `"../constants.js"` |
| `src/queries/token-query.test.ts` | `src/queries/` | `"../constants.js"` |
| `src/cli/commands/cleanup.ts` | `src/cli/commands/` | `"../../constants.js"` |
| `src/cli/commands/session-log.ts` | `src/cli/commands/` | `"../../constants.js"` |
| `src/tools/token-status.ts` | `src/tools/` | `"../constants.js"` |
| `src/index.test.ts` | `src/` | `"./constants.js"` |

- [ ] **Step 3: Build and run tests**

Run: `npm run build && node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail

- [ ] **Step 4: Commit**

```bash
git add src/constants.ts src/index.ts src/collectors/session-collector.ts src/collectors/token-collector.ts src/collectors/token-collector.test.ts src/queries/token-query.ts src/queries/token-query.test.ts src/cli/commands/cleanup.ts src/cli/commands/session-log.ts src/tools/token-status.ts src/index.test.ts src/storage/csv-writer.test.ts src/storage/jsonl-writer.test.ts
git commit -m "refactor: replace magic strings with SESSION_LOGS and TOKEN_STATUS constants"
```

---

### Task 4: Isolate session-collector tests with `freshDir()`

**Files:**
- Modify: `src/collectors/session-collector.test.ts`

- [ ] **Step 1: Add `freshDir()` helper**

At the top of `src/collectors/session-collector.test.ts`, after the imports, replace:

```typescript
const BASE = join(tmpdir(), "monitor-session-test-" + Date.now());
```

With:

```typescript
let testNum = 0;
function freshDir(): string {
  const dir = join(tmpdir(), "monitor-session-test-" + Date.now() + "-" + (testNum++));
  after(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  });
  return dir;
}
```

- [ ] **Step 2: Update each `it()` block to use `freshDir()`**

For each test, add `const BASE = freshDir();` at the start of the `it()` callback.

This affects ALL `it()` blocks in the file (23 tests across 2 describe blocks). Each gets its own isolated directory.

Example transformation for "should log user message as input":
```typescript
  it("should log user message as input", () => {
    const BASE = freshDir();
    const input = {
      sessionID: "session-1",
      agent: "default",
    };
    const output = {
      message: { role: "user" },
      parts: [{ type: "text", text: "Hello" }],
    };
    handleChatMessage({ base: BASE, input: input as any, output: output as any });
    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 1);
    ...
  });
```

- [ ] **Step 3: Replace index-based assertions with `find()` where needed**

Some tests use `records[N]` to find a specific record by position. With isolated dirs, each test has only its own records, so index-based access is safe. However, tests that rely on ALL records (e.g., `records.length` cross-test) need fixing.

Check these specific assertions:
- **"should handle messages without reasoning/thinking"** — line 68: `assert.equal(records.length, 3)`. With isolated BASE, this test creates 1 record (3rd call in original) → should be `assert.equal(records.length, 1)`.
- **"should log user message as input"** — line 31: `assert.equal(records.length, 1)`. Same → 1 record.
- **"should log assistant message as output with thinking"** — line 54: `assert.equal(records.length, 2)`. Was 2nd call in original, now 1st call in its own dir → `assert.equal(records.length, 1)`.
- **"should include reasoning when includeThinking is true"** — line 290-291: `records.find(r => r.session_id === "test-session")` — already uses find, safe.
- **"should exclude reasoning when includeThinking is false"** — same, uses find. Safe.

**Key rule for assertion updates:** Since each test now writes to its own directory, `records.length` will always equal the number of records written in THAT test only (not cumulative). If a test writes 1 record, `records.length` should be 1. If it writes 2 events (e.g., handlePartUpdate then flushAssistantOutput), it should be 1 flushed record (or similar).

Look at each test and determine how many records it creates, then update `records.length` assertions accordingly.

- [ ] **Step 4: Build and run tests**

Run: `npm run build && node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add src/collectors/session-collector.test.ts
git commit -m "test: isolate session-collector tests with freshDir pattern"
```

---

### Task 5: Split `runSessionLogCLI` into focused functions

**Files:**
- Modify: `src/cli/commands/session-log.ts`
- Modify: `src/cli/index.ts`

- [ ] **Step 1: Add `SessionLogAction` type and create helper functions**

In `src/cli/commands/session-log.ts`, replace the `runSessionLogCLI` function with this modular structure:

```typescript
import { readJSONL } from "../../storage/jsonl-writer.js";
import { getDataDir } from "../../paths.js";
import type { Config } from "../../config.js";

interface LogFilters {
  sessionId?: string;
  searchText?: string;
  date?: string;
  since?: string;
  until?: string;
  agent?: string;
  field?: "input" | "output" | "thinking" | "all";
  tail?: number;
  error?: boolean;
}

type SessionLogAction = "list" | "view" | "search" | "help";

function formatSessionList(basePath: string): string {
  const records = readJSONL(basePath, "session-logs");
  const sessions = new Map<string, { timestamp: string; session_id: string }>();
  for (const r of records) {
    const sid = String(r.session_id ?? "");
    if (sid && !sessions.has(sid)) {
      sessions.set(sid, { timestamp: String(r.timestamp ?? ""), session_id: sid });
    }
  }
  const lines: string[] = ["Available Sessions", "\u2550".repeat(60)];
  for (const s of sessions.values()) {
    lines.push(`  ${s.timestamp}  ${s.session_id}`);
  }
  if (sessions.size === 0) lines.push("  No session logs found.");
  return lines.join("\n");
}

function formatSessionView(filters: LogFilters, basePath: string, config?: Config): string {
  const includeThinking = config?.includeThinking ?? false;
  let sessionRecords = readJSONL(basePath, "session-logs")
    .filter((r) => String(r.session_id) === filters.sessionId);

  if (filters.date) {
    sessionRecords = sessionRecords.filter((r) => String(r.timestamp).slice(0, 10) === filters.date);
  }
  if (filters.since) {
    sessionRecords = sessionRecords.filter((r) => String(r.timestamp).slice(0, 10) >= String(filters.since));
  }
  if (filters.until) {
    sessionRecords = sessionRecords.filter((r) => String(r.timestamp).slice(0, 10) <= String(filters.until));
  }
  if (filters.agent) {
    sessionRecords = sessionRecords.filter((r) => String(r.agent) === filters.agent);
  }
  if (filters.error) {
    sessionRecords = sessionRecords.filter((r) => r.error !== undefined && r.error !== null);
  }
  if (filters.tail && filters.tail > 0) {
    sessionRecords = sessionRecords.slice(-filters.tail);
  }

  if (sessionRecords.length === 0) return `No logs found for session: ${filters.sessionId}`;

  const lines: string[] = [];
  for (const r of sessionRecords) {
    lines.push("\u2500".repeat(60));
    lines.push(`Session: ${r.session_id}`);
    lines.push(`Time:    ${r.timestamp}`);
    lines.push(`Agent:   ${r.agent}`);
    if (r.username) lines.push(`User:    ${r.username}`);
    if (r.provider_id) lines.push(`Model:   ${r.provider_id}/${r.model_id}`);
    if (r.mode) lines.push(`Mode:    ${r.mode}`);
    if (r.duration_ms !== undefined) lines.push(`Duration: ${r.duration_ms}ms`);
    if (r.finish_reason) lines.push(`Finish:  ${r.finish_reason}`);
    if (r.error) lines.push(`Error:   ${typeof r.error === 'object' ? JSON.stringify(r.error) : r.error}`);
    lines.push("");

    const field = filters.field ?? "all";
    const showInput = field === "input" || field === "all";
    const showOutput = field === "output" || field === "all";
    const showThinking = includeThinking && (field === "thinking" || field === "all") && r.thinking;

    if (showInput) {
      lines.push("Input:");
      lines.push(String(r.input ?? ""));
      lines.push("");
    }
    if (showOutput) {
      lines.push("Output:");
      lines.push(String(r.output ?? ""));
      lines.push("");
    }
    if (showThinking) {
      lines.push("Thinking:");
      lines.push(String(r.thinking));
      lines.push("");
    }
  }
  return lines.join("\n");
}

function formatSessionSearch(filters: LogFilters, basePath: string): string {
  const records = readJSONL(basePath, "session-logs");
  const text = (filters.searchText ?? "").toLowerCase();
  const matching = records.filter(
    (r) =>
      String(r.input ?? "").toLowerCase().includes(text) ||
      String(r.output ?? "").toLowerCase().includes(text),
  );
  const lines: string[] = [];
  for (const r of matching) {
    const preview = String(r.input ?? "").slice(0, 80);
    lines.push(`  ${r.timestamp}  ${r.session_id}  "${preview}..."`);
  }
  if (matching.length === 0) lines.push("  No matches found.");
  return lines.join("\n");
}

function getHelpText(): string {
  return "Usage: session-log <session-id> | session-log list | session-log search <text>";
}

export function runSessionLogCLI(
  action: SessionLogAction,
  filters: LogFilters,
  basePath?: string,
  config?: Config,
): string {
  const base = basePath ?? getDataDir();
  switch (action) {
    case "list":   return formatSessionList(base);
    case "view":   return formatSessionView(filters, base, config);
    case "search": return formatSessionSearch(filters, base);
    case "help":   return getHelpText();
  }
}
```

**IMPORTANT:** This is a pure extraction. The logic for each helper is IDENTICAL to what was previously inside `runSessionLogCLI`. Double-check:
- `formatSessionView` includes `includeThinking` logic ✓
- `formatSessionSearch` correctly handles empty `searchText` via `filters.searchText ?? ""` ✓
- `getHelpText` returns the exact same string ✓

- [ ] **Step 2: Build and run tests**

Run: `npm run build && node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/session-log.ts
git commit -m "refactor: split runSessionLogCLI into focused helper functions"
```

---

### Task 6: Add CLI test coverage for list, search, and help modes

**Files:**
- Modify: `src/cli/commands/session-log.test.ts`

- [ ] **Step 1: Add 5 new tests to `session-log.test.ts`**

Add these tests inside the existing `describe("session-log filters", ...)` block:

```typescript
  it("should list all sessions", () => {
    const base = freshDir();
    writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "a", output: "b" });
    writeSessionRecord(base, "2026-05-15", { timestamp: "2026-05-15T10:00:00.000Z", session_id: "sess-2", agent: "explore", input: "c", output: "d" });

    const output = runSessionLogCLI("list", {}, base);
    assert.match(output, /sess-1/);
    assert.match(output, /sess-2/);
  });

  it("should show empty message when no sessions exist", () => {
    const base = freshDir();
    const output = runSessionLogCLI("list", {}, base);
    assert.match(output, /No session logs found/);
  });

  it("should search by text", () => {
    const base = freshDir();
    writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "hello world", output: "ok" });
    writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T11:00:00.000Z", session_id: "sess-2", agent: "feature", input: "goodbye", output: "ok" });

    const output = runSessionLogCLI("search", { searchText: "hello" }, base);
    assert.match(output, /sess-1/);
    assert.ok(!output.includes("sess-2"));
  });

  it("should show no matches when search finds nothing", () => {
    const base = freshDir();
    writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "hello", output: "world" });

    const output = runSessionLogCLI("search", { searchText: "zzznonexistent" }, base);
    assert.match(output, /No matches found/);
  });

  it("should return help text for help action", () => {
    const output = runSessionLogCLI("help", {}, "/tmp");
    assert.match(output, /Usage/);
    assert.match(output, /session-log/);
  });
```

- [ ] **Step 2: Build and run tests**

Run: `npm run build && node --test 'dist/**/*.test.js'`
Expected: 71 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/session-log.test.ts
git commit -m "test: add coverage for list, search, and help CLI modes"
```
