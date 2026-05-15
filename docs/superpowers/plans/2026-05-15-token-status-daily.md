# Token-Status Daily Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--daily` flag to `opencode-monitor token-status` that shows token metrics grouped by day with a total row.

**Architecture:** `queryDailyBreakdown` groups CSV rows by date from the timestamp column. `formatDailyTable` appends a formatted daily table to existing output before the Agent Breakdown.

**Tech Stack:** TypeScript, Node.js `fs` (readCSV), existing `COL` constants

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/queries/token-query.ts` | Modify | Add `DailyRow` interface + `queryDailyBreakdown()` |
| `src/queries/token-query.test.ts` | Modify | Test `queryDailyBreakdown` with 2-day data |
| `src/cli/commands/token-status.ts` | Modify | Add `formatDailyTable()` + `--daily` flag handling |
| `src/cli/commands/token-status.test.ts` | Create | Test `formatDailyTable` output |
| `README.md` | Already done | Verify |

---

### Task 1: Add daily query to token-query.ts

**Files:**
- Modify: `src/queries/token-query.ts`
- Modify: `src/queries/token-query.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/queries/token-query.test.ts`:

```typescript
import { queryTokenSummary, queryAgentBreakdown, queryDailyBreakdown } from "./token-query.js";
```

Add new `it` blocks:

```typescript
it("should return daily breakdown grouped by date", () => {
  const cols = ["ts","agent","session_id","provider","model","in","out","reasoning","cache_r","cache_w","cost"];
  appendCSV(BASE, "token_status", cols, ["2026-01-01T10:00:00Z","agent-a","s1","p1","m1","100","50","10","20","5","0.01"], "2026-01-01");
  appendCSV(BASE, "token_status", cols, ["2026-01-01T11:00:00Z","agent-b","s2","p1","m1","200","30","5","10","2","0.02"], "2026-01-01");
  appendCSV(BASE, "token_status", cols, ["2026-01-02T10:00:00Z","agent-a","s3","p1","m1","50","10","0","0","0","0.005"], "2026-01-02");

  const result = queryDailyBreakdown(BASE, 30);
  assert.equal(result.length, 2);
  assert.equal(result[0].date, "2026-01-01");
  assert.equal(result[0].hits, 2);
  assert.equal(result[0].input, 300);
  assert.equal(result[0].output, 80);
  assert.equal(result[0].cost, 0.03);
  assert.equal(result[1].date, "2026-01-02");
  assert.equal(result[1].hits, 1);
  assert.equal(result[1].input, 50);
});

