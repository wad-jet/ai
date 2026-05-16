import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleChatMessage, handlePartUpdate, flushAssistantOutput } from "./session-collector.js";
import { readJSONL } from "../storage/jsonl-writer.js";

const BASE = join(tmpdir(), "monitor-session-test-" + Date.now());
const CONFIG_ENABLED = { includeThinking: true as const };
const CONFIG_DISABLED = { includeThinking: false as const };

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

    handleChatMessage({ base: BASE, input: input as any, output: output as any });

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

    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      config: CONFIG_ENABLED as any,
    });

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

    handleChatMessage({
      base: BASE,
      input: {} as any,
      output: output as any,
      config: CONFIG_DISABLED as any,
    });
    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 3);
    // Last record should not have thinking
    const lastRecord = records[records.length - 1];
    assert.equal(lastRecord.thinking, undefined);
  });

  it("should accumulate and flush assistant text from part updates", () => {
    const TEXT_PART = { properties: { part: { id: "p-accum", type: "text", text: "Hello world!", messageID: "msg-accum", time: { end: 1 } } } };
    const REASON_PART = { properties: { part: { id: "p-accum-2", type: "reasoning", text: "thinking...", messageID: "msg-accum", time: { end: 2 } } } };

    handlePartUpdate(BASE, TEXT_PART as any);
    handlePartUpdate(BASE, REASON_PART as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-accum", sessionId: "sess-accum", agent: "agent", config: CONFIG_ENABLED });

    const records = readJSONL(BASE, "session-logs") as any[];
    const record = records.find((r) => r.session_id === "sess-accum");
    assert.ok(record !== undefined, "record should exist");
    assert.equal(record!.agent, "agent");
    assert.equal(record!.output, "Hello world!");
    assert.equal(record!.thinking, "thinking...");
  });

  it("should not flush if no parts accumulated", () => {
    const before = readJSONL(BASE, "session-logs").length;
    flushAssistantOutput({ base: BASE, msgId: "nonexistent", sessionId: "sess-2", agent: "agent", config: CONFIG_DISABLED });
    const after = readJSONL(BASE, "session-logs").length;
    assert.equal(after, before);
  });

  it("should skip part without time.end", () => {
    const ev = { properties: { part: { id: "p3", type: "text", text: "incomplete", messageID: "msg-2" } } };
    handlePartUpdate(BASE, ev as any);
    flushAssistantOutput({ base: BASE, msgId: "msg-2", sessionId: "sess-3", agent: "agent", config: CONFIG_DISABLED });
    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.notEqual(last.session_id, "sess-3");
  });

  it("should include root_dir in chat message records", () => {
    const input = { sessionID: "sess-root", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hello" }] };

    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      rootDir: "/test/project",
    });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.root_dir, "/test/project");
  });

  it("should include root_dir in flushed assistant output", () => {
    const textPart = { properties: { part: { id: "p-root", type: "text", text: "output", messageID: "msg-root", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-root", sessionId: "sess-root", agent: "agent", timestamp: "2026-01-01T00:00:00.000Z", rootDir: "/test/project" });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.root_dir, "/test/project");
  });

  it("should include username in chat message records", () => {
    const input = { sessionID: "sess-user", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hello" }] };

    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      username: "testuser",
    });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.username, "testuser");
  });

  it("should include username in flushed assistant output", () => {
    const textPart = { properties: { part: { id: "p-user", type: "text", text: "output", messageID: "msg-user", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-user", sessionId: "sess-user", agent: "agent", timestamp: "2026-01-01T00:00:00.000Z", username: "testuser" });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.username, "testuser");
  });

  it("should not include username when not provided", () => {
    const input = { sessionID: "sess-no-user", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hello" }] };

    handleChatMessage({ base: BASE, input: input as any, output: output as any });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.username, undefined);
  });

  it("should include finish_reason in flushed output", () => {
    const textPart = { properties: { part: { id: "p-fr", type: "text", text: "out", messageID: "msg-fr", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-fr", sessionId: "sess-fr", agent: "agent", timestamp: "2026-01-01T00:00:00.000Z", finishReason: "stop", mode: "agent", durationMs: 1234, cwd: "/home/user/proj", projectId: "proj-1", gitBranch: "main" });

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

    flushAssistantOutput({ base: BASE, msgId: "msg-err", sessionId: "sess-err", agent: "agent", timestamp: "2026-01-01T00:00:00.000Z", error: { type: "api_error", message: "timeout" } });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.deepEqual(last.error, { type: "api_error", message: "timeout" });
  });

  it("should include project_id and git_branch in flushed output", () => {
    const textPart = { properties: { part: { id: "p-pg", type: "text", text: "out", messageID: "msg-pg", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-pg", sessionId: "sess-pg", agent: "agent", timestamp: "2026-01-01T00:00:00.000Z", projectId: "proj-1", gitBranch: "main" });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.project_id, "proj-1");
    assert.equal(last.git_branch, "main");
  });

  it("should persist duration_ms=0 (not treat as falsy)", () => {
    const textPart = { properties: { part: { id: "p-d0", type: "text", text: "out", messageID: "msg-d0", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-d0", sessionId: "sess-d0", agent: "agent", timestamp: "2026-01-01T00:00:00.000Z", durationMs: 0 });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.duration_ms, 0);
  });

  it("should include model info and opencode version in chat message records", () => {
    const input = { sessionID: "sess-model", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hi" }] };

    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      providerId: "anthropic",
      modelId: "claude-3",
      opencodeVersion: "1.15.0",
    });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.provider_id, "anthropic");
    assert.equal(last.model_id, "claude-3");
    assert.equal(last.opencode_version, "1.15.0");
  });

  it("should include model info and opencode version in flushed output", () => {
    const textPart = { properties: { part: { id: "p-model", type: "text", text: "out", messageID: "msg-model", time: { end: 1 } } } };
    handlePartUpdate(BASE, textPart as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-model", sessionId: "sess-model", agent: "agent", timestamp: "2026-01-01T00:00:00.000Z", providerId: "openai", modelId: "gpt-4", opencodeVersion: "1.15.0" });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.provider_id, "openai");
    assert.equal(last.model_id, "gpt-4");
    assert.equal(last.opencode_version, "1.15.0");
  });

  it("should include project_id, git_branch and skills in chat message records", () => {
    const input = { sessionID: "sess-meta", agent: "default" };
    const output = { message: { role: "assistant" }, parts: [{ type: "text", text: "ok" }] };

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

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.project_id, "proj-1");
    assert.equal(last.git_branch, "main");
    assert.deepEqual(last.skills, ["test-driven-development", "writing-plans"]);
  });

  it("should not include skills for user messages", () => {
    const input = { sessionID: "sess-user-skills", agent: "default" };
    const output = { message: { role: "user" }, parts: [{ type: "text", text: "hello" }] };

    handleChatMessage({
      base: BASE,
      input: input as any,
      output: output as any,
      projectId: "proj-1",
      gitBranch: "main",
      skills: ["test-driven-development"],
    });

    const records = readJSONL(BASE, "session-logs") as any[];
    const last = records[records.length - 1];
    assert.equal(last.project_id, "proj-1");
    assert.equal(last.git_branch, "main");
    assert.equal(last.skills, undefined);
  });
});

// Tests for includeThinking config
describe("session-collector with includeThinking", () => {
  const CONFIG_ENABLED = { includeThinking: true as const };
  const CONFIG_DISABLED = { includeThinking: false as const };

  it("should include reasoning when includeThinking is true", () => {
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

    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "test-session");
    assert.equal(record?.thinking, "Thinking process...");
    assert.equal(record?.output, "Hello world");
  });

  it("should exclude reasoning when includeThinking is false", () => {
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

    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "test-session-2");
    assert.equal(record?.thinking, undefined);
    assert.equal(record?.output, "Hello again");
  });

  it("should default to false when config is undefined", () => {
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

    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "test-session-3");
    assert.equal(record?.thinking, undefined);
  });

  it("should handle flushAssistantOutput with includeThinking enabled", () => {
    const textPart = { properties: { part: { id: "p-thinking-1", type: "text", text: "Response", messageID: "msg-thinking-1", time: { end: 1 } } } };
    const reasonPart = { properties: { part: { id: "p-thinking-2", type: "reasoning", text: "Thinking in flush", messageID: "msg-thinking-1", time: { end: 2 } } } };
    
    handlePartUpdate(BASE, textPart as any);
    handlePartUpdate(BASE, reasonPart as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-thinking-1", sessionId: "sess-thinking-1", agent: "agent", timestamp: "2026-01-01T00:03:00.000Z", config: CONFIG_ENABLED });

    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "sess-thinking-1");
    assert.ok(record !== undefined);
    assert.equal(record.output, "Response");
    assert.equal(record.thinking, "Thinking in flush");
  });

  it("should exclude thinking in flushAssistantOutput when disabled", () => {
    const textPart = { properties: { part: { id: "p-no-thinking", type: "text", text: "Response", messageID: "msg-no-thinking", time: { end: 1 } } } };
    const reasonPart = { properties: { part: { id: "p-no-thinking-2", type: "reasoning", text: "Should be excluded", messageID: "msg-no-thinking", time: { end: 2 } } } };
    
    handlePartUpdate(BASE, textPart as any);
    handlePartUpdate(BASE, reasonPart as any);

    flushAssistantOutput({ base: BASE, msgId: "msg-no-thinking", sessionId: "sess-no-thinking", agent: "agent", timestamp: "2026-01-01T00:04:00.000Z", config: CONFIG_DISABLED });

    const records = readJSONL(BASE, "session-logs");
    const record = records.find((r) => r.session_id === "sess-no-thinking");
    assert.ok(record !== undefined);
    assert.equal(record?.thinking, undefined);
    assert.equal(record?.output, "Response");
  });
});
