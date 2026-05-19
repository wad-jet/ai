# Code Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 critical/high code quality issues: dead code removal, `formatSize`/`formatTotalSize` dedup, `runCleanupCLI` double output, and `handleChatMessage` positional params → options object.

**Architecture:** All changes are local refactors in `src/`. No behavioral changes — same inputs produce same outputs. Tasks ordered from simplest (dead code) to most impactful (options object refactor). Each task is independently testable and commit-ready.

**Tech Stack:** TypeScript, node:test, ESM

**Files Modified:**
- `src/paths.ts` — remove unused `getSubDir`
- `src/cli/commands/cleanup.ts` — dedup formatSize, fix double output
- `src/cli/commands/session-log.test.ts` — fix dead code
- `src/collectors/session-collector.ts` — refactor `handleChatMessage` signature
- `src/index.ts` — update `handleChatMessage` call site
- `src/collectors/session-collector.test.ts` — update all call sites
- `src/index.test.ts` — update call sites

---
### Task 1: Remove dead code in `paths.ts` and `session-log.test.ts`

**Files:**
- Modify: `src/paths.ts:11-13`
- Modify: `src/cli/commands/session-log.test.ts:19-24`
- Test: `node --test 'dist/**/*.test.js'` (full suite)

- [ ] **Step 1: Remove `getSubDir` from `paths.ts`**

Delete lines 11-13 from `src/paths.ts`. The file becomes:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";

const PLUGIN_ROOT = "opencode-monitor-plugin";
const BASE = join(homedir(), ".local", "share", "opencode", PLUGIN_ROOT);

export function getDataDir(): string {
  return BASE;
}
```

- [ ] **Step 2: Fix dead code in `session-log.test.ts`**

In `src/cli/commands/session-log.test.ts`, line 23, change:

```typescript
  const content = existsSync(file) ? "" : "";
```

To:

```typescript
  const content = "";
