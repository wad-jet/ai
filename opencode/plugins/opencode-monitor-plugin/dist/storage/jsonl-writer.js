import { appendFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { datePartition } from "./utils.js";
export function appendJSONL(baseDir, subdir, obj, date) {
    const day = date ?? datePartition();
    const dir = join(baseDir, subdir);
    const file = join(dir, `${day}.jsonl`);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    appendFileSync(file, JSON.stringify(obj) + "\n");
}
export function readJSONL(baseDir, subdir, maxDays) {
    const dir = join(baseDir, subdir);
    if (!existsSync(dir))
        return [];
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
    const recent = maxDays ? files.slice(-maxDays) : files;
    const records = [];
    for (const file of recent) {
        const content = readFileSync(join(dir, file), "utf-8");
        for (const line of content.trim().split("\n")) {
            if (!line)
                continue;
            try {
                records.push(JSON.parse(line));
            }
            catch {
                // skip corrupt lines
            }
        }
    }
    return records;
}
