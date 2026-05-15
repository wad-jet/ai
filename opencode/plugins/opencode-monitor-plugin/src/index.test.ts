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
    const chatUserOutput = {
      message: { role: "user" },
      parts: [{ type: "text", text: "hello" }],
    };
    handleChatMessage(BASE, chatInput as any, chatUserOutput as any, ts, "/test/project", "tester", "anthropic", "claude-3-opus", "1.15.0", "proj-1", "main", undefined, { includeThinking: true as const });
    const chatAssistantOutput = {
      message: { role: "assistant" },
      parts: [{ type: "text", text: "world" }, { type: "reasoning", text: "thinking..." }],
    };
    handleChatMessage(BASE, chatInput as any, chatAssistantOutput as any, ts, "/test/project", "tester", "anthropic", "claude-3-opus", "1.15.0", "proj-1", "main", ["skill-a"], { includeThinking: true as const });

    const tokenRows = readCSV(BASE, "token_status", 11);
    assert.equal(tokenRows.length, 1);
    assert.equal(tokenRows[0][5], "100");

    const logRecords = readJSONL(BASE, "session-logs") as any[];
    assert.equal(logRecords.length, 2);
    assert.equal(logRecords[0].input, "hello");
    assert.equal(logRecords[0].root_dir, "/test/project");
    assert.equal(logRecords[0].username, "tester");
    assert.equal(logRecords[0].provider_id, "anthropic");
    assert.equal(logRecords[0].model_id, "claude-3-opus");
    assert.equal(logRecords[0].opencode_version, "1.15.0");
    assert.equal(logRecords[1].output, "world");
    assert.equal(logRecords[1].thinking, "thinking...");
    assert.equal(logRecords[1].root_dir, "/test/project");
    assert.equal(logRecords[1].username, "tester");
    assert.equal(logRecords[1].provider_id, "anthropic");
    assert.equal(logRecords[1].model_id, "claude-3-opus");
    assert.equal(logRecords[1].opencode_version, "1.15.0");
    assert.equal(logRecords[0].project_id, "proj-1");
    assert.equal(logRecords[0].git_branch, "main");
    assert.equal(logRecords[0].skills, undefined);
    assert.equal(logRecords[1].project_id, "proj-1");
    assert.equal(logRecords[1].git_branch, "main");
    assert.deepEqual(logRecords[1].skills, ["skill-a"]);
  });
});
