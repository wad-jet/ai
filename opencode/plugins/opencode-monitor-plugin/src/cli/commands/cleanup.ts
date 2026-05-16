import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { getDataDir } from "../../paths.js";

export interface CleanupFile {
  date: string;
  type: "session-logs" | "token-status";
  size: number;
  path: string;
}

export function collectCleanupFiles(
  dataDir: string,
  days: number,
  types: ("session-logs" | "token-status")[],
): CleanupFile[] {
  const cutoff = new Date(Date.now() - days * 86400000);
  const files: CleanupFile[] = [];

  for (const type of types) {
    const dir = join(dataDir, type);
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const match = entry.match(/^(\d{4}-\d{2}-\d{2})\.(jsonl|csv)$/);
      if (!match) continue;
      const fileDate = new Date(match[1] + "T00:00:00.000Z");
      if (fileDate >= cutoff) continue;
      const fullPath = join(dir, entry);
      try {
        const size = statSync(fullPath).size;
        files.push({ date: match[1], type, size, path: fullPath });
      } catch {
        // skip files that can't be stat'd
      }
    }
  }

  files.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  return files;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatTotalSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatCleanupPreview(files: CleanupFile[]): string {
  const lines: string[] = [];
  lines.push("Files to delete:");
  lines.push(`  ${"Date".padEnd(12)} ${"Type".padEnd(16)} Size`);
  lines.push(`  ${"─".repeat(12)} ${"─".repeat(16)} ${"─".repeat(8)}`);
  let totalSize = 0;
  for (const f of files) {
    totalSize += f.size;
    lines.push(`  ${f.date.padEnd(12)} ${f.type.padEnd(16)} ${formatSize(f.size).padStart(8)}`);
  }
  lines.push(`  ${"─".repeat(40)}`);
  lines.push(`  Total: ${files.length} files, ${formatTotalSize(totalSize)}`);
  return lines.join("\n");
}

function confirmDelete(count: number): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Delete ${count} files? (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

export async function runCleanupCLI(
  args: { days: number; sessionLogs: boolean; tokenStatus: boolean; dryRun: boolean },
  base?: string,
): Promise<string> {
  const dataDir = base ?? getDataDir();

  if (args.days < 0) return "Error: --days must be a non-negative number.";

  const types: ("session-logs" | "token-status")[] = [];
  if (!args.sessionLogs && !args.tokenStatus) {
    types.push("session-logs", "token-status");
  } else {
    if (args.sessionLogs) types.push("session-logs");
    if (args.tokenStatus) types.push("token-status");
  }

  const files = collectCleanupFiles(dataDir, args.days, types);
  if (files.length === 0) return "No files to delete.";

  const preview = formatCleanupPreview(files);

  if (args.dryRun) return preview;

  console.log(preview);
  console.log("");
  const ok = await confirmDelete(files.length);
  if (!ok) return "Cancelled.";

  let deleted = 0;
  for (const f of files) {
    try {
      unlinkSync(f.path);
      deleted++;
    } catch {
      // skip files we can't delete
    }
  }
  return `Deleted ${deleted} files.`;
}
