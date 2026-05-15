import type { PluginInput, Hooks } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { userInfo, homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDataDir } from "./paths.js";
import { handleTokenEvent } from "./collectors/token-collector.js";
import { handleChatMessage, handlePartUpdate, flushAssistantOutput } from "./collectors/session-collector.js";
import { createConfig, type Config } from "./config.js";
import { buildTokenStatusOutput } from "./tools/token-status.js";

// Copy command files to OpenCode config so /token-status shows up in autocomplete
function setupCommands(): void {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const pluginRoot = dirname(dirname(__filename)); // dist/ -> plugin root
    const srcCmd = join(pluginRoot, "commands", "token-status.md");
    const commandsDir = join(homedir(), ".config", "opencode", "command");
    const destCmd = join(commandsDir, "token-status.md");

    if (existsSync(srcCmd) && !existsSync(destCmd)) {
      mkdirSync(commandsDir, { recursive: true });
      copyFileSync(srcCmd, destCmd);
    }
  } catch {
    // Silent fail — commands are a nice-to-have
  }
}

const MonitorPlugin = async (input: PluginInput): Promise<Hooks> => {
  // Register /token-status slash command with OpenCode
  setupCommands();

  const base = getDataDir();
  const defaultAgent = (input.project as any)?.name ?? "unknown";
  const rootDir = input.directory ?? "";
  const username = userInfo().username;
  let opencodeVersion = "";
  try {
    opencodeVersion = execSync("opencode --version", { encoding: "utf-8" }).trim();
  } catch {}

  const projectId = (input.project as any)?.id;
  let gitBranch = "";
  try {
    gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
  } catch {}

  const config = createConfig((input as any).config as Partial<Config>);

  return {
    event: async ({ event }) => {
      handleTokenEvent(base, event as any);
      handlePartUpdate(base, event as any);
      const ev = event as any;
      if (ev.type === "message.updated" && ev.properties?.info?.role === "assistant" && ev.properties?.info?.tokens) {
        const info = ev.properties.info;
        const finishReason = info.finish;
        const mode = info.mode;
        const durationMs = info.time?.completed != null && info.time?.created != null ? info.time.completed - info.time.created : undefined;
        const error = info.error;
        const cwd = info.path?.cwd;
        flushAssistantOutput(base, info.id, info.sessionID, info.agent ?? defaultAgent, undefined, rootDir, username, info.providerID, info.modelID, opencodeVersion, finishReason, mode, durationMs, error, cwd, projectId, gitBranch, undefined, config);
      }
    },

    "chat.message": async (inputMsg, output) => {
      const model = (inputMsg as any).model;
      const parts = (output as any).parts ?? [];
      const skills = parts
        .filter((p: any) => p.type === "tool")
        .map((p: any) => p.tool)
        .filter((t: string) => t);
      const uniqueSkills = skills.length > 0 ? [...new Set(skills)] as string[] : undefined;
      handleChatMessage(base, inputMsg as any, output as any, undefined, rootDir, username, model?.providerID, model?.modelID, opencodeVersion, projectId, gitBranch, uniqueSkills, config);
    },

    tool: {
      token_status: tool({
        description: "Show detailed token usage for the current or specified session",
        args: {
          session_id: tool.schema.string().optional().describe("Session ID to inspect. Defaults to current."),
          include_children: tool.schema.boolean().optional().describe("Include child sessions in aggregation."),
          agent_view: tool.schema.enum(["execution", "initiator", "both"]).optional().describe("Agent view filter."),
          agent_sort: tool.schema.enum(["cost", "tokens"]).optional().describe("Sort tables by cost (default) or tokens."),
          agent_top_n: tool.schema.number().optional().describe("Show top N agents (default: 10). Use 0 to show all."),
          trend_days: tool.schema.number().optional().describe("Days for trend analysis (default: 7)."),
          scope: tool.schema.enum(["project", "all"]).optional().describe("Filter trends to project or all."),
          compact: tool.schema.boolean().optional().describe("Skip heavy tables."),
          debug: tool.schema.boolean().optional().describe("Include debug information."),
        },
        execute: async (args) => {
          return buildTokenStatusOutput({
            session_id: args.session_id,
            include_children: args.include_children,
            agent_view: args.agent_view,
            agent_sort: args.agent_sort,
            agent_top_n: args.agent_top_n,
            trend_days: args.trend_days,
            scope: args.scope,
            compact: args.compact,
            debug: args.debug,
          });
        },
      }),
    },
  };
};

export default MonitorPlugin;
