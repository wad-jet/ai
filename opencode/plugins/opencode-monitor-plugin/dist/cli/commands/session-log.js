import { readJSONL } from "../../storage/jsonl-writer.js";
import { getDataDir } from "../../paths.js";
import { SESSION_LOGS } from "../../constants.js";
function formatSessionList(basePath) {
    const records = readJSONL(basePath, SESSION_LOGS);
    const sessions = new Map();
    for (const r of records) {
        const sid = String(r.session_id ?? "");
        if (sid && !sessions.has(sid)) {
            sessions.set(sid, { timestamp: String(r.timestamp ?? ""), session_id: sid });
        }
    }
    const lines = ["Available Sessions", "\u2550".repeat(60)];
    for (const s of sessions.values()) {
        lines.push(`  ${s.timestamp}  ${s.session_id}`);
    }
    if (sessions.size === 0)
        lines.push("  No session logs found.");
    return lines.join("\n");
}
function formatSessionView(filters, basePath, config) {
    const includeThinking = config?.includeThinking ?? false;
    let sessionRecords = readJSONL(basePath, SESSION_LOGS)
        .filter((r) => String(r.session_id) === filters.sessionId);
    if (filters.date) {
        sessionRecords = sessionRecords.filter((r) => String(r.timestamp).slice(0, 10) === filters.date);
    }
    if (filters.since) {
        sessionRecords = sessionRecords.filter((r) => String(r.timestamp).slice(0, 10) >= String(filters.since));
    }
    if (filters.until) {
        sessionRecords = sessionRecords.filter((r) => String(r.timestamp).slice(0, 10) <= String(filters.until));
    }
    if (filters.agent) {
        sessionRecords = sessionRecords.filter((r) => String(r.agent) === filters.agent);
    }
    if (filters.error) {
        sessionRecords = sessionRecords.filter((r) => r.error !== undefined && r.error !== null);
    }
    if (filters.tail && filters.tail > 0) {
        sessionRecords = sessionRecords.slice(-filters.tail);
    }
    if (sessionRecords.length === 0)
        return `No logs found for session: ${filters.sessionId}`;
    const lines = [];
    for (const r of sessionRecords) {
        lines.push("\u2500".repeat(60));
        lines.push(`Session: ${r.session_id}`);
        lines.push(`Time:    ${r.timestamp}`);
        lines.push(`Agent:   ${r.agent}`);
        if (r.username)
            lines.push(`User:    ${r.username}`);
        if (r.provider_id)
            lines.push(`Model:   ${r.provider_id}/${r.model_id}`);
        if (r.mode)
            lines.push(`Mode:    ${r.mode}`);
        if (r.duration_ms !== undefined)
            lines.push(`Duration: ${r.duration_ms}ms`);
        if (r.finish_reason)
            lines.push(`Finish:  ${r.finish_reason}`);
        if (r.error)
            lines.push(`Error:   ${typeof r.error === 'object' ? JSON.stringify(r.error) : r.error}`);
        lines.push("");
        const field = filters.field ?? "all";
        const showInput = field === "input" || field === "all";
        const showOutput = field === "output" || field === "all";
        const showThinking = includeThinking && (field === "thinking" || field === "all") && r.thinking;
        if (showInput) {
            lines.push("Input:");
            lines.push(String(r.input ?? ""));
            lines.push("");
        }
        if (showOutput) {
            lines.push("Output:");
            lines.push(String(r.output ?? ""));
            lines.push("");
        }
        if (showThinking) {
            lines.push("Thinking:");
            lines.push(String(r.thinking));
            lines.push("");
        }
    }
    return lines.join("\n");
}
function formatSessionSearch(filters, basePath) {
    const records = readJSONL(basePath, SESSION_LOGS);
    const text = (filters.searchText ?? "").toLowerCase();
    const matching = records.filter((r) => String(r.input ?? "").toLowerCase().includes(text) ||
        String(r.output ?? "").toLowerCase().includes(text));
    const lines = [];
    for (const r of matching) {
        const preview = String(r.input ?? "").slice(0, 80);
        lines.push(`  ${r.timestamp}  ${r.session_id}  "${preview}..."`);
    }
    if (matching.length === 0)
        lines.push("  No matches found.");
    return lines.join("\n");
}
function getHelpText() {
    return "Usage: session-log <session-id> | session-log list | session-log search <text>";
}
export function runSessionLogCLI(action, filters, basePath, config) {
    const base = basePath ?? getDataDir();
    switch (action) {
        case "list": return formatSessionList(base);
        case "view": return formatSessionView(filters, base, config);
        case "search": return formatSessionSearch(filters, base);
        case "help": return getHelpText();
    }
}
