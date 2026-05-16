import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectCleanupFiles, formatCleanupPreview, runCleanupCLI } from "./cleanup.js";
let testNum = 0;
function freshDir() {
    const dir = join(tmpdir(), "monitor-cleanup-test-" + Date.now() + "-" + (testNum++));
    after(() => {
        try {
            rmSync(dir, { recursive: true, force: true });
        }
        catch { }
    });
    return dir;
}
function touch(base, type, date) {
    const dir = join(base, type);
    mkdirSync(dir, { recursive: true });
    const ext = type === "token-status" ? ".csv" : ".jsonl";
    writeFileSync(join(dir, date + ext), "test\n");
}
describe("cleanup", () => {
    it("should collect no files when all are recent", () => {
        const base = freshDir();
        touch(base, "session-logs", "2026-05-15");
        touch(base, "token-status", "2026-05-15");
        const files = collectCleanupFiles(base, 30, ["session-logs", "token-status"]);
        assert.equal(files.length, 0);
    });
    it("should collect old files by date", () => {
        const base = freshDir();
        touch(base, "session-logs", "2025-01-01");
        touch(base, "token-status", "2025-01-01");
        const files = collectCleanupFiles(base, 30, ["session-logs", "token-status"]);
        assert.equal(files.length, 2);
        assert.equal(files[0].date, "2025-01-01");
        assert.equal(files[0].type, "session-logs");
        assert.equal(files[1].type, "token-status");
    });
    it("should filter by type", () => {
        const base = freshDir();
        touch(base, "session-logs", "2025-02-01");
        touch(base, "token-status", "2025-02-01");
        const files = collectCleanupFiles(base, 30, ["session-logs"]);
        assert.equal(files.length, 1);
        assert.equal(files[0].type, "session-logs");
    });
    it("should ignore non-date filenames", () => {
        const base = freshDir();
        const dir = join(base, "session-logs");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "bad-file.csv"), "test\n");
        writeFileSync(join(dir, "notes.txt"), "test\n");
        const files = collectCleanupFiles(base, 30, ["session-logs"]);
        assert.equal(files.length, 0);
    });
    it("should return preview in dry-run mode without asking confirmation", async () => {
        const base = freshDir();
        touch(base, "session-logs", "2025-03-01");
        const result = await runCleanupCLI({ days: 1, sessionLogs: false, tokenStatus: false, dryRun: true }, base);
        assert.match(result, /Files to delete/);
        assert.match(result, /2025-03-01/);
    });
    it("should format preview with correct summary", () => {
        const files = [
            { date: "2025-01-01", type: "session-logs", size: 1024, path: "/x" },
            { date: "2025-01-15", type: "token-status", size: 2048, path: "/y" },
        ];
        const output = formatCleanupPreview(files);
        assert.match(output, /2025-01-01/);
        assert.match(output, /session-logs/);
        assert.match(output, /1\.0 KB/);
        assert.match(output, /2 files/);
    });
});
