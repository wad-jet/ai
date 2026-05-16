import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendCSV } from "../storage/csv-writer.js";
import { queryTokenSummary, queryAgentBreakdown, queryDailyBreakdown } from "./token-query.js";

let testNum = 0;

function freshDir(): string {
  const dir = join(tmpdir(), "monitor-query-test-" + Date.now() + "-" + (testNum++));
  after(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  });
  return dir;
}

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

function writeCSV(base: string, date: string, rows: string[][]) {
  const cols = ["ts","agent","session_id","provider","model","in","out","reasoning","cache_r","cache_w","cost"];
  for (const row of rows) {
    appendCSV(base, "token-status", cols, row, date);
  }
}

describe("token-query", () => {
  it("should sum tokens across CSV rows", () => {
    const base = freshDir();
    writeCSV(base, "2026-01-01", [
      ["t1","agent-a","s1","p1","m1","100","50","10","20","5","0.01"],
      ["t2","agent-a","s2","p1","m1","200","30","5","10","2","0.02"],
      ["t3","agent-b","s3","p1","m1","50","10","0","0","0","0.005"],
    ]);
    const result = queryTokenSummary(base, 30);
    assert.equal(result.totalInput, 350);
    assert.equal(result.totalOutput, 90);
    assert.ok(approx(result.totalCost, 0.035));
    assert.equal(result.totalRows, 3);
  });

  it("should return agent breakdown sorted by cost", () => {
    const base = freshDir();
    writeCSV(base, "2026-01-01", [
      ["t1","agent-a","s1","p1","m1","100","50","10","20","5","0.01"],
      ["t2","agent-a","s2","p1","m1","200","30","5","10","2","0.02"],
      ["t3","agent-b","s3","p1","m1","50","10","0","0","0","0.005"],
    ]);
    const result = queryAgentBreakdown(base, 30, "cost", 5);
    assert.equal(result.length, 2);
    assert.equal(result[0].agent, "agent-a");
    assert.ok(approx(result[0].cost, 0.03));
    assert.equal(result[1].agent, "agent-b");
    assert.ok(approx(result[1].cost, 0.005));
  });

  it("should return empty summary for no data", () => {
    const base = freshDir();
    const result = queryTokenSummary(base, 1);
    assert.equal(result.totalInput, 0);
    assert.equal(result.totalOutput, 0);
    assert.equal(result.totalRows, 0);
  });

  it("should return daily breakdown grouped by date", () => {
    const base = freshDir();
    writeCSV(base, "2026-01-01", [
      ["2026-01-01T10:00:00Z","agent-a","s1","p1","m1","100","50","10","20","5","0.01"],
      ["2026-01-01T11:00:00Z","agent-b","s2","p1","m1","200","30","5","10","2","0.02"],
    ]);
    writeCSV(base, "2026-01-02", [
      ["2026-01-02T10:00:00Z","agent-a","s3","p1","m1","50","10","0","0","0","0.005"],
    ]);

    const result = queryDailyBreakdown(base, 30);
    assert.equal(result.length, 2);
    assert.equal(result[0].date, "2026-01-01");
    assert.equal(result[0].hits, 2);
    assert.equal(result[0].input, 300);
    assert.equal(result[0].output, 80);
    assert.ok(approx(result[0].cost, 0.03));
    assert.equal(result[1].date, "2026-01-02");
    assert.equal(result[1].hits, 1);
    assert.equal(result[1].input, 50);
  });

  it("should return empty daily breakdown for no data", () => {
    const base = freshDir();
    const result = queryDailyBreakdown(base, 1);
    assert.equal(result.length, 0);
  });
});
