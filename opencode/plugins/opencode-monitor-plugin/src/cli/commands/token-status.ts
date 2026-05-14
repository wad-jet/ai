import { queryTokenSummary, queryAgentBreakdown, TokenSummary, AgentRow } from "../../queries/token-query.js";
import { getDataDir } from "../../paths.js";

export function runTokenStatusCLI(args: Record<string, string | boolean | number | undefined>): string {
  const base = getDataDir();
  const days = (args.trend_days as number) ?? 7;
  const topN = (args.agent_top_n as number) ?? 10;
  const sortBy = (args.agent_sort as "cost" | "tokens") ?? "cost";

  const summary = queryTokenSummary(base, days);
  const agents = queryAgentBreakdown(base, days, sortBy, topN);

  return formatCLITokenTable(summary, agents);
}

export function formatCLITokenTable(summary: TokenSummary, agents: AgentRow[]): string {
  const lines: string[] = [];

  if (summary.totalRows === 0) {
    return "No token data found.";
  }

  lines.push("Token Usage Summary");
  lines.push("\u2550".repeat(50));
  lines.push(`  Total Input:     ${summary.totalInput.toLocaleString()}`);
  lines.push(`  Total Output:    ${summary.totalOutput.toLocaleString()}`);
  lines.push(`  Reasoning:       ${summary.totalReasoning.toLocaleString()}`);
  lines.push(`  Cache Read:      ${summary.totalCacheRead.toLocaleString()}`);
  lines.push(`  Cache Write:     ${summary.totalCacheWrite.toLocaleString()}`);
  lines.push(`  Total Cost:      $${summary.totalCost.toFixed(4)}`);
  lines.push(`  API Calls:       ${summary.totalRows}`);
  lines.push("");

  if (agents.length > 0) {
    lines.push("Agent Breakdown");
    lines.push("\u2550".repeat(70));
    const header = "  Agent         Calls    Input      Output     Cost";
    lines.push(header);
    lines.push("  " + "\u2500".repeat(60));
    for (const a of agents) {
      const agent = a.agent.padEnd(14).slice(0, 14);
      const hits = String(a.hits).padStart(5);
      const inp = a.input.toLocaleString().padStart(10);
      const out = a.output.toLocaleString().padStart(10);
      const cost = `$${a.cost.toFixed(4)}`.padStart(10);
      lines.push(`  ${agent} ${hits} ${inp} ${out} ${cost}`);
    }
  }

  return lines.join("\n");
}
