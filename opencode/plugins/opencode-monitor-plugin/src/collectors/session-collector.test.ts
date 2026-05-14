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
});
