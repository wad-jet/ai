import { readJSONL } from "../../storage/jsonl-writer.js";
import { getDataDir } from "../../paths.js";

interface LogFilters {
  sessionId?: string;
  searchText?: string;
  date?: string;
}

export function runSessionLogCLI(action: string, filters: LogFilters): string {
  const base = getDataDir();
  const lines: string[] = [];

  if (action === "list") {
    const records = readJSONL(base, "session-logs");
    const sessions = new Map<string, { timestamp: string; session_id: string }>();
    for (const r of records) {
      const sid = String(r.session_id ?? "");
      if (sid && !sessions.has(sid)) {
        sessions.set(sid, { timestamp: String(r.timestamp ?? ""), session_id: sid });
      }
    }
    lines.push("Available Sessions");
    lines.push("\u2550".repeat(60));
    for (const s of sessions.values()) {
      lines.push(`  ${s.timestamp}  ${s.session_id}`);
    }
    if (sessions.size === 0) lines.push("  No session logs found.");
    return lines.join("\n");
  }

  if (action === "view" && filters.sessionId) {
    const records = readJSONL(base, "session-logs");
    const sessionRecords = records.filter((r) => String(r.session_id) === filters.sessionId);
    if (sessionRecords.length === 0) return `No logs found for session: ${filters.sessionId}`;

    for (const r of sessionRecords) {
      lines.push("\u2500".repeat(60));
      lines.push(`Time:    ${r.timestamp}`);
      lines.push(`Agent:   ${r.agent}`);
      lines.push("");
      lines.push("Input:");
      lines.push(String(r.input ?? ""));
      lines.push("");
      lines.push("Output:");
      lines.push(String(r.output ?? ""));
      if (r.thinking) {
        lines.push("");
        lines.push("Thinking:");
        lines.push(String(r.thinking));
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  if (action === "search" && filters.searchText) {
    const records = readJSONL(base, "session-logs");
    const text = filters.searchText.toLowerCase();
    const matching = records.filter(
      (r) =>
        String(r.input ?? "").toLowerCase().includes(text) ||
        String(r.output ?? "").toLowerCase().includes(text),
    );
    for (const r of matching) {
      const preview = String(r.input ?? "").slice(0, 80);
      lines.push(`  ${r.timestamp}  ${r.session_id}  "${preview}..."`);
    }
    if (matching.length === 0) lines.push("  No matches found.");
    return lines.join("\n");
  }

  return "Usage: session-log <session-id> | session-log list | session-log search <text>";
}