it("should return empty daily breakdown for no data", () => {
  const emptyBase = join(tmpdir(), "monitor-empty-daily-" + Date.now());
  const result = queryDailyBreakdown(emptyBase, 1);
  assert.equal(result.length, 0);
  rmSync(emptyBase, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/queries/token-query.test.js' 2>&1 || true
```

Expected: FAIL — `queryDailyBreakdown` not exported.

- [ ] **Step 3: Add DailyRow and queryDailyBreakdown to token-query.ts**

```typescript
export interface DailyRow {
  date: string;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  hits: number;
}

export function queryDailyBreakdown(base: string, days: number): DailyRow[] {
  const rows = readCSV(base, "token_status", COL_COUNT);
  const map = new Map<string, DailyRow>();
  for (const row of rows) {
    const date = (row[COL.TS] ?? "").slice(0, 10);
    if (!date) continue;
    const entry = map.get(date) ?? { date, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0, hits: 0 };
    entry.input += Number(row[COL.IN]) || 0;
    entry.output += Number(row[COL.OUT]) || 0;
    entry.reasoning += Number(row[COL.REASONING]) || 0;
    entry.cacheRead += Number(row[COL.CACHE_R]) || 0;
    entry.cacheWrite += Number(row[COL.CACHE_W]) || 0;
    entry.cost += Number(row[COL.COST]) || 0;
    entry.hits++;
    map.set(date, entry);
  }
  for (const entry of map.values()) {
    entry.cost = Math.round(entry.cost * 1e6) / 1e6;
  }
  const result = Array.from(map.values());
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}
```

- [ ] **Step 4: Run tests to verify GREEN**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/queries/token-query.test.js' 2>&1
```

Expected: PASS — all 5 tests (3 existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/queries/token-query.ts opencode/plugins/opencode-monitor-plugin/src/queries/token-query.test.ts
git commit -m "feat(monitor): add queryDailyBreakdown for token-status --daily"
```

---

### Task 2: Wire --daily in token-status CLI

**Files:**
- Modify: `src/cli/commands/token-status.ts`
- Modify: `src/cli/commands/token-status.test.ts`

- [ ] **Step 1: Write the failing test**

Update existing `src/cli/commands/token-status.test.ts`. The current test calls `formatCLITokenTable(summary, agents)` but the new API splits this into `formatCLITokenTable(summary)` + `formatAgentTable(agents)`. Replace the existing content:

```typescript
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { formatCLITokenTable, formatAgentTable, formatDailyTable } from "./token-status.js";

describe("CLI token-status format", () => {
  it("should format ASCII table", () => {
    const summary = { totalInput: 1000, totalOutput: 500, totalReasoning: 0, totalCacheRead: 0, totalCacheWrite: 0, totalCost: 0.15, totalRows: 3 };
    const agents = [{ agent: "default", input: 1000, output: 500, cost: 0.15, hits: 3 }];
    const output = formatCLITokenTable(summary) + "\n" + formatAgentTable(agents, false);
    assert.ok(output.includes("1,000"));
    assert.ok(output.includes("$0.15"));
    assert.ok(output.includes("default"));
  });

  it("should format daily table with header and total", () => {
    const rows = [
      { date: "2026-05-14", input: 1500, output: 750, reasoning: 100, cacheRead: 300, cacheWrite: 60, cost: 0.03, hits: 12 },
      { date: "2026-05-15", input: 900, output: 450, reasoning: 50, cacheRead: 200, cacheWrite: 40, cost: 0.018, hits: 8 },
    ];
    const output = formatDailyTable(rows);
    assert.match(output, /Day Breakdown/);
    assert.match(output, /2026-05-14/);
    assert.match(output, /2026-05-15/);
    assert.match(output, /Total:/);
    assert.match(output, /20/);
    assert.match(output, /2,400/);
    assert.match(output, /\$0.0480/);
  });

  it("should return empty string for no daily rows", () => {
    assert.equal(formatDailyTable([]), "");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/cli/commands/token-status.test.js' 2>&1 || true
```

Expected: FAIL — `formatDailyTable` not exported.

- [ ] **Step 3: Add formatDailyTable and --daily handling to token-status.ts**

Replace current content of `src/cli/commands/token-status.ts`:

```typescript
import { queryTokenSummary, queryAgentBreakdown, queryDailyBreakdown, TokenSummary, AgentRow, DailyRow } from "../../queries/token-query.js";
import { getDataDir } from "../../paths.js";

export function runTokenStatusCLI(args: Record<string, string | boolean | number | undefined>): string {
  const base = getDataDir();
  const days = (args.trend_days as number) ?? 7;
  const topN = (args.agent_top_n as number) ?? 10;
  const sortBy = (args.agent_sort as "cost" | "tokens") ?? "cost";

  const summary = queryTokenSummary(base, days);
  let output = formatCLITokenTable(summary);

  if (args.daily) {
    const daily = queryDailyBreakdown(base, days);
    output += "\n" + formatDailyTable(daily);
  }

  const agents = queryAgentBreakdown(base, days, sortBy, topN);
  output += "\n" + formatAgentTable(agents, summary.totalRows === 0);

  return output;
}

export function formatCLITokenTable(summary: TokenSummary): string {
  const lines: string[] = [];

  if (summary.totalRows === 0) {
    return "No token data found.";
  }

  lines.push("Token Usage Summary");
  lines.push("═".repeat(50));
  lines.push(`  Total Input:     ${summary.totalInput.toLocaleString()}`);
  lines.push(`  Total Output:    ${summary.totalOutput.toLocaleString()}`);
  lines.push(`  Reasoning:       ${summary.totalReasoning.toLocaleString()}`);
  lines.push(`  Cache Read:      ${summary.totalCacheRead.toLocaleString()}`);
  lines.push(`  Cache Write:     ${summary.totalCacheWrite.toLocaleString()}`);
  lines.push(`  Total Cost:      $${summary.totalCost.toFixed(4)}`);
  lines.push(`  API Calls:       ${summary.totalRows}`);
  lines.push("");

  return lines.join("\n");
}

export function formatDailyTable(rows: DailyRow[]): string {
  if (rows.length === 0) return "";

  const lines: string[] = [];
  lines.push("Day Breakdown");
  lines.push("═".repeat(90));
  const header = "  Date         Calls    Input      Output     Reasoning  Cache R   Cache W   Cost";
  lines.push(header);
  lines.push("  " + "─".repeat(80));

  let totalInput = 0, totalOutput = 0, totalReasoning = 0;
  let totalCacheR = 0, totalCacheW = 0, totalCost = 0, totalHits = 0;

  for (const r of rows) {
    totalInput += r.input;
    totalOutput += r.output;
    totalReasoning += r.reasoning;
    totalCacheR += r.cacheRead;
    totalCacheW += r.cacheWrite;
    totalCost += r.cost;
    totalHits += r.hits;

    const date = r.date.padEnd(12);
    const hits = String(r.hits).padStart(5);
    const inp = r.input.toLocaleString().padStart(10);
    const out = r.output.toLocaleString().padStart(10);
    const reason = r.reasoning.toLocaleString().padStart(10);
    const cr = r.cacheRead.toLocaleString().padStart(8);
    const cw = r.cacheWrite.toLocaleString().padStart(8);
    const cost = `$${r.cost.toFixed(4)}`.padStart(9);
    lines.push(`  ${date} ${hits} ${inp} ${out} ${reason} ${cr} ${cw} ${cost}`);
  }

  lines.push("  " + "─".repeat(80));
  lines.push(
    `  Total:    ${String(totalHits).padStart(5)} ${totalInput.toLocaleString().padStart(10)} ${totalOutput.toLocaleString().padStart(10)} ${totalReasoning.toLocaleString().padStart(10)} ${totalCacheR.toLocaleString().padStart(8)} ${totalCacheW.toLocaleString().padStart(8)} $${totalCost.toFixed(4).padStart(8)}`
  );

  return lines.join("\n");
}

export function formatAgentTable(agents: AgentRow[], noData: boolean): string {
  if (noData || agents.length === 0) return "";

  const lines: string[] = [];
  lines.push("Agent Breakdown");
  lines.push("═".repeat(70));
  const header = "  Agent         Calls    Input      Output     Cost";
  lines.push(header);
  lines.push("  " + "─".repeat(60));
  for (const a of agents) {
    const agent = a.agent.padEnd(14).slice(0, 14);
    const hits = String(a.hits).padStart(5);
    const inp = a.input.toLocaleString().padStart(10);
    const out = a.output.toLocaleString().padStart(10);
    const cost = `$${a.cost.toFixed(4)}`.padStart(10);
    lines.push(`  ${agent} ${hits} ${inp} ${out} ${cost}`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify GREEN**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/cli/commands/token-status.test.js' 2>&1
```

Expected: PASS — both tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd opencode/plugins/opencode-monitor-plugin && npm test 2>&1
```

Expected: All 43+ tests pass (existing + 2 new daily + 2 new format).

- [ ] **Step 6: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/cli/commands/token-status.ts opencode/plugins/opencode-monitor-plugin/src/cli/commands/token-status.test.ts
git commit -m "feat(monitor): add --daily flag to token-status CLI"
```
