# Session Logs Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 new metadata fields to session-logs JSONL: finish_reason, mode, duration_ms, error, cwd, project_id, git_branch, skills.

**Architecture:** New fields come from two sources — `message.updated` event data (finish_reason, mode, duration_ms, error, cwd) and plugin initialization (project_id, git_branch). Skills extracted from `ToolPart.tool` in `chat.message` output. All passed as optional params to `handleChatMessage` / `flushAssistantOutput`.

**Tech Stack:** TypeScript, Node.js `node:child_process` (execSync), `@opencode-ai/sdk` types (AssistantMessage, ToolPart)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/collectors/session-collector.ts` | Modify | Add params and JSONL fields to `handleChatMessage` and `flushAssistantOutput` |
| `src/index.ts` | Modify | Capture `project.id`, `git_branch`, extract event fields, collect skills |
| `src/collectors/session-collector.test.ts` | Modify | Tests for each new field |
| `src/index.test.ts` | Modify | Integration test with new fields |
| `README.md` | Modify | Document new fields |

---

### Task 1: Update flushAssistantOutput with new fields

**Files:**
- Modify: `src/collectors/session-collector.ts` (flushAssistantOutput function)

- [ ] **Step 1: Write the failing test**

Add to `src/collectors/session-collector.test.ts`:

```typescript
it("should include finish_reason in flushed output", () => {
  const textPart = { properties: { part: { id: "p-fr", type: "text", text: "out", messageID: "msg-fr", time: { end: 1 } } } };
  handlePartUpdate(BASE, textPart as any);

  flushAssistantOutput(BASE, "msg-fr", "sess-fr", "agent", "2026-01-01T00:00:00.000Z", undefined, undefined, undefined, undefined, undefined, "stop", "agent", 1234, undefined, "/home/user/proj", "proj-1", "main");

  const records = readJSONL(BASE, "session-logs") as any[];
  const last = records[records.length - 1];
  assert.equal(last.finish_reason, "stop");
  assert.equal(last.mode, "agent");
  assert.equal(last.duration_ms, 1234);
  assert.equal(last.cwd, "/home/user/proj");
});

it("should include error in flushed output", () => {
  const textPart = { properties: { part: { id: "p-err", type: "text", text: "out", messageID: "msg-err", time: { end: 1 } } } };
  handlePartUpdate(BASE, textPart as any);

  flushAssistantOutput(BASE, "msg-err", "sess-err", "agent", "2026-01-01T00:00:00.000Z", undefined, undefined, undefined, undefined, undefined, "anthropic", "claude-3", "1.15.0", undefined, undefined, undefined, { type: "api_error", message: "timeout" });

  const records = readJSONL(BASE, "session-logs") as any[];
  const last = records[records.length - 1];
  assert.deepEqual(last.error, { type: "api_error", message: "timeout" });
});

