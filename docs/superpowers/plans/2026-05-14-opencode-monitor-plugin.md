# opencode-monitor-plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build opencode plugin that collects token usage statistics and session logs to CSV/JSONL files, with tool and CLI access.

**Architecture:** Plugin hooks (`event` for tokens, `chat.message` for session logs) write to date-partitioned files under `~/.local/share/opencode/opencode-monitor-plugin/`. Tool and CLI share query logic that reads live via SDK and historical from files.

**Tech Stack:** TypeScript, `@opencode-ai/plugin` v1.14.41, zod v4, Node.js fs, csv-parse (or manual parsing)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/package.json`
- Create: `opencode/plugins/opencode-monitor-plugin/tsconfig.json`
- Create: `opencode/plugins/opencode-monitor-plugin/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@opencode-ai/opencode-monitor-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "opencode-monitor": "dist/cli/index.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "node --test dist/**/*.test.js"
  },
  "dependencies": {
    "@opencode-ai/plugin": "1.14.41",
    "zod": "^4.1.8"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "@types/node": "^24.12.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create stub src/index.ts**

```typescript
import type { PluginInput, Hooks } from "@opencode-ai/plugin";

export default async function MonitorPlugin(input: PluginInput): Promise<Hooks> {
  return {
    event: async () => {},
    "chat.message": async () => {},
    tool: {},
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd opencode/plugins/opencode-monitor-plugin && npm install && npx tsc --noEmit
```

Expected: No errors, `dist/` directory created with JS output.

---

### Task 2: CSV Writer Utility

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/src/storage/csv-writer.ts`
- Test: `opencode/plugins/opencode-monitor-plugin/src/storage/csv-writer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/storage/csv-writer.test.ts
import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendCSV, readCSV } from "./csv-writer.js";