```

Also remove the now-unused `existsSync` import from the top of the file (line 3). Change:

```typescript
import { rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
```

To:

```typescript
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
```

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail

- [ ] **Step 4: Commit**

```bash
git add src/paths.ts src/cli/commands/session-log.test.ts
git commit -m "chore: remove dead code (getSubDir, unused existsSync)"
```

---

### Task 2: Deduplicate `formatTotalSize` in `cleanup.ts`

**Files:**
- Modify: `src/cli/commands/cleanup.ts:44-54`
- Test: `node --test 'dist/**/*.test.js'`

- [ ] **Step 1: Delete `formatTotalSize` function**

In `src/cli/commands/cleanup.ts`, delete lines 50-54 (`function formatTotalSize`).

- [ ] **Step 2: Update the call site in `formatCleanupPreview`**

On line 67 of `src/cli/commands/cleanup.ts`, change:

```typescript
  lines.push(`  Total: ${files.length} files, ${formatTotalSize(totalSize)}`);
```

To:

```typescript
  lines.push(`  Total: ${files.length} files, ${formatSize(totalSize)}`);
```

- [ ] **Step 3: Run tests**

Run: `node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail (the cleanup test checks `formatCleanupPreview` output and `formatSize` is the same logic)

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/cleanup.ts
git commit -m "chore: remove duplicate formatTotalSize function"
```

---

### Task 3: Fix double output in `runCleanupCLI`

**Files:**
- Modify: `src/cli/commands/cleanup.ts:100-105`
- Test: `node --test 'dist/**/*.test.js'`

- [ ] **Step 1: Remove the extra `console.log` calls**

In `src/cli/commands/cleanup.ts`, lines 104-105, remove:

```typescript
  console.log(preview);
  console.log("");
```

The function should now flow directly from the `dryRun` check to the confirmation prompt:

```typescript
  if (args.dryRun) return preview;

  const ok = await confirmDelete(files.length);
  if (!ok) return "Cancelled.";
```

- [ ] **Step 2: Verify tests still pass**

The existing test "should return preview in dry-run mode without asking confirmation" directly checks `return preview`, so it is unaffected by this change.

Run: `node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/cleanup.ts
git commit -m "fix: remove double output in runCleanupCLI"
```

---

### Task 4: Refactor `handleChatMessage` to use options object

**Files:**
- Modify: `src/collectors/session-collector.ts:23-76`
- Modify: `src/index.ts:85`
- Modify: `src/collectors/session-collector.test.ts` (all call sites)
- Modify: `src/index.test.ts` (call sites)
- Test: `node --test 'dist/**/*.test.js'`

- [ ] **Step 1: Create the options interface and refactor signature + body in `session-collector.ts`**

Replace the existing `handleChatMessage` function (lines 23-76) with:

```typescript
export interface HandleChatMessageOptions {
  base: string;
  input: ChatInput;
  output: ChatOutput;
  timestamp?: string;
  rootDir?: string;
  username?: string;
  providerId?: string;
  modelId?: string;
  opencodeVersion?: string;
  projectId?: string;
  gitBranch?: string;
  skills?: string[];
  config?: Config;
}

export function handleChatMessage(options: HandleChatMessageOptions): void {
  const ts = options.timestamp ?? new Date().toISOString();
  const includeThinking = options.config?.includeThinking ?? false;

  const parts = options.output.parts ?? [];
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
  const thinkingText = parts
    .filter((p) => p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("\n");

  const isUser = options.output.message?.role === "user";

  const record: Record<string, unknown> = {
    timestamp: ts,
    session_id: options.input.sessionID ?? "",
    agent: options.input.agent ?? "unknown",
  };
  if (options.username) record.username = options.username;
  if (options.projectId) record.project_id = options.projectId;
  if (options.gitBranch) record.git_branch = options.gitBranch;
  if (options.rootDir) record.root_dir = options.rootDir;
  if (options.providerId) record.provider_id = options.providerId;
  if (options.modelId) record.model_id = options.modelId;
  if (options.opencodeVersion) record.opencode_version = options.opencodeVersion;
  if (!isUser && options.skills) {
    record.skills = options.skills;
  }
  if (isUser) {
    record.input = text;
  } else {
    record.output = text;
  }
  if (includeThinking && thinkingText) record.thinking = thinkingText;

  appendJSONL(options.base, "session-logs", record);
}
```

- [ ] **Step 2: Update call site in `src/index.ts`**

Line 85 in `src/index.ts`. Replace:

```typescript
        handleChatMessage(base, inputMsg as any, output as any, undefined, rootDir, username, model?.providerID, model?.modelID, opencodeVersion, projectId, gitBranch, uniqueSkills, config);
```

With:

```typescript
        handleChatMessage({
          base,
          input: inputMsg as any,
          output: output as any,
          rootDir,
          username,
          providerId: model?.providerID,
          modelId: model?.modelID,
          opencodeVersion,
          projectId,
          gitBranch,
          skills: uniqueSkills,
          config,
        });
```

Also add `HandleChatMessageOptions` to the import on line 10 if it's destructured separately. Currently line 10 imports `handleChatMessage, handlePartUpdate, flushAssistantOutput`. No change needed — `handleChatMessage` is already imported.

- [ ] **Step 3: Update all call sites in `src/collectors/session-collector.test.ts`**

Every call to `handleChatMessage(BASE, input, output, ...14 args...)` must be replaced with the options object form.

**Line 28 — "should log user message as input":**
```typescript
    handleChatMessage({ base: BASE, input: input as any, output: output as any });
```

**Lines 51 — "should log assistant message as output with thinking":**
```typescript
    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      config: CONFIG_ENABLED as any,
    });
```

**Lines 66 — "should handle messages without reasoning/thinking":**
```typescript
    handleChatMessage({
      base: BASE,
      input: {} as any,
      output: output as any,
      config: CONFIG_DISABLED as any,
    });
