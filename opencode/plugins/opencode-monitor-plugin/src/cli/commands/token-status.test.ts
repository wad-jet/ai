import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { formatCLITokenTable } from "./token-status.js";

describe("CLI token-status format", () => {
  it("should format ASCII table", () => {
    const summary = { totalInput: 1000, totalOutput: 500, totalReasoning: 0, totalCacheRead: 0, totalCacheWrite: 0, totalCost: 0.15, totalRows: 3 };
    const agents = [{ agent: "default", input: 1000, output: 500, cost: 0.15, hits: 3 }];
    const output = formatCLITokenTable(summary, agents);
    assert.ok(output.includes("1,000"));
    assert.ok(output.includes("$0.15"));
    assert.ok(output.includes("default"));
  });
});
