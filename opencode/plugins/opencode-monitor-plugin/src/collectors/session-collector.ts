import { appendJSONL } from "../storage/jsonl-writer.js";

interface ChatInput {
  sessionID?: string;
  agent?: string;
}

interface ChatOutput {
  message?: { role?: string; parts?: { type?: string; text?: string }[] };
  parts?: { type?: string; text?: string }[];
}

export function handleChatMessage(
  base: string,
  input: ChatInput,
  output: ChatOutput,
  timestamp?: string,
): void {
  const ts = timestamp ?? new Date().toISOString();

  const userParts = output.message?.parts ?? [];
  const userText = userParts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");

  const assistantParts = output.parts ?? [];
  const outputText = assistantParts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
  const thinkingText = assistantParts
    .filter((p) => p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("\n");

  const record: Record<string, unknown> = {
    timestamp: ts,
    agent: input.agent ?? "unknown",
    session_id: input.sessionID ?? "",
    input: userText,
    output: outputText,
  };
  if (thinkingText) record.thinking = thinkingText;

  appendJSONL(base, "session-logs", record);
}
