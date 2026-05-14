import type { PluginInput, Hooks } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import { getDataDir } from "./paths.js";
import { handleTokenEvent } from "./collectors/token-collector.js";
import { handleChatMessage, handlePartUpdate, flushAssistantOutput } from "./collectors/session-collector.js";
import { buildTokenStatusOutput } from "./tools/token-status.js";

const MonitorPlugin = async (input: PluginInput): Promise<Hooks> => {
  const base = getDataDir();
  const defaultAgent = (input.project as any)?.name ?? "unknown";

  return {
    event: async ({ event }) => {
      handleTokenEvent(base, event as any);
      handlePartUpdate(base, event as any);
      const ev = event as any;
      if (ev.type === "message.updated" && ev.properties?.info?.role === "assistant" && ev.properties?.info?.tokens) {
        flushAssistantOutput(base, ev.properties.info.id, ev.properties.info.sessionID, ev.properties.info.agent ?? defaultAgent);
      }
    },

    "chat.message": async (inputMsg, output) => {
      handleChatMessage(base, inputMsg as any, output as any);
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
