import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendJSONL, readJSONL } from "./jsonl-writer.js";

describe("jsonl-writer", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "monitor-jsonl-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should append a JSON object to a date-partitioned JSONL", () => {
    const obj = { ts: "2026-01-01", agent: "default", value: 42 };
    appendJSONL(tmpDir, "test-logs", obj);

    const records = readJSONL(tmpDir, "test-logs", 3);
    assert.equal(records.length, 1);
    assert.equal(records[0].agent, "default");
  });

  it("should append multiple objects", () => {
    appendJSONL(tmpDir, "test-logs", { id: 1 });
    appendJSONL(tmpDir, "test-logs", { id: 2 });

    const records = readJSONL(tmpDir, "test-logs", 3);
    assert.equal(records.length, 3);
  });

  it("should return empty for missing directory", () => {
    const records = readJSONL(tmpDir, "no-data", 3);
    assert.deepEqual(records, []);
  });
});
