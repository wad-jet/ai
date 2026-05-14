import { queryTokenSummary, queryAgentBreakdown, TokenSummary, AgentRow } from "../queries/token-query.js";
import { getDataDir } from "../paths.js";

interface FormatOptions {
  sessionId?: string;
  debug?: boolean;
  compact?: boolean;
}

export function formatTokenTable(
  summary: TokenSummary,
  agents: AgentRow[],
  opts?: FormatOptions,
): string {
  const lines: string[] = [];

  if (summary.totalRows === 0) {
    return "No token data found for the requested period.";
  }

  lines.push("## Token Usage Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Total Input Tokens | ${summary.totalInput.toLocaleString()} |`);
  lines.push(`| Total Output Tokens | ${summary.totalOutput.toLocaleString()} |`);
  lines.push(`| Reasoning Tokens | ${summary.totalReasoning.toLocaleString()} |`);
  lines.push(`| Cache Read | ${summary.totalCacheRead.toLocaleString()} |`);
  lines.push(`| Cache Write | ${summary.totalCacheWrite.toLocaleString()} |`);
  lines.push(`| **Total Cost** | **$${summary.totalCost.toFixed(4)}** |`);
  lines.push(`| Rows (API calls) | ${summary.totalRows} |`);
  lines.push("");

  if (!opts?.compact && agents.length > 0) {
    lines.push("### Agent Breakdown");
    lines.push("");
    lines.push("| Agent | Calls | Input | Output | Cost |");
    lines.push("|-------|-------|-------|--------|------|");
    for (const a of agents) {
      const costStr = `$${a.cost.toFixed(4)}`;
      lines.push(`| ${a.agent} | ${a.hits} | ${a.input.toLocaleString()} | ${a.output.toLocaleString()} | ${costStr} |`);
    }
    lines.push("");
  }

  if (opts?.sessionId) {
    lines.push(`> Session: \`${opts.sessionId}\``);
  }
  if (opts?.debug) {
    lines.push("");
    lines.push("### Debug Info");
    lines.push("- Data directory: `~/.local/share/opencode/opencode-monitor-plugin`");
    lines.push(`- Trend days: ${summary.totalRows} rows in period`);
  }

  return lines.join("\n");
}

export function buildTokenStatusOutput(args: {
  session_id?: string;
  include_children?: boolean;
  agent_view?: string;
  agent_sort?: string;
  agent_top_n?: number;
  trend_days?: number;
  scope?: string;
  compact?: boolean;
  debug?: boolean;
}): string {
  const base = getDataDir();
  const days = args.trend_days ?? 7;
  const topN = args.agent_top_n ?? 10;
  const sortBy = (args.agent_sort ?? "cost") as "cost" | "tokens";

  const summary = queryTokenSummary(base, days);
  const agents = queryAgentBreakdown(base, days, sortBy, topN);

  return formatTokenTable(summary, agents, {
    sessionId: args.session_id,
    debug: args.debug,
    compact: args.compact,
  });
}
