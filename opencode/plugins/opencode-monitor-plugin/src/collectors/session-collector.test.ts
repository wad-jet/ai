import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleChatMessage } from "./session-collector.js";
import { readJSONL } from "../storage/jsonl-writer.js";

const BASE = join(tmpdir(), "monitor-session-test-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("session-collector", () => {
  it("should log user message and assistant response", () => {
    const input = {
      sessionID: "session-1",
      agent: "default",
    };
    const output = {
      message: { role: "user", parts: [{ type: "text", text: "Hello" }] } as any,
      parts: [
        { type: "text", text: "Hi there!" },
        { type: "reasoning", text: "thinking step..." },
      ] as any,
    };

    handleChatMessage(BASE, input as any, output as any);

    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 1);
    assert.equal(records[0].session_id, "session-1");
    assert.equal(records[0].input, "Hello");
    assert.equal(records[0].output, "Hi there!");
    assert.equal(records[0].thinking, "thinking step...");
    assert.ok(records[0].timestamp);
  });

  it("should handle messages without reasoning/thinking", () => {
    const output = {
      message: { role: "user", parts: [{ type: "text", text: "test" }] } as any,
      parts: [{ type: "text", text: "response" }] as any,
    };

    handleChatMessage(BASE, {} as any, output as any);
    const records = readJSONL(BASE, "session-logs") as any[];
    assert.equal(records.length, 2);
    assert.equal(records[1].thinking, undefined);
  });
});
