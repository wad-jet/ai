import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleChatMessage, handlePartUpdate, flushAssistantOutput } from "./session-collector.js";
import { readJSONL } from "../storage/jsonl-writer.js";

const BASE = join(tmpdir(), "monitor-session-test-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("session-collector", () => {
  it("should log user message as input", () => {
    const input = {
      sessionID: "session-1",
      agent: "default",
    };
    const output = {
      message: { role: "user" },
      parts: [{ type: "text", text: "Hello" }],
    };

    handleChatMessage(BASE, input as any, output as any);

    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 1);
    assert.equal(records[0].session_id, "session-1");
    assert.equal(records[0].input, "Hello");
    assert.equal(records[0].output, undefined);
    assert.ok(records[0].timestamp);
  });

  it("should log assistant message as output with thinking", () => {
    const input = {
      sessionID: "session-1",
      agent: "default",
    };
    const output = {
      message: { role: "assistant" },
      parts: [
        { type: "text", text: "Hi there!" },
        { type: "reasoning", text: "thinking step..." },
      ],
    };

    handleChatMessage(BASE, input as any, output as any);

    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 2);
    assert.equal(records[1].output, "Hi there!");
    assert.equal(records[1].thinking, "thinking step...");
    assert.equal(records[1].input, undefined);
  });

  it("should handle messages without reasoning/thinking", () => {
    const output = {
      message: { role: "assistant" },
      parts: [{ type: "text", text: "response" }],
    };

    handleChatMessage(BASE, {} as any, output as any);
    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 3);
    assert.equal(records[2].thinking, undefined);
  });

  it("should accumulate and flush assistant text from part updates", () => {
    const textPart = { properties: { part: { id: "p1", type: "text", text: "Hello world!", messageID: "msg-1", time: { end: 1 } } } };
    const reasonPart = { properties: { part: { id: "p2", type: "reasoning", text: "thinking...", messageID: "msg-1", time: { end: 2 } } } };

    handlePartUpdate(BASE, textPart as any);
    handlePartUpdate(BASE, reasonPart as any);

    flushAssistantOutput(BASE, "msg-1", "sess-1", "agent", "2026-01-01T00:00:00.000Z");

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.session_id, "sess-1");
    assert.equal(last.agent, "agent");
    assert.equal(last.output, "Hello world!");
    assert.equal(last.thinking, "thinking...");
  });

  it("should not flush if no parts accumulated", () => {
    const before = readJSONL(BASE, "session-logs").length;
    flushAssistantOutput(BASE, "nonexistent", "sess-2", "agent");
    const after = readJSONL(BASE, "session-logs").length;
    assert.equal(after, before);
  });

  it("should skip part without time.end", () => {
    const ev = { properties: { part: { id: "p3", type: "text", text: "incomplete", messageID: "msg-2" } } };
    handlePartUpdate(BASE, ev as any);
    flushAssistantOutput(BASE, "msg-2", "sess-3", "agent");
    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.notEqual(last.session_id, "sess-3");
  });

  it("should include root_dir in chat message records", () => {
    const input = { sessionID: "sess-root", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hello" }] };

    handleChatMessage(BASE, input as any, output as any, undefined, "/test/project");

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.root_dir, "/test/project");
  });

  it("should include root_dir in flushed assistant output", () => {
    const textPart = { properties: { part: { id: "p-root", type: "text", text: "output", messageID: "msg-root", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput(BASE, "msg-root", "sess-root", "agent", "2026-01-01T00:00:00.000Z", "/test/project");

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.root_dir, "/test/project");
  });

  it("should include username in chat message records", () => {
    const input = { sessionID: "sess-user", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hello" }] };

    handleChatMessage(BASE, input as any, output as any, undefined, undefined, "testuser");

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.username, "testuser");
  });

  it("should include username in flushed assistant output", () => {
    const textPart = { properties: { part: { id: "p-user", type: "text", text: "output", messageID: "msg-user", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput(BASE, "msg-user", "sess-user", "agent", "2026-01-01T00:00:00.000Z", undefined, "testuser");

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.username, "testuser");
  });

  it("should not include username when not provided", () => {
    const input = { sessionID: "sess-no-user", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hello" }] };

    handleChatMessage(BASE, input as any, output as any);

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.username, undefined);
  });

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

    flushAssistantOutput(BASE, "msg-err", "sess-err", "agent", "2026-01-01T00:00:00.000Z", undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { type: "api_error", message: "timeout" });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.deepEqual(last.error, { type: "api_error", message: "timeout" });
  });

  it("should include project_id and git_branch in flushed output", () => {
    const textPart = { properties: { part: { id: "p-pg", type: "text", text: "out", messageID: "msg-pg", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput(BASE, "msg-pg", "sess-pg", "agent", "2026-01-01T00:00:00.000Z", undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, "proj-1", "main");

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.project_id, "proj-1");
    assert.equal(last.git_branch, "main");
  });

  it("should persist duration_ms=0 (not treat as falsy)", () => {
    const textPart = { properties: { part: { id: "p-d0", type: "text", text: "out", messageID: "msg-d0", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput(BASE, "msg-d0", "sess-d0", "agent", "2026-01-01T00:00:00.000Z", undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0);

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.duration_ms, 0);
  });

  it("should include model info and opencode version in chat message records", () => {
    const input = { sessionID: "sess-model", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hi" }] };

    handleChatMessage(BASE, input as any, output as any, undefined, undefined, undefined, "anthropic", "claude-3", "1.15.0");

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.provider_id, "anthropic");
    assert.equal(last.model_id, "claude-3");
    assert.equal(last.opencode_version, "1.15.0");
  });

  it("should include model info and opencode version in flushed output", () => {
    const textPart = { properties: { part: { id: "p-model", type: "text", text: "out", messageID: "msg-model", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput(BASE, "msg-model", "sess-model", "agent", "2026-01-01T00:00:00.000Z", undefined, undefined, "openai", "gpt-4", "1.15.0");

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.provider_id, "openai");
    assert.equal(last.model_id, "gpt-4");
    assert.equal(last.opencode_version, "1.15.0");
  });
});
