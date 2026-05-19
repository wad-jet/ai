# Code Quality Fixes Round 2 — Design Spec

## Overview

Refactoring and cleanup of opencode-monitor-plugin based on code review findings. 5 sections: utility extraction, test isolation, `runSessionLogCLI` split, type hygiene, and test coverage for CLI modes.

## Sections

### Section 1: Utility Extraction

**1.1 `datePartition` → shared utility**
- Current: duplicated in `csv-writer.ts` and `jsonl-writer.ts`
- Move to `src/storage/utils.ts` (or `src/paths.ts`) with `export function datePartition(): string`
- Both writers import from single source

**1.2 `roundCost` → local helper**
- Current: `Math.round(cost * 1e6) / 1e6` repeated 3× in `token-query.ts`
- Extract to `function roundCost(cost: number): number` at module level
- Replace 3 call sites

**1.3 Magic strings → constants**
- Current: `"session-logs"` and `"token-status"` hardcoded across files
- Extract to `src/constants.ts`: `export const SESSION_LOGS = "session-logs"`, `export const TOKEN_STATUS = "token-status"`
- Update all imports in: `index.ts`, `session-collector.ts`, `token-collector.ts`, `csv-writer.ts` (tests only), `jsonl-writer.ts` (tests only), `cleanup.ts`, `session-log.ts`, `token-query.ts`

### Section 2: Test Isolation + `_columns` Removal

**2.1 `session-collector.test.ts` → `freshDir()`**
- Current: shared `BASE = join(tmpdir(), "monitor-session-test-" + Date.now())`, tests depend on record order
- Switch to per-test `freshDir()` pattern (same as `cleanup.test.ts` and `token-query.test.ts`)
- Create `let testNum = 0` + `function freshDir()` returning isolated temp dir with `after()` cleanup
- Each `it()` block calls `freshDir()` and uses its own directory
- Replace index-based assertions (`records[1]`) with `records.find(r => r.session_id === ...)` where needed

**2.2 Remove `_columns` from `appendCSV`**
- Current: `appendCSV(baseDir, subdir, _columns, values, date?)` — `_columns` is unused
- Change signature to `appendCSV(baseDir, subdir, values, date?)`
- Update both call sites in `token-collector.ts` and `token-query.test.ts`

### Section 3: `runSessionLogCLI` Split

**3.1 Extract `SessionLogAction` type**
```typescript
type SessionLogAction = "list" | "view" | "search" | "help";
```

**3.2 Split into focused functions**
- `formatSessionList(basePath: string): string`
- `formatSessionView(filters: LogFilters, basePath: string, config?: Config): string` — existing logic, extracted body
- `formatSessionSearch(filters: LogFilters, basePath: string): string`
- `getHelpText(): string` — static help string

**3.3 Top-level dispatcher**
```typescript
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

### Section 4: Type Hygiene

**4.1 `PartUpdateEvent` interface**
- Extract inline anonymous type from `handlePartUpdate` signature (lines 81-82) to named interface:

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

- Update function signature to `handlePartUpdate(base: string, event: PartUpdateEvent): void`

### Section 5: CLI Test Coverage (+5 tests)

All in `session-log.test.ts`. Using the `freshDir()` + `writeSessionRecord` helpers already defined there:

- **list sessions**: 2 sessions → both appear in output
- **search by text**: match found → shows correct session_id
- **search by text**: no match → shows "No matches found"
- **help**: unknown action → shows "Usage/session-log" text
- **list empty**: no sessions → shows "No session logs found"

## Testing

- All existing 66 tests must continue to pass
- 5 new tests for CLI modes → total 71
- All changes are refactoring-only (no behavioural changes)
- Test isolation change (`freshDir()`) may require updating assertion style from `records[N]` to `records.find(...)` to handle unordered results

## Order of Implementation

1. Constants (`src/constants.ts`) — foundational, used by all other sections
2. Utility functions (`datePartition`, `roundCost`) — independent
3. `PartUpdateEvent` interface — isolated change
4. Remove `_columns` from `appendCSV` — touches 2 files
5. Test isolation (`freshDir()`) + fix assertions
6. `runSessionLogCLI` split + new tests

## Risks

- **`freshDir()` refactor in tests**: Assertions rely on `records.length` being exact across the whole file. With isolated dirs per test, each test sees only its own data. This is more correct but changes expected counts in multi-assertion tests. Low risk — straightforward.
- **`_columns` removal**: Signature change in a public export. Only 2 call sites, both in the same package. Zero external consumers. Low risk.
- **Constants refactor**: Mechanical find-and-replace. TS compiler catches missed references. Low risk.