```

**Lines 111 — "should include root_dir in chat message records":**
```typescript
    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      rootDir: "/test/project",
    });
```

**Lines 133 — "should include username in chat message records":**
```typescript
    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      username: "testuser",
    });
```

**Line 155 — "should not include username when not provided":**
```typescript
    handleChatMessage({ base: BASE, input: input as any, output: output as any });
```

**Lines 214 — "should include model info and opencode version in chat message records":**
```typescript
    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      providerId: "anthropic",
      modelId: "claude-3",
      opencodeVersion: "1.15.0",
    });
```

**Lines 240 — "should include project_id, git_branch and skills in chat message records":**
```typescript
    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      providerId: "anthropic",
      modelId: "claude-3",
      opencodeVersion: "1.15.0",
      projectId: "proj-1",
      gitBranch: "main",
      skills: ["test-driven-development", "writing-plans"],
    });
```

**Lines 253 — "should not include skills for user messages":**
```typescript
    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      projectId: "proj-1",
      gitBranch: "main",
      skills: ["test-driven-development"],
    });
```

**Lines 269-288 — "should include reasoning when includeThinking is true":**
```typescript
    handleChatMessage({
      base: BASE,
      input: { sessionID: "test-session", agent: "test-agent" },
      output: {
        message: { role: "assistant" },
        parts: [
          { type: "text", text: "Hello world" },
          { type: "reasoning", text: "Thinking process..." },
        ],
      },
      timestamp: "2026-01-01T00:00:00.000Z",
      config: CONFIG_ENABLED as any,
    });
```

**Lines 297-315 — "should exclude reasoning when includeThinking is false":**
```typescript
    handleChatMessage({
      base: BASE,
      input: { sessionID: "test-session-2", agent: "test-agent" },
      output: {
        message: { role: "assistant" },
        parts: [
          { type: "text", text: "Hello again" },
          { type: "reasoning", text: "More thinking" },
        ],
      },
      timestamp: "2026-01-01T00:01:00.000Z",
      config: CONFIG_DISABLED as any,
    });
```

**Lines 325-343 — "should default to false when config is undefined":**
```typescript
    handleChatMessage({
      base: BASE,
      input: { sessionID: "test-session-3", agent: "test-agent" },
      output: {
        message: { role: "assistant" },
        parts: [
          { type: "text", text: "Test" },
          { type: "reasoning", text: "Should be excluded" },
        ],
      },
      timestamp: "2026-01-01T00:02:00.000Z",
    });
```

- [ ] **Step 4: Update call sites in `src/index.test.ts`**

Line 40:
```typescript
    handleChatMessage({
      base: BASE,
      input: chatInput as any,
      output: chatUserOutput as any,
      timestamp: ts,
      rootDir: "/test/project",
      username: "tester",
      providerId: "anthropic",
      modelId: "claude-3-opus",
      opencodeVersion: "1.15.0",
      projectId: "proj-1",
      gitBranch: "main",
      config: { includeThinking: true as const },
    });
```

Line 45:
```typescript
    handleChatMessage({
      base: BASE,
      input: chatInput as any,
      output: chatAssistantOutput as any,
      timestamp: ts,
      rootDir: "/test/project",
      username: "tester",
      providerId: "anthropic",
      modelId: "claude-3-opus",
      opencodeVersion: "1.15.0",
      projectId: "proj-1",
      gitBranch: "main",
      skills: ["skill-a"],
      config: { includeThinking: true as const },
    });
```

Also add `HandleChatMessageOptions` to the import if it's needed — but it's not, since the tests just call the function.

- [ ] **Step 5: Run full test suite**

Run: `node --test 'dist/**/*.test.js'`
Expected: 66 pass, 0 fail

- [ ] **Step 6: Commit**

```bash
git add src/collectors/session-collector.ts src/index.ts src/collectors/session-collector.test.ts src/index.test.ts
git commit -m "refactor: replace handleChatMessage positional params with options object"
```
