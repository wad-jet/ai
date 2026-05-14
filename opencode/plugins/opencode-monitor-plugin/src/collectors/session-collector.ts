import { appendJSONL } from "../storage/jsonl-writer.js";

interface ChatInput {
  sessionID?: string;
  agent?: string;
}

interface ChatOutput {
  message?: { role?: string };
  parts?: { type?: string; text?: string }[];
}

interface PendingPart {
  type: string;
  text: string;
  messageID: string;
}

const pendingParts = new Map<string, PendingPart>();

export function handleChatMessage(
  base: string,
  input: ChatInput,
  output: ChatOutput,
  timestamp?: string,
): void {
  const ts = timestamp ?? new Date().toISOString();

  const parts = output.parts ?? [];
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
  const thinkingText = parts
    .filter((p) => p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("\n");

  const isUser = output.message?.role === "user";

  const record: Record<string, unknown> = {
    timestamp: ts,
    agent: input.agent ?? "unknown",
    session_id: input.sessionID ?? "",
  };
  if (isUser) {
    record.input = text;
  } else {
    record.output = text;
  }
  if (thinkingText) record.thinking = thinkingText;

  appendJSONL(base, "session-logs", record);
}

export function handlePartUpdate(
  base: string,
  event: { properties?: { part?: { id?: string; type?: string; text?: string; messageID?: string; time?: { end?: number } } } },
): void {
  const part = event.properties?.part;
  if (!part?.type || !part.id || !part.messageID) return;
  if (!part.time?.end) return;

  pendingParts.set(part.id, {
    type: part.type,
    text: part.text ?? "",
    messageID: part.messageID,
  });
}

export function flushAssistantOutput(
  base: string,
  msgId: string,
  sessionId: string,
  agent: string,
  timestamp?: string,
): void {
  const parts: PendingPart[] = [];
  for (const [id, p] of pendingParts) {
    if (p.messageID === msgId) {
      parts.push(p);
      pendingParts.delete(id);
    }
  }

  if (parts.length === 0) return;

  const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
  const reasoning = parts.filter((p) => p.type === "reasoning").map((p) => p.text).join("\n");
  if (!text && !reasoning) return;

  const ts = timestamp ?? new Date().toISOString();
  const record: Record<string, unknown> = {
    timestamp: ts,
    agent: agent ?? "unknown",
    session_id: sessionId ?? "",
    output: text,
  };
  if (reasoning) record.thinking = reasoning;

  appendJSONL(base, "session-logs", record);
}
