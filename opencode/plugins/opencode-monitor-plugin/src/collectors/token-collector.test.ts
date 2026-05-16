import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleTokenEvent } from "./token-collector.js";
import { readCSV } from "../storage/csv-writer.js";

const BASE = join(tmpdir(), "monitor-token-test-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

describe("token-collector", () => {
  it("should write token data from a message.updated event", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: {
          role: "assistant",
          sessionID: "session-1",
          agent: "default",
          providerID: "anthropic",
          modelID: "claude-3-opus",
          cost: 0.015,
          tokens: {
            input: 500,
            output: 200,
            reasoning: 50,
            cache: { read: 100, write: 50 },
          },
        },
      },
    };

    handleTokenEvent(BASE, event as any);

    const rows = readCSV(BASE, "token-status", 11);
    assert.equal(rows.length, 1);
    assert.equal(rows[0][1], "default");
    assert.equal(rows[0][3], "anthropic");
    assert.equal(rows[0][5], "500");
    assert.equal(rows[0][6], "200");
  });

  it("should skip non-assistant messages", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: { role: "user" },
      },
    };

    handleTokenEvent(BASE, event as any);
    const rows = readCSV(BASE, "token-status", 11);
    assert.equal(rows.length, 1);
  });

  it("should skip events without tokens field", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: { role: "assistant" },
      },
    };

    handleTokenEvent(BASE, event as any);
    const rows = readCSV(BASE, "token-status", 11);
    assert.equal(rows.length, 1);
  });
});