it("should include project_id and git_branch in flushed output", () => {
  const textPart = { properties: { part: { id: "p-pg", type: "text", text: "out", messageID: "msg-pg", time: { end: 1 } } } };
  handlePartUpdate(BASE, textPart as any);

  flushAssistantOutput(BASE, "msg-pg", "sess-pg", "agent", "2026-01-01T00:00:00.000Z", undefined, undefined, undefined, undefined, undefined, "anthropic", "claude-3", "1.15.0", undefined, undefined, undefined, undefined, "proj-1", "main");

  const records = readJSONL(BASE, "session-logs") as any[];
  const last = records[records.length - 1];
  assert.equal(last.project_id, "proj-1");
  assert.equal(last.git_branch, "main");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/collectors/session-collector.test.js' 2>&1 || true
```
Expected: FAIL — `flushAssistantOutput` has wrong arity / undefined fields.

- [ ] **Step 3: Add new params and fields to flushAssistantOutput**

Add params after `opencodeVersion`:
- `finishReason?: string`
- `mode?: string`
- `durationMs?: number`
- `error?: object`
- `cwd?: string`
- `projectId?: string`
- `gitBranch?: string`

Add to the record:
```typescript
if (finishReason) record.finish_reason = finishReason;
if (mode) record.mode = mode;
if (durationMs !== undefined) record.duration_ms = durationMs;
if (error) record.error = error;
if (cwd) record.cwd = cwd;
if (projectId) record.project_id = projectId;
if (gitBranch) record.git_branch = gitBranch;
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/collectors/session-collector.test.js' 2>&1
```
Expected: PASS — 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts
git commit -m "feat(monitor): add finish_reason, mode, duration_ms, error, cwd, project_id, git_branch to flushAssistantOutput"
```

---

### Task 2: Update handleChatMessage with projectId, gitBranch, skills

**Files:**
- Modify: `src/collectors/session-collector.ts` (handleChatMessage function)

- [ ] **Step 1: Write the failing test**

Add to `src/collectors/session-collector.test.ts`:

```typescript
it("should include project_id, git_branch and skills in chat message records", () => {
  const input = { sessionID: "sess-meta", agent: "default" };
  const output = { message: { role: "assistant" }, parts: [{ type: "text", text: "ok" }] };

  handleChatMessage(BASE, input as any, output as any, undefined, undefined, undefined, "anthropic", "claude-3", "1.15.0", "proj-1", "main", ["test-driven-development", "writing-plans"]);

  const records = readJSONL(BASE, "session-logs") as any[];
  const last = records[records.length - 1];
  assert.equal(last.project_id, "proj-1");
  assert.equal(last.git_branch, "main");
  assert.deepEqual(last.skills, ["test-driven-development", "writing-plans"]);
});

it("should not include skills for user messages", () => {
  const input = { sessionID: "sess-user-skills", agent: "default" };
  const output = { message: { role: "user" }, parts: [{ type: "text", text: "hello" }] };

  handleChatMessage(BASE, input as any, output as any, undefined, undefined, undefined, undefined, undefined, undefined, "proj-1", "main", ["test-driven-development"]);

  const records = readJSONL(BASE, "session-logs") as any[];
  const last = records[records.length - 1];
  assert.equal(last.project_id, "proj-1");
  assert.equal(last.git_branch, "main");
  assert.equal(last.skills, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/collectors/session-collector.test.js' 2>&1 || true
```
Expected: FAIL.

- [ ] **Step 3: Add new params and fields to handleChatMessage**

Add params after `opencodeVersion`:
- `projectId?: string`
- `gitBranch?: string`
- `skills?: string[]`

Add to the record:
```typescript
if (projectId) record.project_id = projectId;
if (gitBranch) record.git_branch = gitBranch;
if (skills && !isUser) record.skills = skills;
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/collectors/session-collector.test.js' 2>&1
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.ts opencode/plugins/opencode-monitor-plugin/src/collectors/session-collector.test.ts
git commit -m "feat(monitor): add project_id, git_branch, skills to handleChatMessage"
```

---

### Task 3: Wire up new data sources in index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing test (update integration test first)**

Update `src/index.test.ts` — add new fields to the `tokenEvent` and assertions:

```typescript
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
      finish: "stop",
      mode: "agent",
      time: { created: 1000, completed: 5000 },
      path: { cwd: "/home/user/proj", root: "/home/user/proj" },
    },
  },
};
```

Update the handleChatMessage calls to pass `"proj-1", "main", ["skill-a"]`:

```typescript
handleChatMessage(BASE, chatInput as any, chatUserOutput as any, ts, "/test/project", "tester", "anthropic", "claude-3-opus", "1.15.0", "proj-1", "main", ["skill-a"]);
```

Add assertions for `project_id`, `git_branch`, `skills`.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/index.test.js' 2>&1 || true
```
Expected: FAIL — missing project_id, git_branch, skills in output.

- [ ] **Step 3: Update index.ts to capture and pass all new data**

In plugin init:
```typescript
import { execSync } from "node:child_process";

const projectId = input.project.id;
let gitBranch = "";
try {
  gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
} catch {}
```

In `chat.message` handler — extract skills from ToolPart:
```typescript
"chat.message": async (inputMsg, output) => {
  const model = (inputMsg as any).model;
  const parts = (output as any).parts ?? [];
  const skills = parts
    .filter((p: any) => p.type === "tool")
    .map((p: any) => p.tool)
    .filter((t: string) => t);
  const uniqueSkills = skills.length > 0 ? [...new Set(skills)] : undefined;
  handleChatMessage(base, inputMsg as any, output as any, undefined, rootDir, username, model?.providerID, model?.modelID, opencodeVersion, projectId, gitBranch, uniqueSkills);
},
```

In `event` handler — extract finish, mode, duration, error, cwd:
```typescript
const info = ev.properties?.info;
if (info) {
  const finishReason = info.finish;
  const mode = info.mode;
  const durationMs = info.time?.completed ? info.time.completed - info.time.created : undefined;
  const error = info.error;
  const cwd = info.path?.cwd;
  flushAssistantOutput(base, info.id, info.sessionID, info.agent ?? defaultAgent, undefined, rootDir, username, info.providerID, info.modelID, opencodeVersion, finishReason, mode, durationMs, error, cwd, projectId, gitBranch);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc && node --test 'dist/index.test.js' 2>&1
```
Expected: PASS.

- [ ] **Step 5: Run all tests**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npm test 2>&1
```
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/src/index.ts opencode/plugins/opencode-monitor-plugin/src/index.test.ts
git commit -m "feat(monitor): wire project_id, git_branch, finish_reason, mode, duration_ms, error, cwd, skills"
```

---

### Task 4: Update README

**Files:**
- Modify: `opencode/plugins/opencode-monitor-plugin/README.md`

- [ ] **Step 1: Update session-logs JSONL example and field table**

Update the example to include all new fields:
```json
{
  "timestamp": "2026-05-15T06:55:42.000Z",
  "agent": "feature",
  "session_id": "58a91aab-...",
  "username": "odemidov",
  "root_dir": "/Users/user/projects/my-app",
  "project_id": "proj_abc123",
  "git_branch": "feature/monitor",
  "provider_id": "opencode",
  "model_id": "big-pickle",
  "opencode_version": "1.15.0",
  "mode": "agent",
  "finish_reason": "stop",
  "duration_ms": 4523,
  "cwd": "/Users/user/projects/my-app/src",
  "error": { "type": "api_error", "message": "timeout" },
  "skills": ["test-driven-development"],
  "input": "текст запроса",
  "output": "ответ модели",
  "thinking": "цепочка рассуждений"
}
```

Add to the field table:
| `project_id` | string | ID проекта (опционально) |
| `git_branch` | string | Текущая ветка git (опционально) |
| `mode` | string | Режим агента: chat/agent (опционально) |
| `finish_reason` | string | Причина завершения: stop/length/error/tool_use (опционально) |
| `duration_ms` | number | Длительность ответа в мс (опционально) |
| `cwd` | string | Рабочая директория (опционально) |
| `error` | object | Ошибка, если была (опционально) |
| `skills` | string[] | Список вызванных скилов (опционально, только для assistant) |

- [ ] **Step 2: Commit**

```bash
git add opencode/plugins/opencode-monitor-plugin/README.md
git commit -m "docs(monitor): document new session-logs fields in README"
```

---

### Task 5: Full test run and final commit

- [ ] **Step 1: Typecheck**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Run all tests**

Run:
```bash
cd opencode/plugins/opencode-monitor-plugin && npm test
```
Expected: All tests PASS.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore(monitor): final fixes after enrichment implementation"
```
