import type { PluginInput, Hooks } from "@opencode-ai/plugin";
import { getDataDir } from "./paths.js";
import { handleTokenEvent } from "./collectors/token-collector.js";
import { handleChatMessage } from "./collectors/session-collector.js";
import { buildTokenStatusOutput } from "./tools/token-status.js";

const MonitorPlugin = async (input: PluginInput): Promise<Hooks> => {
  const base = getDataDir();

  return {
    event: async ({ event }) => {
      handleTokenEvent(base, event as any);
    },

    "chat.message": async (inputMsg, output) => {
      handleChatMessage(base, inputMsg as any, output as any);
    },

    tool: {
      token_status: {
        description: "Show detailed token usage for the current or specified session",
        parameters: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "Session ID to inspect. Defaults to current." },
            include_children: { type: "boolean", description: "Include child sessions in aggregation." },
            agent_view: { type: "string", enum: ["execution", "initiator", "both"], description: "Agent view filter." },
            agent_sort: { type: "string", enum: ["cost", "tokens"], description: "Sort tables by cost (default) or tokens." },
            agent_top_n: { type: "number", description: "Show top N agents (default: 10). Use 0 to show all." },
            trend_days: { type: "number", description: "Days for trend analysis (default: 7)." },
            scope: { type: "string", enum: ["project", "all"], description: "Filter trends to project or all." },
            compact: { type: "boolean", description: "Skip heavy tables." },
            debug: { type: "boolean", description: "Include debug information." },
          },
          required: [],
        },
        execute: async (args: Record<string, unknown>) => {
          return buildTokenStatusOutput({
            session_id: args.session_id as string | undefined,
            include_children: args.include_children as boolean | undefined,
            agent_view: args.agent_view as string | undefined,
            agent_sort: args.agent_sort as string | undefined,
            agent_top_n: args.agent_top_n as number | undefined,
            trend_days: args.trend_days as number | undefined,
            scope: args.scope as string | undefined,
            compact: args.compact as boolean | undefined,
            debug: args.debug as boolean | undefined,
          });
        },
      } as any,
    },
  };
};

export default MonitorPlugin;
