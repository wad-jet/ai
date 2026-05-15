import { appendJSONL } from "../storage/jsonl-writer.js";
import type { Config } from "../config.js";

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
  rootDir?: string,
  username?: string,
  providerId?: string,
  modelId?: string,
  opencodeVersion?: string,
  projectId?: string,
  gitBranch?: string,
  skills?: string[],
  config?: Config,
): void {
  const ts = timestamp ?? new Date().toISOString();
  const includeThinking = config?.includeThinking ?? false;

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
    session_id: input.sessionID ?? "",
    agent: input.agent ?? "unknown",
  };
  if (username) record.username = username;
  if (projectId) record.project_id = projectId;
  if (gitBranch) record.git_branch = gitBranch;
  if (rootDir) record.root_dir = rootDir;
  if (providerId) record.provider_id = providerId;
  if (modelId) record.model_id = modelId;
  if (opencodeVersion) record.opencode_version = opencodeVersion;
  if (!isUser && skills) {
    record.skills = skills;
  }
  if (isUser) {
    record.input = text;
  } else {
    record.output = text;
  }
  if (includeThinking && thinkingText) record.thinking = thinkingText;

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
  rootDir?: string,
  username?: string,
  providerId?: string,
  modelId?: string,
  opencodeVersion?: string,
  finishReason?: string,
  mode?: string,
  durationMs?: number,
  error?: Record<string, unknown>,
  cwd?: string,
  projectId?: string,
  gitBranch?: string,
  skills?: string[],
  config?: Config,
): void {
  const includeThinking = config?.includeThinking ?? false;
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
    session_id: sessionId ?? "",
    agent: agent ?? "unknown",
  };
  if (username) record.username = username;
  if (projectId) record.project_id = projectId;
  if (gitBranch) record.git_branch = gitBranch;
  if (rootDir) record.root_dir = rootDir;
  if (providerId) record.provider_id = providerId;
  if (modelId) record.model_id = modelId;
  if (opencodeVersion) record.opencode_version = opencodeVersion;
  record.output = text;
  if (mode) record.mode = mode;
  if (durationMs !== undefined) record.duration_ms = durationMs;
  if (finishReason) record.finish_reason = finishReason;
  if (error) record.error = error;
  if (cwd) record.cwd = cwd;
  if (includeThinking && reasoning) record.thinking = reasoning;
  if (skills) record.skills = skills;

  appendJSONL(base, "session-logs", record);
}
