# Monitor Plugin Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issues found during code review of opencode-monitor-plugin against official plugin API

**Architecture:** Three independent fixes: (1) add try/catch error boundaries around all hooks to prevent plugin crashes, (2) fix `pendingParts` Map leak with session-level timeout cleanup, (3) fix `setupCommands` to also overwrite outdated command files on plugin update. All changes are in the plugin source files only.

**Tech Stack:** TypeScript, @opencode-ai/plugin, Node:fs, Zod

---

### Task 1: Add error boundaries to all hooks

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/index.ts:53-78`
- Test: `opencode/plugins/opencode-monitor-plugin/dist/index.test.js` (compiled, test via coverage)

**Problem:** Both `event` and `chat.message` hooks are async functions that call `handleTokenEvent`, `handlePartUpdate`, `flushAssistantOutput`, and `handleChatMessage` without try/catch. If any of these throw (disk full, permissions, corrupt data), the entire hook fails and unhandled promise rejection can crash the plugin.

The plugin API docs warn: "Unhandled promise rejections crash the plugin."

**Solution:** Wrap the body of each hook in try/catch. On error, log via `client.app.log()` if available, otherwise `console.error`. The plugin should never crash from a write failure.

- [ ] **Step 1: Add error boundary to `event` hook**

Current code (lines 54-67):
```ts
event: async ({ event }) => {
  handleTokenEvent(base, event as any);
  handlePartUpdate(base, event as any);
  const ev = event as any;
  if (ev.type === "message.updated" && ev.properties?.info?.role === "assistant" && ev.properties?.info?.tokens) {
    const info = ev.properties.info;
    const finishReason = info.finish;
    const mode = info.mode;
    const durationMs = info.time?.completed != null && info.time?.created != null ? info.time.completed - info.time.created : undefined;
    const error = info.error;
    const cwd = info.path?.cwd;
    flushAssistantOutput(base, info.id, info.sessionID, info.agent ?? defaultAgent, undefined, rootDir, username, info.providerID, info.modelID, opencodeVersion, finishReason, mode, durationMs, error, cwd, projectId, gitBranch, undefined, config);
  }
},
```

Replace with:
```ts
event: async ({ event }) => {
  try {
    handleTokenEvent(base, event as any);
    handlePartUpdate(base, event as any);
    const ev = event as any;
    if (ev.type === "message.updated" && ev.properties?.info?.role === "assistant" && ev.properties?.info?.tokens) {
      const info = ev.properties.info;
      const finishReason = info.finish;
      const mode = info.mode;
      const durationMs = info.time?.completed != null && info.time?.created != null ? info.time.completed - info.time.created : undefined;
      const error = info.error;
      const cwd = info.path?.cwd;
      flushAssistantOutput(base, info.id, info.sessionID, info.agent ?? defaultAgent, undefined, rootDir, username, info.providerID, info.modelID, opencodeVersion, finishReason, mode, durationMs, error, cwd, projectId, gitBranch, undefined, config);
    }
  } catch (err) {
    console.error("[opencode-monitor-plugin] event hook error:", err);
  }
},
```

- [ ] **Step 2: Add error boundary to `chat.message` hook**

Current code (lines 69-78):
```ts
"chat.message": async (inputMsg, output) => {
  const model = (inputMsg as any).model;
  const parts = (output as any).parts ?? [];
  const skills = parts
    .filter((p: any) => p.type === "tool")
    .map((p: any) => p.tool)
    .filter((t: string) => t);
  const uniqueSkills = skills.length > 0 ? [...new Set(skills)] as string[] : undefined;
  handleChatMessage(base, inputMsg as any, output as any, undefined, rootDir, username, model?.providerID, model?.modelID, opencodeVersion, projectId, gitBranch, uniqueSkills, config);
},
```

Replace with:
```ts
"chat.message": async (inputMsg, output) => {
  try {
    const model = (inputMsg as any).model;
    const parts = (output as any).parts ?? [];
    const skills = parts
      .filter((p: any) => p.type === "tool")
      .map((p: any) => p.tool)
      .filter((t: string) => t);
    const uniqueSkills = skills.length > 0 ? [...new Set(skills)] as string[] : undefined;
    handleChatMessage(base, inputMsg as any, output as any, undefined, rootDir, username, model?.providerID, model?.modelID, opencodeVersion, projectId, gitBranch, uniqueSkills, config);
  } catch (err) {
    console.error("[opencode-monitor-plugin] chat.message hook error:", err);
  }
},
```

- [ ] **Step 3: Build and run tests**

```bash
npm run build
npm test
```

Expected: 66 tests, 63 pass, 3 pre-existing fail.

- [ ] **Step 4: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/index.ts
git commit -m "fix: add error boundaries to event and chat.message hooks"
```

---

