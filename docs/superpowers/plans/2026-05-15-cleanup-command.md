# Cleanup CLI Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `opencode-monitor cleanup --days <N>` CLI command to delete old session-logs and token-status files with mandatory confirmation and `--dry-run` support.

**Architecture:** File-level deletion based on date from filename (`YYYY-MM-DD`). Pure functions extract the file collection and display logic; the CLI entry handles I/O (preview, confirmation, deletion). `runCleanupCLI` is async to support readline confirmation prompt.

**Tech Stack:** TypeScript, Node.js `fs` (readdirSync, statSync, unlinkSync), `node:readline` (question prompt)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/cli/commands/cleanup.ts` | Create | Core logic: collect files, format preview, run deletion |
| `src/cli/commands/cleanup.test.ts` | Create | Tests for collectCleanupFiles, formatCleanupPreview, dry-run |
| `src/cli/index.ts` | Modify | Add case "cleanup", make main() async for confirmation prompt |
| `README.md` | Modify | Already updated in this session — verify final state |

---

### Task 1: Create cleanup.ts

**Files:**
- Create: `src/cli/commands/cleanup.ts`

- [ ] **Step 1: Write the failing test first**

Create test file `src/cli/commands/cleanup.test.ts`:

```typescript
import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectCleanupFiles, formatCleanupPreview } from "./cleanup.js";

