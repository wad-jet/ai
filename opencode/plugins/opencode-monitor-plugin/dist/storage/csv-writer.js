import { appendFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
function datePartition() {
    return new Date().toISOString().slice(0, 10);
}
export function appendCSV(baseDir, subdir, _columns, values, date) {
    const day = date ?? datePartition();
    const dir = join(baseDir, subdir);
    const file = join(dir, `${day}.csv`);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const escaped = values.map((v) => {
        if (v.includes(",") || v.includes('"') || v.includes("\n")) {
            return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
    });
    appendFileSync(file, escaped.join(",") + "\n");
}
export function readCSV(baseDir, subdir, columnCount, maxDays) {
    const dir = join(baseDir, subdir);
    if (!existsSync(dir))
        return [];
    const files = readdirSync(dir).filter((f) => f.endsWith(".csv")).sort();
    const recent = maxDays ? files.slice(-maxDays) : files;
    const rows = [];
    for (const file of recent) {
        const content = readFileSync(join(dir, file), "utf-8");
        for (const line of content.trim().split("\n")) {
            if (!line)
                continue;
            const parsed = parseCSVLine(line, columnCount);
            if (parsed)
                rows.push(parsed);
        }
    }
    return rows;
}
function parseCSVLine(line, columnCount) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                current += ch;
            }
        }
        else {
            if (ch === '"') {
                inQuotes = true;
            }
            else if (ch === ",") {
                result.push(current);
                current = "";
            }
            else {
                current += ch;
            }
        }
    }
    result.push(current);
    return result.length === columnCount ? result : null;
}
