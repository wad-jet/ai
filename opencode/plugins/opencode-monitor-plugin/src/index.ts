import type { PluginInput, Hooks } from "@opencode-ai/plugin";

export default async function MonitorPlugin(input: PluginInput): Promise<Hooks> {
  return {
    event: async () => {},
    "chat.message": async () => {},
    tool: {},
  };
}
