#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runTokenStatusCLI } from "./commands/token-status.js";
import { runSessionLogCLI } from "./commands/session-log.js";
import { runCleanupCLI } from "./commands/cleanup.js";
import { getDataDir } from "../paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));
const VERSION = pkg.version as string;

const args = process.argv.slice(2);
const command = args[0];

if (args.includes("--version") || args.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}

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

async function main(): Promise<void> {
  const base = getDataDir();
  switch (command) {
    case "token-status":
      console.log(runTokenStatusCLI(parseArgs(args)));
      break;
    case "session-log": {
      const sub = args[1];
      const opts = parseArgs(args);
      
      if (sub === "list") {
        console.log(runSessionLogCLI("list", {}, base));
      } else if (sub === "search") {
        const text = args.slice(2).join(" ");
        console.log(runSessionLogCLI("search", { searchText: text }, base));
      } else if (sub) {
        const filters = {
          sessionId: sub,
          date: opts.date as string | undefined,
          since: opts.since as string | undefined,
          until: opts.until as string | undefined,
          agent: opts.agent as string | undefined,
          field: (opts.field as "input" | "output" | "thinking" | "all") || "all",
          tail: opts.tail as number | undefined,
          error: opts.error === true,
        };
        console.log(runSessionLogCLI("view", filters, base));
      } else {
        console.log(runSessionLogCLI("help", {}, base));
      }
      break;
    }
    case "cleanup": {
      const opts = parseArgs(args);
      const days = Number(opts["days"] ?? NaN);
      if (isNaN(days) || days < 0) {
        console.log("Error: --days must be a non-negative number.");
        return;
      }
      const result = await runCleanupCLI({
        days,
        sessionLogs: opts["session-logs"] === true,
        tokenStatus: opts["token-status"] === true,
        dryRun: opts["dry-run"] === true,
      });
      console.log(result);
      break;
    }
    default:
      console.log(`Usage:
  opencode-monitor --version
  opencode-monitor token-status [options]
  opencode-monitor session-log <session-id> [options]
  opencode-monitor session-log list
  opencode-monitor session-log search <text>
  opencode-monitor cleanup --days <N> [--session-logs] [--token-status] [--dry-run]

  opencode-monitor v${VERSION}

Options for token-status:
  --session-id <id>     Session ID to inspect
  --include-children    Include child sessions
  --agent-view <view>   execution|initiator|both
  --agent-sort <sort>   cost|tokens
  --agent-top-n <n>     Show top N agents
  --trend-days <n>      Days for trend analysis
  --scope <scope>       project|all
  --compact             Skip heavy tables
  --debug               Debug info

Options for session-log:
  --date <YYYY-MM-DD>   Filter by specific date
  --since <YYYY-MM-DD>  Filter from date (inclusive)
  --until <YYYY-MM-DD>  Filter until date (inclusive)
  --agent <name>        Filter by agent name
  --field <field>       Field to show: input|output|thinking|all
  --tail <N>            Show last N records
  --error               Show only records with errors

Options for cleanup:
  --days <N>            Delete data older than N days (required)
  --session-logs        Delete only session logs
  --token-status        Delete only token metrics
  --dry-run             Preview without deleting`);
  }
}

main().catch(console.error);
