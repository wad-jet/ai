import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSessionLogCLI } from "./session-log.js";
import { createConfig } from "../../config.js";
let testNum = 0;
function freshDir() {
    const dir = join(tmpdir(), "monitor-session-test-" + Date.now() + "-" + (testNum++));
    after(() => {
        try {
            rmSync(dir, { recursive: true, force: true });
        }
        catch { }
    });
    return dir;
}
function writeSessionRecord(base, date, record) {
    const dir = join(base, "session-logs");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, date + ".jsonl");
    const content = "";
    writeFileSync(file, JSON.stringify(record) + "\n", { flag: "a" });
}
describe("session-log filters", () => {
    it("should filter by date", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "test1", output: "result1" });
        writeSessionRecord(base, "2026-05-15", { timestamp: "2026-05-15T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "test2", output: "result2" });
        const output = runSessionLogCLI("view", { sessionId: "sess-1", date: "2026-05-14" }, base);
        assert.match(output, /test1/);
        assert.ok(!output.includes("test2"), "test2 should not be in output");
    });
    it("should filter by agent", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "feature input" });
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T11:00:00.000Z", session_id: "sess-1", agent: "explore", input: "explore input" });
        const output = runSessionLogCLI("view", { sessionId: "sess-1", agent: "feature" }, base);
        assert.match(output, /feature input/);
        assert.ok(!output.includes("explore input"), "explore input should not be in output");
    });
    it("should return tail N records", () => {
        const base = freshDir();
        for (let i = 1; i <= 10; i++) {
            writeSessionRecord(base, "2026-05-14", { timestamp: `2026-05-14T${String(i).padStart(2, "0")}:00:00.000Z`, session_id: "sess-1", agent: "feature", input: `input${i}`, output: `output${i}` });
        }
        const output = runSessionLogCLI("view", { sessionId: "sess-1", tail: 3 }, base);
        assert.ok(output.includes("input10"), "input10 should be in output");
        assert.ok(output.includes("input9"), "input9 should be in output");
        assert.ok(output.includes("input8"), "input8 should be in output");
        assert.ok(!output.includes("input7"), "input7 should not be in output (outside tail 3)");
    });
    it("should filter by error", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", output: "ok" });
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T11:00:00.000Z", session_id: "sess-1", agent: "feature", output: "error output", error: { type: "api_error", message: "timeout" } });
        const output = runSessionLogCLI("view", { sessionId: "sess-1", error: true }, base);
        assert.match(output, /error output/);
    });
    it("should show only specified field", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-1", agent: "feature", input: "user input", output: "ai output", thinking: "reasoning" });
        const outputInput = runSessionLogCLI("view", { sessionId: "sess-1", field: "input" }, base);
        assert.match(outputInput, /user input/);
        assert.ok(!outputInput.includes("ai output"), "ai output should not be in input-only view");
        const outputThinking = runSessionLogCLI("view", { sessionId: "sess-1", field: "thinking" }, base, createConfig({ includeThinking: true }));
        assert.match(outputThinking, /reasoning/);
    });
    it("should hide thinking when includeThinking is false", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-2", agent: "feature", input: "user input", output: "ai output", thinking: "reasoning data" });
        const config = createConfig({ includeThinking: false });
        const output = runSessionLogCLI("view", { sessionId: "sess-2" }, base, config);
        assert.ok(!output.includes("reasoning data"), "reasoning should be hidden when includeThinking is false");
    });
    it("should show thinking when includeThinking is true", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-3", agent: "feature", input: "user input", output: "ai output", thinking: "reasoning data" });
        const config = createConfig({ includeThinking: true });
        const output = runSessionLogCLI("view", { sessionId: "sess-3" }, base, config);
        assert.match(output, /reasoning data/, "reasoning should be shown when includeThinking is true");
    });
    it("should hide thinking with field='thinking' when config is undefined", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-4", agent: "feature", input: "user input", output: "ai output", thinking: "reasoning data" });
        const output = runSessionLogCLI("view", { sessionId: "sess-4", field: "thinking" }, base);
        assert.ok(!output.includes("reasoning data"), "reasoning should be hidden by default when config is undefined");
    });
    it("list action should show sessions", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-list-1", agent: "feature", input: "hello", output: "world" });
        writeSessionRecord(base, "2026-05-15", { timestamp: "2026-05-15T10:00:00.000Z", session_id: "sess-list-2", agent: "explore", input: "hi", output: "there" });
        const output = runSessionLogCLI("list", {}, base);
        assert.match(output, /sess-list-1/);
        assert.match(output, /sess-list-2/);
        assert.match(output, /Available Sessions/);
    });
    it("list action should show empty message when no data", () => {
        const base = freshDir();
        const output = runSessionLogCLI("list", {}, base);
        assert.match(output, /No session logs found/);
    });
    it("search action should find matching records", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-s1", agent: "feature", input: "hello world", output: "goodbye" });
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T11:00:00.000Z", session_id: "sess-s2", agent: "feature", input: "something else", output: "hello there" });
        const output = runSessionLogCLI("search", { searchText: "hello" }, base);
        assert.match(output, /sess-s1/);
        assert.match(output, /sess-s2/);
    });
    it("search action should show no matches when no match", () => {
        const base = freshDir();
        writeSessionRecord(base, "2026-05-14", { timestamp: "2026-05-14T10:00:00.000Z", session_id: "sess-nomatch", agent: "feature", input: "foo", output: "bar" });
        const output = runSessionLogCLI("search", { searchText: "zzzzz" }, base);
        assert.match(output, /No matches found/);
    });
    it("help action should show usage text", () => {
        const base = freshDir();
        const output = runSessionLogCLI("help", {}, base);
        assert.match(output, /Usage:/);
        assert.match(output, /session-log/);
    });
});
