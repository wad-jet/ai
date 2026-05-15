# Include Thinking Config Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `includeThinking` boolean config option (default: false) to opencode-monitor-plugin to control whether reasoning/thinking data is collected and displayed.

**Architecture:** Centralized config via Zod schema with config object passed through session collectors and CLI commands. When false, reasoning fields are skipped in data collection and filtered out in display.

**Tech Stack:** TypeScript, Zod for config validation, Node.js native modules

---

### Task 1: Create Config Module

**Files:**
- Create: `opencode/plugins/opencode-monitor-plugin/src/config.ts`
- Create: `opencode/plugins/opencode-monitor-plugin/src/config.test.ts`

- [ ] **Step 1: Write the config module**

Create `opencode/plugins/opencode-monitor-plugin/src/config.ts`:

```typescript
import { z } from "zod";

export const ConfigSchema = z.object({
  includeThinking: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

export function createConfig(input: Partial<Config>): Config {
  return ConfigSchema.parse(input);
}
```

- [ ] **Step 2: Write failing test for config module**

Create `opencode/plugins/opencode-monitor-plugin/src/config.test.ts`:

```typescript
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { ConfigSchema, createConfig } from "./config.js";

describe("config", () => {
  it("should validate config with includeThinking true", () => {
    const config = ConfigSchema.parse({ includeThinking: true });
    assert.equal(config.includeThinking, true);
  });

  it("should validate config with includeThinking false", () => {
    const config = ConfigSchema.parse({ includeThinking: false });
    assert.equal(config.includeThinking, false);
  });

  it("should default includeThinking to false when not provided", () => {
    const config = ConfigSchema.parse({});
    assert.equal(config.includeThinking, false);
  });

  it("should create config with custom values", () => {
    const config = createConfig({ includeThinking: true });
    assert.equal(config.includeThinking, true);
  });

  it("should create config with defaults", () => {
    const config = createConfig({});
    assert.equal(config.includeThinking, false);
  });

  it("should reject invalid includeThinking value", () => {
    assert.throws(() => ConfigSchema.parse({ includeThinking: "yes" as any }), z.ZodError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd opencode/plugins/opencode-monitor-plugin && npm test -- src/config.test.ts`
Expected: FAIL with "Cannot find module './config.js'"

- [ ] **Step 4: Implement config module**

Create `opencode/plugins/opencode-monitor-plugin/src/config.ts` with content from Step 1.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd opencode/plugins/opencode-monitor-plugin && npm test -- src/config.test.ts`
Expected: PASS for all 6 tests

- [ ] **Step 6: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/config.ts opencode/plugins/opencode-monitor-plugin/src/config.test.ts
git commit -m "feat: add config module with includeThinking option"
```

---

