import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendCSV } from "../storage/csv-writer.js";
import { queryTokenSummary, queryAgentBreakdown } from "./token-query.js";

const BASE = join(tmpdir(), "monitor-query-test-" + Date.now());
after(() => {
  try { rmSync(BASE, { recursive: true, force: true }); } catch {}
});

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

describe("token-query", () => {
  it("should sum tokens across CSV rows", () => {
    const cols = ["ts","agent","session_id","provider","model","in","out","reasoning","cache_r","cache_w","cost"];
    appendCSV(BASE, "token_status", cols, ["t1","agent-a","s1","p1","m1","100","50","10","20","5","0.01"], "2026-01-01");
    appendCSV(BASE, "token_status", cols, ["t2","agent-a","s2","p1","m1","200","30","5","10","2","0.02"], "2026-01-01");
    appendCSV(BASE, "token_status", cols, ["t3","agent-b","s3","p1","m1","50","10","0","0","0","0.005"], "2026-01-01");

    const result = queryTokenSummary(BASE, 30);
    assert.equal(result.totalInput, 350);
    assert.equal(result.totalOutput, 90);
    assert.ok(approx(result.totalCost, 0.035));
    assert.equal(result.totalRows, 3);
  });

  it("should return agent breakdown sorted by cost", () => {
    const result = queryAgentBreakdown(BASE, 30, "cost", 5);
    assert.equal(result.length, 2);
    assert.equal(result[0].agent, "agent-a");
    assert.ok(approx(result[0].cost, 0.03));
    assert.equal(result[1].agent, "agent-b");
    assert.ok(approx(result[1].cost, 0.005));
  });

  it("should return empty summary for no data", () => {
    const emptyBase = join(tmpdir(), "monitor-empty-" + Date.now());
    const result = queryTokenSummary(emptyBase, 1);
    assert.equal(result.totalInput, 0);
    assert.equal(result.totalOutput, 0);
    assert.equal(result.totalRows, 0);
    rmSync(emptyBase, { recursive: true, force: true });
  });
});
