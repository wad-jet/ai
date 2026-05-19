import { readCSV } from "../storage/csv-writer.js";
import { TOKEN_STATUS } from "../constants.js";
const COL_COUNT = 11;
const COL = {
    TS: 0, AGENT: 1, SESSION: 2, PROVIDER: 3, MODEL: 4,
    IN: 5, OUT: 6, REASONING: 7, CACHE_R: 8, CACHE_W: 9, COST: 10,
};
function roundCost(cost) {
    return Math.round(cost * 1e6) / 1e6;
}
export function queryTokenSummary(base, days) {
    const rows = readCSV(base, TOKEN_STATUS, COL_COUNT, days);
    const summary = {
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
    summary.totalCost = roundCost(summary.totalCost);
    return summary;
}
export function queryDailyBreakdown(base, days) {
    const rows = readCSV(base, TOKEN_STATUS, COL_COUNT, days);
    const map = new Map();
    for (const row of rows) {
        const date = (row[COL.TS] ?? "").slice(0, 10);
        if (!date)
            continue;
        const entry = map.get(date) ?? { date, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0, hits: 0 };
        entry.input += Number(row[COL.IN]) || 0;
        entry.output += Number(row[COL.OUT]) || 0;
        entry.reasoning += Number(row[COL.REASONING]) || 0;
        entry.cacheRead += Number(row[COL.CACHE_R]) || 0;
        entry.cacheWrite += Number(row[COL.CACHE_W]) || 0;
        entry.cost += Number(row[COL.COST]) || 0;
        entry.hits++;
        map.set(date, entry);
    }
    for (const entry of map.values()) {
        entry.cost = roundCost(entry.cost);
    }
    const result = Array.from(map.values());
    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
}
export function queryAgentBreakdown(base, days, sortBy, topN) {
    const rows = readCSV(base, TOKEN_STATUS, COL_COUNT, days);
    const map = new Map();
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
        entry.cost = roundCost(entry.cost);
    }
    const result = Array.from(map.values());
    result.sort((a, b) => sortBy === "cost" ? b.cost - a.cost : (b.input + b.output) - (a.input + a.output));
    if (topN > 0)
        return result.slice(0, topN);
    return result;
}
