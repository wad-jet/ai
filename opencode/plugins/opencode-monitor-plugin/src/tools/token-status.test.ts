import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { formatTokenTable } from "./token-status.js";

describe("token-status tool", () => {
  it("should format summary section", () => {
    const summary = {
      totalInput: 1000, totalOutput: 500, totalReasoning: 100,
      totalCacheRead: 200, totalCacheWrite: 50, totalCost: 0.15, totalRows: 5,
    };
    const output = formatTokenTable(summary, []);
    assert.ok(output.includes("1,000"));
    assert.ok(output.includes("500"));
    assert.ok(output.includes("0.1500"));
    assert.ok(output.includes("$0.1500"));
  });

  it("should format agent breakdown section", () => {
    const agents = [
      { agent: "agent-a", input: 800, output: 300, cost: 0.10, hits: 3 },
      { agent: "agent-b", input: 200, output: 200, cost: 0.05, hits: 2 },
    ];
    const output = formatTokenTable({ totalInput: 1000, totalOutput: 500, totalReasoning: 0, totalCacheRead: 0, totalCacheWrite: 0, totalCost: 0.15, totalRows: 5 }, agents);
    assert.ok(output.includes("agent-a"));
    assert.ok(output.includes("agent-b"));
    assert.ok(output.includes("|"));
  });
});