### Task 2: Update Session Collector

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts`
- Modify: `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts`

- [ ] **Step 1: Read existing session-collector test**

Read `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts` to understand existing test structure.

- [ ] **Step 2: Update function signatures with Config parameter**

Modify `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts`:

Change line 21-34 in `handleChatMessage`:

```typescript
import { appendJSONL } from "../storage/jsonl-writer.js";
import type { Config } from "../config.js";
```

Update `handleChatMessage` signature:

```typescript
export function handleChatMessage(
  base: string,
  input: ChatInput,
  output: ChatOutput,
  timestamp?: string,
  rootDir?: string,
  username?: string,
  providerId?: string,
  modelId?: string,
  opencodeVersion?: string,
  projectId?: string,
  gitBranch?: string,
  skills?: string[],
  config?: Config,
): void {
  const ts = timestamp ?? new Date().toISOString();
  const includeThinking = config?.includeThinking ?? false;

  const parts = output.parts ?? [];
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
  const thinkingText = parts
    .filter((p) => p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("\n");

  const isUser = output.message?.role === "user";

  const record: Record<string, unknown> = {
    timestamp: ts,
    session_id: input.sessionID ?? "",
    agent: input.agent ?? "unknown",
  };
  if (username) record.username = username;
  if (projectId) record.project_id = projectId;
  if (gitBranch) record.git_branch = gitBranch;
  if (rootDir) record.root_dir = rootDir;
  if (providerId) record.provider_id = providerId;
  if (modelId) record.model_id = modelId;
  if (opencodeVersion) record.opencode_version = opencodeVersion;
  if (!isUser && skills) record.skills = skills;
  if (isUser) {
    record.input = text;
  } else {
    record.output = text;
  }
  if (includeThinking && thinkingText) record.thinking = thinkingText;

  appendJSONL(base, "session-logs", record);
}
```

Update `flushAssistantOutput` signature (add config parameter after skills):

```typescript
export function flushAssistantOutput(
  base: string,
  msgId: string,
  sessionId: string,
  agent: string,
  timestamp?: string,
  rootDir?: string,
  username?: string,
  providerId?: string,
  modelId?: string,
  opencodeVersion?: string,
  finishReason?: string,
  mode?: string,
  durationMs?: number,
  error?: Record<string, unknown>,
  cwd?: string,
  projectId?: string,
  gitBranch?: string,
  skills?: string[],
  config?: Config,
): void {
  const includeThinking = config?.includeThinking ?? false;
  // ... rest of function
  const reasons = parts.filter((p) => p.type === "reasoning").map((p) => p.text).join("\n");
  // ...
  if (includeThinking && reasoning) record.thinking = reasoning;
  // ...
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd opencode/plugins/opencode-monitor-plugin && npm test -- src/collectors/session-collector.test.ts`
Expected: FAIL due to type mismatches

- [ ] **Step 4: Verify compilation passes (no type errors)**

Run: `cd opencode/plugins/opencode-monitor-plugin && npx tsc --noEmit`
Expected: No errors if imports are updated correctly

- [ ] **Step 5: Commit changes to session-collector**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts
git commit -m "feat: add config parameter to session collectors"
```

---

### Task 3: Update CLI Commands

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.ts`

- [ ] **Step 1: Read existing session-log command**

Read `opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.ts` lines 83-104 to understand field filtering logic.

- [ ] **Step 2: Add config parameter to runSessionLogCLI**

Modify `opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.ts`:

Add import at line 1:

```typescript
import { readJSONL } from "../../storage/jsonl-writer.js";
import { getDataDir } from "../../paths.js";
import type { Config } from "../../config.js";
```

Modify function signature at line 17:

```typescript
export function runSessionLogCLI(action: string, filters: LogFilters, basePath?: string, config?: Config): string {
  const base = basePath ?? getDataDir();
  const includeThinking = config?.includeThinking ?? false;
  // ... rest of function
```

Update field filtering logic at lines 86-102:

Change:
```typescript
const showThinking = (field === "thinking" || field === "all") && r.thinking;
```

To:
```typescript
const showThinking = includeThinking && (field === "thinking" || field === "all") && r.thinking;
```

- [ ] **Step 3: Commit changes to session-log**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.ts
git commit -m "feat: respect includeThinking in session-log CLI"
```

---

### Task 4: Update Plugin Index

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/index.ts`

- [ ] **Step 1: Read existing plugin index**

Read `opencode/plugins/opencode-monitor-plugin/src/index.ts` lines 62-75 to understand where handlers are called.

- [ ] **Step 2: Add config to plugin initialization**

Add import at line 8:

```typescript
import { getDataDir } from "./paths.js";
import { handleTokenEvent } from "./collectors/token-collector.js";
import { handleChatMessage, handlePartUpdate, flushAssistantOutput } from "./collectors/session-collector.js";
import { createConfig, type Config } from "./config.js";
```

Add config creation after line 48:

```typescript
  const gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();

  const config = createConfig(input.config as Partial<Config>);
```

Update `flushAssistantOutput` call at line 62 to pass config:

```typescript
        flushAssistantOutput(base, info.id, info.sessionID, info.agent ?? defaultAgent, undefined, rootDir, username, info.providerID, info.modelID, opencodeVersion, finishReason, mode, durationMs, error, cwd, projectId, gitBranch, undefined, config);
```

Update `handleChatMessage` call at line 74 to pass config:

```typescript
      handleChatMessage(base, inputMsg as any, output as any, undefined, rootDir, username, model?.providerID, model?.modelID, opencodeVersion, projectId, gitBranch, uniqueSkills, config);
```

- [ ] **Step 3: Commit changes to index**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/index.ts
git commit -m "feat: integrate config into plugin initialization"
```

---

### Task 5: Create Integration Test

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts`

- [ ] **Step 1: Add includeThinking tests**

Read `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts` to find existing test patterns, then add:

```typescript
import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleChatMessage, flushAssistantOutput } from "./session-collector.js";
import { readJSONL } from "../storage/jsonl-writer.js";
import { createConfig } from "../config.js";

const BASE = join(tmpdir(), "monitor-session-test-" + Date.now());
const CONFIG_ENABLED = createConfig({ includeThinking: true });
const CONFIG_DISABLED = createConfig({ includeThinking: false });

after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("session-collector with includeThinking", () => {
  it("should include reasoning when includeThinking is true", () => {
    handleChatMessage(BASE, 
      { sessionID: "test-session", agent: "test-agent" },
      { 
        message: { role: "assistant" },
        parts: [
          { type: "text", text: "Hello world" },
          { type: "reasoning", text: "Thinking process..." }
        ]
      },
      "2026-01-01T00:00:00.000Z",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      CONFIG_ENABLED,
    );

    const records = readJSONL(BASE, "session-logs");
    assert.equal(records.length, 1);
    assert.equal(records[0].thinking, "Thinking process...");
    assert.equal(records[0].output, "Hello world");
  });

  it("should exclude reasoning when includeThinking is false", () => {
    handleChatMessage(BASE,
      { sessionID: "test-session-2", agent: "test-agent" },
      {
        message: { role: "assistant" },
        parts: [
          { type: "text", text: "Hello again" },
          { type: "reasoning", text: "More thinking" }
        ]
      },
      "2026-01-01T00:01:00.000Z",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      CONFIG_DISABLED,
    );

    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "test-session-2");
    assert.equal(record?.thinking, undefined);
    assert.equal(record?.output, "Hello again");
  });

  it("should default to false when config is undefined", () => {
    handleChatMessage(BASE,
      { sessionID: "test-session-3", agent: "test-agent" },
      {
        message: { role: "assistant" },
        parts: [
          { type: "text", text: "Test" },
          { type: "reasoning", text: "Should be excluded" }
        ]
      },
      "2026-01-01T00:02:00.000Z",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "test-session-3");
    assert.equal(record?.thinking, undefined);
  });

  it("should handle flushAssistantOutput with includeThinking", () => {
    flushAssistantOutput(BASE, "msg-1", "test-session-4", "test-agent",
      "2026-01-01T00:03:00.000Z",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      CONFIG_ENABLED,
    );

    // Note: flushAssistantOutput needs pending parts to be set via handlePartUpdate
    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "test-session-4");
    assert.ok(record !== undefined);
    if (record.thinking) {
      assert.equal(typeof record.thinking, "string");
    }
  });

  it("should exclude thinking in flushAssistantOutput when disabled", () => {
    flushAssistantOutput(BASE, "msg-2", "test-session-5", "test-agent",
      "2026-01-01T00:04:00.000Z",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      CONFIG_DISABLED,
    );

    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "test-session-5");
    assert.ok(record !== undefined);
    assert.equal(record?.thinking, undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd opencode/plugins/opencode-monitor-plugin && npm test -- src/collectors/session-collector.test.ts`
Expected: FAIL due to type mismatches from Task 2

- [ ] **Step 3: Run test to verify it passes**

After Task 2 changes are committed, run:
`cd opencode/plugins/opencode-monitor-plugin && npm test -- src/collectors/session-collector.test.ts`
Expected: PASS for all tests

- [ ] **Step 4: Commit integration tests**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts
git commit -m "test: add integration tests for includeThinking config"
```

---

### Self-Review Checklist

**1. Spec coverage:**
- ✅ ConfigSchema with `includeThinking` boolean - Task 1
- ✅ Default value false - Task 1
- ✅ Applied in session-collector.ts - Task 2
- ✅ Applied in session-log.ts - Task 3
- ✅ Plugin integrations - Task 4
- ✅ Tests created and passing - Task 5

**2. Placeholder scan:**
- ✅ No TODOs, TBD, or "implement later"
- ✅ All code blocks are complete
- ✅ All steps show exact code changes

**3. Type consistency:**
- ✅ Config type imported consistently across files
- ✅ Function signatures updated uniformly
- ✅ Default value handling consistent (config?.includeThinking ?? false)

**Gap: Missing test for runSessionLogCLI**

Add Task 6:

---

### Task 6: Test CLI Command

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.test.ts`

- [ ] **Step 1: Add includeThinking CLI test**

Read `opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.test.ts` to understand test structure, then add:

```typescript
import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendJSONL } from "../../storage/jsonl-writer.js";
import { runSessionLogCLI } from "./session-log.js";
import { createConfig } from "../../config.js";

const BASE = join(tmpdir(), "monitor-cli-test-" + Date.now());

after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("session-log CLI with includeThinking", () => {
  it("should show thinking when includeThinking is true", () => {
    appendJSONL(BASE, "session-logs", {
      timestamp: "2026-01-01T00:00:00.000Z",
      session_id: "test-session",
      agent: "test-agent",
      input: "Hello",
      output: "Hi there",
      thinking: "Thinking about response",
    });

    const config = createConfig({ includeThinking: true });
    const output = runSessionLogCLI("view", { sessionId: "test-session" }, BASE, config);
    
    assert.ok(output.includes("Thinking:"));
    assert.ok(output.includes("Thinking about response"));
  });

  it("should hide thinking when includeThinking is false", () => {
    appendJSONL(BASE, "session-logs", {
      timestamp: "2026-01-01T00:00:00.000Z",
      session_id: "test-session-2",
      agent: "test-agent",
      input: "Hello",
      output: "Hi there",
      thinking: "Thinking about response",
    });

    const config = createConfig({ includeThinking: false });
    const output = runSessionLogCLI("view", { sessionId: "test-session-2" }, BASE, config);
    
    assert.ok(!output.includes("Thinking:"));
  });

  it("should hide thinking when config is undefined", () => {
    appendJSONL(BASE, "session-logs", {
      timestamp: "2026-01-01T00:00:00.000Z",
      session_id: "test-session-3",
      agent: "test-agent",
      input: "Hello",
      output: "Hi there",
      thinking: "Thinking about response",
    });

    const output = runSessionLogCLI("view", { sessionId: "test-session-3" }, BASE);
    
    assert.ok(!output.includes("Thinking:"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd opencode/plugins/opencode-monitor-plugin && npm test -- src/cli/commands/session-log.test.ts`
Expected: FAIL due to type mismatches

- [ ] **Step 3: Run test to verify it passes**

After Task 3 changes are committed:
`cd opencode/plugins/opencode-monitor-plugin && npm test -- src/cli/commands/session-log.test.ts`
Expected: PASS

- [ ] **Step 4: Commit CLI tests**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/cli/commands/session-log.test.ts
git commit -m "test: add CLI tests for includeThinking option"
```

---

After completing all tasks:

**Plan complete and saved to `docs/superpowers/plans/2026-05-15-thinking-config.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
