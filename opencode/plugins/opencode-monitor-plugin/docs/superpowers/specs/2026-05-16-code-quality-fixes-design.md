# Code Quality Fixes — Design Spec

## Overview

Four targeted fixes addressing critical and high-priority issues identified in code review of `opencode-monitor-plugin`. No new features, no architectural changes — strictly defect removal and maintainability improvements.

## Changes

### 1. `handleChatMessage` — Options Object

**Problem:** 13 positional parameters (same class of bug as the old `flushAssistantOutput`). Call sites pass `undefined, undefined, ...` chains that are fragile, unreadable, and will silently break if order changes.

**Solution:** New `HandleChatMessageOptions` interface:

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
```

Function signature changes from:
```typescript
handleChatMessage(base, input, output, timestamp?, rootDir?, ...)
```
to:
```typescript
handleChatMessage(options: HandleChatMessageOptions)
```

**Files affected:**
- `src/collectors/session-collector.ts` — signature + destructuring
- `src/index.ts` — call in `chat.message` hook
- `src/collectors/session-collector.test.ts` — all ~12 call sites
- `src/index.test.ts` — 2 call sites

### 2. `runCleanupCLI` Double Output

**Problem:** `formatCleanupPreview` is printed twice — once via `console.log(preview)` inside `runCleanupCLI` (line 104), and once via `console.log(result)` in `cli/index.ts` (line 74). For interactive mode (with `confirmDelete`), the preview appears before `Cancelled.` or `Deleted X files.` — confusing UX.

**Solution:** Remove `console.log(preview)` and `console.log("")` from `runCleanupCLI`. Only `return preview` or `return "Deleted X files."`. The CLI entry point handles all output.

**Files affected:**
- `src/cli/commands/cleanup.ts` — lines 104–105 removed

### 3. Dead Code Removal

| Location | Code | Action |
|----------|------|--------|
| `session-log.test.ts:23` | `const content = existsSync(file) ? "" : ""` (both branches empty) | Simplify to `const content = ""` or inline |
| `paths.ts:11-13` | `getSubDir(sub)` — exported, zero usages in codebase | Remove function + export |
| `cleanup.ts:50-54` | `formatTotalSize(bytes)` — identical to `formatSize`, unused outside `formatCleanupPreview` | Remove, keep `formatSize` only |

### 4. `formatSize` / `formatTotalSize` Duplication

**Problem:** `formatTotalSize` (line 50) is byte-for-byte identical to `formatSize` (line 44) and only called once (line 67 of `formatCleanupPreview`).

**Solution:** Delete `formatTotalSize`, replace its usage in `formatCleanupPreview` with `formatSize`.

**Files affected:**
- `src/cli/commands/cleanup.ts`

## Testing

- All 66 existing tests must continue to pass
- No new tests needed — pure refactoring, no behavioral changes
- Manual verification: `node --test 'dist/**/*.test.js'`

## Order of Implementation

1. Dead code removal (`paths.ts`, `cleanup.ts`)
2. `formatTotalSize` dedup (`cleanup.ts`)
3. `runCleanupCLI` double output fix (`cleanup.ts`)
4. `handleChatMessage` options object (core change — touches most files)

## Risks

- **`handleChatMessage` refactor:** Changes 3 files (source + 2 test files). Low risk — all call sites are in the same repo, TypeScript catches any missed spots after renames.
- **Dead code removal:** Zero risk — functions are either unused or pure duplicates.
- **Double output fix:** Low risk — regression would mean cleanup output prints twice (current behavior) vs once (new behavior). Easy to verify.
