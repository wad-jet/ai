import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
export const ConfigSchema = z.object({
    includeThinking: z.boolean().default(false),
});
export function createConfig(input) {
    return ConfigSchema.parse(input ?? {});
}
const CONFIG_FILE = join(homedir(), ".config", "opencode", "opencode-monitor-plugin.json");
export function loadPluginConfig() {
    if (!existsSync(CONFIG_FILE))
        return createConfig({});
    try {
        const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
        return createConfig(raw);
    }
    catch {
        return createConfig({});
    }
}
