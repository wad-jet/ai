import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleTokenEvent } from "./collectors/token-collector.js";
import { handleChatMessage } from "./collectors/session-collector.js";
import { readCSV } from "./storage/csv-writer.js";
import { readJSONL } from "./storage/jsonl-writer.js";

const BASE = join(tmpdir(), "monitor-integration-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("integration: collector pipeline", () => {
  it("should collect token data and session logs end-to-end", () => {
    const ts = "2026-01-01T00:00:00.000Z";
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
        },
      },
    };
    handleTokenEvent(BASE, tokenEvent as any, ts);

    const chatInput = { sessionID: "sess-1", agent: "default" };
    const chatOutput = {
      message: { role: "user", parts: [{ type: "text", text: "hello" }] },
      parts: [{ type: "text", text: "world" }, { type: "reasoning", text: "thinking..." }],
    };
    handleChatMessage(BASE, chatInput as any, chatOutput as any, ts);

    const tokenRows = readCSV(BASE, "token_status", 11);
    assert.equal(tokenRows.length, 1);
    assert.equal(tokenRows[0][5], "100");

    const logRecords = readJSONL(BASE, "session-logs") as any[];
    assert.equal(logRecords.length, 1);
    assert.equal(logRecords[0].input, "hello");
    assert.equal(logRecords[0].thinking, "thinking...");
  });
});
