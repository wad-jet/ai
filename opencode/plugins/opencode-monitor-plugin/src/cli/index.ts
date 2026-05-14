#!/usr/bin/env node
import { runTokenStatusCLI } from "./commands/token-status.js";
import { runSessionLogCLI } from "./commands/session-log.js";

const args = process.argv.slice(2);
const command = args[0];

function parseArgs(args: string[]): Record<string, string | boolean | number | undefined> {
  const parsed: Record<string, string | boolean | number | undefined> = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const eqIdx = key.indexOf("=");
      if (eqIdx !== -1) {
        parsed[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        parsed[key] = args[++i];
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

function main(): void {
  switch (command) {
    case "token-status":
      console.log(runTokenStatusCLI(parseArgs(args)));
      break;
    case "session-log": {
      const sub = args[1];
      if (sub === "list") {
        console.log(runSessionLogCLI("list", {}));
      } else if (sub === "search") {
        const text = args.slice(2).join(" ");
        console.log(runSessionLogCLI("search", { searchText: text }));
      } else if (sub) {
        console.log(runSessionLogCLI("view", { sessionId: sub }));
      } else {
        console.log(runSessionLogCLI("help", {}));
      }
      break;
    }
    default:
      console.log(`Usage:
  opencode-monitor token-status [options]
  opencode-monitor session-log <session-id>
  opencode-monitor session-log list
  opencode-monitor session-log search <text>

Options for token-status:
  --session-id <id>     Session ID to inspect
  --include-children    Include child sessions
  --agent-view <view>   execution|initiator|both
  --agent-sort <sort>   cost|tokens
  --agent-top-n <n>     Show top N agents
  --trend-days <n>      Days for trend analysis
  --scope <scope>       project|all
  --compact             Skip heavy tables
  --debug               Debug info`);
  }
}

main();
