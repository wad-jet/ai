import { appendCSV } from "../storage/csv-writer.js";
const COLUMNS = [
    "timestamp", "agent", "session_id", "provider_id", "model_id",
    "input_tokens", "output_tokens", "reasoning_tokens", "cache_read", "cache_write", "cost",
];
export function handleTokenEvent(base, event, timestamp) {
    if (event.type !== "message.updated")
        return;
    const info = event.properties?.info;
    if (!info || info.role !== "assistant")
        return;
    if (!info.tokens)
        return;
    const ts = timestamp ?? new Date().toISOString();
    appendCSV(base, "token_status", COLUMNS, [
        ts,
        info.agent ?? "unknown",
        info.sessionID ?? "",
        info.providerID ?? "",
        info.modelID ?? "",
        String(info.tokens.input),
        String(info.tokens.output),
        String(info.tokens.reasoning),
        String(info.tokens.cache.read),
        String(info.tokens.cache.write),
        String(info.cost ?? 0),
    ]);
}