### Task 2: Fix pendingParts memory leak

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts:20,92-120`
- Test: compiled via `npm test`

**Problem:** `pendingParts` is a module-level `Map<string, PendingPart>`. Parts are added on `message.part.updated` events (via `handlePartUpdate`) and removed on `message.updated` events (via `flushAssistantOutput`). If a `message.part.updated` fires but the corresponding `message.updated` never fires (session error, crash, disconnect), the part entry leaks in the Map permanently.

**Root cause:** No cleanup mechanism for orphaned parts.

**Solution:** Add a stale entry cleanup that removes entries older than 5 minutes when a new part is added. This is a low-overhead guard.

- [ ] **Step 1: Add TTL-based cleanup to `handlePartUpdate`**

Current code:
```ts
export function handlePartUpdate(
  base: string,
  event: { properties?: { part?: { id?: string; type?: string; text?: string; messageID?: string; time?: { end?: number } } } },
): void {
  const part = event.properties?.part;
  if (!part?.type || !part.id || !part.messageID) return;
  if (!part.time?.end) return;

  pendingParts.set(part.id, {
    type: part.type,
    text: part.text ?? "",
    messageID: part.messageID,
  });
}
```

Replace with:
```ts
const PART_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function handlePartUpdate(
  base: string,
  event: { properties?: { part?: { id?: string; type?: string; text?: string; messageID?: string; time?: { end?: number } } } },
): void {
  const part = event.properties?.part;
  if (!part?.type || !part.id || !part.messageID) return;
  if (!part.time?.end) return;

  // Clean stale entries on each insert to prevent memory leak
  const now = Date.now();
  for (const [id, p] of pendingParts) {
    const entry = p as PendingPart & { _ts?: number };
    if (entry._ts && now - entry._ts > PART_TTL_MS) {
      pendingParts.delete(id);
    }
  }

  pendingParts.set(part.id, {
    _ts: now,
    type: part.type,
    text: part.text ?? "",
    messageID: part.messageID,
  });
}
```

Also update the `PendingPart` interface:
```ts
interface PendingPart {
  _ts: number;       // timestamp for TTL cleanup
  type: string;
  text: string;
  messageID: string;
}
```

- [ ] **Step 2: Build and run tests**

```bash
npm run build
npm test
```

Expected: 66 tests, 63 pass, 3 pre-existing fail.

- [ ] **Step 3: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts
git commit -m "fix: add TTL cleanup to pendingParts to prevent memory leak"
```

---

### Task 3: Fix command file update on plugin upgrade

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/src/index.ts:14-30`
- Test: manual (command file content comparison)

**Problem:** `setupCommands()` copies `token-status.md` to `~/.config/opencode/command/token-status.md` only if the destination **does not exist** (`!existsSync(destCmd)`). When the plugin is updated with changes to the command file, the old copy remains and the update is invisible to users.

**Solution:** Always overwrite if the source file differs from the destination (by content length or content hash). Use file size as a quick heuristic; if sizes differ, overwrite.

- [ ] **Step 1: Update `setupCommands` to overwrite outdated files**

Current code (lines 14-30):
```ts
function setupCommands(): void {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const pluginRoot = dirname(dirname(__filename)); // dist/ -> plugin root
    const srcCmd = join(pluginRoot, "commands", "token-status.md");
    const commandsDir = join(homedir(), ".config", "opencode", "command");
    const destCmd = join(commandsDir, "token-status.md");

    if (existsSync(srcCmd) && !existsSync(destCmd)) {
      mkdirSync(commandsDir, { recursive: true });
      copyFileSync(srcCmd, destCmd);
    }
  } catch {
    // Silent fail — commands are a nice-to-have
  }
}
```

Replace with:
```ts
import { readFileSync } from "node:fs";

function setupCommands(): void {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const pluginRoot = dirname(dirname(__filename)); // dist/ -> plugin root
    const srcCmd = join(pluginRoot, "commands", "token-status.md");
    const commandsDir = join(homedir(), ".config", "opencode", "command");
    const destCmd = join(commandsDir, "token-status.md");
    const srcSize = statSync(srcCmd).size;

    // Copy if destination doesn't exist or is different size (content changed)
    if (!existsSync(destCmd) || statSync(destCmd).size !== srcSize) {
      mkdirSync(commandsDir, { recursive: true });
      copyFileSync(srcCmd, destCmd);
    }
  } catch {
    // Silent fail — commands are a nice-to-have
  }
}
```

Note: Need to add `statSync` to the import from `"node:fs"`.

Current import:
```ts
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
```

Updated import:
```ts
import { existsSync, mkdirSync, copyFileSync, statSync, readFileSync } from "node:fs";
```

- [ ] **Step 2: Build and run tests**

```bash
npm run build
npm test
```

Expected: 66 tests, 63 pass, 3 pre-existing fail.

- [ ] **Step 3: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/index.ts
git commit -m "fix: overwrite outdated command file on plugin upgrade"
```

---

### Task 4: Build and final verification

- [ ] **Step 1: Full rebuild**

```bash
cd opencode/plugins/opencode-monitor-plugin
npm run build
```

- [ ] **Step 2: Full test suite**

```bash
npm test
```

Expected: 66 tests, 63 pass, 3 pre-existing fail.

- [ ] **Step 3: Verify dist output**

```bash
# Check that hooks have try/catch
grep -c "try {" dist/index.js
grep -c "catch (err)" dist/index.js

# Check that pendingParts has _ts
grep "_ts" dist/collectors/session-collector.js

# Check that setupCommands uses statSync
grep "statSync" dist/index.js
```

All commands should return positive counts.

- [ ] **Step 4: Final commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/dist/
git commit -m "chore: update dist after review fixes"
```

Or commit all remaining changes:
```bash
git add -A && git commit -m "chore: rebuild dist after review fixes"
```
