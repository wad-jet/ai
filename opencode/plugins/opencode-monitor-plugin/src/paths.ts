import { homedir } from "node:os";
import { join } from "node:path";

const PLUGIN_ROOT = "opencode-monitor-plugin";
const BASE = join(homedir(), ".local", "share", "opencode", PLUGIN_ROOT);

export function getDataDir(): string {
  return BASE;
}

export function getSubDir(sub: string): string {
  return join(BASE, sub);
}
