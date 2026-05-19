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
  _ts: number;       // timestamp for TTL cleanup
  type: string;
  text: string;
  messageID: string;
}

const pendingParts = new Map<string, PendingPart>();

export interface HandleChatMessageOptions {
  base: string;
  input: ChatInput;
  output: ChatOutput;
  timestamp?: string;
  rootDir?: string;
  username?: string;
  providerId?: string;
  modelId?: string;
  opencodeVersion?: string;
  projectId?: string;
  gitBranch?: string;
  skills?: string[];
  config?: Config;
}

export function handleChatMessage(options: HandleChatMessageOptions): void {
  const ts = options.timestamp ?? new Date().toISOString();
  const includeThinking = options.config?.includeThinking ?? false;

  const parts = options.output.parts ?? [];
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
  const thinkingText = parts
    .filter((p) => p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("\n");

  const isUser = options.output.message?.role === "user";

  const record: Record<string, unknown> = {
    timestamp: ts,
    session_id: options.input.sessionID ?? "",
    agent: options.input.agent ?? "unknown",
  };
  if (options.username) record.username = options.username;
  if (options.projectId) record.project_id = options.projectId;
  if (options.gitBranch) record.git_branch = options.gitBranch;
  if (options.rootDir) record.root_dir = options.rootDir;
  if (options.providerId) record.provider_id = options.providerId;
  if (options.modelId) record.model_id = options.modelId;
  if (options.opencodeVersion) record.opencode_version = options.opencodeVersion;
  if (!isUser && options.skills) {
    record.skills = options.skills;
  }
  if (isUser) {
    record.input = text;
  } else {
    record.output = text;
  }
  if (includeThinking && thinkingText) record.thinking = thinkingText;

  appendJSONL(options.base, "session-logs", record);
}

const PART_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function handlePartUpdate(
  base: string,
  event: { properties?: { part?: { id?: string; type?: string; text?: string; messageID?: string; time?: { end?: number } } } },
): void {
  const part = event.properties?.part;
  if (!part?.type || !part.id || !part.messageID) return;
  if (!part.time?.end) return;

  // Clean stale entries on each insert to prevent memory leak
  const now = Date.now();
  for (const [id, p] of pendingParts) {
    if (p._ts && now - p._ts > PART_TTL_MS) {
      pendingParts.delete(id);
    }
  }

  pendingParts.set(part.id, {
    _ts: now,
    type: part.type,
    text: part.text ?? "",
    messageID: part.messageID,
  });
}

export interface FlushAssistantOutputOptions {
  base: string;
  msgId: string;
  sessionId: string;
  agent: string;
  timestamp?: string;
  rootDir?: string;
  username?: string;
  providerId?: string;
  modelId?: string;
  opencodeVersion?: string;
  finishReason?: string;
  mode?: string;
  durationMs?: number;
  error?: Record<string, unknown>;
  cwd?: string;
  projectId?: string;
  gitBranch?: string;
  skills?: string[];
  config?: Config;
}

export function flushAssistantOutput(options: FlushAssistantOutputOptions): void {
  const {
    base, msgId, sessionId, agent, timestamp,
    rootDir, username, providerId, modelId, opencodeVersion,
    finishReason, mode, durationMs, error, cwd,
    projectId, gitBranch, skills, config,
  } = options;
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
