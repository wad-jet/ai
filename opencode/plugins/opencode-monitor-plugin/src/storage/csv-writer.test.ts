import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendCSV, readCSV } from "./csv-writer.js";

describe("csv-writer", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "monitor-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should append a row to a date-partitioned CSV", () => {
    const vals = ["2026-01-01", "default", "100"];
    appendCSV(tmpDir, "test-tokens", vals);

    const rows = readCSV(tmpDir, "test-tokens", 3);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].length, 3);
    assert.equal(rows[0][1], "default");
  });

  it("should append multiple rows", () => {
    appendCSV(tmpDir, "test-tokens", ["2026-01-01", "agent-a", "50"]);
    appendCSV(tmpDir, "test-tokens", ["2026-01-01", "agent-b", "75"]);

    const rows = readCSV(tmpDir, "test-tokens", 3);
    assert.equal(rows.length, 3);
  });

  it("should return empty for missing directory", () => {
    const rows = readCSV(tmpDir, "nonexistent", 3);
    assert.deepEqual(rows, []);
  });
});
