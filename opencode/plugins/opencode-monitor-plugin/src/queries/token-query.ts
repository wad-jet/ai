import { readCSV } from "../storage/csv-writer.js";

const COL_COUNT = 11;
const COL = {
  TS: 0, AGENT: 1, SESSION: 2, PROVIDER: 3, MODEL: 4,
  IN: 5, OUT: 6, REASONING: 7, CACHE_R: 8, CACHE_W: 9, COST: 10,
};

export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalReasoning: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalCost: number;
  totalRows: number;
}

export function queryTokenSummary(base: string, days: number): TokenSummary {
  const rows = readCSV(base, "token_status", COL_COUNT);
  const summary: TokenSummary = {
    totalInput: 0, totalOutput: 0, totalReasoning: 0,
    totalCacheRead: 0, totalCacheWrite: 0, totalCost: 0, totalRows: rows.length,
  };
  for (const row of rows) {
    summary.totalInput += Number(row[COL.IN]) || 0;
    summary.totalOutput += Number(row[COL.OUT]) || 0;
    summary.totalReasoning += Number(row[COL.REASONING]) || 0;
    summary.totalCacheRead += Number(row[COL.CACHE_R]) || 0;
    summary.totalCacheWrite += Number(row[COL.CACHE_W]) || 0;
    summary.totalCost += Number(row[COL.COST]) || 0;
  }
  summary.totalCost = Math.round(summary.totalCost * 1e6) / 1e6;
  return summary;
}

export interface AgentRow {
  agent: string;
  input: number;
  output: number;
  cost: number;
  hits: number;
}

export function queryAgentBreakdown(
  base: string,
  days: number,
  sortBy: "cost" | "tokens",
  topN: number,
): AgentRow[] {
  const rows = readCSV(base, "token_status", COL_COUNT);
  const map = new Map<string, AgentRow>();
  for (const row of rows) {
    const agent = row[COL.AGENT] || "unknown";
    const entry = map.get(agent) ?? { agent, input: 0, output: 0, cost: 0, hits: 0 };
    entry.input += Number(row[COL.IN]) || 0;
    entry.output += Number(row[COL.OUT]) || 0;
    entry.cost += Number(row[COL.COST]) || 0;
    entry.hits++;
    map.set(agent, entry);
  }
  for (const entry of map.values()) {
    entry.cost = Math.round(entry.cost * 1e6) / 1e6;
  }
  const result = Array.from(map.values());
  result.sort((a, b) => sortBy === "cost" ? b.cost - a.cost : (b.input + b.output) - (a.input + a.output));
  if (topN > 0) return result.slice(0, topN);
  return result;
}