const BASE = join(tmpdir(), "monitor-cleanup-test-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

function touch(base: string, type: "session-logs" | "token_status", date: string) {
  const dir = join(base, type);
  mkdirSync(dir, { recursive: true });
  const ext = type === "token_status" ? ".csv" : ".jsonl";
  writeFileSync(join(dir, date + ext), "test\n");
}

describe("cleanup", () => {
  it("should collect no files when all are recent", () => {
    touch(BASE, "session-logs", "2026-05-15");
    touch(BASE, "token_status", "2026-05-15");
    const files = collectCleanupFiles(BASE, 30, ["session-logs", "token_status"]);
    assert.equal(files.length, 0);
  });

  it("should collect old files by date", () => {
    touch(BASE, "session-logs", "2025-01-01");
    touch(BASE, "token_status", "2025-01-01");
    const files = collectCleanupFiles(BASE, 30, ["session-logs", "token_status"]);
    assert.equal(files.length, 2);
    assert.equal(files[0].date, "2025-01-01");
    assert.equal(files[0].type, "session-logs");
    assert.equal(files[1].type, "token_status");
  });

  it("should filter by type", () => {
    touch(BASE, "session-logs", "2025-02-01");
    touch(BASE, "token_status", "2025-02-01");
    const files = collectCleanupFiles(BASE, 30, ["session-logs"]);
    assert.equal(files.length, 1);
    assert.equal(files[0].type, "session-logs");
  });

  it("should ignore non-date filenames", () => {
    const dir = join(BASE, "session-logs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "bad-file.csv"), "test\n");
    writeFileSync(join(dir, "notes.txt"), "test\n");
    const files = collectCleanupFiles(BASE, 30, ["session-logs"]);
    assert.equal(files.length, 0);
  });

  it("should format preview with correct summary", () => {
    const files = [
      { date: "2025-01-01", type: "session-logs" as const, size: 1024, path: "/x" },
      { date: "2025-01-15", type: "token_status" as const, size: 2048, path: "/y" },
    ];
    const output = formatCleanupPreview(files);
    assert.match(output, /2025-01-01/);
    assert.match(output, /session-logs/);
    assert.match(output, /1.0 KB/);
    assert.match(output, /2 files/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/cli/commands/cleanup.test.js' 2>&1 || true
```

Expected: FAIL — module not found (cleanup.ts doesn't exist yet).

- [ ] **Step 3: Create cleanup.ts**

```typescript
import { existsSync, readdirSync, readSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "../../paths.js";

export interface CleanupFile {
  date: string;
  type: "session-logs" | "token_status";
  size: number;
  path: string;
}

export function collectCleanupFiles(
  dataDir: string,
  days: number,
  types: ("session-logs" | "token_status")[],
): CleanupFile[] {
  const cutoff = new Date(Date.now() - days * 86400000);
  const files: CleanupFile[] = [];

  for (const type of types) {
    const dir = join(dataDir, type);
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const match = entry.match(/^(\d{4}-\d{2}-\d{2})\.(jsonl|csv)$/);
      if (!match) continue;
      const fileDate = new Date(match[1] + "T00:00:00.000Z");
      if (fileDate >= cutoff) continue;
      const fullPath = join(dir, entry);
      try {
        const size = statSync(fullPath).size;
        files.push({ date: match[1], type, size, path: fullPath });
      } catch {
        // skip files we can't stat
      }
    }
  }

  files.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  return files;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatTotalSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatCleanupPreview(files: CleanupFile[]): string {
  const lines: string[] = [];
  lines.push("Files to delete:");
  lines.push(`  ${"Date".padEnd(12)} ${"Type".padEnd(16)} Size`);
  lines.push(`  ${"─".repeat(12)} ${"─".repeat(16)} ${"─".repeat(8)}`);
  let totalSize = 0;
  for (const f of files) {
    totalSize += f.size;
    lines.push(`  ${f.date.padEnd(12)} ${f.type.padEnd(16)} ${formatSize(f.size).padStart(8)}`);
  }
  lines.push(`  ${"─".repeat(40)}`);
  lines.push(`  Total: ${files.length} files, ${formatTotalSize(totalSize)}`);
  return lines.join("\n");
}

function confirmDelete(count: number): Promise<boolean> {
  return new Promise((resolve) => {
    const { createInterface } = require("node:readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Delete ${count} files? (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

export async function runCleanupCLI(
  args: { days: number; sessionLogs: boolean; tokenStatus: boolean; dryRun: boolean },
  base?: string,
): Promise<string> {
  const dataDir = base ?? getDataDir();
  const days = args.days;
  if (days < 0) return "Error: --days must be a non-negative number.";

  const types: ("session-logs" | "token_status")[] = [];
  if (!args.sessionLogs && !args.tokenStatus) {
    types.push("session-logs", "token_status");
  } else {
    if (args.sessionLogs) types.push("session-logs");
    if (args.tokenStatus) types.push("token_status");
  }

  const files = collectCleanupFiles(dataDir, days, types);
  if (files.length === 0) return "No files to delete.";

  const preview = formatCleanupPreview(files);

  if (args.dryRun) return preview;

  console.log(preview);
  console.log("");
  const ok = await confirmDelete(files.length);
  if (!ok) return "Cancelled.";

  let deleted = 0;
  for (const f of files) {
    try {
      unlinkSync(f.path);
      deleted++;
    } catch {
      // skip files we can't delete
    }
  }
  return `Deleted ${deleted} files.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/cli/commands/cleanup.test.js' 2>&1
```

Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/cli/commands/cleanup.ts opencode/plugins/opencode-monitor-plugin/src/cli/commands/cleanup.test.ts
git commit -m "feat(monitor): add cleanup command with dry-run and confirmation"
```

---

### Task 2: Wire cleanup in cli/index.ts

**Files:**
- Modify: `src/cli/index.ts`

- [ ] **Step 1: Write the test first**

Modify `src/cli/commands/cleanup.test.ts` — add integration test:

```typescript
it("should return preview in dry-run mode without asking confirmation", async () => {
  const result = await runCleanupCLI(
    { days: 1, sessionLogs: false, tokenStatus: false, dryRun: true },
    BASE,
  );
  assert.match(result, /Files to delete/);
});
```

- [ ] **Step 2: Run test to verify RED**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/cli/commands/cleanup.test.js' 2>&1 || true
```

Expected: FAIL — runCleanupCLI is async but caller in test doesn't exist yet, or function not exported.

Actually the test should work since we already have runCleanupCLI. Let me verify.

- [ ] **Step 3: Update cli/index.ts**

Modify the file to add the cleanup case:

```typescript
#!/usr/bin/env node
import { runTokenStatusCLI } from "./commands/token-status.js";
import { runSessionLogCLI } from "./commands/session-log.js";
import { runCleanupCLI } from "./commands/cleanup.js";

const args = process.argv.slice(2);
const command = args[0];

function parseArgs(args: string[]): Record<string, string | boolean | number | undefined> {
  const parsed: Record<string, string | boolean | number | undefined> = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const eqIdx = key.indexOf("=");
      if (eqIdx !== -1) {
        parsed[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        parsed[key] = args[++i];
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

async function main(): Promise<void> {
  switch (command) {
    case "token-status":
      console.log(runTokenStatusCLI(parseArgs(args)));
      break;
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
    case "cleanup": {
      const opts = parseArgs(args);
      const days = Number(opts["days"] ?? NaN);
      if (isNaN(days) || days < 0) {
        console.log("Error: --days must be a non-negative number.");
        return;
      }
      const result = await runCleanupCLI({
        days,
        sessionLogs: opts["session-logs"] === true,
        tokenStatus: opts["token-status"] === true,
        dryRun: opts["dry-run"] === true,
      });
      console.log(result);
      break;
    }
    default:
      console.log(`Usage:
  opencode-monitor token-status [options]
  opencode-monitor session-log <session-id>
  opencode-monitor session-log list
  opencode-monitor session-log search <text>
  opencode-monitor cleanup --days <N> [--session-logs] [--token-status] [--dry-run]

Options for token-status:
  --session-id <id>     Session ID to inspect
  --include-children    Include child sessions
  --agent-view <view>   execution|initiator|both
  --agent-sort <sort>   cost|tokens
  --agent-top-n <n>     Show top N agents
  --trend-days <n>      Days for trend analysis
  --scope <scope>       project|all
  --compact             Skip heavy tables
  --debug               Debug info

Options for cleanup:
  --days <N>            Delete data older than N days (required)
  --session-logs        Delete only session logs
  --token-status        Delete only token metrics
  --dry-run             Preview without deleting`);
  }
}

main().catch(console.error);
```

- [ ] **Step 4: Run tests to verify GREEN**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/cli/commands/cleanup.test.js' 2>&1
```

Expected: PASS — 6 tests (5 existing + 1 new)

- [ ] **Step 5: Run full test suite**

```bash
cd opencode/plugins/opencode-monitor-plugin && npm test 2>&1
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/cli/index.ts opencode/plugins/opencode-monitor-plugin/src/cli/commands/cleanup.test.ts
git commit -m "feat(monitor): wire cleanup command in CLI entry point"
```

---

### Task 3: Verify README

**Files:**
- Check: `README.md`

- [ ] **Step 1: Verify README has cleanup section**

READ the file and confirm it has the cleanup section with:
- Description of the cleanup process (file-level deletion by date)
- Confirmation prompt mention
- Example commands: `--days`, `--session-logs`, `--token-status`, `--dry-run`

- [ ] **Step 2: Build and final test run**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc --noEmit && npm test 2>&1
```

Expected: No type errors, all tests pass.

- [ ] **Step 3: Commit if any README fixes needed**

```bash
git add opencode/plugins/opencode-monitor-plugin/README.md
git commit -m "docs(monitor): finalize cleanup command docs"
```
