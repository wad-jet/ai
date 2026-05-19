import { homedir } from "node:os";
import { join } from "node:path";
const PLUGIN_ROOT = "opencode-monitor-plugin";
const BASE = join(homedir(), ".local", "share", "opencode", PLUGIN_ROOT);
export function getDataDir() {
    return BASE;
}
