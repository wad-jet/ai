import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { formatCLITokenTable, formatAgentTable, formatDailyTable } from "./token-status.js";
describe("CLI token-status format", () => {
    it("should format summary table", () => {
        const summary = { totalInput: 1000, totalOutput: 500, totalReasoning: 0, totalCacheRead: 0, totalCacheWrite: 0, totalCost: 0.15, totalRows: 3 };
        const output = formatCLITokenTable(summary);
        assert.ok(output.includes("1,000"));
        assert.ok(output.includes("$0.15"));
    });
    it("should format agent breakdown table", () => {
        const agents = [{ agent: "default", input: 1000, output: 500, cost: 0.15, hits: 3 }];
        const output = formatAgentTable(agents, false);
        assert.ok(output.includes("default"));
        assert.ok(output.includes("$0.15"));
    });
    it("should return empty for no agents", () => {
        assert.equal(formatAgentTable([], false), "");
        assert.equal(formatAgentTable([], true), "");
    });
    it("should format daily table with header and total", () => {
        const rows = [
            { date: "2026-05-14", input: 1500, output: 750, reasoning: 100, cacheRead: 300, cacheWrite: 60, cost: 0.03, hits: 12 },
            { date: "2026-05-15", input: 900, output: 450, reasoning: 50, cacheRead: 200, cacheWrite: 40, cost: 0.018, hits: 8 },
        ];
        const output = formatDailyTable(rows);
        assert.match(output, /Day Breakdown/);
        assert.match(output, /2026-05-14/);
        assert.match(output, /2026-05-15/);
        assert.match(output, /Total:/);
        assert.match(output, /20/);
        assert.match(output, /2,400/);
        assert.match(output, /\$0.0480/);
    });
    it("should return empty string for no daily rows", () => {
        assert.equal(formatDailyTable([]), "");
    });
});