describe("csv-writer", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "monitor-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should append a row to a date-partitioned CSV", () => {
    const cols = ["ts", "agent", "tokens"];
    const vals = ["2026-01-01", "default", "100"];
    appendCSV(tmpDir, "test-tokens", cols, vals);

    const rows = readCSV(tmpDir, "test-tokens", 3);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].length, 3);
    assert.equal(rows[0][1], "default");
  });

  it("should append multiple rows", () => {
    appendCSV(tmpDir, "test-tokens", ["ts", "agent", "tokens"], ["2026-01-01", "agent-a", "50"]);
    appendCSV(tmpDir, "test-tokens", ["ts", "agent", "tokens"], ["2026-01-01", "agent-b", "75"]);

    const rows = readCSV(tmpDir, "test-tokens", 3);
    assert.equal(rows.length, 3); // 1 from previous test + 2 new
  });

  it("should return empty for missing directory", () => {
    const rows = readCSV(tmpDir, "nonexistent", 3);
    assert.deepEqual(rows, []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && node --test dist/storage/csv-writer.test.js 2>&1 || true
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/storage/csv-writer.ts
import { appendFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

function datePartition(): string {
  return new Date().toISOString().slice(0, 10);
}

export function appendCSV(
  baseDir: string,
  subdir: string,
  _columns: string[],
  values: string[],
  date?: string,
): void {
  const day = date ?? datePartition();
  const dir = join(baseDir, subdir);
  const file = join(dir, `${day}.csv`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const escaped = values.map((v) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  });
  appendFileSync(file, escaped.join(",") + "\n");
}

export function readCSV(
  baseDir: string,
  subdir: string,
  columnCount: number,
): string[][] {
  const dir = join(baseDir, subdir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".csv")).sort();
  const rows: string[][] = [];
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");
    for (const line of content.trim().split("\n")) {
      if (!line) continue;
      const parsed = parseCSVLine(line, columnCount);
      if (parsed) rows.push(parsed);
    }
  }
  return rows;
}

function parseCSVLine(line: string, columnCount: number): string[] | null {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result.length === columnCount ? result : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/storage/csv-writer.test.js
```

Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/package.json opencode/plugins/opencode-monitor-plugin/tsconfig.json opencode/plugins/opencode-monitor-plugin/src/index.ts opencode/plugins/opencode-monitor-plugin/src/storage/csv-writer.ts opencode/plugins/opencode-monitor-plugin/src/storage/csv-writer.test.ts
git commit -m "feat(monitor): add project scaffolding and CSV writer utility"
```

---

### Task 3: JSONL Writer Utility

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/src/storage/jsonl-writer.ts`
- Test: `opencode/plugins/opencode-monitor-plugin/src/storage/jsonl-writer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/storage/jsonl-writer.test.ts
import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendJSONL, readJSONL } from "./jsonl-writer.js";

describe("jsonl-writer", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "monitor-jsonl-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should append a JSON object to a date-partitioned JSONL", () => {
    const obj = { ts: "2026-01-01", agent: "default", value: 42 };
    appendJSONL(tmpDir, "test-logs", obj);

    const records = readJSONL(tmpDir, "test-logs", 3);
    assert.equal(records.length, 1);
    assert.equal(records[0].agent, "default");
  });

  it("should append multiple objects", () => {
    appendJSONL(tmpDir, "test-logs", { id: 1 });
    appendJSONL(tmpDir, "test-logs", { id: 2 });

    const records = readJSONL(tmpDir, "test-logs", 3);
    assert.equal(records.length, 3);
  });

  it("should return empty for missing directory", () => {
    const records = readJSONL(tmpDir, "no-data", 3);
    assert.deepEqual(records, []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/storage/jsonl-writer.test.js 2>&1 || true
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/storage/jsonl-writer.ts
import { appendFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

function datePartition(): string {
  return new Date().toISOString().slice(0, 10);
}

export function appendJSONL(
  baseDir: string,
  subdir: string,
  obj: Record<string, unknown>,
  date?: string,
): void {
  const day = date ?? datePartition();
  const dir = join(baseDir, subdir);
  const file = join(dir, `${day}.jsonl`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(file, JSON.stringify(obj) + "\n");
}

export function readJSONL(
  baseDir: string,
  subdir: string,
  maxDays?: number,
): Record<string, unknown>[] {
  const dir = join(baseDir, subdir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  const recent = maxDays ? files.slice(-maxDays) : files;
  const records: Record<string, unknown>[] = [];
  for (const file of recent) {
    const content = readFileSync(join(dir, file), "utf-8");
    for (const line of content.trim().split("\n")) {
      if (!line) continue;
      try {
        records.push(JSON.parse(line));
      } catch {
        // skip corrupt lines
      }
    }
  }
  return records;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/storage/jsonl-writer.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/storage/jsonl-writer.ts opencode/plugins/opencode-monitor-plugin/src/storage/jsonl-writer.test.ts
git commit -m "feat(monitor): add JSONL writer utility"
```

---

### Task 4: Token Collector

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/src/collectors/token-collector.ts`
- Test: `opencode/plugins/opencode-monitor-plugin/src/collectors/token-collector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/collectors/token-collector.test.ts
import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleTokenEvent } from "./token-collector.js";
import { readCSV } from "../storage/csv-writer.js";

const BASE = join(tmpdir(), "monitor-token-test-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("token-collector", () => {
  it("should write token data from a message.updated event", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: {
          role: "assistant",
          sessionID: "session-1",
          agent: "default",
          providerID: "anthropic",
          modelID: "claude-3-opus",
          cost: 0.015,
          tokens: {
            input: 500,
            output: 200,
            reasoning: 50,
            cache: { read: 100, write: 50 },
          },
        },
      },
    };

    handleTokenEvent(BASE, event as any);

    const rows = readCSV(BASE, "token_status", 11);
    assert.equal(rows.length, 1);
    assert.equal(rows[0][1], "default"); // agent
    assert.equal(rows[0][3], "anthropic"); // provider_id
    assert.equal(rows[0][5], "500"); // input_tokens
    assert.equal(rows[0][6], "200"); // output_tokens
  });

  it("should skip non-assistant messages", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: { role: "user" },
      },
    };

    handleTokenEvent(BASE, event as any);
    // count should remain 1 from previous
    const rows = readCSV(BASE, "token_status", 11);
    assert.equal(rows.length, 1);
  });

  it("should skip events without tokens field", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: { role: "assistant" },
      },
    };

    handleTokenEvent(BASE, event as any);
    const rows = readCSV(BASE, "token_status", 11);
    assert.equal(rows.length, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/collectors/token-collector.test.js 2>&1 || true
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/collectors/token-collector.ts
import { getDataDir } from "../paths.js";
import { appendCSV } from "../storage/csv-writer.js";

interface TokenEvent {
  type: string;
  properties?: {
    info?: {
      role?: string;
      sessionID?: string;
      agent?: string;
      providerID?: string;
      modelID?: string;
      cost?: number;
      tokens?: {
        input: number;
        output: number;
        reasoning: number;
        cache: { read: number; write: number };
      };
    };
  };
}

// Columns: timestamp,agent,session_id,provider_id,model_id,input_tokens,output_tokens,reasoning_tokens,cache_read,cache_write,cost
const COLUMNS = [
  "timestamp", "agent", "session_id", "provider_id", "model_id",
  "input_tokens", "output_tokens", "reasoning_tokens", "cache_read", "cache_write", "cost",
];

export function handleTokenEvent(base: string, event: TokenEvent, timestamp?: string): void {
  if (event.type !== "message.updated") return;
  const info = event.properties?.info;
  if (!info || info.role !== "assistant") return;
  if (!info.tokens) return;

  const ts = timestamp ?? new Date().toISOString();
  appendCSV(base, "token_status", COLUMNS, [
    ts,
    info.agent ?? "unknown",
    info.sessionID ?? "",
    info.providerID ?? "",
    info.modelID ?? "",
    String(info.tokens.input),
    String(info.tokens.output),
    String(info.tokens.reasoning),
    String(info.tokens.cache.read),
    String(info.tokens.cache.write),
    String(info.cost ?? 0),
  ]);
}
```

Also create the shared paths utility:

- [ ] **Step 3b: Create paths utility**

```typescript
// src/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";

const PLUGIN_ROOT = "opencode-monitor-plugin";
const BASE = join(homedir(), ".local", "share", "opencode", PLUGIN_ROOT);

export function getDataDir(): string {
  return BASE;
}

export function getSubDir(sub: string): string {
  return join(BASE, sub);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/collectors/token-collector.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/paths.ts opencode/plugins/opencode-monitor-plugin/src/collectors/token-collector.ts opencode/plugins/opencode-monitor-plugin/src/collectors/token-collector.test.ts
git commit -m "feat(monitor): add token collector from message.updated events"
```

---

### Task 5: Session Log Collector

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts`
- Test: `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/collectors/session-collector.test.ts
import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleChatMessage } from "./session-collector.js";
import { readJSONL } from "../storage/jsonl-writer.js";

const BASE = join(tmpdir(), "monitor-session-test-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("session-collector", () => {
  it("should log user message and assistant response", () => {
    const input = {
      sessionID: "session-1",
      agent: "default",
      messageID: "msg-1",
    };
    const output = {
      message: { role: "user", parts: [{ type: "text", text: "Hello" }] } as any,
      parts: [
        { type: "text", text: "Hi there!" },
        { type: "reasoning", text: "thinking step..." },
      ] as any,
    };

    handleChatMessage(BASE, input as any, output as any);

    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 1);
    assert.equal(records[0].session_id, "session-1");
    assert.equal(records[0].input, "Hello");
    assert.equal(records[0].output, "Hi there!");
    assert.equal(records[0].thinking, "thinking step...");
    assert.ok(records[0].timestamp);
  });

  it("should handle messages without reasoning/thinking", () => {
    const output = {
      message: { role: "user", parts: [{ type: "text", text: "test" }] } as any,
      parts: [{ type: "text", text: "response" }] as any,
    };

    handleChatMessage(BASE, {} as any, output as any);
    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 2);
    assert.equal(records[1].thinking, undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/collectors/session-collector.test.js 2>&1 || true
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/collectors/session-collector.ts
import { appendJSONL } from "../storage/jsonl-writer.js";

interface ChatInput {
  sessionID?: string;
  agent?: string;
}

interface ChatOutput {
  message?: { role?: string; parts?: { type?: string; text?: string }[] };
  parts?: { type?: string; text?: string }[];
}

export function handleChatMessage(
  base: string,
  input: ChatInput,
  output: ChatOutput,
  timestamp?: string,
): void {
  const ts = timestamp ?? new Date().toISOString();

  // Extract user text from input message
  const userParts = output.message?.parts ?? [];
  const userText = userParts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");

  // Extract assistant text and thinking from output parts
  const assistantParts = output.parts ?? [];
  const outputText = assistantParts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
  const thinkingText = assistantParts
    .filter((p) => p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("\n");

  const record: Record<string, unknown> = {
    timestamp: ts,
    agent: input.agent ?? "unknown",
    session_id: input.sessionID ?? "",
    input: userText,
    output: outputText,
  };
  if (thinkingText) record.thinking = thinkingText;

  appendJSONL(base, "session-logs", record);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/collectors/session-collector.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts
git commit -m "feat(monitor): add session log collector from chat.message hook"
```

---

### Task 6: Token Query Engine

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/src/queries/token-query.ts`
- Test: `opencode/plugins/opencode-monitor-plugin/src/queries/token-query.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/queries/token-query.test.ts
import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendCSV } from "../storage/csv-writer.js";
import { queryTokenSummary, queryAgentBreakdown } from "./token-query.js";

const BASE = join(tmpdir(), "monitor-query-test-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("token-query", () => {
  it("should sum tokens across CSV rows", () => {
    const cols = ["ts","agent","session_id","provider","model","in","out","reasoning","cache_r","cache_w","cost"];
    appendCSV(BASE, "token_status", cols, ["t1","agent-a","s1","p1","m1","100","50","10","20","5","0.01"], "2026-01-01");
    appendCSV(BASE, "token_status", cols, ["t2","agent-a","s2","p1","m1","200","30","5","10","2","0.02"], "2026-01-01");
    appendCSV(BASE, "token_status", cols, ["t3","agent-b","s3","p1","m1","50","10","0","0","0","0.005"], "2026-01-01");

    const result = queryTokenSummary(BASE, 30);
    assert.equal(result.totalInput, 350);
    assert.equal(result.totalOutput, 90);
    assert.equal(result.totalCost, 0.035);
    assert.equal(result.totalRows, 3);
  });

  it("should return agent breakdown sorted by cost", () => {
    const result = queryAgentBreakdown(BASE, 30, "cost", 5);
    assert.equal(result.length, 2);
    assert.equal(result[0].agent, "agent-a");
    assert.equal(result[0].cost, 0.03);
    assert.equal(result[1].agent, "agent-b");
    assert.equal(result[1].cost, 0.005);
  });

  it("should return empty summary for no data", () => {
    const result = queryTokenSummary(BASE, 1);
    assert.equal(result.totalInput, 0);
    assert.equal(result.totalOutput, 0);
    assert.equal(result.totalRows, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/queries/token-query.test.js 2>&1 || true
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/queries/token-query.ts
import { readCSV } from "../storage/csv-writer.js";

const COL_COUNT = 11;
const COL = {
  TS: 0, AGENT: 1, SESSION: 2, PROVIDER: 3, MODEL: 4,
  IN: 5, OUT: 6, REASONING: 7, CACHE_R: 8, CACHE_W: 9, COST: 10,
};

export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalReasoning: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalCost: number;
  totalRows: number;
}

export function queryTokenSummary(base: string, days: number): TokenSummary {
  const rows = readCSV(base, "token_status", COL_COUNT);
  const summary: TokenSummary = {
    totalInput: 0, totalOutput: 0, totalReasoning: 0,
    totalCacheRead: 0, totalCacheWrite: 0, totalCost: 0, totalRows: rows.length,
  };
  for (const row of rows) {
    summary.totalInput += Number(row[COL.IN]) || 0;
    summary.totalOutput += Number(row[COL.OUT]) || 0;
    summary.totalReasoning += Number(row[COL.REASONING]) || 0;
    summary.totalCacheRead += Number(row[COL.CACHE_R]) || 0;
    summary.totalCacheWrite += Number(row[COL.CACHE_W]) || 0;
    summary.totalCost += Number(row[COL.COST]) || 0;
  }
  return summary;
}

export interface AgentRow {
  agent: string;
  input: number;
  output: number;
  cost: number;
  hits: number;
}

export function queryAgentBreakdown(
  base: string,
  days: number,
  sortBy: "cost" | "tokens",
  topN: number,
): AgentRow[] {
  const rows = readCSV(base, "token_status", COL_COUNT);
  const map = new Map<string, AgentRow>();
  for (const row of rows) {
    const agent = row[COL.AGENT] || "unknown";
    const entry = map.get(agent) ?? { agent, input: 0, output: 0, cost: 0, hits: 0 };
    entry.input += Number(row[COL.IN]) || 0;
    entry.output += Number(row[COL.OUT]) || 0;
    entry.cost += Number(row[COL.COST]) || 0;
    entry.hits++;
    map.set(agent, entry);
  }
  const result = Array.from(map.values());
  result.sort((a, b) => sortBy === "cost" ? b.cost - a.cost : (b.input + b.output) - (a.input + a.output));
  if (topN > 0) return result.slice(0, topN);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/queries/token-query.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/queries/token-query.ts opencode/plugins/opencode-monitor-plugin/src/queries/token-query.test.ts
git commit -m "feat(monitor): add token query engine with agent breakdown"
```

---

### Task 7: Token Status Tool

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/src/tools/token-status.ts`
- Create: `opencode/plugins/opencode-monitor-plugin/src/tools/token-status.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tools/token-status.test.ts
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { formatTokenTable } from "./token-status.js";

describe("token-status tool", () => {
  it("should format summary section", () => {
    const summary = {
      totalInput: 1000, totalOutput: 500, totalReasoning: 100,
      totalCacheRead: 200, totalCacheWrite: 50, totalCost: 0.15, totalRows: 5,
    };
    const output = formatTokenTable(summary, []);
    assert.ok(output.includes("1000"));
    assert.ok(output.includes("500"));
    assert.ok(output.includes("0.15"));
    assert.ok(output.includes("$0.15"));
  });

  it("should format agent breakdown section", () => {
    const agents = [
      { agent: "agent-a", input: 800, output: 300, cost: 0.10, hits: 3 },
      { agent: "agent-b", input: 200, output: 200, cost: 0.05, hits: 2 },
    ];
    const output = formatTokenTable({ totalInput: 1000, totalOutput: 500, totalReasoning: 0, totalCacheRead: 0, totalCacheWrite: 0, totalCost: 0.15, totalRows: 5 }, agents);
    assert.ok(output.includes("agent-a"));
    assert.ok(output.includes("agent-b"));
    assert.ok(output.includes("|")); // table separators
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/tools/token-status.test.js 2>&1 || true
```

Expected: FAIL.

- [ ] **Step 3: Write implementation**

```typescript
// src/tools/token-status.ts
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { queryTokenSummary, queryAgentBreakdown, TokenSummary, AgentRow } from "../queries/token-query.js";
import { getDataDir } from "../paths.js";

export const tokenStatusTool = tool({
  description: "Show detailed token usage for the current or specified session",
  args: {
    session_id: z.string().optional().describe("Session ID to inspect. Defaults to current."),
    include_children: z.boolean().optional().describe("Include child sessions in aggregation."),
    agent_view: z.enum(["execution", "initiator", "both"]).optional().describe("Agent view filter."),
    agent_sort: z.enum(["cost", "tokens"]).optional().describe("Sort tables by cost (default) or tokens."),
    agent_top_n: z.number().optional().describe("Show top N agents (default: 10). Use 0 to show all."),
    trend_days: z.number().optional().describe("Days for trend analysis (default: 7)."),
    scope: z.enum(["project", "all"]).optional().describe("Filter trends to project or all."),
    compact: z.boolean().optional().describe("Skip heavy tables."),
    debug: z.boolean().optional().describe("Include debug information."),
  },
  async execute(args) {
    const base = getDataDir();
    const days = args.trend_days ?? 7;
    const topN = args.agent_top_n ?? 10;
    const sortBy = args.agent_sort ?? "cost";

    const summary = queryTokenSummary(base, days);
    const agents = queryAgentBreakdown(base, days, sortBy, topN);

    return formatTokenTable(summary, agents, {
      sessionId: args.session_id,
      debug: args.debug,
      compact: args.compact,
    });
  },
});

interface FormatOptions {
  sessionId?: string;
  debug?: boolean;
  compact?: boolean;
}

export function formatTokenTable(
  summary: TokenSummary,
  agents: AgentRow[],
  opts?: FormatOptions,
): string {
  const lines: string[] = [];

  if (summary.totalRows === 0) {
    return "No token data found for the requested period.";
  }

  // Summary section
  lines.push("## Token Usage Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Input Tokens | ${summary.totalInput.toLocaleString()} |`);
  lines.push(`| Total Output Tokens | ${summary.totalOutput.toLocaleString()} |`);
  lines.push(`| Reasoning Tokens | ${summary.totalReasoning.toLocaleString()} |`);
  lines.push(`| Cache Read | ${summary.totalCacheRead.toLocaleString()} |`);
  lines.push(`| Cache Write | ${summary.totalCacheWrite.toLocaleString()} |`);
  lines.push(`| **Total Cost** | **$${summary.totalCost.toFixed(4)}** |`);
  lines.push(`| Rows (API calls) | ${summary.totalRows} |`);
  lines.push("");

  if (!opts?.compact && agents.length > 0) {
    lines.push("### Agent Breakdown");
    lines.push("");
    lines.push("| Agent | Calls | Input | Output | Cost |");
    lines.push("|-------|-------|-------|--------|------|");
    for (const a of agents) {
      const costStr = `$${a.cost.toFixed(4)}`;
      lines.push(`| ${a.agent} | ${a.hits} | ${a.input.toLocaleString()} | ${a.output.toLocaleString()} | ${costStr} |`);
    }
    lines.push("");
  }

  if (opts?.sessionId) {
    lines.push(`> Session: \`${opts.sessionId}\``);
  }
  if (opts?.debug) {
    lines.push("");
    lines.push("### Debug Info");
    lines.push(`- Data directory: \`~/.local/share/opencode/opencode-monitor-plugin\``);
    lines.push(`- Trend days: ${summary.totalRows} rows in period`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/tools/token-status.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/tools/token-status.ts opencode/plugins/opencode-monitor-plugin/src/tools/token-status.test.ts
git commit -m "feat(monitor): add token status tool with markdown output"
```

---

### Task 8: CLI Entry Point

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/src/cli/index.ts`
- Create: `opencode/plugins/opencode-monitor-plugin/src/cli/commands/token-status.ts`
- Create: `opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.ts`

- [ ] **Step 1: Write the failing tests**

First, create a shared CLI format utility test:

```typescript
// src/cli/commands/token-status.test.ts
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { formatCLITokenTable } from "./token-status.js";

describe("CLI token-status format", () => {
  it("should format ASCII table", () => {
    const summary = { totalInput: 1000, totalOutput: 500, totalReasoning: 0, totalCacheRead: 0, totalCacheWrite: 0, totalCost: 0.15, totalRows: 3 };
    const agents = [{ agent: "default", input: 1000, output: 500, cost: 0.15, hits: 3 }];
    const output = formatCLITokenTable(summary, agents);
    assert.ok(output.includes("1000"));
    assert.ok(output.includes("$0.15"));
    assert.ok(output.includes("default"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/cli/commands/token-status.test.js 2>&1 || true
```

Expected: FAIL.

- [ ] **Step 3: Write CLI implementation**

```typescript
// src/cli/commands/token-status.ts
import { queryTokenSummary, queryAgentBreakdown, TokenSummary, AgentRow } from "../../queries/token-query.js";
import { getDataDir } from "../../paths.js";

export function runTokenStatusCLI(args: Record<string, string | boolean | number | undefined>): string {
  const base = getDataDir();
  const days = (args.trend_days as number) ?? 7;
  const topN = (args.agent_top_n as number) ?? 10;
  const sortBy = (args.agent_sort as "cost" | "tokens") ?? "cost";

  const summary = queryTokenSummary(base, days);
  const agents = queryAgentBreakdown(base, days, sortBy, topN);

  return formatCLITokenTable(summary, agents);
}

export function formatCLITokenTable(summary: TokenSummary, agents: AgentRow[]): string {
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

  if (agents.length > 0) {
    lines.push("Agent Breakdown");
    lines.push("═".repeat(70));
    // Simple column layout
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
  }

  return lines.join("\n");
}
```

```typescript
// src/cli/commands/session-log.ts
import { readJSONL } from "../../storage/jsonl-writer.js";
import { getDataDir } from "../../paths.js";

interface LogFilters {
  sessionId?: string;
  searchText?: string;
  date?: string;
}

export function runSessionLogCLI(action: string, filters: LogFilters): string {
  const base = getDataDir();
  const lines: string[] = [];

  if (action === "list") {
    const records = readJSONL(base, "session-logs");
    // Deduplicate by session_id
    const sessions = new Map<string, { timestamp: string; session_id: string }>();
    for (const r of records) {
      const sid = String(r.session_id ?? "");
      if (sid && !sessions.has(sid)) {
        sessions.set(sid, { timestamp: String(r.timestamp ?? ""), session_id: sid });
      }
    }
    lines.push("Available Sessions");
    lines.push("═".repeat(60));
    for (const s of sessions.values()) {
      lines.push(`  ${s.timestamp}  ${s.session_id}`);
    }
    if (sessions.size === 0) lines.push("  No session logs found.");
    return lines.join("\n");
  }

  if (filters.sessionId) {
    const records = readJSONL(base, "session-logs");
    const sessionRecords = records.filter((r) => String(r.session_id) === filters.sessionId);
    if (sessionRecords.length === 0) return `No logs found for session: ${filters.sessionId}`;

    for (const r of sessionRecords) {
      lines.push("─".repeat(60));
      lines.push(`Time:    ${r.timestamp}`);
      lines.push(`Agent:   ${r.agent}`);
      lines.push("");
      lines.push("Input:");
      lines.push(String(r.input ?? ""));
      lines.push("");
      lines.push("Output:");
      lines.push(String(r.output ?? ""));
      if (r.thinking) {
        lines.push("");
        lines.push("Thinking:");
        lines.push(String(r.thinking));
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  if (filters.searchText) {
    const records = readJSONL(base, "session-logs");
    const text = filters.searchText.toLowerCase();
    const matching = records.filter(
      (r) =>
        String(r.input ?? "").toLowerCase().includes(text) ||
        String(r.output ?? "").toLowerCase().includes(text),
    );
    for (const r of matching) {
      const preview = String(r.input ?? "").slice(0, 80);
      lines.push(`  ${r.timestamp}  ${r.session_id}  "${preview}..."`);
    }
    if (matching.length === 0) lines.push("  No matches found.");
    return lines.join("\n");
  }

  return "Usage: session-log <session-id> | session-log list | session-log search <text>";
}
```

```typescript
// src/cli/index.ts
#!/usr/bin/env node
import { runTokenStatusCLI } from "./commands/token-status.js";
import { runSessionLogCLI } from "./commands/session-log.js";

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

function main(): void {
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
    default:
      console.log(`Usage:
  opencode-monitor token-status [options]
  opencode-monitor session-log <session-id>
  opencode-monitor session-log list
  opencode-monitor session-log search <text>

Options for token-status:
  --session-id <id>     Session ID to inspect
  --include-children    Include child sessions
  --agent-view <view>   execution|initiator|both
  --agent-sort <sort>   cost|tokens
  --agent-top-n <n>     Show top N agents
  --trend-days <n>      Days for trend analysis
  --scope <scope>       project|all
  --compact             Skip heavy tables
  --debug               Debug info`);
  }
}

main();
```

- [ ] **Step 4: Run tests**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/cli/commands/token-status.test.js
```

Expected: PASS.

- [ ] **Step 5: Verify CLI works**

```bash
node dist/cli/index.js token-status
```

Expected: Output with token summary or "No token data found."

- [ ] **Step 6: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/cli/
git commit -m "feat(monitor): add CLI with token-status and session-log commands"
```

---

### Task 9: Wire Plugin Entry Point

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/index.ts`

- [ ] **Step 1: Write integration test**

```typescript
// src/index.test.ts
import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleTokenEvent } from "./collectors/token-collector.js";
import { handleChatMessage } from "./collectors/session-collector.js";
import { readCSV } from "./storage/csv-writer.js";
import { readJSONL } from "./storage/jsonl-writer.js";

const BASE = join(tmpdir(), "monitor-integration-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("integration: collector pipeline", () => {
  it("should collect token data and session logs end-to-end", () => {
    const ts = "2026-01-01T00:00:00.000Z";
    const tokenEvent = {
      type: "message.updated",
      properties: {
        info: {
          role: "assistant",
          sessionID: "sess-1",
          agent: "default",
          providerID: "anthropic",
          modelID: "claude-3-opus",
          cost: 0.01,
          tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 20, write: 5 } },
        },
      },
    };
    handleTokenEvent(BASE, tokenEvent as any, ts);

    const chatInput = { sessionID: "sess-1", agent: "default" };
    const chatOutput = {
      message: { role: "user", parts: [{ type: "text", text: "hello" }] },
      parts: [{ type: "text", text: "world" }, { type: "reasoning", text: "thinking..." }],
    };
    handleChatMessage(BASE, chatInput as any, chatOutput as any, ts);

    const tokenRows = readCSV(BASE, "token_status", 11);
    assert.equal(tokenRows.length, 1);
    assert.equal(tokenRows[0][5], "100");

    const logRecords = readJSONL(BASE, "session-logs") as any[];
    assert.equal(logRecords.length, 1);
    assert.equal(logRecords[0].input, "hello");
    assert.equal(logRecords[0].thinking, "thinking...");
  });
});
```

- [ ] **Step 2: Run test to verify it passes with current collectors**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/index.test.js
```

Expected: PASS.

- [ ] **Step 3: Wire up main plugin entry**

```typescript
// src/index.ts
import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { getDataDir } from "./paths.js";
import { handleTokenEvent } from "./collectors/token-collector.js";
import { handleChatMessage } from "./collectors/session-collector.js";
import { tokenStatusTool } from "./tools/token-status.js";

const MonitorPlugin: Plugin = async (input: PluginInput) => {
  const base = getDataDir();

  return {
    event: async ({ event }) => {
      handleTokenEvent(base, event as any);
    },

    "chat.message": async (inputMsg, output) => {
      handleChatMessage(base, inputMsg as any, output as any);
    },

    tool: {
      token_status: tokenStatusTool,
    },
  };
};

export default MonitorPlugin;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Run all tests**

```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test dist/**/*.test.js
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/index.ts opencode/plugins/opencode-monitor-plugin/src/index.test.ts
git commit -m "feat(monitor): wire plugin entry with hooks and tool registration"
```

---

### Task 10: Final Verification & Package Configuration

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/package.json`

- [ ] **Step 1: Update package.json with final metadata**

```json
{
  "name": "@opencode-ai/opencode-monitor-plugin",
  "version": "0.1.0",
  "description": "OpenCode plugin for monitoring token usage and session logs",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "opencode-monitor": "dist/cli/index.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "node --test 'dist/**/*.test.js'"
  },
  "dependencies": {
    "@opencode-ai/plugin": "1.14.41",
    "zod": "^4.1.8"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "@types/node": "^24.12.2"
  },
  "keywords": ["opencode", "monitor", "tokens", "plugin"],
  "license": "MIT"
}
```

- [ ] **Step 2: Final typecheck and test**

```bash
cd opencode/plugins/opencode-monitor-plugin && npm run typecheck && npm test
```

Expected: No type errors, all tests PASS.

- [ ] **Step 3: Final commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/
git commit -m "feat(monitor): finalize package configuration and integration tests"
```
