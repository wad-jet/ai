import { queryTokenSummary, queryAgentBreakdown, queryDailyBreakdown, TokenSummary, AgentRow, DailyRow } from "../../queries/token-query.js";
import { getDataDir } from "../../paths.js";

export function runTokenStatusCLI(args: Record<string, string | boolean | number | undefined>): string {
  const base = getDataDir();
  const days = (args.trend_days as number) ?? 7;
  const topN = (args.agent_top_n as number) ?? 10;
  const sortBy = (args.agent_sort as "cost" | "tokens") ?? "cost";

  const summary = queryTokenSummary(base, days);
  let output = formatCLITokenTable(summary);

  if (args.daily) {
    const daily = queryDailyBreakdown(base, days);
    output += "\n" + formatDailyTable(daily);
  }

  const agents = queryAgentBreakdown(base, days, sortBy, topN);
  const agentTable = formatAgentTable(agents, summary.totalRows === 0);
  if (agentTable) output += "\n" + agentTable;

  return output;
}

export function formatCLITokenTable(summary: TokenSummary): string {
  if (summary.totalRows === 0) {
    return "No token data found.";
  }

  const lines: string[] = [];
  lines.push("Token Usage Summary");
  lines.push("═".repeat(50));
  lines.push(`  Total Input:     ${summary.totalInput.toLocaleString()}`);
  lines.push(`  Total Output:    ${summary.totalOutput.toLocaleString()}`);
  lines.push(`  Reasoning:       ${summary.totalReasoning.toLocaleString()}`);
  lines.push(`  Cache Read:      ${summary.totalCacheRead.toLocaleString()}`);
  lines.push(`  Cache Write:     ${summary.totalCacheWrite.toLocaleString()}`);
  lines.push(`  Total Cost:      $${summary.totalCost.toFixed(4)}`);
  lines.push(`  API Calls:       ${summary.totalRows}`);
  lines.push("");

  return lines.join("\n");
}

export function formatDailyTable(rows: DailyRow[]): string {
  if (rows.length === 0) return "";

  const lines: string[] = [];
  lines.push("Day Breakdown");
  lines.push("═".repeat(90));
  const header = "  Date         Calls    Input      Output     Reasoning  Cache R   Cache W   Cost";
  lines.push(header);
  lines.push("  " + "─".repeat(80));

  let totalInput = 0, totalOutput = 0, totalReasoning = 0;
  let totalCacheR = 0, totalCacheW = 0, totalCost = 0, totalHits = 0;

  for (const r of rows) {
    totalInput += r.input;
    totalOutput += r.output;
    totalReasoning += r.reasoning;
    totalCacheR += r.cacheRead;
    totalCacheW += r.cacheWrite;
    totalCost += r.cost;
    totalHits += r.hits;

    const date = r.date.padEnd(12);
    const hits = String(r.hits).padStart(5);
    const inp = r.input.toLocaleString().padStart(10);
    const out = r.output.toLocaleString().padStart(10);
    const reason = r.reasoning.toLocaleString().padStart(10);
    const cr = r.cacheRead.toLocaleString().padStart(8);
    const cw = r.cacheWrite.toLocaleString().padStart(8);
    const cost = `$${r.cost.toFixed(4)}`.padStart(9);
    lines.push(`  ${date} ${hits} ${inp} ${out} ${reason} ${cr} ${cw} ${cost}`);
  }

  lines.push("  " + "─".repeat(80));
  lines.push(
    `  Total:    ${String(totalHits).padStart(5)} ${totalInput.toLocaleString().padStart(10)} ${totalOutput.toLocaleString().padStart(10)} ${totalReasoning.toLocaleString().padStart(10)} ${totalCacheR.toLocaleString().padStart(8)} ${totalCacheW.toLocaleString().padStart(8)} ${`$${totalCost.toFixed(4)}`.padStart(9)}`,
  );

  return lines.join("\n");
}

export function formatAgentTable(agents: AgentRow[], noData: boolean): string {
  if (noData || agents.length === 0) return "";

  const lines: string[] = [];
  lines.push("Agent Breakdown");
  lines.push("═".repeat(70));
  const header = "  Agent         Calls    Input      Output     Cost";
  lines.push(header);
  lines.push("  " + "─".repeat(60));
  for (const a of agents) {
    const agent = a.agent.padEnd(14).slice(0, 14);
    const hits = String(a.hits).padStart(5);
    const inp = a.input.toLocaleString().padStart(10);
    const out = a.output.toLocaleString().padStart(10);
    const cost = `$${a.cost.toFixed(4)}`.padStart(10);
    lines.push(`  ${agent} ${hits} ${inp} ${out} ${cost}`);
  }

  return lines.join("\n");
}
