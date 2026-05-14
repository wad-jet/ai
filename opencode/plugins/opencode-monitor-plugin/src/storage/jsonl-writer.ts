import { appendFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

function datePartition(): string {
  return new Date().toISOString().slice(0, 10);
}

export function appendJSONL(
  baseDir: string,
  subdir: string,
  obj: Record<string, unknown>,
  date?: string,
): void {
  const day = date ?? datePartition();
  const dir = join(baseDir, subdir);
  const file = join(dir, `${day}.jsonl`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(file, JSON.stringify(obj) + "\n");
}

export function readJSONL(
  baseDir: string,
  subdir: string,
  maxDays?: number,
): Record<string, unknown>[] {
  const dir = join(baseDir, subdir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  const recent = maxDays ? files.slice(-maxDays) : files;
  const records: Record<string, unknown>[] = [];
  for (const file of recent) {
    const content = readFileSync(join(dir, file), "utf-8");
    for (const line of content.trim().split("\n")) {
      if (!line) continue;
      try {
        records.push(JSON.parse(line));
      } catch {
        // skip corrupt lines
      }
    }
  }
  return records;
}
