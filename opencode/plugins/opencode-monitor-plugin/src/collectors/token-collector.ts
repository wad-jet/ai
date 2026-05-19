import { appendCSV } from "../storage/csv-writer.js";
import { TOKEN_STATUS } from "../constants.js";

interface TokenEvent {
  type: string;
  properties?: {
    info?: {
      role?: string;
      sessionID?: string;
      agent?: string;
      providerID?: string;
      modelID?: string;
      cost?: number;
      tokens?: {
        input: number;
        output: number;
        reasoning: number;
        cache: { read: number; write: number };
      };
    };
  };
}

export function handleTokenEvent(base: string, event: TokenEvent, timestamp?: string): void {
  if (event.type !== "message.updated") return;
  const info = event.properties?.info;
  if (!info || info.role !== "assistant") return;
  if (!info.tokens) return;

  const ts = timestamp ?? new Date().toISOString();
  appendCSV(base, TOKEN_STATUS, [
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
